#!/usr/bin/env bash
set -Eeuo pipefail

readonly STATE_DIRECTORY="/var/lib/vps-manager/service-operations"
readonly REQUEST_FILE="${STATE_DIRECTORY}/request.json"
readonly STATUS_FILE="${STATE_DIRECTORY}/status.json"

if [[ "${EUID}" -ne 0 ]]; then
  echo "The service operations agent must run as root." >&2
  exit 1
fi

if [[ ! -e "${REQUEST_FILE}" && ! -L "${REQUEST_FILE}" ]]; then
  exit 0
fi
if [[ -L "${REQUEST_FILE}" || ! -f "${REQUEST_FILE}" ]]; then
  rm -f -- "${REQUEST_FILE}"
  echo "Rejected a non-regular service operation request file." >&2
  exit 1
fi
request_size="$(stat -c '%s' "${REQUEST_FILE}")"
if (( request_size > 1024 )); then
  rm -f -- "${REQUEST_FILE}"
  echo "Rejected an oversized service operation request." >&2
  exit 1
fi

request_data="$(python3 - "${REQUEST_FILE}" <<'PY'
import json
import re
import sys

with open(sys.argv[1], encoding="utf-8") as request_file:
    request = json.load(request_file)
if not isinstance(request, dict):
    raise SystemExit("Invalid service operation request.")
common_fields = {"id", "operation", "serviceId"}
if request.get("operation") == "restart-service":
    if set(request) != common_fields:
        raise SystemExit("Invalid service operation request fields.")
    replicas = "-"
elif request.get("operation") == "scale-service":
    if set(request) != common_fields | {"replicas"}:
        raise SystemExit("Invalid service operation request fields.")
    if not isinstance(request["replicas"], int) or isinstance(request["replicas"], bool):
        raise SystemExit("Invalid desired replica count.")
    if not 1 <= request["replicas"] <= 100:
        raise SystemExit("Desired replica count must be between 1 and 100.")
    replicas = request["replicas"]
elif request.get("operation") == "install-gitea":
    if set(request) != {"id", "operation", "domain"}:
        raise SystemExit("Invalid Gitea installation request fields.")
    if not isinstance(request["domain"], str) or not re.fullmatch(
        r"(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}",
        request["domain"],
    ) or re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", request["domain"]):
        raise SystemExit("Invalid Gitea domain.")
    service_id = "-"
    replicas = "-"
elif request.get("operation") == "configure-gitea-token":
    if set(request) != {"id", "operation", "token"}:
        raise SystemExit("Invalid Gitea token configuration request fields.")
    if not isinstance(request["token"], str) or not re.fullmatch(r"[A-Za-z0-9._-]{20,512}", request["token"]):
        raise SystemExit("Invalid Gitea API token.")
    service_id = "-"
    replicas = "-"
else:
    raise SystemExit("Invalid service operation request fields.")
if not re.fullmatch(
    r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}",
    str(request["id"]),
):
    raise SystemExit("Invalid service operation request identifier.")
if request["operation"] in {"restart-service", "scale-service"} and not re.fullmatch(
    r"[a-fA-F0-9]{25,64}", str(request["serviceId"])
):
    raise SystemExit("Invalid Docker Swarm service identifier.")
print(f'{request["id"]}\t{request["operation"]}\t{request.get("serviceId", "-")}\t{replicas}\t{request.get("domain", "-")}\t{request.get("token", "-")}')
PY
)" || {
  rm -f -- "${REQUEST_FILE}"
  echo "Rejected an invalid VPS Manager service operation request." >&2
  exit 1
}
IFS=$'\t' read -r request_id operation service_id replicas gitea_domain gitea_api_token <<< "${request_data}"

write_status() {
  local state="$1"
  local message="$2"
  local temporary_file
  temporary_file="$(mktemp "${STATE_DIRECTORY}/status.XXXXXX")"
  if [[ "${operation}" == "install-gitea" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","domain":"%s","credentialsAvailable":%s,"updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${gitea_domain}" "${gitea_credentials_available:-false}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  elif [[ "${operation}" == "configure-gitea-token" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  elif [[ "${operation}" == "scale-service" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","serviceId":"%s","replicas":%s,"updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${service_id}" "${replicas}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  else
    printf '{"id":"%s","operation":"%s","state":"%s","serviceId":"%s","updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${service_id}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  fi
  chmod 0644 "${temporary_file}"
  mv -f -- "${temporary_file}" "${STATUS_FILE}"
}

if [[ "${operation}" == "install-gitea" ]]; then
  write_status "running" "Preparando la instalación segura de Gitea."
elif [[ "${operation}" == "configure-gitea-token" ]]; then
  write_status "running" "Actualizando de forma segura el secreto del token de Gitea."
elif [[ "${operation}" == "scale-service" ]]; then
  write_status "running" "Escalado de servicio en curso."
else
  write_status "running" "Reinicio de servicio en curso."
fi
rm -f -- "${REQUEST_FILE}"

if ! command -v docker >/dev/null 2>&1; then
  write_status "failed" "Docker no está disponible en el host."
  echo "Docker is not installed." >&2
  exit 1
fi

if [[ "${operation}" == "configure-gitea-token" ]]; then
  readonly MANAGER_SERVICE="vps-manager_manager"
  readonly INSTALL_ENV="/opt/vps-manager/install.env"
  token_file=""
  env_backup=""
  new_secret="vps_manager_gitea_api_${request_id//-/}"
  cleanup_gitea_token() {
    if [[ -n "${token_file}" ]]; then rm -f -- "${token_file}"; fi
    if [[ -n "${env_backup}" ]]; then rm -f -- "${env_backup}"; fi
    if [[ "${gitea_api_token:-}" != "" ]]; then unset gitea_api_token; fi
  }
  trap cleanup_gitea_token EXIT

  if [[ ! -f "${INSTALL_ENV}" || -L "${INSTALL_ENV}" ]]; then
    write_status "failed" "No se encontró el archivo seguro de configuración de instalación."
    exit 1
  fi
  if ! service_info="$(docker service inspect --format '{{.ID}} {{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}}' "${MANAGER_SERVICE}" 2>/dev/null)"; then
    write_status "failed" "No se encontró el servicio administrado de VPS Manager."
    exit 1
  fi
  IFS=' ' read -r _ manager_managed manager_component <<< "${service_info}"
  if [[ "${manager_managed}" != "true" || "${manager_component}" != "api" ]]; then
    write_status "failed" "El servicio del panel no pertenece a VPS Manager."
    exit 1
  fi
  if ! old_secret="$(docker service inspect --format '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{if eq .File.Name "gitea_api_token"}}{{.SecretName}}{{end}}{{end}}' "${MANAGER_SERVICE}" 2>/dev/null)"; then
    write_status "failed" "No se pudo consultar la configuración de secretos del panel."
    exit 1
  fi
  if [[ "${old_secret}" == *$'\n'* ]]; then
    write_status "failed" "La configuración contiene referencias múltiples al token de Gitea."
    exit 1
  fi

  umask 077
  token_file="$(mktemp "${STATE_DIRECTORY}/gitea-api-token.XXXXXX")"
  if ! printf '%s' "${gitea_api_token}" > "${token_file}"; then
    write_status "failed" "No se pudo preparar el secreto temporal del token."
    exit 1
  fi
  unset gitea_api_token
  if ! docker secret create \
    --label vps-manager.managed=true \
    --label vps-manager.component=gitea-api-token \
    "${new_secret}" "${token_file}" >/dev/null; then
    write_status "failed" "Docker no pudo crear el secreto del token de Gitea."
    exit 1
  fi
  if ! env_backup="$(mktemp "${INSTALL_ENV}.backup.XXXXXX")" \
    || ! cp -p -- "${INSTALL_ENV}" "${env_backup}" \
    || ! python3 - "${INSTALL_ENV}" "${new_secret}" <<'PY'
import os
import stat
import sys
import tempfile

path, secret_name = sys.argv[1:]
metadata = os.stat(path, follow_symlinks=False)
with open(path, encoding="utf-8") as source:
    lines = source.read().splitlines()
key = "VPS_MANAGER_GITEA_API_SECRET="
replacement = f"{key}{secret_name}"
found = False
updated = []
for line in lines:
    if line.startswith(key):
        if not found:
            updated.append(replacement)
            found = True
    else:
        updated.append(line)
if not found:
    updated.append(replacement)
directory = os.path.dirname(path)
descriptor, temporary = tempfile.mkstemp(prefix=".install.env.", dir=directory)
try:
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as destination:
        destination.write("\n".join(updated) + "\n")
    os.chmod(temporary, stat.S_IMODE(metadata.st_mode))
    os.chown(temporary, metadata.st_uid, metadata.st_gid)
    os.replace(temporary, path)
except BaseException:
    try:
        os.unlink(temporary)
    except FileNotFoundError:
        pass
    raise
PY
  then
    docker secret rm "${new_secret}" >/dev/null 2>&1 || true
    write_status "failed" "No se pudo guardar de forma segura la referencia al secreto de Gitea."
    exit 1
  fi
  update_args=(--detach=false --secret-add "source=${new_secret},target=gitea_api_token")
  if [[ -n "${old_secret}" ]]; then
    update_args+=(--secret-rm "${old_secret}")
  fi
  if ! docker service update "${update_args[@]}" "${MANAGER_SERVICE}" >/dev/null; then
    if ! cp -p -- "${env_backup}" "${INSTALL_ENV}"; then
      env_backup=""
      write_status "failed" "Falló la actualización del servicio y no se pudo restaurar la configuración anterior; el respaldo local requiere revisión."
      exit 1
    fi
    rm -f -- "${env_backup}"
    env_backup=""
    docker secret rm "${new_secret}" >/dev/null 2>&1 || true
    write_status "failed" "No se pudo actualizar el servicio del panel con el secreto de Gitea."
    exit 1
  fi
  rm -f -- "${env_backup}"
  env_backup=""
  if [[ -n "${old_secret}" ]]; then
    old_secret_labels="$(docker secret inspect --format '{{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}}' "${old_secret}" 2>/dev/null || true)"
    if [[ "${old_secret_labels}" == "true gitea-api-token" ]]; then
      docker secret rm "${old_secret}" >/dev/null || {
        write_status "failed" "El token se actualizó, pero no se pudo retirar el secreto anterior."
        exit 1
      }
    fi
  fi
  write_status "succeeded" "Token de Gitea configurado como secreto Swarm."
  exit 0
fi

if [[ "${operation}" == "install-gitea" ]]; then
  readonly INSTALL_ENV="/opt/vps-manager/install.env"
  readonly GITEA_SERVICE="vps-manager-gitea"
  readonly GITEA_IMAGE="gitea/gitea:1.25.3"
  readonly CREDENTIALS_FILE="${STATE_DIRECTORY}/gitea-credentials-${request_id}.json"
  base_domain="$(sed -n 's/^VPS_MANAGER_DOMAIN=//p' "${INSTALL_ENV}" | head -n 1)"
  test_mode="$(sed -n 's/^VPS_MANAGER_TEST_MODE=//p' "${INSTALL_ENV}" | head -n 1)"
  if [[ "${test_mode}" == "true" || ! "${base_domain}" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ \
    || "${gitea_domain,,}" != "git.${base_domain,,}" ]]; then
    gitea_credentials_available=false
    write_status "failed" "Gitea requiere una instalación HTTPS con un dominio público; el modo de prueba no es compatible."
    exit 1
  fi
  if ! docker network inspect vps-manager-proxy >/dev/null 2>&1; then
    gitea_credentials_available=false
    write_status "failed" "No se encontró la red HTTPS de Traefik."
    exit 1
  fi

  if service_info="$(docker service inspect --format '{{.ID}} {{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}}' "${GITEA_SERVICE}" 2>/dev/null)"; then
    IFS=' ' read -r _ managed_label component_label <<< "${service_info}"
    if [[ "${managed_label}" != "true" || "${component_label}" != "gitea" ]]; then
      gitea_credentials_available=false
      write_status "failed" "Ya existe un servicio con el nombre reservado para Gitea y no pertenece a VPS Manager."
      exit 1
    fi
    gitea_credentials_available=false
    write_status "succeeded" "Gitea ya estaba instalado. No se generaron credenciales nuevas."
    exit 0
  fi

  if [[ ! -e "${CREDENTIALS_FILE}" ]]; then
    if ! gitea_password="$(python3 - "${CREDENTIALS_FILE}" "${request_id}" "${gitea_domain}" <<'PY'
import json
import os
import secrets
import sys

path, task_id, domain = sys.argv[1:]
password = secrets.token_hex(32)
temporary = f"{path}.tmp"
descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o640)
with os.fdopen(descriptor, "w", encoding="utf-8") as credential_file:
    json.dump({
        "taskId": task_id,
        "domain": domain,
        "username": "vpsadmin",
        "password": password,
    }, credential_file)
    credential_file.write("\n")
os.chown(temporary, 0, 1000)
os.replace(temporary, path)
print(password)
PY
    )"; then
      gitea_credentials_available=false
      write_status "failed" "No se pudieron generar las credenciales iniciales de Gitea."
      exit 1
    fi
  else
    gitea_password="$(python3 - "${CREDENTIALS_FILE}" "${request_id}" <<'PY'
import json
import re
import sys

with open(sys.argv[1], encoding="utf-8") as credential_file:
    credentials = json.load(credential_file)
if credentials.get("taskId") != sys.argv[2] or not re.fullmatch(r"[a-f0-9]{64}", credentials.get("password", "")):
    raise SystemExit("Invalid pending Gitea credentials.")
print(credentials["password"])
PY
    )" || {
      gitea_credentials_available=false
      write_status "failed" "No se pudieron validar las credenciales temporales de Gitea."
      exit 1
    }
  fi

  if ! systemd-run --quiet --on-active=30m \
    --unit="vps-manager-gitea-credentials-expire-${request_id}" \
    /usr/bin/find "${STATE_DIRECTORY}" -maxdepth 1 -type f \
      -name "gitea-credentials-${request_id}.json*" -delete; then
    rm -f -- "${CREDENTIALS_FILE}"
    gitea_credentials_available=false
    write_status "failed" "No se pudo programar la caducidad de las credenciales iniciales."
    exit 1
  fi

  if ! docker pull "${GITEA_IMAGE}"; then
    gitea_credentials_available=true
    write_status "failed" "No se pudo descargar la imagen fijada de Gitea."
    exit 1
  fi

  if ! docker service create \
    --name "${GITEA_SERVICE}" \
    --replicas 1 \
    --constraint 'node.role==manager' \
    --network vps-manager-proxy \
    --mount type=volume,source=vps-manager-gitea-data,target=/data \
    --publish published=2222,target=22,protocol=tcp,mode=host \
    --env USER_UID=1000 \
    --env USER_GID=1000 \
    --env GITEA__database__DB_TYPE=sqlite3 \
    --env GITEA__server__DOMAIN="${gitea_domain}" \
    --env GITEA__server__ROOT_URL="https://${gitea_domain}/" \
    --env GITEA__server__SSH_DOMAIN="${gitea_domain}" \
    --env GITEA__server__SSH_PORT=2222 \
    --env GITEA__server__SSH_LISTEN_PORT=22 \
    --env GITEA__server__START_SSH_SERVER=true \
    --env GITEA__security__INSTALL_LOCK=true \
    --env GITEA__service__DISABLE_REGISTRATION=true \
    --env GITEA__service__REQUIRE_SIGNIN_VIEW=true \
    --label vps-manager.managed=true \
    --label vps-manager.component=gitea \
    --label traefik.enable=true \
    --label traefik.swarm.network=vps-manager-proxy \
    --label "traefik.http.routers.vps-manager-gitea.rule=Host(\`${gitea_domain}\`)" \
    --label traefik.http.routers.vps-manager-gitea.entrypoints=websecure \
    --label traefik.http.routers.vps-manager-gitea.tls=true \
    --label traefik.http.routers.vps-manager-gitea.tls.certresolver=vpsmanager \
    --label traefik.http.services.vps-manager-gitea.loadbalancer.server.port=3000 \
    --limit-cpu 1 \
    --limit-memory 768M \
    --restart-condition on-failure \
    "${GITEA_IMAGE}" >/dev/null; then
    gitea_credentials_available=true
    write_status "failed" "Swarm no pudo crear el servicio Gitea. Verifica si el puerto TCP 2222 está disponible."
    exit 1
  fi

  container_id=""
  admin_list=""
  for attempt in $(seq 1 90); do
    container_id="$(docker ps \
      --filter "label=com.docker.swarm.service.name=${GITEA_SERVICE}" \
      --filter status=running \
      --format '{{.ID}}' | head -n 1)"
    if [[ -n "${container_id}" ]] \
      && admin_list="$(docker exec "${container_id}" gitea admin user list --admin 2>/dev/null)"; then
      break
    fi
    sleep 2
  done
  if [[ -z "${container_id}" ]]; then
    gitea_credentials_available=true
    write_status "failed" "Gitea no inició a tiempo. El volumen persistente se conservó; revisa los logs del servicio."
    exit 1
  fi

  if ! awk '{ for (i = 1; i <= NF; i++) if ($i == "vpsadmin") found = 1 } END { exit !found }' <<< "${admin_list}"; then
    if ! docker exec "${container_id}" gitea admin user create \
      --username vpsadmin \
      --password "${gitea_password}" \
      --email "vpsadmin@${base_domain}" \
      --admin; then
      gitea_credentials_available=true
      write_status "failed" "No se pudo crear el administrador inicial de Gitea; los datos persistentes se conservaron."
      exit 1
    fi
  fi
  gitea_credentials_available=true
  write_status "succeeded" "Gitea instalado en https://${gitea_domain}/. El administrador inicial puede consultar sus credenciales una sola vez durante 30 minutos."
  exit 0
fi

if ! service_info="$(docker service inspect --format '{{.ID}} {{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}}' "${service_id}")"; then
  write_status "failed" "No se pudo encontrar el servicio solicitado."
  exit 1
fi
IFS=' ' read -r inspected_id managed_label component_label <<< "${service_info}"
if [[ "${inspected_id}" != "${service_id}" || "${managed_label}" != "true" ]]; then
  write_status "failed" "Solo se permiten operaciones sobre servicios administrados por VPS Manager."
  echo "Rejected a service without the vps-manager.managed=true label." >&2
  exit 1
fi

if [[ "${operation}" == "scale-service" ]]; then
  if [[ "${component_label}" == "api" && "${replicas}" != "1" ]]; then
    write_status "failed" "El servicio del panel debe conservar exactamente una réplica."
    echo "Rejected scaling the VPS Manager API away from one replica." >&2
    exit 1
  fi
  if [[ "${component_label}" == "gitea" && "${replicas}" != "1" ]]; then
    write_status "failed" "Gitea usa SQLite y debe conservar exactamente una réplica."
    echo "Rejected scaling the Gitea application away from one replica." >&2
    exit 1
  fi
  if docker service update --replicas "${replicas}" --detach=true "${service_id}"; then
    write_status "succeeded" "Escalado solicitado a ${replicas} réplicas; Swarm programará las tareas según los recursos disponibles."
  else
    write_status "failed" "Docker no pudo completar el escalado del servicio."
    exit 1
  fi
else
  if docker service update --force --detach=false "${service_id}"; then
    write_status "succeeded" "Servicio reiniciado correctamente."
  else
    write_status "failed" "Docker no pudo completar el reinicio del servicio."
    exit 1
  fi
fi
