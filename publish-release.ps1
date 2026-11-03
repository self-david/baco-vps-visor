param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Version
)

$ErrorActionPreference = "Stop"
$repositoryDirectory = $PSScriptRoot
$versionFile = Join-Path $repositoryDirectory "apps\manager\VERSION"

function Invoke-Git {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & git -C $repositoryDirectory @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($exitCode -ne 0) {
    throw "Falló git $($Arguments -join ' ')`n$($output -join "`n")"
  }
  return $output
}

function Test-GitAncestor {
  param(
    [Parameter(Mandatory = $true)][string]$Ancestor,
    [Parameter(Mandatory = $true)][string]$Commit
  )

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & git -C $repositoryDirectory merge-base --is-ancestor $Ancestor $Commit 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($exitCode -gt 1) {
    throw "No se pudo comparar $Ancestor con $Commit.`n$($output -join "`n")"
  }
  return $exitCode -eq 0
}

if ($Version -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') {
  throw "La versión debe tener formato semver estable, por ejemplo: 0.1.2"
}
if (-not (Test-Path -LiteralPath $versionFile -PathType Leaf)) {
  throw "No se encontró apps\manager\VERSION en $repositoryDirectory."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "No se encontró git en PATH."
}

$branch = (Invoke-Git -Arguments @("branch", "--show-current") | Select-Object -First 1).Trim()
if ($branch -ne "main") {
  throw "Publica desde la rama main; la rama actual es '$branch'."
}

$dirtyFiles = Invoke-Git -Arguments @("status", "--porcelain", "--untracked-files=all")
if ($dirtyFiles.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$dirtyFiles)) {
  throw "Hay cambios locales sin confirmar. Confírmalos o guárdalos antes de publicar:`n$($dirtyFiles -join "`n")"
}

Invoke-Git -Arguments @("fetch", "origin", "main", "--tags") | Out-Null
if (-not (Test-GitAncestor -Ancestor "origin/main" -Commit "HEAD")) {
  throw "La rama main local no contiene todos los cambios de origin/main. Integra los cambios remotos antes de publicar."
}

$currentVersion = (Get-Content -LiteralPath $versionFile -Raw).Trim()
if ($currentVersion -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') {
  throw "apps\manager\VERSION no contiene una versión semver estable válida: '$currentVersion'."
}
if ([version]$Version -lt [version]$currentVersion) {
  throw "La versión solicitada ($Version) no puede ser menor que la versión de apps\manager\VERSION ($currentVersion)."
}

$existingTags = @(Invoke-Git -Arguments @("tag", "--list", "v*"))
$remoteTags = @(Invoke-Git -Arguments @("ls-remote", "--tags", "--refs", "origin", "refs/tags/v*"))
$allTags = @($existingTags) + @($remoteTags | ForEach-Object {
  if ($_ -match '\s(refs/tags/.*)$') { $Matches[1] -replace '^refs/tags/', '' }
})
$tag = "v$Version"
if ($allTags -contains $tag) {
  throw "El tag $tag ya existe localmente o en origin; las releases publicadas no se deben reutilizar."
}

$highestVersion = [version]$currentVersion
foreach ($existingTag in $allTags) {
  if ([string]$existingTag -match '^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') {
    $tagVersion = [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"
    if ($tagVersion -gt $highestVersion) {
      $highestVersion = $tagVersion
    }
  }
}
if ([version]$Version -le $highestVersion) {
  throw "La versión debe ser mayor que la versión más alta etiquetada ($highestVersion)."
}

if ([version]$Version -gt [version]$currentVersion) {
  Set-Content -LiteralPath $versionFile -Value $Version -NoNewline -Encoding ascii
  Invoke-Git -Arguments @("add", "--", "apps/manager/VERSION") | Out-Null
  Invoke-Git -Arguments @("commit", "-m", "chore: prepare release $tag") | Out-Null
}
Invoke-Git -Arguments @("push", "origin", "HEAD:main") | Out-Null
Invoke-Git -Arguments @("tag", "-a", $tag, "-m", "Release $tag") | Out-Null
Invoke-Git -Arguments @("push", "origin", "refs/tags/$tag") | Out-Null

Write-Host "Tag $tag publicado. GitHub Actions generará la release; verifica su resultado en la pestaña Actions."
