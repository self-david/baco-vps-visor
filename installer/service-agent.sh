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
if set(request) != {"id", "operation", "serviceId"}:
    raise SystemExit("Invalid service operation request fields.")
if not re.fullmatch(
    r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}",
    str(request["id"]),
):
    raise SystemExit("Invalid service operation request identifier.")
if request["operation"] != "restart-service":
    raise SystemExit("Unsupported service operation.")
if not re.fullmatch(r"[a-fA-F0-9]{25,64}", str(request["serviceId"])):
    raise SystemExit("Invalid Docker Swarm service identifier.")
print(f'{request["id"]}\t{request["serviceId"]}')
PY
)" || {
  rm -f -- "${REQUEST_FILE}"
  echo "Rejected an invalid VPS Manager service operation request." >&2
  exit 1
}
IFS=$'\t' read -r request_id service_id <<< "${request_data}"

write_status() {
  local state="$1"
  local message="$2"
  local temporary_file
  temporary_file="$(mktemp "${STATE_DIRECTORY}/status.XXXXXX")"
  printf '{"id":"%s","state":"%s","serviceId":"%s","updatedAt":"%s","message":"%s"}\n' \
    "${request_id}" "${state}" "${service_id}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  chmod 0644 "${temporary_file}"
  mv -f -- "${temporary_file}" "${STATUS_FILE}"
}

write_status "running" "Reinicio de servicio en curso."
rm -f -- "${REQUEST_FILE}"

if ! command -v docker >/dev/null 2>&1; then
  write_status "failed" "Docker no está disponible en el host."
  echo "Docker is not installed." >&2
  exit 1
fi

if ! service_info="$(docker service inspect --format '{{.ID}} {{index .Spec.Labels "vps-manager.managed"}}' "${service_id}")"; then
  write_status "failed" "No se pudo encontrar el servicio solicitado."
  exit 1
fi
IFS=' ' read -r inspected_id managed_label <<< "${service_info}"
if [[ "${inspected_id}" != "${service_id}" || "${managed_label}" != "true" ]]; then
  write_status "failed" "Solo se permite reiniciar servicios administrados por VPS Manager."
  echo "Rejected a service without the vps-manager.managed=true label." >&2
  exit 1
fi

if docker service update --force --detach=false "${service_id}"; then
  write_status "succeeded" "Servicio reiniciado correctamente."
else
  write_status "failed" "Docker no pudo completar el reinicio del servicio."
  exit 1
fi
