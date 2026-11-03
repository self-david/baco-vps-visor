#!/usr/bin/env bash
set -Eeuo pipefail

readonly INSTALL_DIR="/opt/vps-manager"
readonly SERVICE_NAME="vps-manager_manager"
readonly API_BASE="https://api.github.com/repos"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || fail "Ejecuta como root: sudo vps-manager-update"
command -v docker >/dev/null 2>&1 || fail "Docker no está instalado."
command -v curl >/dev/null 2>&1 || fail "curl no está instalado."
command -v python3 >/dev/null 2>&1 || fail "Python 3 no está instalado."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum no está instalado."
command -v tar >/dev/null 2>&1 || fail "tar no está instalado."
[[ -r "${INSTALL_DIR}/install.env" && -r "${INSTALL_DIR}/version" ]] \
  || fail "No se encontró una instalación compatible de VPS Manager."

set -a
. "${INSTALL_DIR}/install.env"
set +a

REPOSITORY="${VPS_MANAGER_GITHUB_REPOSITORY:-}"
[[ "${REPOSITORY}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
  || fail "Configura VPS_MANAGER_GITHUB_REPOSITORY=owner/repo en ${INSTALL_DIR}/install.env."
CURRENT_VERSION="$(cat "${INSTALL_DIR}/version")"
[[ "${CURRENT_VERSION}" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] \
  || fail "La versión instalada no tiene un formato semver compatible."

TEMP_DIRECTORY="$(mktemp -d)"
cleanup() { rm -rf -- "${TEMP_DIRECTORY}"; }
trap cleanup EXIT

printf 'Consultando releases de %s...\n' "${REPOSITORY}"
curl --fail --silent --show-error --location --retry 2 \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  -H 'User-Agent: VPS-Manager-updater' \
  "${API_BASE}/${REPOSITORY}/releases/latest" \
  -o "${TEMP_DIRECTORY}/release.json"

RELEASE_DATA="$(python3 - "${TEMP_DIRECTORY}/release.json" "${REPOSITORY}" <<'PY'
import json
import re
import sys
from urllib.parse import quote

with open(sys.argv[1], encoding="utf-8") as release_file:
    release = json.load(release_file)
repository = sys.argv[2]
tag = release.get("tag_name", "")
version = tag[1:] if tag.startswith("v") else tag
if release.get("draft") or release.get("prerelease") or not re.fullmatch(
    r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", version
):
    raise SystemExit("La última release no tiene un tag estable semver compatible.")
assets = release.get("assets", [])
archive = next(
    (asset for asset in assets if asset.get("name") == "vps-manager-source.tar.gz"),
    None,
)
if archive is None:
    raise SystemExit("La release no incluye vps-manager-source.tar.gz.")
expected_url = (
    f"https://github.com/{repository}/releases/download/"
    f"{quote(tag, safe='')}/vps-manager-source.tar.gz"
)
if archive.get("browser_download_url") != expected_url:
    raise SystemExit("La URL del archivo de la release no coincide con GitHub.")
digest = archive.get("digest", "")
match = re.fullmatch(r"sha256:([a-fA-F0-9]{64})", digest)
if not match:
    raise SystemExit("GitHub no reportó un digest SHA-256 válido para el archivo.")
print(tag, version, expected_url, match.group(1).lower(), sep="\t")
PY
)" || fail "No se pudo validar la release de GitHub."
IFS=$'\t' read -r RELEASE_TAG RELEASE_VERSION ARCHIVE_URL EXPECTED_DIGEST <<< "${RELEASE_DATA}"

if ! python3 - "${CURRENT_VERSION}" "${RELEASE_VERSION}" <<'PY'
import sys
current = tuple(map(int, sys.argv[1].split(".")))
latest = tuple(map(int, sys.argv[2].split(".")))
raise SystemExit(0 if latest > current else 1)
PY
then
  printf 'VPS Manager ya está actualizado (versión %s).\n' "${CURRENT_VERSION}"
  exit 0
fi

printf 'Nueva versión verificada: %s (actual: %s).\n' "${RELEASE_TAG}" "${CURRENT_VERSION}"
docker service inspect "${SERVICE_NAME}" >/dev/null \
  || fail "No se encontró el servicio ${SERVICE_NAME}."

MANAGER_CONTAINER="$(docker ps \
  --filter "label=com.docker.swarm.service.name=${SERVICE_NAME}" \
  --format '{{.ID}}')"
[[ -n "${MANAGER_CONTAINER}" && "${MANAGER_CONTAINER}" != *$'\n'* ]] \
  || fail "No se encontró exactamente una tarea activa del panel para respaldar PostgreSQL."
printf 'Creando respaldo cifrado preventivo de PostgreSQL...\n'
docker exec --user 1000:1000 "${MANAGER_CONTAINER}" node --input-type=module -e \
  'import { createBackupManager } from "/app/backup-manager.mjs"; const backup = await createBackupManager().create(); console.log(`Respaldo preventivo: ${backup.id}`);'

curl --fail --silent --show-error --location --retry 2 \
  -H 'User-Agent: VPS-Manager-updater' \
  "${ARCHIVE_URL}" \
  -o "${TEMP_DIRECTORY}/source.tar.gz"
ACTUAL_DIGEST="$(sha256sum "${TEMP_DIRECTORY}/source.tar.gz" | awk '{print $1}')"
[[ "${ACTUAL_DIGEST}" == "${EXPECTED_DIGEST}" ]] \
  || fail "El SHA-256 del archivo descargado no coincide con el digest de GitHub."

python3 - "${TEMP_DIRECTORY}/source.tar.gz" <<'PY'
import sys
import tarfile

with tarfile.open(sys.argv[1], "r:gz") as archive:
    members = archive.getmembers()
    if not members:
        raise SystemExit("El archivo de release está vacío.")
    for member in members:
        name = member.name.rstrip("/")
        parts = name.split("/")
        if not name:
            continue
        if member.name.startswith("/") or any(part in ("", ".", "..") for part in parts):
            raise SystemExit("El archivo contiene una ruta no segura.")
        if not member.name.startswith("vps-manager/"):
            raise SystemExit("El archivo no contiene el prefijo esperado.")
        if member.issym() or member.islnk() or member.isdev():
            raise SystemExit("El archivo contiene un tipo de entrada no permitido.")
PY

mkdir "${TEMP_DIRECTORY}/extracted"
tar -xzf "${TEMP_DIRECTORY}/source.tar.gz" \
  --no-same-owner --no-same-permissions -C "${TEMP_DIRECTORY}/extracted"
SOURCE_DIR="${TEMP_DIRECTORY}/extracted/vps-manager"
[[ -f "${SOURCE_DIR}/install.sh" && -f "${SOURCE_DIR}/apps/manager/VERSION" ]] \
  || fail "La release no contiene el instalador o la versión del panel."
[[ "$(tr -d '\r\n' < "${SOURCE_DIR}/apps/manager/VERSION")" == "${RELEASE_VERSION}" ]] \
  || fail "La versión del archivo no coincide con el tag publicado."

printf 'Aplicando la versión %s...\n' "${RELEASE_TAG}"
if ! VPS_MANAGER_SOURCE_DIR="${SOURCE_DIR}" \
  VPS_MANAGER_GITHUB_REPOSITORY="${REPOSITORY}" \
  bash "${SOURCE_DIR}/install.sh"; then
  printf 'La actualización no terminó correctamente; intentando restaurar el servicio anterior...\n' >&2
  docker service update --rollback --detach=false "${SERVICE_NAME}" \
    || printf 'ADVERTENCIA: Swarm no pudo revertir automáticamente el servicio.\n' >&2
  fail "La actualización falló. Revisa el diagnóstico y los logs de Swarm."
fi

printf 'VPS Manager actualizado de %s a %s.\n' "${CURRENT_VERSION}" "${RELEASE_VERSION}"
