$ErrorActionPreference = "Stop"

$server = "baco@192.168.100.156"
$projectDirectory = $PSScriptRoot

if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  throw "No se encontró scp. Instala el cliente OpenSSH de Windows."
}
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "No se encontró ssh. Instala el cliente OpenSSH de Windows."
}

Write-Host "Copiando el proyecto a ${server}:/tmp/vps-installer ..."
& scp -r $projectDirectory "${server}:/tmp/"
if ($LASTEXITCODE -ne 0) {
  throw "Falló la copia del proyecto por SCP (código $LASTEXITCODE)."
}

$remoteCommand = "sudo python3 /tmp/vps-installer/installer/normalize-shell-scripts.py && sudo env VPS_MANAGER_TEST_MODE=true VPS_MANAGER_DOMAIN=192.168.100.156 bash /tmp/vps-installer/install.sh"
Write-Host "Conectando al VPS, normalizando los scripts y ejecutando la instalación..."
& ssh -tt $server $remoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "La instalación remota terminó con error (código $LASTEXITCODE). Vuelve a ejecutar este script; conserva la salida de SSH para diagnosticar el fallo."
}
