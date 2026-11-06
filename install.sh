#!/usr/bin/env bash
set -Eeuo pipefail

readonly INSTALL_DIR="/opt/vps-manager"
readonly STACK_NAME="vps-manager"
readonly DEFAULT_REPOSITORY_URL="https://github.com/self-david/baco-vps-visor.git"
readonly DEFAULT_GITHUB_REPOSITORY="self-david/baco-vps-visor"
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
TEMP_DIRECTORIES=()
cleanup() {
  for temporary_file in "${TEMP_FILES[@]}"; do
    [[ -z "${temporary_file}" ]] || rm -f -- "${temporary_file}"
  done
  for temporary_directory in "${TEMP_DIRECTORIES[@]}"; do
    [[ -z "${temporary_directory}" ]] || rm -rf -- "${temporary_directory}"
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
GITHUB_REPOSITORY="${VPS_MANAGER_GITHUB_REPOSITORY:-${DEFAULT_GITHUB_REPOSITORY}}"
if [[ -n "${GITHUB_REPOSITORY}" && ! "${GITHUB_REPOSITORY}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  fail "VPS_MANAGER_GITHUB_REPOSITORY debe tener el formato owner/repo."
fi

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
apt-get install -y ca-certificates curl gnupg git python3 openssl apache2-utils openssh-client
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
docker buildx version >/dev/null 2>&1 || fail "Docker Buildx (BuildKit) no está disponible después de instalar Docker."

RAILPACK_VERSION="0.43.0"
case "$(uname -m)" in
  x86_64)
    RAILPACK_ASSET="railpack-v${RAILPACK_VERSION}-x86_64-unknown-linux-musl.tar.gz"
    RAILPACK_SHA256="248a8f60f36854aabed6124113631078a802de3461660855fc4de9c26065c1fb"
    ;;
  aarch64)
    RAILPACK_ASSET="railpack-v${RAILPACK_VERSION}-arm64-unknown-linux-musl.tar.gz"
    RAILPACK_SHA256="732ece14eb4f4676a43ebba19431f954edf7b130acb76159ef0f2ff86ac42ac9"
    ;;
esac
RAILPACK_ARCHIVE="$(mktemp)"
TEMP_FILES+=("${RAILPACK_ARCHIVE}")
RAILPACK_DIRECTORY="$(mktemp -d)"
TEMP_DIRECTORIES+=("${RAILPACK_DIRECTORY}")
curl -fsSL --retry 3 \
  "https://github.com/railwayapp/railpack/releases/download/v${RAILPACK_VERSION}/${RAILPACK_ASSET}" \
  -o "${RAILPACK_ARCHIVE}"
printf '%s  %s\n' "${RAILPACK_SHA256}" "${RAILPACK_ARCHIVE}" | sha256sum --check --status \
  || fail "La verificación de integridad de Railpack falló."
tar -xzf "${RAILPACK_ARCHIVE}" --no-same-owner --no-same-permissions -C "${RAILPACK_DIRECTORY}"
RAILPACK_BINARY="$(find "${RAILPACK_DIRECTORY}" -type f -name railpack -print -quit)"
[[ -n "${RAILPACK_BINARY}" && ! -L "${RAILPACK_BINARY}" ]] \
  || fail "La release de Railpack no contiene el ejecutable esperado."
install -m 0755 "${RAILPACK_BINARY}" /usr/local/bin/railpack
railpack --version | grep -F "${RAILPACK_VERSION}" >/dev/null \
  || fail "La versión instalada de Railpack no coincide con la versión verificada."

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
VPS_MANAGER_IMAGE_TAG="${VPS_MANAGER_IMAGE_TAG:-${VPS_MANAGER_VERSION}}"
[[ "${VPS_MANAGER_IMAGE_TAG}" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] \
  || fail "La etiqueta de imagen de VPS Manager no es válida."
readonly IMAGE_NAME="vps-manager:${VPS_MANAGER_IMAGE_TAG}"
log "Construyendo imagen del panel ${IMAGE_NAME}."
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

DOCKER_CONFIG=/var/lib/vps-manager/service-operations/buildx-config \
  bash "${SOURCE_DIR}/installer/configure-buildkit.sh"
DOCKER_CONFIG=/var/lib/vps-manager/service-operations/buildx-config \
  docker buildx build --builder vps-manager-projects --pull --load --tag "${IMAGE_NAME}" "${SOURCE_DIR}/apps/manager"
umask 077
install -d -m 0700 "${INSTALL_DIR}"
install -d -o 1000 -g 1000 -m 0700 /var/lib/vps-manager/backups
install -d -o 1000 -g 1000 -m 0700 /var/lib/vps-manager/web-update
install -d -o root -g 1000 -m 0730 /var/lib/vps-manager/service-operations
install -d -o root -g root -m 0700 /var/lib/vps-manager/registry
install -d -m 0755 /usr/local/libexec
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
install -m 0755 "${SOURCE_DIR}/installer/web-update-worker.sh" /usr/local/libexec/vps-manager-web-update
install -m 0755 "${SOURCE_DIR}/installer/swarm-node-enroll.sh" /usr/local/libexec/vps-manager-swarm-node-enroll
install -m 0644 "${SOURCE_DIR}/installer/vps-manager-web-update.path" /etc/systemd/system/vps-manager-web-update.path
install -m 0644 "${SOURCE_DIR}/installer/vps-manager-web-update.service" /etc/systemd/system/vps-manager-web-update.service
install -m 0755 "${SOURCE_DIR}/installer/service-agent.sh" /usr/local/libexec/vps-manager-service-agent
install -m 0644 "${SOURCE_DIR}/installer/vps-manager-service-agent.path" /etc/systemd/system/vps-manager-service-agent.path
install -m 0644 "${SOURCE_DIR}/installer/vps-manager-service-agent.service" /etc/systemd/system/vps-manager-service-agent.service
install -m 0644 "${SOURCE_DIR}/installer/vps-manager-container-cleanup.timer" /etc/systemd/system/vps-manager-container-cleanup.timer
systemctl daemon-reload
systemctl enable --now vps-manager-web-update.path
systemctl enable --now vps-manager-service-agent.path
systemctl enable --now vps-manager-container-cleanup.timer

export VPS_MANAGER_VERSION VPS_MANAGER_IMAGE_TAG VPS_MANAGER_GITHUB_REPOSITORY="${GITHUB_REPOSITORY}"
if [[ "${TEST_MODE}" == "true" ]]; then
  STACK_FILE="${SOURCE_DIR}/installer/stack.test.yml"
  PANEL_SCHEME="http"
  export VPS_MANAGER_DOMAIN="${DOMAIN}" VPS_MANAGER_TEST_MODE=true
else
  STACK_FILE="${SOURCE_DIR}/installer/stack.yml"
  PANEL_SCHEME="https"
  export VPS_MANAGER_DOMAIN="${DOMAIN}" VPS_MANAGER_EMAIL="${EMAIL}" VPS_MANAGER_TEST_MODE=false
fi
docker stack deploy --detach=true --with-registry-auth -c "${STACK_FILE}" "${STACK_NAME}"
log "El despliegue de Swarm fue enviado; esperando que ${STACK_NAME}_manager inicie ${IMAGE_NAME} (hasta 180 segundos)."
manager_image_ready=false
for attempt in $(seq 1 90); do
  service_image="$(docker service inspect --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' "${STACK_NAME}_manager" 2>/dev/null || true)"
  if [[ "${service_image}" == "${IMAGE_NAME}" ]]; then
    while IFS= read -r task_line; do
      task_state="${task_line%%|*}"
      task_image="${task_line#*|}"
      if [[ "${task_state}" == Running* && "${task_image}" == "${IMAGE_NAME}" ]]; then
        manager_image_ready=true
        break
      fi
    done < <(docker service ps "${STACK_NAME}_manager" --format '{{.CurrentState}}|{{.Image}}' 2>/dev/null || true)
  fi
  if [[ "${manager_image_ready}" == "true" ]]; then break; fi
  if (( attempt % 5 == 0 )); then
    log "Esperando que Swarm inicie ${IMAGE_NAME} (${attempt}/90)."
  fi
  sleep 2
done
if [[ "${manager_image_ready}" != "true" ]]; then
  docker service ps "${STACK_NAME}_manager" --no-trunc || true
  printf 'Estado de percepción del manager: %s\n' "$(docker service inspect --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' "${STACK_NAME}_manager" 2>/dev/null || echo 'sin-información')" >&2
  fail "El servicio del panel no llegó a la imagen esperada ${IMAGE_NAME}. Revisar los estados de la tarea y el log del servicio."
fi

managed_service_names="$(docker service ls --filter label=vps-manager.managed=true --format '{{.Name}}')" \
  || fail "No se pudieron consultar los servicios administrados para activar su recuperación automática."
while IFS= read -r managed_service_name; do
  [[ -n "${managed_service_name}" ]] || continue
  [[ "${managed_service_name}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,254}$ ]] \
    || fail "Docker devolvió un nombre de servicio administrado no válido."
  restart_condition="$(docker service inspect --format '{{.Spec.TaskTemplate.RestartPolicy.Condition}}' "${managed_service_name}")" \
    || fail "No se pudo consultar la política de reinicio de un servicio administrado."
  if [[ "${restart_condition}" != "any" ]]; then
    log "Activando recuperación automática para el servicio ${managed_service_name}."
    docker service update --restart-condition any --detach=true "${managed_service_name}" \
      || fail "No se pudo activar la recuperación automática para el servicio ${managed_service_name}."
  fi
done <<< "${managed_service_names}"

log "El manager inició; esperando que los servicios de Swarm estén listos (hasta 180 segundos)."
service_total=0
service_count=0
service_status=""
for attempt in $(seq 1 90); do
  service_status="$(docker stack services "${STACK_NAME}" --format '{{.Name}} {{.Replicas}}' 2>/dev/null || true)"
  service_total="$(awk 'NF >= 2 { count++ } END { print count + 0 }' <<< "${service_status}")"
  service_count="$(awk '$2 ~ /^[0-9]+\/[0-9]+$/ { split($2, replicas, "/"); if (replicas[1] == replicas[2]) count++ } END { print count + 0 }' \
    <<< "${service_status}")"
  if [[ "${service_total}" -ge 4 && "${service_count}" == "${service_total}" ]]; then
    break
  fi
  if (( attempt % 5 == 0 )); then
    log "Servicios Swarm listos: ${service_count}/${service_total} (${attempt}/90). Estado actual:"
    if [[ -n "${service_status}" ]]; then
      while IFS= read -r service_line; do
        [[ -n "${service_line}" ]] && printf '  %s\n' "${service_line}"
      done <<< "${service_status}"
    else
      printf '  (Swarm todavía no informa servicios para el stack %s)\n' "${STACK_NAME}"
    fi
  fi
  sleep 2
done

docker stack services "${STACK_NAME}"
if [[ "${service_total}" -lt 4 || "${service_count}" != "${service_total}" ]]; then
  log "El stack no alcanzó el estado esperado. Tareas y errores de Swarm:"
  docker stack ps "${STACK_NAME}" --no-trunc || true
  while read -r service_name _; do
    [[ "${service_name}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,254}$ ]] || continue
    log "Últimos logs de ${service_name}:"
    docker service logs --tail 80 "${service_name}" 2>&1 || true
  done <<< "${service_status}"
  fail "Solo ${service_count} de ${service_total} servicios están listos tras 180 segundos. Revisa los estados y logs anteriores; también puedes ejecutar: sudo vps-manager-diagnostics"
fi

log "Esperando que el panel responda por ${PANEL_SCHEME^^}."
panel_ready=false
consecutive_ready_checks=0
last_root_status="000"
last_app_status="000"
last_styles_status="000"
last_health_status="000"
for attempt in $(seq 1 36); do
  panel_url="${PANEL_SCHEME}://${DOMAIN}"
  last_root_status="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 3 "${panel_url}/" 2>/dev/null || true)"
  last_app_status="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 3 "${panel_url}/app.js" 2>/dev/null || true)"
  last_styles_status="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 3 "${panel_url}/styles.css" 2>/dev/null || true)"
  health_result="$(curl -sS -w $'\n%{http_code}' --connect-timeout 2 --max-time 3 "${panel_url}/api/health" 2>/dev/null || true)"
  last_health_status="${health_result##*$'\n'}"
  health_response="${health_result%$'\n'*}"
  if [[ "${last_root_status}" == "200" && "${last_app_status}" == "200" && "${last_styles_status}" == "200" ]] \
    && [[ "${last_health_status}" == "200" ]] \
    && [[ "${health_response}" == *'"status":"ok"'* ]]; then
    consecutive_ready_checks=$((consecutive_ready_checks + 1))
    log "Panel y recursos disponibles (${consecutive_ready_checks}/3 comprobaciones consecutivas)."
    if (( consecutive_ready_checks >= 3 )); then
      panel_ready=true
      break
    fi
  else
    consecutive_ready_checks=0
  fi
  sleep 3
done
if [[ "${panel_ready}" != "true" ]]; then
  log "Últimos códigos HTTP: /=${last_root_status}, /app.js=${last_app_status}, /styles.css=${last_styles_status}, /api/health=${last_health_status}."
  docker service logs --tail 100 "${STACK_NAME}_traefik" || true
  docker service logs --tail 100 "${STACK_NAME}_manager" || true
  if [[ "${TEST_MODE}" == "true" ]]; then
    fail "No se pudo validar http://${DOMAIN}/api/health. Revisa el firewall TCP 80 y los logs mostrados."
  fi
  fail "No se pudo validar https://${DOMAIN}/api/health. Revisa DNS, firewall TCP 80/443 y los logs mostrados."
fi

if docker service inspect vps-manager-gitea >/dev/null 2>&1; then
  gitea_labels="$(docker service inspect \
    --format '{{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}}' \
    vps-manager-gitea)" || fail "No se pudo verificar el servicio Gitea existente."
  if [[ "${gitea_labels}" == "true gitea" ]]; then
    log "Retirando el servicio Gitea administrado; sus secretos y volumen persistente se conservan."
    docker service rm vps-manager-gitea
    for attempt in $(seq 1 60); do
      if ! docker service inspect vps-manager-gitea >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done
    if docker service inspect vps-manager-gitea >/dev/null 2>&1; then
      fail "No se pudo retirar el servicio Gitea. Sus datos persistentes se conservaron."
    fi
  else
    log "Se encontró vps-manager-gitea sin las etiquetas de VPS Manager; no se modificó."
  fi
fi

printf '%s\n' "${VPS_MANAGER_VERSION}" > "${INSTALL_DIR}/version.tmp"
chmod 0600 "${INSTALL_DIR}/version.tmp"
mv -f "${INSTALL_DIR}/version.tmp" "${INSTALL_DIR}/version"
log "Instalación completada."
printf 'Imagen del panel: %s\n' "${IMAGE_NAME}"
printf 'Panel: %s://%s\n' "${PANEL_SCHEME}" "${DOMAIN}"
printf 'Diagnóstico: sudo vps-manager-diagnostics\n'
printf 'Desinstalación (conserva secretos y datos): sudo vps-manager-uninstall\n'
