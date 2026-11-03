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
else:
    raise SystemExit("Invalid service operation request fields.")
if not re.fullmatch(
    r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}",
    str(request["id"]),
):
    raise SystemExit("Invalid service operation request identifier.")
if not re.fullmatch(r"[a-fA-F0-9]{25,64}", str(request["serviceId"])):
    raise SystemExit("Invalid Docker Swarm service identifier.")
print(f'{request["id"]}\t{request["operation"]}\t{request["serviceId"]}\t{replicas}')
PY
)" || {
  rm -f -- "${REQUEST_FILE}"
  echo "Rejected an invalid VPS Manager service operation request." >&2
  exit 1
}
IFS=$'\t' read -r request_id operation service_id replicas <<< "${request_data}"

write_status() {
  local state="$1"
  local message="$2"
  local temporary_file
  temporary_file="$(mktemp "${STATE_DIRECTORY}/status.XXXXXX")"
  if [[ "${operation}" == "scale-service" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","serviceId":"%s","replicas":%s,"updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${service_id}" "${replicas}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  else
    printf '{"id":"%s","operation":"%s","state":"%s","serviceId":"%s","updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${service_id}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  fi
  chmod 0644 "${temporary_file}"
  mv -f -- "${temporary_file}" "${STATUS_FILE}"
}

if [[ "${operation}" == "scale-service" ]]; then
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
