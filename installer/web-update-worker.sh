#!/usr/bin/env bash
set -Eeuo pipefail

readonly STATE_DIRECTORY="/var/lib/vps-manager/web-update"
readonly REQUEST_FILE="${STATE_DIRECTORY}/request"
readonly STATUS_FILE="${STATE_DIRECTORY}/status.json"
readonly UPDATER="/usr/local/bin/vps-manager-update"

if [[ "${EUID}" -ne 0 ]]; then
  echo "The web update worker must run as root." >&2
  exit 1
fi

[[ -f "${REQUEST_FILE}" ]] || exit 0
request_id="$(tr -d '\r\n' < "${REQUEST_FILE}")"
if [[ ! "${request_id}" =~ ^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$ ]]; then
  rm -f -- "${REQUEST_FILE}"
  echo "Rejected an invalid VPS Manager web update request." >&2
  exit 1
fi

write_status() {
  local state="$1"
  local message="$2"
  local temporary_file
  temporary_file="$(mktemp "${STATE_DIRECTORY}/status.XXXXXX")"
  printf '{"id":"%s","state":"%s","updatedAt":"%s","message":"%s"}\n' \
    "${request_id}" "${state}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  chmod 0644 "${temporary_file}"
  mv -f -- "${temporary_file}" "${STATUS_FILE}"
}

write_status "running" "Actualizacion en curso. El panel puede reiniciarse durante el proceso."
rm -f -- "${REQUEST_FILE}"

if "${UPDATER}"; then
  write_status "succeeded" "Actualizacion completada. VPS Manager ya esta ejecutando la nueva version."
else
  exit_code="$?"
  write_status "failed" "La actualizacion fallo. Revisa el journal del servicio vps-manager-web-update."
  exit "${exit_code}"
fi
