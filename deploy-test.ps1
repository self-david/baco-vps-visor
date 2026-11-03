$ErrorActionPreference = "Stop"

$server = "baco@192.168.100.156"
$projectDirectory = $PSScriptRoot
$deploymentId = [guid]::NewGuid().ToString("N")
$localStageDirectory = Join-Path $env:TEMP "vps-manager-deploy-$deploymentId"
$remoteStageDirectory = "/tmp/vps-manager-deploy-$deploymentId"

function Copy-ProjectFiles {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  foreach ($item in Get-ChildItem -LiteralPath $Source -Force) {
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
      continue
    }
    if ($item.Name -eq "password-test.txt") {
      continue
    }
    if ($item.PSIsContainer -and $item.Name -in @(".git", "node_modules")) {
      continue
    }

    $target = Join-Path $Destination $item.Name
    if ($item.PSIsContainer) {
      Copy-ProjectFiles -Source $item.FullName -Destination $target
    } else {
      Copy-Item -LiteralPath $item.FullName -Destination $target
    }
  }
}

if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  throw "No se encontró scp. Instala el cliente OpenSSH de Windows."
}
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "No se encontró ssh. Instala el cliente OpenSSH de Windows."
}

try {
  Copy-ProjectFiles -Source $projectDirectory -Destination $localStageDirectory

  Write-Host "Copiando el proyecto (sin .git ni node_modules) a ${server}:${remoteStageDirectory} ..."
  & scp -r $localStageDirectory "${server}:/tmp/"
  if ($LASTEXITCODE -ne 0) {
    $scpExitCode = $LASTEXITCODE
    try {
      & ssh $server "rm -rf -- '$remoteStageDirectory'"
    } catch {
      Write-Warning "No se pudo limpiar el directorio temporal parcial del VPS."
    }
    throw "Falló la copia del proyecto por SCP (código $scpExitCode)."
  }

  $remoteCommand = "set -Eeuo pipefail; trap 'rm -rf -- `"$remoteStageDirectory`"' EXIT; python3 '$remoteStageDirectory/installer/normalize-shell-scripts.py'; sudo env VPS_MANAGER_SOURCE_DIR='$remoteStageDirectory' VPS_MANAGER_TEST_MODE=true VPS_MANAGER_DOMAIN=192.168.100.156 bash '$remoteStageDirectory/install.sh'"
  Write-Host "Conectando al VPS, normalizando los scripts y ejecutando la instalación..."
  & ssh -tt $server $remoteCommand
  if ($LASTEXITCODE -ne 0) {
    throw "La instalación remota terminó con error (código $LASTEXITCODE). Vuelve a ejecutar este script; conserva la salida de SSH para diagnosticar el fallo."
  }
} finally {
  if (Test-Path -LiteralPath $localStageDirectory) {
    Remove-Item -LiteralPath $localStageDirectory -Recurse -Force
  }
}
