#!/usr/bin/env bash
set -Eeuo pipefail

readonly INSTALL_DIR="/opt/vps-manager"
readonly STACK_NAME="vps-manager"
readonly DEFAULT_REPOSITORY_URL="__CONFIGURE_GIT_REPOSITORY_URL_BEFORE_PUBLISHING__"
readonly RELEASE_REF="v0.1.0"

ADMIN_PASSWORD_INPUT="${VPS_MANAGER_ADMIN_PASSWORD:-}"
unset VPS_MANAGER_ADMIN_PASSWORD

log() { printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
prompt_value() {
  local prompt_text="$1"
  local variable_name="$2"
  local silent="${3:-false}"
  [[ -r /dev/tty ]] || fail "Se requiere un terminal para responder. Define las variables VPS_MANAGER_DOMAIN, VPS_MANAGER_EMAIL y, para una instalación no interactiva, VPS_MANAGER_ADMIN_PASSWORD."
  if [[ "${silent}" == "true" ]]; then
    read -r -s -p "${prompt_text}" "${variable_name}" </dev/tty
    printf '\n' >/dev/tty
  else
    read -r -p "${prompt_text}" "${variable_name}" </dev/tty
  fi
}
TEMP_FILES=()
cleanup() {
  for temporary_file in "${TEMP_FILES[@]}"; do
    [[ -z "${temporary_file}" ]] || rm -f -- "${temporary_file}"
  done
}
on_error() {
  local line="$1"
  printf 'ERROR: instalación interrumpida en la línea %s. Revisa los mensajes anteriores y ejecuta el diagnóstico.\n' "${line}" >&2
}
trap 'cleanup; on_error "$LINENO"' ERR
trap cleanup EXIT

[[ "${EUID}" -eq 0 ]] || fail "Ejecuta como root: curl -fsSL <URL>/install.sh | sudo bash"
command -v apt-get >/dev/null 2>&1 || fail "Este instalador solo admite Ubuntu Server 24.04 LTS."
command -v ss >/dev/null 2>&1 || fail "No se encontró ss (iproute2); instala iproute2 y vuelve a intentar."
[[ -r /etc/os-release ]] || fail "No se pudo identificar el sistema operativo."
. /etc/os-release
[[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]] || fail "Sistema no compatible. Se requiere Ubuntu 24.04 LTS."

case "$(uname -m)" in
  x86_64) DOCKER_ARCH="amd64" ;;
  aarch64) DOCKER_ARCH="arm64" ;;
  *) fail "Arquitectura no compatible: $(uname -m)." ;;
esac

TEST_MODE="${VPS_MANAGER_TEST_MODE:-false}"
[[ "${TEST_MODE}" == "true" || "${TEST_MODE}" == "false" ]] || fail "VPS_MANAGER_TEST_MODE solo admite true o false."
DOMAIN="${VPS_MANAGER_DOMAIN:-}"
EMAIL="${VPS_MANAGER_EMAIL:-}"

if [[ "${TEST_MODE}" == "true" ]]; then
  if [[ -z "${DOMAIN}" ]]; then
    prompt_value "IP privada del panel (ejemplo: 192.168.1.10): " DOMAIN
  fi
  [[ "${DOMAIN}" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] || fail "El modo de prueba requiere una dirección IPv4 privada."
  IFS=. read -r -a IP_OCTETS <<< "${DOMAIN}"
  for octet in "${IP_OCTETS[@]}"; do
    (( 10#${octet} <= 255 )) || fail "La dirección IPv4 no es válida."
  done
  if ! { (( 10#${IP_OCTETS[0]} == 10 )) \
    || (( 10#${IP_OCTETS[0]} == 172 && 10#${IP_OCTETS[1]} >= 16 && 10#${IP_OCTETS[1]} <= 31 )) \
    || (( 10#${IP_OCTETS[0]} == 192 && 10#${IP_OCTETS[1]} == 168 )); }; then
    fail "El modo HTTP de prueba solo admite direcciones IPv4 privadas."
  fi
else
  if [[ -z "${DOMAIN}" ]]; then
    prompt_value "Dominio del panel (ejemplo: panel.ejemplo.com): " DOMAIN
  fi
  if [[ -z "${EMAIL}" ]]; then
    prompt_value "Correo para notificaciones de Let's Encrypt: " EMAIL
  fi
  [[ "${DOMAIN}" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || fail "El dominio tiene un formato inválido."
  [[ "${EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail "El correo tiene un formato inválido."
  if ! getent ahostsv4 "${DOMAIN}" >/dev/null 2>&1; then
    fail "El dominio no resuelve a una dirección IPv4. Configura primero el registro DNS A y vuelve a intentar."
  fi
fi

STACK_ALREADY_DEPLOYED=false
if command -v docker >/dev/null 2>&1 && docker stack ls --format '{{.Name}}' 2>/dev/null | grep -Fxq "${STACK_NAME}"; then
  STACK_ALREADY_DEPLOYED=true
fi
PORTS_IN_USE="$(ss -H -ltn '( sport = :80 or sport = :443 )' 2>/dev/null || true)"
if [[ "${TEST_MODE}" == "true" ]]; then
  PORTS_IN_USE="$(ss -H -ltn '( sport = :80 )' 2>/dev/null || true)"
fi
if [[ "${STACK_ALREADY_DEPLOYED}" != "true" && -n "${PORTS_IN_USE}" ]]; then
  if [[ "${TEST_MODE}" == "true" ]]; then
    fail "El puerto 80 ya está ocupado. Libéralo antes de instalar."
  fi
  fail "El puerto 80 o 443 ya está ocupado. Libera ambos puertos antes de instalar."
fi

SCRIPT_DIR=""
SCRIPT_FILE="${BASH_SOURCE[0]:-}"
SCRIPT_PARENT=""
if [[ -n "${SCRIPT_FILE}" && -f "${SCRIPT_FILE}" ]]; then
  SCRIPT_PARENT="$(dirname "$(readlink -f "${SCRIPT_FILE}")")"
fi
for candidate in "${VPS_MANAGER_SOURCE_DIR:-}" "${PWD}" "${SCRIPT_PARENT}"; do
  if [[ -n "${candidate}" && -f "${candidate}/apps/manager/server.mjs" && -f "${candidate}/installer/stack.yml" ]]; then
    SCRIPT_DIR="$(cd "${candidate}" && pwd)"
    break
  fi
done

REPOSITORY_URL="${VPS_MANAGER_REPOSITORY_URL:-${DEFAULT_REPOSITORY_URL}}"
if [[ -z "${SCRIPT_DIR}" && "${REPOSITORY_URL}" == "__CONFIGURE_GIT_REPOSITORY_URL_BEFORE_PUBLISHING__" ]]; then
  fail "El código aún no está publicado. Configura DEFAULT_REPOSITORY_URL en install.sh antes de publicar el instalador."
fi
if [[ -z "${SCRIPT_DIR}" && ! "${REPOSITORY_URL}" =~ ^https:// ]]; then
  fail "La URL del repositorio debe usar HTTPS."
fi

MEMORY_MIB="$(awk '/MemTotal:/ { print int($2 / 1024) }' /proc/meminfo)"
ROOT_DISK_MIB="$(df -Pm / | awk 'NR == 2 { print $4 }')"
if (( MEMORY_MIB < 2048 )); then
  log "ADVERTENCIA: el VPS tiene menos de 2 GiB de RAM; el rendimiento puede ser insuficiente."
fi
if (( ROOT_DISK_MIB < 8192 )); then
  log "ADVERTENCIA: hay menos de 8 GiB libres en /."
fi

log "Prevalidaciones completadas para ${DOMAIN}."
if [[ "${TEST_MODE}" == "true" ]]; then
  log "MODO DE PRUEBA: el panel usará HTTP sin cifrado. No lo expongas a Internet."
fi
log "El instalador no modificará UFW ni reglas existentes del firewall."

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg git python3 openssl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL --retry 3 https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${VERSION_CODENAME}
Components: stable
Architectures: ${DOCKER_ARCH}
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

if [[ -z "${SCRIPT_DIR}" ]]; then
  SOURCE_DIR="${INSTALL_DIR}/source"
  if [[ ! -d "${SOURCE_DIR}/apps/manager" ]]; then
    install -d -m 0755 "${INSTALL_DIR}"
    git clone --depth 1 --branch "${RELEASE_REF}" "${REPOSITORY_URL}" "${SOURCE_DIR}"
  fi
else
  SOURCE_DIR="${SCRIPT_DIR}"
fi

[[ -f "${SOURCE_DIR}/apps/manager/server.mjs" && -f "${SOURCE_DIR}/installer/stack.yml" ]] || fail "El repositorio no contiene la versión esperada de VPS Manager."
VPS_MANAGER_VERSION="$(tr -d '\r\n' < "${SOURCE_DIR}/apps/manager/VERSION")"
[[ "${VPS_MANAGER_VERSION}" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] \
  || fail "La versión del panel debe tener formato semver estable (por ejemplo 1.2.3)."
readonly IMAGE_NAME="vps-manager:${VPS_MANAGER_VERSION}"
if [[ "${TEST_MODE}" == "true" ]]; then
  [[ -f "${SOURCE_DIR}/installer/stack.test.yml" ]] || fail "No se encontró la configuración del modo de prueba."
fi

SWARM_STATE="$(docker info --format '{{.Swarm.LocalNodeState}}')"
if [[ "${SWARM_STATE}" == "inactive" ]]; then
  ADVERTISE_ADDR="${VPS_MANAGER_ADVERTISE_ADDR:-$(ip -4 route get 1.1.1.1 | awk '{ for (i=1; i<=NF; i++) if ($i == "src") { print $(i+1); exit } }')}"
  [[ -n "${ADVERTISE_ADDR}" ]] || fail "No se pudo detectar la dirección IPv4 para inicializar Swarm; configura VPS_MANAGER_ADVERTISE_ADDR."
  docker swarm init --advertise-addr "${ADVERTISE_ADDR}"
elif [[ "$(docker info --format '{{.Swarm.ControlAvailable}}')" != "true" ]]; then
  fail "Este servidor pertenece a un Swarm como worker. Se requiere un nodo manager."
fi

if ! docker network inspect vps-manager-proxy >/dev/null 2>&1; then
  docker network create --driver overlay --attachable vps-manager-proxy >/dev/null
fi
[[ "$(docker network inspect vps-manager-proxy --format '{{.Driver}}')" == "overlay" ]] || fail "La red vps-manager-proxy ya existe, pero no es overlay."

if ! docker network inspect vps-manager-internal >/dev/null 2>&1; then
  docker network create --driver overlay --opt encrypted=true vps-manager-internal >/dev/null
fi
[[ "$(docker network inspect vps-manager-internal --format '{{.Driver}}')" == "overlay" ]] || fail "La red vps-manager-internal ya existe, pero no es overlay."

if ! docker secret inspect vps_manager_admin_credentials >/dev/null 2>&1; then
  ADMIN_PASSWORD="${ADMIN_PASSWORD_INPUT}"
  if [[ -z "${ADMIN_PASSWORD}" ]]; then
    prompt_value "Contraseña de administrador (mínimo 16 caracteres): " ADMIN_PASSWORD true
    prompt_value "Confirma la contraseña: " ADMIN_PASSWORD_CONFIRM true
    [[ "${ADMIN_PASSWORD}" == "${ADMIN_PASSWORD_CONFIRM}" ]] || fail "Las contraseñas no coinciden."
  fi
  (( ${#ADMIN_PASSWORD} >= 16 )) || fail "La contraseña de administrador debe tener al menos 16 caracteres."
  CREDENTIAL_FILE="$(mktemp)"
  TEMP_FILES+=("${CREDENTIAL_FILE}")
  chmod 0600 "${CREDENTIAL_FILE}"
  printf '%s' "${ADMIN_PASSWORD}" | python3 -c 'import hashlib, secrets, sys; password=sys.stdin.buffer.read(); salt=secrets.token_bytes(16); digest=hashlib.scrypt(password, salt=salt, n=16384, r=8, p=1, dklen=64); print(salt.hex()+":"+digest.hex())' > "${CREDENTIAL_FILE}"
  docker secret create vps_manager_admin_credentials "${CREDENTIAL_FILE}" >/dev/null
  rm -f "${CREDENTIAL_FILE}"
  unset ADMIN_PASSWORD ADMIN_PASSWORD_CONFIRM ADMIN_PASSWORD_INPUT
fi

if ! docker secret inspect vps_manager_session_key >/dev/null 2>&1; then
  SESSION_KEY_FILE="$(mktemp)"
  TEMP_FILES+=("${SESSION_KEY_FILE}")
  chmod 0600 "${SESSION_KEY_FILE}"
  openssl rand -hex 32 > "${SESSION_KEY_FILE}"
  docker secret create vps_manager_session_key "${SESSION_KEY_FILE}" >/dev/null
  rm -f "${SESSION_KEY_FILE}"
fi

if ! docker secret inspect vps_manager_postgres_password >/dev/null 2>&1; then
  POSTGRES_PASSWORD_FILE="$(mktemp)"
  TEMP_FILES+=("${POSTGRES_PASSWORD_FILE}")
  chmod 0600 "${POSTGRES_PASSWORD_FILE}"
  printf '%s' "$(openssl rand -hex 32)" > "${POSTGRES_PASSWORD_FILE}"
  docker secret create vps_manager_postgres_password "${POSTGRES_PASSWORD_FILE}" >/dev/null
  rm -f "${POSTGRES_PASSWORD_FILE}"
fi

if ! docker secret inspect vps_manager_backup_key >/dev/null 2>&1; then
  BACKUP_KEY_FILE="$(mktemp)"
  TEMP_FILES+=("${BACKUP_KEY_FILE}")
  chmod 0600 "${BACKUP_KEY_FILE}"
  openssl rand -hex 32 > "${BACKUP_KEY_FILE}"
  docker secret create vps_manager_backup_key "${BACKUP_KEY_FILE}" >/dev/null
  printf '\nIMPORTANTE: guarda ahora esta clave fuera del VPS; solo se mostrará una vez.\n'
  printf 'Clave de cifrado de respaldos: '
  cat "${BACKUP_KEY_FILE}"
  printf 'Sin esta clave no será posible restaurar los respaldos cifrados.\n\n'
  rm -f "${BACKUP_KEY_FILE}"
fi

docker build --pull -t "${IMAGE_NAME}" "${SOURCE_DIR}/apps/manager"
umask 077
install -d -m 0700 "${INSTALL_DIR}"
install -d -o 1000 -g 1000 -m 0700 /var/lib/vps-manager/backups
GITHUB_REPOSITORY="${VPS_MANAGER_GITHUB_REPOSITORY:-}"
if [[ -n "${GITHUB_REPOSITORY}" && ! "${GITHUB_REPOSITORY}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  fail "VPS_MANAGER_GITHUB_REPOSITORY debe tener el formato owner/repo."
fi
{
  printf 'VPS_MANAGER_DOMAIN=%s\n' "${DOMAIN}"
  printf 'VPS_MANAGER_TEST_MODE=%s\n' "${TEST_MODE}"
  printf 'VPS_MANAGER_GITHUB_REPOSITORY=%s\n' "${GITHUB_REPOSITORY}"
  if [[ "${TEST_MODE}" != "true" ]]; then
    printf 'VPS_MANAGER_EMAIL=%s\n' "${EMAIL}"
  fi
} > "${INSTALL_DIR}/install.env"
install -m 0755 "${SOURCE_DIR}/installer/update.sh" /usr/local/bin/vps-manager-update
install -m 0755 "${SOURCE_DIR}/installer/diagnostics.sh" /usr/local/bin/vps-manager-diagnostics
install -m 0755 "${SOURCE_DIR}/installer/uninstall.sh" /usr/local/bin/vps-manager-uninstall
install -m 0755 "${SOURCE_DIR}/installer/reset-password.sh" /usr/local/bin/vps-manager-reset-password

export VPS_MANAGER_VERSION VPS_MANAGER_GITHUB_REPOSITORY="${GITHUB_REPOSITORY}"
if [[ "${TEST_MODE}" == "true" ]]; then
  STACK_FILE="${SOURCE_DIR}/installer/stack.test.yml"
  PANEL_SCHEME="http"
  export VPS_MANAGER_DOMAIN="${DOMAIN}" VPS_MANAGER_TEST_MODE=true
else
  STACK_FILE="${SOURCE_DIR}/installer/stack.yml"
  PANEL_SCHEME="https"
  export VPS_MANAGER_DOMAIN="${DOMAIN}" VPS_MANAGER_EMAIL="${EMAIL}" VPS_MANAGER_TEST_MODE=false
fi
docker stack deploy --with-registry-auth -c "${STACK_FILE}" "${STACK_NAME}"
docker service update --force --detach=false "${STACK_NAME}_manager"

log "Esperando que los servicios de Swarm inicien."
service_total=0
service_count=0
for attempt in $(seq 1 90); do
  service_total="$(docker stack services "${STACK_NAME}" --format '{{.Name}}' 2>/dev/null | wc -l)"
  service_total="${service_total//[[:space:]]/}"
  service_count="$(docker stack services "${STACK_NAME}" --format '{{.Replicas}}' 2>/dev/null | grep -c '^1/1$' || true)"
  if [[ "${service_total}" -ge 4 && "${service_count}" == "${service_total}" ]]; then
    break
  fi
  sleep 2
done

docker stack services "${STACK_NAME}"
if [[ "${service_total}" -lt 4 || "${service_count}" != "${service_total}" ]]; then
  docker stack ps "${STACK_NAME}" --no-trunc || true
  fail "No todos los servicios llegaron a 1/1. Ejecuta: sudo vps-manager-diagnostics"
fi

log "Esperando que el panel responda por ${PANEL_SCHEME^^}."
panel_ready=false
for attempt in $(seq 1 36); do
  if health_response="$(curl -fsS --connect-timeout 5 --max-time 10 "${PANEL_SCHEME}://${DOMAIN}/api/health" 2>/dev/null)" && [[ "${health_response}" == *'"status":"ok"'* ]]; then
    panel_ready=true
    break
  fi
  sleep 5
done
if [[ "${panel_ready}" != "true" ]]; then
  docker service logs --tail 100 "${STACK_NAME}_traefik" || true
  docker service logs --tail 100 "${STACK_NAME}_manager" || true
  if [[ "${TEST_MODE}" == "true" ]]; then
    fail "No se pudo validar http://${DOMAIN}/api/health. Revisa el firewall TCP 80 y los logs mostrados."
  fi
  fail "No se pudo validar https://${DOMAIN}/api/health. Revisa DNS, firewall TCP 80/443 y los logs mostrados."
fi

printf '%s\n' "${VPS_MANAGER_VERSION}" > "${INSTALL_DIR}/version"
chmod 0600 "${INSTALL_DIR}/version"
log "Instalación completada."
printf 'Panel: %s://%s\n' "${PANEL_SCHEME}" "${DOMAIN}"
printf 'Diagnóstico: sudo vps-manager-diagnostics\n'
printf 'Desinstalación (conserva secretos y datos): sudo vps-manager-uninstall\n'
