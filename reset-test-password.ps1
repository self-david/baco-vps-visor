$ErrorActionPreference = "Stop"

$server = "baco@192.168.100.156"
$projectDirectory = $PSScriptRoot

if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  throw "OpenSSH scp was not found."
}
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "OpenSSH ssh was not found."
}

Write-Host "Copying the password reset helper to ${server} ..."
& scp -r $projectDirectory "${server}:/tmp/"
if ($LASTEXITCODE -ne 0) {
  throw "SCP failed with exit code $LASTEXITCODE."
}

$remoteCommand = "sudo python3 /tmp/vps-installer/installer/normalize-shell-scripts.py && sudo install -m 0755 /tmp/vps-installer/installer/reset-password.sh /usr/local/bin/vps-manager-reset-password && sudo /usr/local/bin/vps-manager-reset-password"
Write-Host "Connecting to the VPS to reset the panel password..."
& ssh -tt $server $remoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "Password reset failed with exit code $LASTEXITCODE."
}
