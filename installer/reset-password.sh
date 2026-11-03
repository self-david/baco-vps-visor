#!/usr/bin/env bash
set -Eeuo pipefail

readonly SERVICE_NAME="vps-manager_manager"
readonly ADMIN_SECRET="vps_manager_admin_credentials"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta como root: sudo vps-manager-reset-password" >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || { echo "Docker no está instalado." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 no está instalado." >&2; exit 1; }
docker service inspect "${SERVICE_NAME}" >/dev/null
docker secret inspect "${ADMIN_SECRET}" >/dev/null

if [[ "${1:-}" == "--password-file" && "$#" -eq 2 ]]; then
  [[ -f "$2" && -r "$2" ]] || { echo "El archivo de contraseña no existe o no se puede leer." >&2; exit 1; }
  ADMIN_PASSWORD="$(python3 - "$2" <<'PY'
from pathlib import Path
import sys

content = Path(sys.argv[1]).read_bytes()
if content.endswith(b"\r\n"):
    content = content[:-2]
elif content.endswith(b"\n"):
    content = content[:-1]
if not content or any(character in content for character in (b"\n", b"\r", b"\0")):
    raise SystemExit("El archivo debe contener una contraseña en una sola línea.")
try:
    password = content.decode("utf-8-sig")
except UnicodeDecodeError as error:
    raise SystemExit("El archivo de contraseña debe estar codificado en UTF-8.") from error
if len(password) < 16 or len(password.encode("utf-16-le")) // 2 > 1024:
    raise SystemExit("La contraseña debe tener entre 16 y 1024 caracteres.")
sys.stdout.write(password)
PY
)"
  [[ -n "${ADMIN_PASSWORD}" ]] || { echo "El archivo de contraseña está vacío." >&2; exit 1; }
  unset ADMIN_PASSWORD_CONFIRM
elif [[ "$#" -eq 0 ]]; then
  [[ -r /dev/tty ]] || { echo "Se requiere un terminal interactivo para introducir la contraseña." >&2; exit 1; }
  read -r -s -p "Nueva contraseña de administrador (mínimo 16 caracteres): " ADMIN_PASSWORD </dev/tty
  printf '\n' >/dev/tty
  read -r -s -p "Confirma la nueva contraseña: " ADMIN_PASSWORD_CONFIRM </dev/tty
  printf '\n' >/dev/tty

  if [[ "${ADMIN_PASSWORD}" != "${ADMIN_PASSWORD_CONFIRM}" ]]; then
    echo "Las contraseñas no coinciden." >&2
    exit 1
  fi
  if (( ${#ADMIN_PASSWORD} < 16 || ${#ADMIN_PASSWORD} > 1024 )); then
    echo "La contraseña debe tener entre 16 y 1024 caracteres." >&2
    exit 1
  fi
else
  echo "Uso: vps-manager-reset-password [--password-file ARCHIVO]" >&2
  exit 2
fi

CREDENTIAL_FILE="$(mktemp)"
TEMP_SECRET="vps_manager_admin_credentials_$(openssl rand -hex 6)"
cleanup() {
  rm -f -- "${CREDENTIAL_FILE}"
}
trap cleanup EXIT
chmod 0600 "${CREDENTIAL_FILE}"
printf '%s' "${ADMIN_PASSWORD}" | python3 -c 'import hashlib, secrets, sys; password=sys.stdin.buffer.read(); salt=secrets.token_bytes(16); digest=hashlib.scrypt(password, salt=salt, n=16384, r=8, p=1, dklen=64); print(salt.hex()+":"+digest.hex())' > "${CREDENTIAL_FILE}"
unset ADMIN_PASSWORD ADMIN_PASSWORD_CONFIRM

docker secret create "${TEMP_SECRET}" "${CREDENTIAL_FILE}" >/dev/null
docker service update --detach=false \
  --secret-rm "${ADMIN_SECRET}" \
  --secret-add "source=${TEMP_SECRET},target=admin_credentials" \
  "${SERVICE_NAME}"

docker secret rm "${ADMIN_SECRET}"
docker secret create "${ADMIN_SECRET}" "${CREDENTIAL_FILE}" >/dev/null
docker service update --detach=false \
  --secret-rm "${TEMP_SECRET}" \
  --secret-add "source=${ADMIN_SECRET},target=admin_credentials" \
  "${SERVICE_NAME}"
docker secret rm "${TEMP_SECRET}"

echo "Contraseña de administrador actualizada."
