#!/usr/bin/env bash
set -Eeuo pipefail

readonly BUILDER_NAME="vps-manager-projects"
readonly CONFIG_DIRECTORY="/etc/docker"
readonly CONFIG_FILE="${CONFIG_DIRECTORY}/vps-manager-buildkitd.toml"
readonly CONFIG_HASH_FILE="${CONFIG_DIRECTORY}/vps-manager-buildkitd.sha256"
readonly BUILDX_CONFIG_DIRECTORY="/var/lib/vps-manager/service-operations/buildx-config"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || fail "Ejecuta este script como root."
command -v docker >/dev/null 2>&1 || fail "Docker no está instalado."
command -v python3 >/dev/null 2>&1 || fail "Python 3 no está instalado."
docker buildx version >/dev/null 2>&1 || fail "Docker Buildx (BuildKit) no está disponible."

install -d -m 0755 "${CONFIG_DIRECTORY}"
install -d -o root -g 1000 -m 0730 /var/lib/vps-manager/service-operations
install -d -o root -g root -m 0700 "${BUILDX_CONFIG_DIRECTORY}"
export DOCKER_CONFIG="${BUILDX_CONFIG_DIRECTORY}"
temporary_config="$(mktemp "${CONFIG_DIRECTORY}/vps-manager-buildkitd.XXXXXX")"
temporary_hash=""
cleanup() {
  [[ -z "${temporary_config}" ]] || rm -f -- "${temporary_config}"
  [[ -z "${temporary_hash}" ]] || rm -f -- "${temporary_hash}"
}
trap cleanup EXIT

python3 - "${temporary_config}" <<'PY'
import ipaddress
import json
import sys
from pathlib import Path

servers = []
for resolver_path in (
    Path("/run/systemd/resolve/resolv.conf"),
    Path("/etc/resolv.conf"),
):
    try:
        lines = resolver_path.read_text(encoding="utf-8").splitlines()
    except OSError:
        continue

    candidates = []
    for line in lines:
        fields = line.split()
        if len(fields) < 2 or fields[0] != "nameserver":
            continue
        try:
            address = ipaddress.ip_address(fields[1].split("%", 1)[0])
        except ValueError:
            continue
        if address.is_loopback or address.is_link_local or address.is_unspecified or address.is_multicast:
            continue
        if str(address) not in candidates:
            candidates.append(str(address))
    if candidates:
        servers = sorted(candidates, key=lambda value: (ipaddress.ip_address(value).version != 4, candidates.index(value)))
        break

if not servers:
    raise SystemExit(
        "No se encontró un servidor DNS accesible para el builder de BuildKit. "
        "Configura un DNS ascendente en el VPS y vuelve a intentar."
    )

Path(sys.argv[1]).write_text(
    "[dns]\nnameservers = " + json.dumps(servers) + "\n",
    encoding="utf-8",
)
PY

configuration_hash="$(sha256sum "${temporary_config}" | awk '{print $1}')"
[[ "${configuration_hash}" =~ ^[a-f0-9]{64}$ ]] || fail "No se pudo calcular el hash de la configuración DNS."

builder_exists=false
if docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1; then
  [[ -r "${CONFIG_HASH_FILE}" && ! -L "${CONFIG_HASH_FILE}" ]] \
    || fail "El builder reservado ${BUILDER_NAME} existe sin una huella de configuración administrada."
  recorded_hash="$(tr -d '\r\n' < "${CONFIG_HASH_FILE}")"
  [[ "${recorded_hash}" =~ ^[a-f0-9]{64}$ ]] \
    || fail "La huella de configuración del builder ${BUILDER_NAME} no es válida."
  if [[ "${recorded_hash}" != "${configuration_hash}" ]]; then
    printf 'Actualizando los servidores DNS del builder aislado de BuildKit.\n'
    docker buildx rm --force "${BUILDER_NAME}" \
      || fail "No se pudo retirar el builder anterior de VPS Manager."
  else
    builder_exists=true
  fi
fi

install -m 0644 "${temporary_config}" "${CONFIG_FILE}"
temporary_hash="$(mktemp "${CONFIG_DIRECTORY}/vps-manager-buildkitd.sha256.XXXXXX")"
printf '%s\n' "${configuration_hash}" > "${temporary_hash}"
chmod 0644 "${temporary_hash}"
mv -f -- "${temporary_hash}" "${CONFIG_HASH_FILE}"
temporary_hash=""

if [[ "${builder_exists}" != "true" ]]; then
  docker buildx create \
    --name "${BUILDER_NAME}" \
    --driver docker-container \
    --driver-opt network=bridge \
    --buildkitd-config "${CONFIG_FILE}" >/dev/null \
    || fail "No se pudo crear el builder aislado de BuildKit."
fi

docker buildx inspect "${BUILDER_NAME}" --bootstrap >/dev/null \
  || fail "No se pudo iniciar el builder aislado de BuildKit."
printf 'Builder aislado de BuildKit listo: %s.\n' "${BUILDER_NAME}"
