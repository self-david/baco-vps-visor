param(
  [Parameter(Position = 0)]
  [string]$PasswordFile,
  [string]$Server = "baco@192.168.100.158"
)

$ErrorActionPreference = "Stop"

$transferId = [guid]::NewGuid().ToString("N")
$remoteDirectory = "/tmp/vps-manager-password-reset-$transferId"
$localStageDirectory = Join-Path $env:TEMP "vps-manager-password-reset-$transferId"
$remoteDirectoryCreated = $false

if ($Server -notmatch '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$') {
  throw "El servidor debe tener el formato usuario@host."
}
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  throw "No se encontró scp. Instala el cliente OpenSSH de Windows."
}
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "No se encontró ssh. Instala el cliente OpenSSH de Windows."
}

if ($PasswordFile) {
  $PasswordFile = (Resolve-Path -LiteralPath $PasswordFile).Path
  $passwordFileInfo = Get-Item -LiteralPath $PasswordFile
  if ($passwordFileInfo.PSIsContainer -or $passwordFileInfo.Length -gt 4096) {
    throw "El archivo debe ser un archivo de texto de hasta 4 KiB."
  }
}

try {
  New-Item -ItemType Directory -Path $localStageDirectory -Force | Out-Null
  $resetScript = [System.IO.File]::ReadAllText(
    (Join-Path $PSScriptRoot "installer\reset-password.sh"),
    [System.Text.Encoding]::UTF8
  )
  $resetScript = $resetScript.Replace("`r`n", "`n")
  $stagedScript = Join-Path $localStageDirectory "reset-password.sh"
  [System.IO.File]::WriteAllText(
    $stagedScript,
    $resetScript,
    [System.Text.UTF8Encoding]::new($false)
  )

  Write-Host "Preparando la actualización de contraseña en ${server} ..."
  & ssh $server "umask 077; mkdir -m 700 -- '$remoteDirectory'"
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo crear el directorio temporal seguro en el VPS (código $LASTEXITCODE)."
  }
  $remoteDirectoryCreated = $true

  & scp $stagedScript "${server}:$remoteDirectory/"
  if ($LASTEXITCODE -ne 0) {
    throw "Falló la copia del helper de contraseña por SCP (código $LASTEXITCODE)."
  }

  $passwordArgument = ""
  if ($PasswordFile) {
    Write-Warning "Modo temporal de pruebas: el archivo contiene la contraseña en texto plano. No lo compartas ni lo subas al repositorio."
    & scp $PasswordFile "${server}:$remoteDirectory/password.txt"
    if ($LASTEXITCODE -ne 0) {
      throw "Falló la copia del archivo temporal de contraseña por SCP (código $LASTEXITCODE)."
    }
    $passwordArgument = " --password-file '$remoteDirectory/password.txt'"
  }

  $remoteCommand = "set -Eeuo pipefail; trap 'rm -rf -- `"$remoteDirectory`"' EXIT; sudo install -m 0755 '$remoteDirectory/reset-password.sh' /usr/local/bin/vps-manager-reset-password; sudo /usr/local/bin/vps-manager-reset-password$passwordArgument"
  if ($PasswordFile) {
    Write-Host "Actualizando la contraseña desde el archivo temporal protegido..."
  } else {
    Write-Host "Conectando al VPS para introducir y confirmar la nueva contraseña..."
  }
  & ssh -tt $server $remoteCommand
  if ($LASTEXITCODE -ne 0) {
    throw "El cambio de contraseña terminó con error (código $LASTEXITCODE)."
  }
  $remoteDirectoryCreated = $false
} finally {
  if ($remoteDirectoryCreated) {
    try {
      & ssh $server "rm -rf -- '$remoteDirectory'"
      if ($LASTEXITCODE -ne 0) {
        Write-Warning "No se pudo limpiar el directorio temporal de transferencia en el VPS."
      }
    } catch {
      Write-Warning "No se pudo limpiar el directorio temporal de transferencia en el VPS."
    }
  }
  if (Test-Path -LiteralPath $localStageDirectory) {
    Remove-Item -LiteralPath $localStageDirectory -Recurse -Force
  }
}
