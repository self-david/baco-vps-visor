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
[[ -r /dev/tty ]] || { echo "Se requiere un terminal interactivo para introducir la contraseña." >&2; exit 1; }
docker service inspect "${SERVICE_NAME}" >/dev/null
docker secret inspect "${ADMIN_SECRET}" >/dev/null

read -r -s -p "Nueva contraseña de administrador (mínimo 16 caracteres): " ADMIN_PASSWORD </dev/tty
printf '\n' >/dev/tty
read -r -s -p "Confirma la nueva contraseña: " ADMIN_PASSWORD_CONFIRM </dev/tty
printf '\n' >/dev/tty

if [[ "${ADMIN_PASSWORD}" != "${ADMIN_PASSWORD_CONFIRM}" ]]; then
  echo "Las contraseñas no coinciden." >&2
  exit 1
fi
if (( ${#ADMIN_PASSWORD} < 16 )); then
  echo "La contraseña de administrador debe tener al menos 16 caracteres." >&2
  exit 1
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
