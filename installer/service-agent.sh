#!/usr/bin/env bash
set -Eeuo pipefail

readonly STATE_DIRECTORY="/var/lib/vps-manager/service-operations"
readonly REQUEST_FILE="${STATE_DIRECTORY}/request.json"
readonly STATUS_FILE="${STATE_DIRECTORY}/status.json"
readonly REGISTRY_DIRECTORY="/var/lib/vps-manager/registry"
readonly REGISTRY_CONFIG_FILE="${REGISTRY_DIRECTORY}/config.json"

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
if (( request_size > 4096 )); then
  rm -f -- "${REQUEST_FILE}"
  echo "Rejected an oversized service operation request." >&2
  exit 1
fi

request_data="$(python3 - "${REQUEST_FILE}" <<'PY'
import json
import hashlib
import os
import re
import stat
import sys

with open(sys.argv[1], encoding="utf-8") as request_file:
    request = json.load(request_file)
if not isinstance(request, dict):
    raise SystemExit("Invalid service operation request.")
if not re.fullmatch(
    r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}",
    str(request.get("id", "")),
):
    raise SystemExit("Invalid service operation request identifier.")
project_id = "-"
commit_sha = "-"
application_id = "-"
application_instance_id = "-"
registry_domain = "-"
registry_username = "-"
node_address = "-"
node_ssh_user = "-"
node_ssh_port = "-"
node_fingerprint = "-"
node_private_cidr = "-"
manager_private_address = "-"
node_role = "-"
container_id = "-"
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
elif request.get("operation") in {"stop-container", "restart-container"}:
    if set(request) != common_fields | {"containerId"} \
        or not isinstance(request["containerId"], str) \
        or not re.fullmatch(r"[a-fA-F0-9]{12,64}", request["containerId"]):
        raise SystemExit("Invalid container operation request fields.")
    container_id = request["containerId"]
    replicas = "-"
elif request.get("operation") in {"install-gitea", "install-n8n"}:
    if set(request) != {"id", "operation", "domain"}:
        raise SystemExit("Invalid application installation request fields.")
    local_gitea_domain = request.get("operation") == "install-gitea" and request.get("domain") == "localhost"
    if not isinstance(request["domain"], str) or not local_gitea_domain and (
        not re.fullmatch(
            r"(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}",
            request["domain"],
        ) or re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", request["domain"])
    ):
        raise SystemExit("Invalid Gitea domain.")
    service_id = "-"
    replicas = "-"
elif request.get("operation") == "install-postgresql":
    if set(request) != {"id", "operation"}:
        raise SystemExit("Invalid PostgreSQL installation request fields.")
    service_id = "-"
    replicas = "-"
elif request.get("operation") == "configure-gitea-token":
    if set(request) != {"id", "operation", "token"}:
        raise SystemExit("Invalid Gitea token configuration request fields.")
    if not isinstance(request["token"], str) or not re.fullmatch(r"[A-Za-z0-9._-]{20,512}", request["token"]):
        raise SystemExit("Invalid Gitea API token.")
    service_id = "-"
    replicas = "-"
    project_id = "-"
    commit_sha = "-"
elif request.get("operation") == "configure-registry":
    if set(request) != {"id", "operation", "domain", "username"}:
        raise SystemExit("Invalid private registry configuration request fields.")
    if not isinstance(request["domain"], str) or not re.fullmatch(
        r"(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}",
        request["domain"],
    ) or re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", request["domain"]) \
        or re.search(r"\.(?:localhost|local|internal|test|example|invalid|onion|home|lan)$", request["domain"], re.IGNORECASE):
        raise SystemExit("Invalid private registry domain.")
    if not isinstance(request["username"], str) or not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", request["username"]):
        raise SystemExit("Invalid private registry username.")
    credential_path = f"/var/lib/vps-manager/service-operations/registry-credentials-{request['id']}.json"
    credential_descriptor = os.open(credential_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        credential_metadata = os.fstat(credential_descriptor)
        if not stat.S_ISREG(credential_metadata.st_mode) or credential_metadata.st_mode & 0o077 \
            or credential_metadata.st_size > 2048:
            raise SystemExit("Invalid private registry credentials file.")
        with os.fdopen(credential_descriptor, encoding="utf-8") as credential_file:
            credential_descriptor = -1
            credentials = json.load(credential_file)
    finally:
        if credential_descriptor >= 0:
            os.close(credential_descriptor)
    if not isinstance(credentials, dict) \
        or credentials.get("requestId") != request["id"] \
        or credentials.get("domain") != request["domain"] \
        or credentials.get("username") != request["username"] \
        or not isinstance(credentials.get("password"), str) \
        or not re.fullmatch(r"[A-Za-z0-9._-]{20,72}", credentials["password"]):
        raise SystemExit("Invalid private registry credentials.")
    service_id = "-"
    replicas = "-"
    registry_domain = request["domain"].lower()
    registry_username = request["username"]
elif request.get("operation") == "build-project":
    if set(request) != {"id", "operation", "projectId", "commitSha"}:
        raise SystemExit("Invalid project image build request fields.")
    if not re.fullmatch(
        r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}",
        str(request["projectId"]),
    ):
        raise SystemExit("Invalid project image build identifier.")
    if not re.fullmatch(r"(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})", str(request["commitSha"])):
        raise SystemExit("Invalid project image build commit.")
    service_id = "-"
    replicas = "-"
    project_id = request["projectId"].lower()
    commit_sha = request["commitSha"].lower()
elif request.get("operation") == "deploy-project":
    if set(request) != {"id", "operation", "projectId", "commitSha"}:
        raise SystemExit("Invalid project deployment request fields.")
    if not re.fullmatch(
        r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}",
        str(request["projectId"]),
    ):
        raise SystemExit("Invalid project deployment identifier.")
    if not re.fullmatch(r"(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})", str(request["commitSha"])):
        raise SystemExit("Invalid project deployment commit.")
    service_id = "-"
    replicas = "-"
    project_id = request["projectId"].lower()
    commit_sha = request["commitSha"].lower()
elif request.get("operation") == "remove-project":
    if set(request) != {"id", "operation", "projectId"}:
        raise SystemExit("Invalid project removal request fields.")
    if not re.fullmatch(
        r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}",
        str(request["projectId"]),
    ):
        raise SystemExit("Invalid project removal identifier.")
    service_id = "-"
    replicas = "-"
    project_id = request["projectId"].lower()
elif request.get("operation") == "deploy-application":
    if set(request) != {"id", "operation", "applicationId", "instanceId"}:
        raise SystemExit("Invalid manual application deployment request fields.")
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,62}", str(request["applicationId"])):
        raise SystemExit("Invalid manual application identifier.")
    if not re.fullmatch(
        r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}",
        str(request["instanceId"]),
    ):
        raise SystemExit("Invalid manual application instance identifier.")
    service_id = "-"
    replicas = "-"
    application_id = request["applicationId"]
    application_instance_id = request["instanceId"].lower()
elif request.get("operation") == "enroll-swarm-node":
    if set(request) != {
        "id", "operation", "address", "sshUser", "sshPort",
        "hostFingerprint", "privateCidr", "managerAddress", "role",
    }:
        raise SystemExit("Invalid Swarm node enrollment request fields.")
    import ipaddress
    try:
        node_ip = ipaddress.ip_address(request["address"])
        manager_ip = ipaddress.ip_address(request["managerAddress"])
        private_network = ipaddress.ip_network(request["privateCidr"], strict=False)
    except (ValueError, TypeError):
        raise SystemExit("Invalid private Swarm node network.")
    private_ranges = [
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
        ipaddress.ip_network("100.64.0.0/10"),
    ]
    if private_network.version != 4 or not 8 <= private_network.prefixlen <= 30 \
        or node_ip.version != 4 or manager_ip.version != 4 \
        or not any(node_ip in network for network in private_ranges) \
        or not any(manager_ip in network for network in private_ranges) \
        or node_ip not in private_network or manager_ip not in private_network:
        raise SystemExit("Swarm node addresses must be inside a private IPv4 CIDR.")
    if not isinstance(request["sshUser"], str) or not re.fullmatch(r"[a-z_][a-z0-9_-]{0,31}", request["sshUser"]) \
        or request["sshUser"] == "root" \
        or not isinstance(request["sshPort"], int) or isinstance(request["sshPort"], bool) \
        or not 1 <= request["sshPort"] <= 65535 \
        or not isinstance(request["hostFingerprint"], str) \
        or not re.fullmatch(r"SHA256:[A-Za-z0-9+/]{43}", request["hostFingerprint"]) \
        or request["role"] not in {"worker", "manager"}:
        raise SystemExit("Invalid SSH access or Swarm node role.")
    service_id = "-"
    replicas = "-"
    node_address = str(node_ip)
    node_ssh_user = request["sshUser"]
    node_ssh_port = str(request["sshPort"])
    node_fingerprint = request["hostFingerprint"]
    node_private_cidr = str(private_network)
    manager_private_address = str(manager_ip)
    node_role = request["role"]
else:
    raise SystemExit("Invalid service operation request fields.")
if request["operation"] in {"restart-service", "scale-service", "stop-container", "restart-container"} and not re.fullmatch(
    r"[a-zA-Z0-9]{25,64}", str(request["serviceId"])
):
    raise SystemExit("Invalid Docker Swarm service identifier.")
print(f'{request["id"]}\t{request["operation"]}\t{request.get("serviceId", "-")}\t{replicas}\t{request.get("domain", "-")}\t{request.get("token", "-")}\t{project_id}\t{commit_sha}\t{registry_domain}\t{registry_username}\t{node_address}\t{node_ssh_user}\t{node_ssh_port}\t{node_fingerprint}\t{node_private_cidr}\t{manager_private_address}\t{node_role}\t{application_id}\t{application_instance_id}\t{container_id}')
PY
)" || {
  rm -f -- "${REQUEST_FILE}"
  echo "Rejected an invalid VPS Manager service operation request." >&2
  exit 1
}
IFS=$'\t' read -r request_id operation service_id replicas gitea_domain gitea_api_token project_id commit_sha registry_domain registry_username node_address node_ssh_user node_ssh_port node_fingerprint node_private_cidr manager_private_address node_role application_id application_instance_id container_id <<< "${request_data}"

write_status() {
  local state="$1"
  local message="$2"
  local temporary_file
  temporary_file="$(mktemp "${STATE_DIRECTORY}/status.XXXXXX")"
  if [[ "${operation}" == "install-gitea" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","domain":"%s","credentialsAvailable":%s,"updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${gitea_domain}" "${gitea_credentials_available:-false}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  elif [[ "${operation}" == "install-n8n" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","domain":"%s","updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${gitea_domain}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  elif [[ "${operation}" == "install-postgresql" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","credentialsAvailable":%s,"updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${postgresql_credentials_available:-false}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  elif [[ "${operation}" == "configure-gitea-token" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  elif [[ "${operation}" == "configure-registry" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","domain":"%s","username":"%s","updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${registry_domain}" "${registry_username}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  elif [[ "${operation}" == "build-project" ]]; then
    if [[ "${state}" == "succeeded" ]]; then
      printf '{"id":"%s","operation":"%s","state":"%s","projectId":"%s","commitSha":"%s","image":"%s","updatedAt":"%s","message":"%s"}\n' \
        "${request_id}" "${operation}" "${state}" "${project_id}" "${commit_sha}" "${built_image}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
    else
      printf '{"id":"%s","operation":"%s","state":"%s","projectId":"%s","commitSha":"%s","updatedAt":"%s","message":"%s"}\n' \
        "${request_id}" "${operation}" "${state}" "${project_id}" "${commit_sha}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
    fi
  elif [[ "${operation}" == "deploy-project" ]]; then
    if [[ "${state}" == "succeeded" ]]; then
      printf '{"id":"%s","operation":"%s","state":"%s","projectId":"%s","commitSha":"%s","serviceId":"%s","image":"%s","updatedAt":"%s","message":"%s"}\n' \
        "${request_id}" "${operation}" "${state}" "${project_id}" "${commit_sha}" "${service_id}" "${built_image}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
    else
      printf '{"id":"%s","operation":"%s","state":"%s","projectId":"%s","commitSha":"%s","updatedAt":"%s","message":"%s"}\n' \
        "${request_id}" "${operation}" "${state}" "${project_id}" "${commit_sha}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
    fi
  elif [[ "${operation}" == "remove-project" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","projectId":"%s","updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${project_id}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  elif [[ "${operation}" == "deploy-application" ]]; then
    if [[ "${state}" == "succeeded" ]]; then
      printf '{"id":"%s","operation":"%s","state":"%s","applicationId":"%s","instanceId":"%s","serviceId":"%s","updatedAt":"%s","message":"%s"}\n' \
        "${request_id}" "${operation}" "${state}" "${application_id}" "${application_instance_id}" "${service_id}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
    else
      printf '{"id":"%s","operation":"%s","state":"%s","applicationId":"%s","instanceId":"%s","updatedAt":"%s","message":"%s"}\n' \
        "${request_id}" "${operation}" "${state}" "${application_id}" "${application_instance_id}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
    fi
  elif [[ "${operation}" == "enroll-swarm-node" ]]; then
    if [[ "${state}" == "succeeded" ]]; then
      printf '{"id":"%s","operation":"%s","state":"%s","nodeAddress":"%s","sshUser":"%s","sshPort":%s,"hostFingerprint":"%s","privateCidr":"%s","managerAddress":"%s","role":"%s","nodeId":"%s","updatedAt":"%s","message":"%s"}\n' \
        "${request_id}" "${operation}" "${state}" "${node_address}" "${node_ssh_user}" "${node_ssh_port}" "${node_fingerprint}" "${node_private_cidr}" "${manager_private_address}" "${node_role}" "${node_id}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
    else
      printf '{"id":"%s","operation":"%s","state":"%s","nodeAddress":"%s","sshUser":"%s","sshPort":%s,"hostFingerprint":"%s","privateCidr":"%s","managerAddress":"%s","role":"%s","updatedAt":"%s","message":"%s"}\n' \
        "${request_id}" "${operation}" "${state}" "${node_address}" "${node_ssh_user}" "${node_ssh_port}" "${node_fingerprint}" "${node_private_cidr}" "${manager_private_address}" "${node_role}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
    fi
  elif [[ "${operation}" == "scale-service" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","serviceId":"%s","replicas":%s,"updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${service_id}" "${replicas}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  elif [[ "${operation}" == "stop-container" || "${operation}" == "restart-container" ]]; then
    printf '{"id":"%s","operation":"%s","state":"%s","serviceId":"%s","containerId":"%s","updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${service_id}" "${container_id}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  else
    printf '{"id":"%s","operation":"%s","state":"%s","serviceId":"%s","updatedAt":"%s","message":"%s"}\n' \
      "${request_id}" "${operation}" "${state}" "${service_id}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${message}" > "${temporary_file}"
  fi
  chmod 0644 "${temporary_file}"
  mv -f -- "${temporary_file}" "${STATUS_FILE}"
  if [[ "${operation}" == "configure-registry" && "${state}" != "running" ]]; then
    registry_status_written=true
  fi
}

if [[ "${operation}" == "install-gitea" ]]; then
  write_status "running" "Preparando la instalación segura de Gitea."
elif [[ "${operation}" == "install-n8n" ]]; then
  write_status "running" "Preparando el despliegue persistente y seguro de n8n."
elif [[ "${operation}" == "install-postgresql" ]]; then
  write_status "running" "Preparando el despliegue privado y persistente de PostgreSQL."
elif [[ "${operation}" == "configure-gitea-token" ]]; then
  write_status "running" "Actualizando de forma segura el secreto del token de Gitea."
elif [[ "${operation}" == "configure-registry" ]]; then
  write_status "running" "Configurando el registro privado en el VPS."
elif [[ "${operation}" == "build-project" ]]; then
  write_status "running" "Preparando el contexto local de construcción."
elif [[ "${operation}" == "deploy-project" ]]; then
  write_status "running" "Preparando el despliegue privado del proyecto."
elif [[ "${operation}" == "remove-project" ]]; then
  write_status "running" "Validando el retiro del servicio del proyecto."
elif [[ "${operation}" == "deploy-application" ]]; then
  write_status "running" "Validando la configuración de la aplicación manual."
elif [[ "${operation}" == "enroll-swarm-node" ]]; then
  write_status "running" "Validando red privada, UFW y acceso SSH del VPS destino."
elif [[ "${operation}" == "scale-service" ]]; then
  write_status "running" "Escalado de servicio en curso."
elif [[ "${operation}" == "stop-container" ]]; then
  write_status "running" "Deteniendo temporalmente la tarea; Swarm la repondrá."
elif [[ "${operation}" == "restart-container" ]]; then
  write_status "running" "Reinicio de contenedor en curso."
else
  write_status "running" "Reinicio de servicio en curso."
fi
rm -f -- "${REQUEST_FILE}"

if ! command -v docker >/dev/null 2>&1; then
  write_status "failed" "Docker no está disponible en el host."
  echo "Docker is not installed." >&2
  exit 1
fi

if [[ "${operation}" == "build-project" ]]; then
  archive="${STATE_DIRECTORY}/build-source-${request_id}.zip"
  build_directory=""
  docker_config_directory=""
  cleanup_project_build() {
    if [[ -n "${build_directory}" ]]; then rm -rf -- "${build_directory}"; fi
    if [[ -n "${docker_config_directory}" ]]; then rm -rf -- "${docker_config_directory}"; fi
    rm -f -- "${archive}"
  }
  trap cleanup_project_build EXIT

  if [[ -L "${archive}" || ! -f "${archive}" ]]; then
    write_status "failed" "No se encontró el archivo seguro del código del proyecto."
    exit 1
  fi
  archive_size="$(stat -c '%s' "${archive}")"
  if (( archive_size < 4 || archive_size > 33554432 )); then
    write_status "failed" "El archivo del código supera el límite permitido o está vacío."
    exit 1
  fi
  if ! docker buildx version >/dev/null 2>&1; then
    write_status "failed" "Docker Buildx (BuildKit) no está disponible en el host."
    exit 1
  fi

  build_directory="$(mktemp -d /tmp/vps-manager-project-build.XXXXXX)"
  context_directory="${build_directory}/context"
  install -d -m 0700 "${context_directory}"
  if ! python3 - "${archive}" "${context_directory}" <<'PY'
import pathlib
import shutil
import stat
import sys
import zipfile

archive_path = pathlib.Path(sys.argv[1])
destination = pathlib.Path(sys.argv[2]).resolve()
maximum_files = 100_000
maximum_uncompressed = 1024 * 1024 * 1024

try:
    with zipfile.ZipFile(archive_path) as source:
        entries = source.infolist()
        if not entries or len(entries) > maximum_files:
            raise ValueError("archive entry count is invalid")
        root_name = None
        total_size = 0
        file_count = 0
        for entry in entries:
            name = entry.filename
            if not name or "\\" in name or name.startswith("/"):
                raise ValueError("archive path is invalid")
            parts = name.rstrip("/").split("/")
            if not parts or any(part in {"", ".", ".."} for part in parts):
                raise ValueError("archive path traversal rejected")
            if root_name is None:
                root_name = parts[0]
            if parts[0] != root_name:
                raise ValueError("archive must contain one root directory")
            if len(parts) == 1:
                if not entry.is_dir():
                    raise ValueError("archive root must be a directory")
                continue
            mode = (entry.external_attr >> 16) & 0o170000
            if mode == stat.S_IFLNK or mode not in {0, stat.S_IFREG, stat.S_IFDIR}:
                raise ValueError("archive contains a non-regular file")
            relative_parts = parts[1:]
            target = destination.joinpath(*relative_parts)
            if not target.resolve().is_relative_to(destination):
                raise ValueError("archive path escaped the build context")
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            file_count += 1
            total_size += entry.file_size
            if file_count > maximum_files or total_size > maximum_uncompressed:
                raise ValueError("archive expands beyond the build context limits")
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.open(entry) as input_file, target.open("xb") as output_file:
                shutil.copyfileobj(input_file, output_file, length=1024 * 1024)
            target.chmod(0o644 | (0o111 if mode == stat.S_IFREG and (entry.external_attr >> 16) & 0o111 else 0))
    if root_name is None or file_count == 0:
        raise ValueError("archive has no source files")
except (OSError, zipfile.BadZipFile, RuntimeError, ValueError) as error:
    print(f"Rejected project source archive: {error}", file=sys.stderr)
    raise SystemExit(1)
PY
  then
    write_status "failed" "Gitea devolvió un archivo inválido o fuera de los límites seguros."
    exit 1
  fi
  if [[ -L "${context_directory}/Dockerfile" || ! -f "${context_directory}/Dockerfile" ]]; then
    write_status "failed" "El repositorio no contiene un Dockerfile regular en su raíz."
    exit 1
  fi

  if [[ -L "${REGISTRY_CONFIG_FILE}" || ! -f "${REGISTRY_CONFIG_FILE}" ]]; then
    write_status "failed" "Configura primero el registro privado desde el panel."
    exit 1
  fi
  docker_config_directory="$(mktemp -d /tmp/vps-manager-registry-auth.XXXXXX)"
  chmod 0700 "${docker_config_directory}"
  if ! registry_domain="$(python3 - "${REGISTRY_CONFIG_FILE}" "${docker_config_directory}/config.json" <<'PY'
import base64
import json
import os
import re
import stat
import sys

config_path, docker_config_path = sys.argv[1:]
descriptor = os.open(config_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
try:
    metadata = os.fstat(descriptor)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & 0o077:
        raise ValueError("registry credentials file permissions are invalid")
    with os.fdopen(descriptor, encoding="utf-8") as config_file:
        descriptor = -1
        configuration = json.load(config_file)
finally:
    if descriptor >= 0:
        os.close(descriptor)
domain = configuration.get("domain")
username = configuration.get("username")
password = configuration.get("password")
if not isinstance(domain, str) or not re.fullmatch(
    r"(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}",
    domain,
) or re.search(r"\.(?:localhost|local|internal|test|example|invalid|onion|home|lan)$", domain, re.IGNORECASE):
    raise SystemExit("The configured registry domain is invalid.")
if not isinstance(username, str) or not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", username):
    raise SystemExit("The configured registry username is invalid.")
if not isinstance(password, str) or not re.fullmatch(r"[A-Za-z0-9._-]{20,72}", password):
    raise SystemExit("The configured registry password is invalid.")
auth = base64.b64encode(f"{username}:{password}".encode()).decode()
temporary = f"{docker_config_path}.tmp"
descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w", encoding="utf-8") as config_file:
    json.dump({"auths": {domain.lower(): {"auth": auth}}}, config_file)
    config_file.write("\n")
os.replace(temporary, docker_config_path)
print(domain.lower())
PY
  )"; then
    write_status "failed" "No se pudo leer de forma segura la configuración del registro."
    exit 1
  fi

  built_image="${registry_domain}/vps-manager-project-${project_id//-/}:${commit_sha}"
  if ! DOCKER_CONFIG="${docker_config_directory}" docker buildx build \
    --pull \
    --push \
    --tag "${built_image}" \
    --label vps-manager.managed=true \
    --label "vps-manager.project-id=${project_id}" \
    --label "vps-manager.commit=${commit_sha}" \
    --file "${context_directory}/Dockerfile" \
    "${context_directory}"; then
    write_status "failed" "BuildKit no pudo construir o publicar la imagen en el registro privado."
    exit 1
  fi
  write_status "succeeded" "Imagen construida y publicada en el registro privado; no fue desplegada."
  exit 0
fi

if [[ "${operation}" == "configure-registry" ]]; then
  readonly REGISTRY_SERVICE="vps-manager_registry"
  registry_credentials_path="${STATE_DIRECTORY}/registry-credentials-${request_id}.json"
  htpasswd_file="$(mktemp "${STATE_DIRECTORY}/registry-htpasswd.XXXXXX")"
  new_secret="vps_manager_registry_auth_${request_id//-/}"
  old_secret=""
  registry_configuration_temp=""
  registry_configuration_succeeded=false
  registry_status_written=false
  cleanup_registry_configuration() {
    local exit_code="$?"
    rm -f -- "${htpasswd_file}" "${registry_credentials_path}"
    if [[ -n "${registry_configuration_temp}" ]]; then rm -f -- "${registry_configuration_temp}"; fi
    if [[ "${registry_configuration_succeeded:-false}" != "true" ]]; then
      service_secret=""
      if docker service inspect "${REGISTRY_SERVICE}" >/dev/null 2>&1; then
        service_secret="$(docker service inspect --format '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{.SecretName}}{{end}}' "${REGISTRY_SERVICE}" 2>/dev/null || true)"
      fi
      if [[ "${service_secret}" != "${new_secret}" ]]; then
        docker secret rm "${new_secret}" >/dev/null 2>&1 || true
      fi
    fi
    if (( exit_code != 0 )) && [[ "${registry_status_written}" != "true" ]]; then
      write_status "failed" "No se pudo completar la configuración del registro privado." || true
    fi
  }
  trap cleanup_registry_configuration EXIT
  chmod 0600 "${htpasswd_file}"

  if ! command -v htpasswd >/dev/null 2>&1; then
    write_status "failed" "No está disponible htpasswd para proteger el registro."
    exit 1
  fi
  if ! python3 -c 'import json, sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["password"])' \
    "${registry_credentials_path}" | htpasswd -Bni "${registry_username}" > "${htpasswd_file}"; then
    write_status "failed" "No se pudieron preparar las credenciales protegidas del registro."
    exit 1
  fi
  install -d -o root -g root -m 0700 "${REGISTRY_DIRECTORY}"
  registry_configuration_temp="$(mktemp "${REGISTRY_DIRECTORY}/config.XXXXXX")"
  chmod 0600 "${registry_configuration_temp}"
  python3 - "${registry_credentials_path}" "${registry_configuration_temp}" "${request_id}" "${registry_domain}" "${registry_username}" <<'PY'
import json
import os
import re
import stat
import sys

source_path, path, request_id, domain, username = sys.argv[1:]
descriptor = os.open(source_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
try:
    metadata = os.fstat(descriptor)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & 0o077:
        raise ValueError("registry credentials file permissions are invalid")
    with os.fdopen(descriptor, encoding="utf-8") as source_file:
        descriptor = -1
        staged = json.load(source_file)
finally:
    if descriptor >= 0:
        os.close(descriptor)
if not isinstance(staged, dict) or staged.get("requestId") != request_id \
    or staged.get("domain", "").lower() != domain or staged.get("username") != username \
    or not re.fullmatch(r"[A-Za-z0-9._-]{20,72}", staged.get("password", "")):
    raise SystemExit("Staged registry credentials do not match the request.")
with open(path, "w", encoding="utf-8") as config_file:
    json.dump({"domain": domain, "username": username, "password": staged["password"]}, config_file)
    config_file.write("\n")
os.chmod(path, 0o600)
PY
  if docker secret inspect "${new_secret}" >/dev/null 2>&1; then
    write_status "failed" "El identificador de esta configuración ya está en uso."
    exit 1
  fi
  if ! docker secret create \
    --label vps-manager.managed=true \
    --label vps-manager.component=registry-auth \
    "${new_secret}" "${htpasswd_file}" >/dev/null; then
    write_status "failed" "No se pudo guardar el secreto de autenticación del registro."
    exit 1
  fi

  registry_labels=(
    --label-add vps-manager.managed=true
    --label-add vps-manager.component=registry
    --label-add traefik.enable=true
    --label-add traefik.swarm.network=vps-manager-proxy
    --label-add "traefik.http.routers.vps-manager-registry.rule=Host(\`${registry_domain}\`)"
    --label-add traefik.http.routers.vps-manager-registry.entrypoints=websecure
    --label-add traefik.http.routers.vps-manager-registry.tls=true
    --label-add traefik.http.routers.vps-manager-registry.tls.certresolver=vpsmanager
    --label-add traefik.http.services.vps-manager-registry.loadbalancer.server.port=5000
  )
  if docker service inspect "${REGISTRY_SERVICE}" >/dev/null 2>&1; then
    service_labels="$(docker service inspect --format '{{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}}' "${REGISTRY_SERVICE}")"
    if [[ "${service_labels}" != "true registry" ]]; then
      write_status "failed" "Ya existe un servicio con el nombre reservado para el registro que no pertenece a VPS Manager."
      exit 1
    fi
    old_secret="$(docker service inspect --format '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{.SecretName}}{{end}}' "${REGISTRY_SERVICE}")"
    if [[ ! "${old_secret}" =~ ^vps_manager_registry_auth_[a-f0-9]{32}$ ]]; then
      write_status "failed" "El registro existente no tiene un secreto de autenticación administrado."
      exit 1
    fi
    if ! docker service update --detach=false \
      --restart-condition any \
      --image registry:3.0.0 \
      --secret-rm "${old_secret}" \
      --secret-add "source=${new_secret},target=htpasswd" \
      --env-add REGISTRY_AUTH=htpasswd \
      --env-add REGISTRY_AUTH_HTPASSWD_PATH=/run/secrets/htpasswd \
      --label-rm traefik.enable \
      --label-rm traefik.swarm.network \
      --label-rm traefik.http.routers.vps-manager-registry.rule \
      --label-rm traefik.http.routers.vps-manager-registry.entrypoints \
      --label-rm traefik.http.routers.vps-manager-registry.tls \
      --label-rm traefik.http.routers.vps-manager-registry.tls.certresolver \
      --label-rm traefik.http.services.vps-manager-registry.loadbalancer.server.port \
      "${registry_labels[@]}" \
      "${REGISTRY_SERVICE}" >/dev/null; then
      write_status "failed" "No se pudo actualizar de forma segura el servicio del registro."
      exit 1
    fi
    if ! docker secret rm "${old_secret}" >/dev/null; then
      write_status "failed" "El registro se actualizó, pero no se pudo retirar el secreto anterior."
      exit 1
    fi
  else
    if ! docker service create --detach=false \
      --name "${REGISTRY_SERVICE}" \
      --replicas 1 \
      --constraint node.role==manager \
      --network vps-manager-proxy \
      --mount type=volume,source=vps-manager-registry-data,target=/var/lib/registry \
      --secret "source=${new_secret},target=htpasswd" \
      --env REGISTRY_AUTH=htpasswd \
      --env REGISTRY_AUTH_HTPASSWD_PATH=/run/secrets/htpasswd \
      "${registry_labels[@]/--label-add/--label}" \
      registry:3.0.0 >/dev/null; then
      write_status "failed" "No se pudo iniciar el servicio privado del registro."
      exit 1
    fi
  fi

  registry_configuration_succeeded=true
  unset registry_password
  mv -f -- "${registry_configuration_temp}" "${REGISTRY_CONFIG_FILE}"
  registry_configuration_temp=""

  public_status_temp="$(mktemp "${STATE_DIRECTORY}/registry-status.XXXXXX")"
  printf '{"domain":"%s","username":"%s"}\n' "${registry_domain}" "${registry_username}" > "${public_status_temp}"
  chmod 0644 "${public_status_temp}"
  mv -f -- "${public_status_temp}" "${STATE_DIRECTORY}/registry-status.json"
  write_status "succeeded" "Registro privado configurado en https://${registry_domain}/ con almacenamiento persistente."
  exit 0
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
  gitea_image_pulled=false
  base_domain="$(sed -n 's/^VPS_MANAGER_DOMAIN=//p' "${INSTALL_ENV}" | head -n 1)"
  test_mode="$(sed -n 's/^VPS_MANAGER_TEST_MODE=//p' "${INSTALL_ENV}" | head -n 1)"
  local_gitea=false
  gitea_migrating=false
  gitea_migration_type=""
  if [[ "${test_mode}" == "true" && "${gitea_domain}" == "localhost" ]]; then
    local_gitea=true
  elif [[ "${test_mode}" == "true" || ! "${base_domain}" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ \
    || "${gitea_domain,,}" != "git.${base_domain,,}" ]]; then
    gitea_credentials_available=false
    write_status "failed" "Gitea requiere una instalación HTTPS con un dominio público; el modo de prueba no es compatible."
    exit 1
  fi
  gitea_admin_email="vpsadmin@${base_domain}"
  if [[ "${local_gitea}" == "true" ]]; then
    gitea_admin_email="vpsadmin@localhost.local"
  fi
  if [[ "${local_gitea}" != "true" ]] && ! docker network inspect vps-manager-proxy >/dev/null 2>&1; then
    gitea_credentials_available=false
    write_status "failed" "No se encontró la red HTTPS de Traefik."
    exit 1
  fi

  if service_info="$(docker service inspect --format '{{.ID}} {{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}} {{index .Spec.Labels "traefik.http.routers.vps-manager-gitea-local.rule"}}' "${GITEA_SERVICE}" 2>/dev/null)"; then
    IFS=' ' read -r _ managed_label component_label local_router_rule <<< "${service_info}"
    if [[ "${managed_label}" != "true" || "${component_label}" != "gitea" ]]; then
      gitea_credentials_available=false
      write_status "failed" "Ya existe un servicio con el nombre reservado para Gitea y no pertenece a VPS Manager."
      exit 1
    fi
    if { [[ "${local_gitea}" == "true" && "${local_router_rule}" != 'Host(`localhost`)&&PathPrefix(`/gitea`)' ]]; } \
      || { [[ "${local_gitea}" != "true" && "${local_router_rule}" == 'Host(`localhost`)&&PathPrefix(`/gitea`)' ]]; }; then
      mounts="$(docker service inspect --format '{{range .Spec.TaskTemplate.ContainerSpec.Mounts}}{{.Source}} {{end}}' "${GITEA_SERVICE}" 2>/dev/null || true)"
      if [[ " ${mounts} " != *" vps-manager-gitea-data "* ]]; then
        gitea_credentials_available=false
        write_status "failed" "No se pudo verificar el volumen persistente de Gitea; no se modificó el servicio existente."
        exit 1
      fi
      if ! docker pull "${GITEA_IMAGE}"; then
        gitea_credentials_available=false
        write_status "failed" "No se pudo descargar la imagen de Gitea; el servicio existente no se modificó."
        exit 1
      fi
      gitea_image_pulled=true
      gitea_migrating=true
      if [[ "${local_gitea}" == "true" ]]; then
        gitea_migration_type="local-upgrade"
      else
        gitea_migration_type="domain"
      fi
      if ! docker service rm "${GITEA_SERVICE}" >/dev/null; then
        gitea_credentials_available=false
        write_status "failed" "No se pudo detener el servicio Gitea para cambiar su acceso."
        exit 1
      fi
      for attempt in $(seq 1 30); do
        if ! docker service inspect "${GITEA_SERVICE}" >/dev/null 2>&1; then break; fi
        sleep 1
      done
      if docker service inspect "${GITEA_SERVICE}" >/dev/null 2>&1; then
        gitea_credentials_available=false
        write_status "failed" "Gitea se detuvo, pero Swarm no liberó el nombre del servicio para la actualización."
        exit 1
      fi
    else
      gitea_credentials_available=false
      write_status "succeeded" "Gitea ya estaba instalado. No se generaron credenciales nuevas."
      exit 0
    fi
  fi

  if [[ "${gitea_migrating}" == "true" ]]; then
    gitea_password=""
  elif [[ ! -e "${CREDENTIALS_FILE}" ]]; then
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

  if [[ "${gitea_migrating}" != "true" ]] && ! systemd-run --quiet --on-active=30m \
    --unit="vps-manager-gitea-credentials-expire-${request_id}" \
    /usr/bin/find "${STATE_DIRECTORY}" -maxdepth 1 -type f \
      -name "gitea-credentials-${request_id}.json*" -delete; then
    rm -f -- "${CREDENTIALS_FILE}"
    gitea_credentials_available=false
    write_status "failed" "No se pudo programar la caducidad de las credenciales iniciales."
    exit 1
  fi

  if [[ "${gitea_image_pulled}" != "true" ]] && ! docker pull "${GITEA_IMAGE}"; then
    gitea_credentials_available=true
    write_status "failed" "No se pudo descargar la imagen fijada de Gitea."
    exit 1
  fi

  gitea_service_args=(
    --name "${GITEA_SERVICE}"
    --replicas 1
    --constraint 'node.role==manager'
    --mount type=volume,source=vps-manager-gitea-data,target=/data
    --env USER_UID=1000
    --env USER_GID=1000
    --env GITEA__database__DB_TYPE=sqlite3
    --env GITEA__security__INSTALL_LOCK=true
    --env GITEA__service__DISABLE_REGISTRATION=true
    --env GITEA__service__REQUIRE_SIGNIN_VIEW=true
    --label vps-manager.managed=true
    --label vps-manager.component=gitea
    --limit-cpu 1
    --limit-memory 768M
    --restart-condition any
  )
  if [[ "${local_gitea}" == "true" ]]; then
    gitea_service_args+=(
      --network vps-manager-proxy
      --env GITEA__server__DOMAIN=localhost
      --env GITEA__server__ROOT_URL=http://localhost:3001/gitea/
      --env GITEA__server__LOCAL_ROOT_URL=http://vps-manager-gitea:3000/
      --env GITEA__server__SSH_DOMAIN=localhost
      --env GITEA__server__START_SSH_SERVER=false
      --label traefik.enable=true
      --label traefik.swarm.network=vps-manager-proxy
      --label 'traefik.http.routers.vps-manager-gitea-local.rule=Host(`localhost`)&&PathPrefix(`/gitea`)'
      --label traefik.http.routers.vps-manager-gitea-local.entrypoints=web
      --label traefik.http.routers.vps-manager-gitea-local.middlewares=vps-manager-gitea-local-chain
      --label traefik.http.middlewares.vps-manager-gitea-local-chain.chain.middlewares=vps-manager-gitea-local-ip,vps-manager-gitea-local-strip
      --label traefik.http.middlewares.vps-manager-gitea-local-ip.ipallowlist.sourcerange=127.0.0.1/32,::1/128
      --label traefik.http.middlewares.vps-manager-gitea-local-strip.stripprefix.prefixes=/gitea
      --label traefik.http.services.vps-manager-gitea-local.loadbalancer.server.port=3000
    )
  else
    gitea_service_args+=(
      --network vps-manager-proxy
      --publish published=2222,target=22,protocol=tcp,mode=host
      --env "GITEA__server__DOMAIN=${gitea_domain}"
      --env "GITEA__server__ROOT_URL=https://${gitea_domain}/"
      --env "GITEA__server__SSH_DOMAIN=${gitea_domain}"
      --env GITEA__server__SSH_PORT=2222
      --env GITEA__server__SSH_LISTEN_PORT=22
      --env GITEA__server__START_SSH_SERVER=true
      --label traefik.enable=true
      --label traefik.swarm.network=vps-manager-proxy
      --label "traefik.http.routers.vps-manager-gitea.rule=Host(\`${gitea_domain}\`)"
      --label traefik.http.routers.vps-manager-gitea.entrypoints=websecure
      --label traefik.http.routers.vps-manager-gitea.tls=true
      --label traefik.http.routers.vps-manager-gitea.tls.certresolver=vpsmanager
      --label traefik.http.services.vps-manager-gitea.loadbalancer.server.port=3000
    )
  fi

  if ! docker service create "${gitea_service_args[@]}" \
    "${GITEA_IMAGE}" >/dev/null; then
    gitea_credentials_available=true
    write_status "failed" "Swarm no pudo crear el servicio Gitea. Verifica la red privada y la disponibilidad de recursos."
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
      && admin_list="$(docker exec --user git "${container_id}" gitea admin user list --admin 2>/dev/null)"; then
      break
    fi
    sleep 2
  done
  if [[ -z "${container_id}" ]]; then
    gitea_credentials_available=true
    write_status "failed" "Gitea no inició a tiempo. El volumen persistente se conservó; revisa los logs del servicio."
    exit 1
  fi

  if [[ "${gitea_migrating}" != "true" ]] \
    && ! awk '{ for (i = 1; i <= NF; i++) if ($i == "vpsadmin") found = 1 } END { exit !found }' <<< "${admin_list}"; then
    if ! docker exec --user git "${container_id}" gitea admin user create \
      --username vpsadmin \
      --password "${gitea_password}" \
      --email "${gitea_admin_email}" \
      --admin; then
      gitea_credentials_available=true
      write_status "failed" "No se pudo crear el administrador inicial de Gitea; los datos persistentes se conservaron."
      exit 1
    fi
  fi
  gitea_credentials_available=true
  if [[ "${gitea_migrating}" == "true" ]]; then
    gitea_credentials_available=false
    if [[ "${gitea_migration_type}" == "domain" ]]; then
      write_status "succeeded" "Gitea migró a https://${gitea_domain}/. Se conservaron el volumen, los repositorios, los usuarios y las credenciales existentes; no se generaron credenciales nuevas."
    else
      write_status "succeeded" "Se actualizó el servicio local de Gitea. Se conservaron la base SQLite, los repositorios y las credenciales existentes; accede mediante http://localhost:3001/gitea/ usando un túnel SSH."
    fi
  elif [[ "${local_gitea}" == "true" ]]; then
    write_status "succeeded" "Gitea está disponible por túnel SSH en http://localhost:3001/gitea/. Las credenciales están disponibles una sola vez durante 30 minutos."
  else
    write_status "succeeded" "Gitea instalado en https://${gitea_domain}/. El administrador inicial puede consultar sus credenciales una sola vez durante 30 minutos."
  fi
  exit 0
fi

if [[ "${operation}" == "install-postgresql" ]]; then
  readonly POSTGRESQL_SERVICE="vps-manager-postgresql"
  readonly POSTGRESQL_IMAGE="postgres:17.11-alpine3.24"
  readonly POSTGRESQL_SECRET="vps-manager-postgresql-password"
  readonly POSTGRESQL_VOLUME="vps-manager-postgresql-data"
  readonly POSTGRESQL_DATABASE="vps_manager_app"
  readonly POSTGRESQL_USERNAME="vps_manager_app"
  readonly POSTGRESQL_CREDENTIALS_FILE="${STATE_DIRECTORY}/postgresql-credentials-${request_id}.json"
  postgresql_credentials_available=false

  if service_info="$(docker service inspect --format '{{.ID}} {{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}}' "${POSTGRESQL_SERVICE}" 2>/dev/null)"; then
    IFS=' ' read -r _ managed_label component_label <<< "${service_info}"
    if [[ "${managed_label}" != "true" || "${component_label}" != "postgresql" ]]; then
      write_status "failed" "Ya existe un servicio con el nombre reservado para PostgreSQL y no pertenece a VPS Manager."
      exit 1
    fi
    if [[ -f "${POSTGRESQL_CREDENTIALS_FILE}" ]]; then
      postgresql_credentials_available=true
    fi
    write_status "succeeded" "PostgreSQL ya estaba instalado; se conservaron el volumen y el secreto de acceso."
    exit 0
  fi

  postgresql_secret_exists=false
  if secret_info="$(docker secret inspect --format '{{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}}' "${POSTGRESQL_SECRET}" 2>/dev/null)"; then
    if [[ "${secret_info}" != "true postgresql-password" ]]; then
      write_status "failed" "El secreto reservado para PostgreSQL existe y no pertenece a VPS Manager."
      exit 1
    fi
    postgresql_secret_exists=true
    if [[ ! -f "${POSTGRESQL_CREDENTIALS_FILE}" ]]; then
      write_status "failed" "Existe un secreto PostgreSQL administrado sin credenciales recuperables para esta tarea; no se reemplazó el secreto ni los datos."
      exit 1
    fi
  fi

  if [[ -e "${POSTGRESQL_CREDENTIALS_FILE}" ]]; then
    postgresql_password="$(python3 - "${POSTGRESQL_CREDENTIALS_FILE}" "${request_id}" <<'PY'
import json
import re
import sys

path, task_id = sys.argv[1:]
with open(path, encoding="utf-8") as credential_file:
    credentials = json.load(credential_file)
if (credentials.get("taskId") != task_id
    or credentials.get("username") != "vps_manager_app"
    or credentials.get("database") != "vps_manager_app"
    or not re.fullmatch(r"[a-f0-9]{64}", credentials.get("password", ""))):
    raise SystemExit("Invalid pending PostgreSQL credentials.")
print(credentials["password"])
PY
    )" || {
      write_status "failed" "No se pudieron validar las credenciales temporales de PostgreSQL."
      exit 1
    }
  else
    postgresql_password="$(python3 - "${POSTGRESQL_CREDENTIALS_FILE}" "${request_id}" <<'PY'
import json
import os
import secrets
import sys

path, task_id = sys.argv[1:]
password = secrets.token_hex(32)
temporary = f"{path}.tmp"
descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o640)
with os.fdopen(descriptor, "w", encoding="utf-8") as credential_file:
    json.dump({
        "taskId": task_id,
        "username": "vps_manager_app",
        "database": "vps_manager_app",
        "password": password,
    }, credential_file)
    credential_file.write("\n")
os.chown(temporary, 0, 1000)
os.replace(temporary, path)
print(password)
PY
    )" || {
      write_status "failed" "No se pudieron generar las credenciales iniciales de PostgreSQL."
      exit 1
    }
  fi
  postgresql_credentials_available=true

  if ! systemd-run --quiet --on-active=30m \
    --unit="vps-manager-postgresql-credentials-expire-${request_id}" \
    /usr/bin/find "${STATE_DIRECTORY}" -maxdepth 1 -type f \
      -name "postgresql-credentials-${request_id}.json*" -delete; then
    rm -f -- "${POSTGRESQL_CREDENTIALS_FILE}"
    postgresql_credentials_available=false
    write_status "failed" "No se pudo programar la caducidad de las credenciales iniciales."
    exit 1
  fi

  secret_file="$(mktemp "${STATE_DIRECTORY}/postgresql-password.XXXXXX")"
  chmod 0600 "${secret_file}"
  trap 'rm -f -- "${secret_file}"' EXIT
  printf '%s' "${postgresql_password}" > "${secret_file}"
  unset postgresql_password

  if [[ "${postgresql_secret_exists}" != "true" ]]; then
    docker secret create \
      --label vps-manager.managed=true \
      --label vps-manager.component=postgresql-password \
      "${POSTGRESQL_SECRET}" "${secret_file}" >/dev/null \
      || { write_status "failed" "No se pudo guardar la contraseña de PostgreSQL como secreto Swarm."; exit 1; }
  fi

  if volume_info="$(docker volume inspect --format '{{index .Labels "vps-manager.managed"}} {{index .Labels "vps-manager.component"}}' "${POSTGRESQL_VOLUME}" 2>/dev/null)"; then
    if [[ "${volume_info}" != "true postgresql" ]]; then
      write_status "failed" "El volumen reservado para PostgreSQL existe y no pertenece a VPS Manager."
      exit 1
    fi
  else
    docker volume create \
      --label vps-manager.managed=true \
      --label vps-manager.component=postgresql \
      "${POSTGRESQL_VOLUME}" >/dev/null \
      || { write_status "failed" "No se pudo crear el volumen persistente de PostgreSQL."; exit 1; }
  fi

  if ! docker pull "${POSTGRESQL_IMAGE}"; then
    write_status "failed" "No se pudo descargar la versión fijada de PostgreSQL."
    exit 1
  fi

  manager_node_id="$(docker info --format '{{.Swarm.NodeID}}' 2>/dev/null)" \
    || { write_status "failed" "No se pudo identificar el manager que conservará los datos de PostgreSQL."; exit 1; }
  [[ "${manager_node_id}" =~ ^[a-zA-Z0-9]{25,64}$ ]] \
    || { write_status "failed" "Docker devolvió un identificador de manager no válido."; exit 1; }

  if ! docker service create \
    --name "${POSTGRESQL_SERVICE}" \
    --replicas 1 \
    --constraint "node.id==${manager_node_id}" \
    --network vps-manager-proxy \
    --mount "type=volume,source=${POSTGRESQL_VOLUME},target=/var/lib/postgresql/data" \
    --secret "source=${POSTGRESQL_SECRET},target=postgresql_password,uid=0,gid=0,mode=0400" \
    --env "POSTGRES_DB=${POSTGRESQL_DATABASE}" \
    --env "POSTGRES_USER=${POSTGRESQL_USERNAME}" \
    --env POSTGRES_PASSWORD_FILE=/run/secrets/postgresql_password \
    --health-cmd "pg_isready -U ${POSTGRESQL_USERNAME} -d ${POSTGRESQL_DATABASE}" \
    --health-interval 10s \
    --health-timeout 5s \
    --health-retries 5 \
    --health-start-period 30s \
    --label vps-manager.managed=true \
    --label vps-manager.component=postgresql \
    --limit-cpu 1 \
    --limit-memory 1G \
    --restart-condition any \
    "${POSTGRESQL_IMAGE}" >/dev/null; then
    write_status "failed" "Swarm no pudo crear el servicio PostgreSQL; el volumen y la contraseña se conservaron."
    exit 1
  fi

  postgresql_running=false
  for _ in $(seq 1 120); do
    container_id="$(docker ps \
      --filter "label=com.docker.swarm.service.name=${POSTGRESQL_SERVICE}" \
      --filter status=running \
      --format '{{.ID}}' | head -n 1)"
    if [[ -n "${container_id}" ]] \
      && docker exec "${container_id}" pg_isready -U "${POSTGRESQL_USERNAME}" -d "${POSTGRESQL_DATABASE}" >/dev/null 2>&1; then
      postgresql_running=true
      break
    fi
    sleep 2
  done
  if [[ "${postgresql_running}" != "true" ]]; then
    write_status "failed" "PostgreSQL no pasó la comprobación de salud a tiempo. El volumen y la contraseña se conservaron; revisa los logs del servicio."
    exit 1
  fi
  write_status "succeeded" "PostgreSQL quedó listo en la red privada de Swarm como vps-manager-postgresql:5432. Las credenciales iniciales están disponibles una sola vez durante 30 minutos."
  exit 0
fi

if [[ "${operation}" == "install-n8n" ]]; then
  readonly N8N_SERVICE="vps-manager-n8n"
  readonly N8N_IMAGE="n8nio/n8n:2.46.4"
  readonly N8N_SECRET="vps-manager-n8n-encryption"
  readonly N8N_VOLUME="vps-manager-n8n-data"
  readonly INSTALL_ENV="/opt/vps-manager/install.env"
  test_mode="$(sed -n 's/^VPS_MANAGER_TEST_MODE=//p' "${INSTALL_ENV}" | head -n 1)"
  if [[ "${test_mode}" == "true" || ! "${gitea_domain}" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]]; then
    write_status "failed" "n8n requiere un hostname público y una instalación HTTPS de VPS Manager."
    exit 1
  fi
  if ! docker network inspect vps-manager-proxy >/dev/null 2>&1; then
    write_status "failed" "No se encontró la red HTTPS de Traefik."
    exit 1
  fi

  if service_info="$(docker service inspect --format '{{.ID}} {{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}} {{index .Spec.Labels "traefik.http.routers.vps-manager-n8n.rule"}}' "${N8N_SERVICE}" 2>/dev/null)"; then
    IFS=' ' read -r _ managed_label component_label router_rule <<< "${service_info}"
    if [[ "${managed_label}" != "true" || "${component_label}" != "n8n" ]]; then
      write_status "failed" "Ya existe un servicio con el nombre reservado para n8n y no pertenece a VPS Manager."
      exit 1
    fi
    if [[ "${router_rule}" != "Host(\`${gitea_domain}\`)" ]]; then
      write_status "failed" "n8n ya está instalado con otro dominio; no se modificó el servicio ni sus datos."
      exit 1
    fi
    write_status "succeeded" "n8n ya estaba instalado; se conservaron el volumen y la clave de cifrado."
    exit 0
  fi

  secret_file="$(mktemp "${STATE_DIRECTORY}/n8n-encryption.XXXXXX")"
  chmod 0600 "${secret_file}"
  trap 'rm -f -- "${secret_file}"' EXIT
  if secret_info="$(docker secret inspect --format '{{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}}' "${N8N_SECRET}" 2>/dev/null)"; then
    if [[ "${secret_info}" != "true n8n-encryption" ]]; then
      write_status "failed" "El secreto reservado para el cifrado de n8n existe y no pertenece a VPS Manager."
      exit 1
    fi
  else
    openssl rand -hex 32 > "${secret_file}" \
      || { write_status "failed" "No se pudo generar la clave de cifrado de n8n."; exit 1; }
    docker secret create \
      --label vps-manager.managed=true \
      --label vps-manager.component=n8n-encryption \
      "${N8N_SECRET}" "${secret_file}" >/dev/null \
      || { write_status "failed" "No se pudo guardar la clave de cifrado como secreto Swarm."; exit 1; }
  fi

  if volume_info="$(docker volume inspect --format '{{index .Labels "vps-manager.managed"}} {{index .Labels "vps-manager.component"}}' "${N8N_VOLUME}" 2>/dev/null)"; then
    if [[ "${volume_info}" != "true n8n" ]]; then
      write_status "failed" "El volumen reservado para n8n existe y no pertenece a VPS Manager."
      exit 1
    fi
  else
    docker volume create \
      --label vps-manager.managed=true \
      --label vps-manager.component=n8n \
      "${N8N_VOLUME}" >/dev/null \
      || { write_status "failed" "No se pudo crear el volumen persistente de n8n."; exit 1; }
  fi

  if ! docker pull "${N8N_IMAGE}"; then
    write_status "failed" "No se pudo descargar la versión fijada de n8n."
    exit 1
  fi

  manager_node_id="$(docker info --format '{{.Swarm.NodeID}}' 2>/dev/null)" \
    || { write_status "failed" "No se pudo identificar el nodo manager que conservará los datos de n8n."; exit 1; }
  [[ "${manager_node_id}" =~ ^[a-zA-Z0-9]{25,64}$ ]] \
    || { write_status "failed" "Docker devolvió un identificador de manager no válido."; exit 1; }

  if ! docker service create \
    --name "${N8N_SERVICE}" \
    --replicas 1 \
    --constraint "node.id==${manager_node_id}" \
    --network vps-manager-proxy \
    --mount "type=volume,source=${N8N_VOLUME},target=/home/node/.n8n" \
    --secret "source=${N8N_SECRET},target=n8n_encryption_key,uid=1000,gid=1000,mode=0400" \
    --env "N8N_HOST=${gitea_domain}" \
    --env N8N_PROTOCOL=https \
    --env "WEBHOOK_URL=https://${gitea_domain}/" \
    --env "N8N_EDITOR_BASE_URL=https://${gitea_domain}/" \
    --env N8N_PROXY_HOPS=1 \
    --env N8N_ENCRYPTION_KEY_FILE=/run/secrets/n8n_encryption_key \
    --env N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true \
    --env N8N_DIAGNOSTICS_ENABLED=false \
    --env N8N_VERSION_NOTIFICATIONS_ENABLED=false \
    --env GENERIC_TIMEZONE=UTC \
    --label vps-manager.managed=true \
    --label vps-manager.component=n8n \
    --label traefik.enable=true \
    --label traefik.swarm.network=vps-manager-proxy \
    --label "traefik.http.routers.vps-manager-n8n.rule=Host(\`${gitea_domain}\`)" \
    --label traefik.http.routers.vps-manager-n8n.entrypoints=websecure \
    --label traefik.http.routers.vps-manager-n8n.tls=true \
    --label traefik.http.routers.vps-manager-n8n.tls.certresolver=vpsmanager \
    --label traefik.http.services.vps-manager-n8n.loadbalancer.server.port=5678 \
    --limit-cpu 1 \
    --limit-memory 1536M \
    --restart-condition any \
    "${N8N_IMAGE}" >/dev/null; then
    write_status "failed" "Swarm no pudo crear el servicio n8n; el secreto y el volumen se conservaron."
    exit 1
  fi

  n8n_running=false
  for _ in $(seq 1 120); do
    task_states="$(docker service ps --filter desired-state=running --format '{{.CurrentState}}' "${N8N_SERVICE}" 2>/dev/null || true)"
    if grep -q '^Running' <<< "${task_states}"; then
      n8n_running=true
      break
    fi
    sleep 2
  done
  if [[ "${n8n_running}" != "true" ]]; then
    write_status "failed" "n8n no inició a tiempo. El volumen y la clave de cifrado se conservaron; revisa los logs del servicio."
    exit 1
  fi
  write_status "succeeded" "n8n quedó listo en https://${gitea_domain}/ con almacenamiento persistente y clave de cifrado protegida."
  exit 0
fi

if [[ "${operation}" == "enroll-swarm-node" ]]; then
  enrollment_error_file="$(mktemp "${STATE_DIRECTORY}/node-enroll-error.XXXXXX")"
  chmod 0600 "${enrollment_error_file}"
  if ! node_id="$(/usr/local/libexec/vps-manager-swarm-node-enroll \
    "${request_id}" "${node_address}" "${node_ssh_user}" "${node_ssh_port}" \
    "${node_fingerprint}" "${node_private_cidr}" "${manager_private_address}" "${node_role}" \
    2>"${enrollment_error_file}")"; then
    enrollment_error="$(grep '^VPS_MANAGER_ERROR=' "${enrollment_error_file}" | tail -n 1 | cut -d= -f2- || true)"
    rm -f -- "${enrollment_error_file}"
    write_status "failed" "${enrollment_error:-No se pudo completar el aprovisionamiento SSH del VPS destino.}"
    exit 1
  fi
  rm -f -- "${enrollment_error_file}"
  if [[ ! "${node_id}" =~ ^[a-zA-Z0-9]{25,64}$ ]]; then
    write_status "failed" "El VPS se unió, pero el identificador de nodo devuelto no es válido."
    exit 1
  fi
  write_status "succeeded" "Docker quedó instalado y el VPS está ready en el Swarm; se agregaron reglas UFW para la CIDR privada."
  exit 0
fi

if [[ "${operation}" == "deploy-project" || "${operation}" == "remove-project" ]]; then
  docker_config_directory=""
  cleanup_project_service_operation() {
    if [[ -n "${docker_config_directory}" ]]; then rm -rf -- "${docker_config_directory}"; fi
  }
  trap cleanup_project_service_operation EXIT
  readonly PROJECT_SERVICE="vps-manager-project-${project_id//-/}"
  if [[ "${operation}" == "remove-project" ]]; then
    if ! service_names="$(docker service ls --format '{{.Name}}')"; then
      write_status "failed" "No se pudo consultar la lista de servicios Swarm."
      exit 1
    fi
    if ! grep -Fxq -- "${PROJECT_SERVICE}" <<< "${service_names}"; then
      write_status "succeeded" "El servicio del proyecto ya estaba retirado."
      exit 0
    fi
    if ! service_info="$(docker service inspect --format '{{.ID}} {{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}} {{index .Spec.Labels "vps-manager.project-id"}}' "${PROJECT_SERVICE}")"; then
      write_status "failed" "No se pudo inspeccionar el servicio del proyecto."
      exit 1
    fi
    IFS=' ' read -r service_id managed_label component_label inspected_project_id <<< "${service_info}"
    if [[ "${managed_label}" != "true" || "${component_label}" != "project" || "${inspected_project_id}" != "${project_id}" ]]; then
      write_status "failed" "El servicio reservado no pertenece a este proyecto administrado."
      exit 1
    fi
    if ! docker service rm "${PROJECT_SERVICE}" >/dev/null; then
      write_status "failed" "Docker no pudo retirar el servicio del proyecto."
      exit 1
    fi
    write_status "succeeded" "Servicio Swarm retirado; no se eliminaron imágenes ni datos externos."
    exit 0
  fi

  if [[ -L "${REGISTRY_CONFIG_FILE}" || ! -f "${REGISTRY_CONFIG_FILE}" ]]; then
    write_status "failed" "Configura primero el registro privado desde el panel."
    exit 1
  fi
  if ! docker_config_directory="$(mktemp -d /tmp/vps-manager-project-auth.XXXXXX)" \
    || ! chmod 0700 "${docker_config_directory}"; then
    write_status "failed" "No se pudo preparar el archivo temporal de autenticación."
    exit 1
  fi
  if ! registry_domain="$(python3 - "${REGISTRY_CONFIG_FILE}" "${docker_config_directory}/config.json" <<'PY'
import base64
import json
import os
import re
import stat
import sys

config_path, docker_config_path = sys.argv[1:]
descriptor = os.open(config_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
try:
    metadata = os.fstat(descriptor)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & 0o077:
        raise ValueError("registry credentials permissions are invalid")
    with os.fdopen(descriptor, encoding="utf-8") as config_file:
        descriptor = -1
        configuration = json.load(config_file)
finally:
    if descriptor >= 0:
        os.close(descriptor)
domain = configuration.get("domain")
username = configuration.get("username")
password = configuration.get("password")
if not isinstance(domain, str) or not re.fullmatch(
    r"(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}",
    domain,
) or re.search(r"\.(?:localhost|local|internal|test|example|invalid|onion|home|lan)$", domain, re.IGNORECASE):
    raise SystemExit("The configured registry domain is invalid.")
if not isinstance(username, str) or not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", username):
    raise SystemExit("The configured registry username is invalid.")
if not isinstance(password, str) or not re.fullmatch(r"[A-Za-z0-9._-]{20,72}", password):
    raise SystemExit("The configured registry password is invalid.")
auth = base64.b64encode(f"{username}:{password}".encode()).decode()
descriptor = os.open(docker_config_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w", encoding="utf-8") as docker_config_file:
    json.dump({"auths": {domain.lower(): {"auth": auth}}}, docker_config_file)
    docker_config_file.write("\n")
print(domain.lower())
PY
  )"; then
    write_status "failed" "No se pudo preparar la autenticación segura del registro privado."
    exit 1
  fi
  built_image="${registry_domain}/vps-manager-project-${project_id//-/}:${commit_sha}"
  deployment_config_file="${STATE_DIRECTORY}/project-config-${project_id}.json"
  deployment_environment_file="$(mktemp "${STATE_DIRECTORY}/project-env.XXXXXX")"
  deployment_metadata_file="$(mktemp "${STATE_DIRECTORY}/project-metadata.XXXXXX")"
  cleanup_project_deployment_config() {
    rm -f -- "${deployment_environment_file}" "${deployment_metadata_file}"
  }
  trap cleanup_project_deployment_config EXIT
  if ! python3 - "${deployment_config_file}" "${deployment_metadata_file}" "${deployment_environment_file}" <<'PY'
import hashlib
import json
import os
import re
import stat
import sys

config_path, metadata_path, environment_path = sys.argv[1:]
try:
    descriptor = os.open(config_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
except FileNotFoundError:
    configuration = {"environment": {}, "domain": None, "port": None}
else:
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & 0o077 or metadata.st_size > 80000:
            raise SystemExit("Invalid project deployment configuration file.")
        with os.fdopen(descriptor, encoding="utf-8") as config_file:
            descriptor = -1
            configuration = json.load(config_file)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
if not isinstance(configuration, dict) \
    or set(configuration) - {"environment", "domain", "port", "domains"} \
    or not isinstance(configuration.get("environment", {}), dict):
    raise SystemExit("Invalid project deployment configuration.")
environment = configuration.get("environment", {})
if len(environment) > 100:
    raise SystemExit("Too many project environment variables.")
environment_size = 0
for name, value in environment.items():
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,127}", name) \
        or not isinstance(value, str) \
        or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", value) \
        or len(value.encode()) > 8192:
        raise SystemExit("Invalid project environment variable.")
    environment_size += len(name.encode()) + len(value.encode())
if environment_size > 24576:
    raise SystemExit("Project environment configuration is too large.")
domains = configuration.get("domains")
if domains is None:
    domain = configuration.get("domain")
    port = configuration.get("port")
    domains = [] if domain is None and port is None else [{"hostname": domain, "port": port}]
if not isinstance(domains, list) or len(domains) > 20:
    raise SystemExit("Invalid project domain list.")
for domain in domains:
    if not isinstance(domain, dict) or set(domain) != {"hostname", "port"} \
        or not isinstance(domain["hostname"], str) or not re.fullmatch(
            r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}",
            domain["hostname"], re.IGNORECASE
        ) or not isinstance(domain["port"], int) or isinstance(domain["port"], bool) \
        or not 1 <= domain["port"] <= 65535:
        raise SystemExit("Invalid project domain configuration.")
with open(metadata_path, "w", encoding="utf-8") as metadata_file:
    canonical = json.dumps({
        "environment": dict(sorted(environment.items())),
        "domains": sorted(domains, key=lambda domain: domain["hostname"]),
    }, ensure_ascii=False, separators=(",", ":"))
    metadata_file.write(hashlib.sha256(canonical.encode()).hexdigest() + "\n")
    for domain in domains:
        metadata_file.write(f"{domain['hostname']}\t{domain['port']}\n")
with open(environment_path, "wb") as environment_file:
    for name, value in environment.items():
        environment_file.write(name.encode() + b"=" + value.encode() + b"\0")
PY
  then
    write_status "failed" "La configuración local de variables o dominio del proyecto no es válida."
    exit 1
  fi
  project_domains=()
  {
    IFS= read -r project_config_hash
    while IFS=$'\t' read -r project_domain project_port; do
      [[ -n "${project_domain}" ]] && project_domains+=("${project_domain}"$'\t'"${project_port}")
    done
  } < "${deployment_metadata_file}"
  mapfile -d '' -t project_environment_entries < "${deployment_environment_file}"
  project_environment_args=()
  for environment_entry in "${project_environment_entries[@]}"; do
    project_environment_args+=(--env-add "${environment_entry}")
  done
  project_traefik_label_args=()
  for index in "${!project_domains[@]}"; do
    IFS=$'\t' read -r project_domain project_port <<< "${project_domains[$index]}"
    project_router="vps-manager-project-${project_id//-/}-${index}"
    project_traefik_label_args+=(
      --label-add "traefik.http.routers.${project_router}.rule=Host(\`${project_domain}\`)"
      --label-add "traefik.http.routers.${project_router}.entrypoints=websecure"
      --label-add "traefik.http.routers.${project_router}.tls=true"
      --label-add "traefik.http.routers.${project_router}.tls.certresolver=vpsmanager"
      --label-add "traefik.http.services.${project_router}.loadbalancer.server.port=${project_port}"
    )
  done
  if (( ${#project_domains[@]} > 0 )); then
    project_traefik_label_args+=(--label-add traefik.enable=true --label-add traefik.swarm.network=vps-manager-proxy)
  fi
  project_traefik_remove_args=()
  for index in {0..19}; do
    project_router="vps-manager-project-${project_id//-/}-${index}"
    project_traefik_remove_args+=(
      --label-rm "traefik.http.routers.${project_router}.rule"
      --label-rm "traefik.http.routers.${project_router}.entrypoints"
      --label-rm "traefik.http.routers.${project_router}.tls"
      --label-rm "traefik.http.routers.${project_router}.tls.certresolver"
      --label-rm "traefik.http.services.${project_router}.loadbalancer.server.port"
    )
  done
  if service_info="$(docker service inspect --format '{{.ID}} {{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}} {{index .Spec.Labels "vps-manager.project-id"}}' "${PROJECT_SERVICE}" 2>/dev/null)"; then
    IFS=' ' read -r _ managed_label component_label inspected_project_id <<< "${service_info}"
    if [[ "${managed_label}" != "true" || "${component_label}" != "project" || "${inspected_project_id}" != "${project_id}" ]]; then
      write_status "failed" "El servicio reservado ya existe y no pertenece a este proyecto administrado."
      exit 1
    fi
    if ! published_ports="$(docker service inspect --format '{{json .Endpoint.Spec.Ports}}' "${PROJECT_SERVICE}")"; then
      write_status "failed" "No se pudo validar la configuración de puertos del servicio existente."
      exit 1
    fi
    if [[ "${published_ports}" != "null" && "${published_ports}" != "[]" ]]; then
      write_status "failed" "El servicio existente publica puertos; retíralo manualmente antes de volver a desplegarlo."
      exit 1
    fi
    if ! existing_environment="$(docker service inspect --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' "${PROJECT_SERVICE}")"; then
      write_status "failed" "No se pudo consultar las variables existentes del servicio."
      exit 1
    fi
    if ! existing_environment_names="$(python3 -c 'import json,sys; values=json.loads(sys.stdin.read() or "[]") or []; isinstance(values, list) or sys.exit(1); [print(item.split("=", 1)[0]) for item in values if isinstance(item, str) and "=" in item]' <<< "${existing_environment}")"; then
      write_status "failed" "La configuración de variables actual del servicio no es válida."
      exit 1
    fi
    project_environment_remove_args=()
    while IFS= read -r environment_name; do
      if [[ "${environment_name}" =~ ^[A-Za-z_][A-Za-z0-9_]{0,127}$ ]]; then
        project_environment_remove_args+=(--env-rm "${environment_name}")
      fi
    done <<< "${existing_environment_names}"
    project_network_args=()
    if ! project_network_id="$(docker network inspect --format '{{.ID}}' vps-manager-proxy)"; then
      write_status "failed" "No se encontró la red privada de Traefik."
      exit 1
    fi
    if ! existing_network_ids="$(docker service inspect --format '{{range .Spec.TaskTemplate.Networks}}{{.Target}} {{end}}' "${PROJECT_SERVICE}")"; then
      write_status "failed" "No se pudieron consultar las redes del servicio existente."
      exit 1
    fi
    if [[ " ${existing_network_ids} " != *" ${project_network_id} "* ]]; then
      project_network_args+=(--network-add vps-manager-proxy)
    fi
    if ! DOCKER_CONFIG="${docker_config_directory}" docker service update --detach=false \
      --mode global \
      --restart-condition any \
      --image "${built_image}" \
      --with-registry-auth \
      --force \
      "${project_environment_remove_args[@]}" \
      "${project_environment_args[@]}" \
      "${project_network_args[@]}" \
      --label-rm traefik.enable \
      --label-rm traefik.swarm.network \
      "${project_traefik_remove_args[@]}" \
      --label-add vps-manager.managed=true \
      --label-add vps-manager.component=project \
      --label-add "vps-manager.project-id=${project_id}" \
      --label-add "vps-manager.project-commit=${commit_sha}" \
      --label-add "vps-manager.project-image=${built_image}" \
      --label-add "vps-manager.project-config-hash=${project_config_hash}" \
      "${project_traefik_label_args[@]}" \
      "${PROJECT_SERVICE}" >/dev/null; then
      write_status "failed" "Swarm no pudo actualizar el servicio del proyecto."
      exit 1
    fi
  else
    if ! DOCKER_CONFIG="${docker_config_directory}" docker service create --detach=false \
      --name "${PROJECT_SERVICE}" \
      --mode global \
      --restart-condition any \
      --network vps-manager-proxy \
      --with-registry-auth \
      "${project_environment_args[@]}" \
      --label vps-manager.managed=true \
      --label vps-manager.component=project \
      --label "vps-manager.project-id=${project_id}" \
      --label "vps-manager.project-commit=${commit_sha}" \
      --label "vps-manager.project-image=${built_image}" \
      --label "vps-manager.project-config-hash=${project_config_hash}" \
      "${project_traefik_label_args[@]}" \
      "${built_image}" >/dev/null; then
      write_status "failed" "Swarm no pudo crear el servicio del proyecto."
      exit 1
    fi
  fi
  if ! service_id="$(docker service inspect --format '{{.ID}}' "${PROJECT_SERVICE}")" \
    || ! [[ "${service_id}" =~ ^[a-zA-Z0-9]{25,64}$ ]]; then
    write_status "failed" "Swarm creó el servicio, pero no se pudo validar su identificador."
    exit 1
  fi
  write_status "succeeded" "Servicio global desplegado con una tarea por nodo Swarm activo y sin puertos publicados."
  exit 0
fi

if [[ "${operation}" == "deploy-application" ]]; then
  application_config="${STATE_DIRECTORY}/application-deploy-${request_id}.json"
  temporary_directory=""
  application_secret_names=()
  preserve_application_secrets=false
  cleanup_manual_application() {
    if [[ -n "${temporary_directory}" ]]; then rm -rf -- "${temporary_directory}"; fi
    if [[ "${preserve_application_secrets}" != "true" ]]; then
      for secret_name in "${application_secret_names[@]}"; do
        docker secret rm "${secret_name}" >/dev/null 2>&1 || true
      done
    fi
    rm -f -- "${application_config}"
  }
  trap cleanup_manual_application EXIT
  if [[ -L "${application_config}" || ! -f "${application_config}" ]]; then
    write_status "failed" "No se encontró la configuración protegida de la aplicación."
    exit 1
  fi
  temporary_directory="$(mktemp -d "${STATE_DIRECTORY}/application-deploy.XXXXXX")"
  chmod 0700 "${temporary_directory}"
  if ! python3 - "${application_config}" "${temporary_directory}" "${request_id}" "${application_id}" "${application_instance_id}" <<'PY'
import json
import os
import re
import stat
import sys

source_path, output_directory, task_id, expected_application_id, expected_instance_id = sys.argv[1:]
descriptor = os.open(source_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
try:
    metadata = os.fstat(descriptor)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & 0o077 or metadata.st_size > 80000:
        raise SystemExit("Invalid staged application configuration file.")
    with os.fdopen(descriptor, encoding="utf-8") as source_file:
        descriptor = -1
        configuration = json.load(source_file)
finally:
    if descriptor >= 0:
        os.close(descriptor)
expected_fields = {
    "taskId", "applicationId", "instanceId", "applicationName", "image",
    "port", "domain", "serverNodeId", "volumeTarget", "environment", "secrets",
}
if not isinstance(configuration, dict) or set(configuration) != expected_fields \
    or configuration["taskId"] != task_id \
    or configuration["applicationId"] != expected_application_id \
    or configuration["instanceId"] != expected_instance_id \
    or not re.fullmatch(r"[a-z][a-z0-9-]{0,62}", configuration["applicationId"]) \
    or not re.fullmatch(r"[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}", configuration["instanceId"], re.IGNORECASE) \
    or not isinstance(configuration["applicationName"], str) or not 1 <= len(configuration["applicationName"]) <= 100 \
    or re.search(r"[\x00-\x1f\x7f]", configuration["applicationName"]) \
    or not isinstance(configuration["image"], str) \
    or not re.fullmatch(r"(?:[a-z0-9]+(?:[.-][a-z0-9]+)*(?::[1-9]\d{0,4})?/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}|@sha256:[a-f0-9]{64})", configuration["image"]) \
    or not isinstance(configuration["port"], int) or isinstance(configuration["port"], bool) or not 1 <= configuration["port"] <= 65535 \
    or not isinstance(configuration["domain"], str) \
    or not re.fullmatch(r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", configuration["domain"], re.IGNORECASE) \
    or re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", configuration["domain"]) \
    or re.search(r"\.(?:localhost|local|internal|test|example|invalid|onion|home|lan)$", configuration["domain"], re.IGNORECASE) \
    or not re.fullmatch(r"[a-zA-Z0-9]{25,64}", configuration["serverNodeId"]) \
    or not isinstance(configuration["volumeTarget"], str) \
    or (configuration["volumeTarget"] and (
        len(configuration["volumeTarget"]) > 255
        or not re.fullmatch(r"/(?:[A-Za-z0-9._-]+/?)*", configuration["volumeTarget"])
        or ".." in configuration["volumeTarget"].split("/")
    )):
    raise SystemExit("Invalid staged manual application configuration.")

name_pattern = re.compile(r"[A-Z_][A-Z0-9_]{0,127}")
for field in ("environment", "secrets"):
    values = configuration[field]
    if not isinstance(values, dict) or len(values) > 100:
        raise SystemExit("Invalid staged application environment.")
    total = 0
    for name, value in values.items():
        if not isinstance(name, str) or not name_pattern.fullmatch(name) \
            or not isinstance(value, str) or len(value.encode()) > 8192 \
            or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", value):
            raise SystemExit("Invalid staged application environment variable.")
        total += len(name.encode()) + len(value.encode())
    if total > 24576:
        raise SystemExit("Staged application environment is too large.")
if set(configuration["environment"]) & set(configuration["secrets"]):
    raise SystemExit("Application environment and secret names overlap.")
with open(os.path.join(output_directory, "metadata.json"), "w", encoding="utf-8") as metadata_file:
    json.dump({
        "applicationName": configuration["applicationName"],
        "image": configuration["image"],
        "port": configuration["port"],
        "domain": configuration["domain"].lower(),
        "serverNodeId": configuration["serverNodeId"].lower(),
        "volumeTarget": configuration["volumeTarget"],
    }, metadata_file)
with open(os.path.join(output_directory, "environment.bin"), "wb") as environment_file:
    for name, value in configuration["environment"].items():
        environment_file.write(name.encode() + b"=" + value.encode() + b"\0")
with open(os.path.join(output_directory, "secrets.bin"), "wb") as secrets_file:
    for name, value in configuration["secrets"].items():
        secrets_file.write(name.encode() + b"\0" + value.encode() + b"\0")
PY
  then
    write_status "failed" "La configuración de la aplicación manual no pasó la validación segura."
    exit 1
  fi
  read -r application_name application_image application_port application_domain application_node_id application_volume_target < <(
    python3 - "${temporary_directory}/metadata.json" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as metadata_file:
    metadata = json.load(metadata_file)
print("\t".join(str(metadata[key]) for key in (
    "applicationName", "image", "port", "domain", "serverNodeId", "volumeTarget",
)))
PY
  )
  mapfile -d '' -t application_environment_entries < "${temporary_directory}/environment.bin"
  mapfile -d '' -t application_secret_entries < "${temporary_directory}/secrets.bin"
  application_secret_args=()
  for ((index = 0; index < ${#application_secret_entries[@]}; index += 2)); do
    secret_variable="${application_secret_entries[$index]}"
    secret_value="${application_secret_entries[$((index + 1))]}"
    secret_name="vps_manager_app_${application_instance_id//-/}_${secret_variable,,}"
    if docker secret inspect "${secret_name}" >/dev/null 2>&1; then
      write_status "failed" "El identificador de un secreto de la aplicación ya está en uso."
      exit 1
    fi
    if ! printf '%s' "${secret_value}" | docker secret create \
      --label vps-manager.managed=true \
      --label vps-manager.component=application-secret \
      --label "vps-manager.application-instance=${application_instance_id}" \
      "${secret_name}" - >/dev/null; then
      write_status "failed" "No se pudo guardar un secreto Swarm de la aplicación."
      exit 1
    fi
    application_secret_names+=("${secret_name}")
    application_secret_args+=(--secret "source=${secret_name},target=${secret_variable}")
    application_environment_entries+=("${secret_variable}_FILE=/run/secrets/${secret_variable}")
  done
  application_environment_args=()
  for environment_entry in "${application_environment_entries[@]}"; do
    application_environment_args+=(--env-add "${environment_entry}")
  done
  application_service="vps-manager-app-${application_instance_id//-/}"
  application_router="${application_service}"
  application_router_args=(
    --label-add traefik.enable=true
    --label-add traefik.swarm.network=vps-manager-proxy
    --label-add "traefik.http.routers.${application_router}.rule=Host(\`${application_domain}\`)"
    --label-add "traefik.http.routers.${application_router}.entrypoints=websecure"
    --label-add "traefik.http.routers.${application_router}.tls=true"
    --label-add "traefik.http.routers.${application_router}.tls.certresolver=vpsmanager"
    --label-add "traefik.http.services.${application_router}.loadbalancer.server.port=${application_port}"
  )
  application_volume_args=()
  if [[ -n "${application_volume_target}" ]]; then
    application_volume_args+=(--mount "type=volume,source=${application_service}-data,target=${application_volume_target}")
  fi
  if ! docker service create --detach=false \
    --name "${application_service}" \
    --replicas 1 \
    --restart-condition any \
    --constraint "node.id==${application_node_id}" \
    --network vps-manager-proxy \
    --label vps-manager.managed=true \
    --label vps-manager.component=application \
    --label "vps-manager.application-id=${application_id}" \
    --label "vps-manager.application-instance=${application_instance_id}" \
    "${application_router_args[@]}" \
    "${application_volume_args[@]}" \
    "${application_environment_args[@]}" \
    "${application_secret_args[@]}" \
    "${application_image}" >/dev/null; then
    write_status "failed" "Swarm no pudo iniciar el servicio de la aplicación."
    exit 1
  fi
  preserve_application_secrets=true
  if ! service_id="$(docker service inspect --format '{{.ID}}' "${application_service}")" \
    || ! [[ "${service_id}" =~ ^[a-zA-Z0-9]{25,64}$ ]]; then
    write_status "failed" "Swarm creó la aplicación, pero no se pudo validar el identificador de servicio."
    exit 1
  fi
  write_status "succeeded" "Aplicación desplegada en el VPS seleccionado; HTTPS se gestiona mediante Traefik."
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

if [[ "${operation}" == "stop-container" || "${operation}" == "restart-container" ]]; then
  if ! container_info="$(docker container inspect \
    --format '{{.Id}} {{index .Config.Labels "com.docker.swarm.service.id"}} {{.State.Running}}' \
    "${container_id}")"; then
    write_status "failed" "No se encontró el contenedor solicitado en este VPS."
    exit 1
  fi
  IFS=' ' read -r inspected_container_id container_service_id container_running <<< "${container_info}"
  if [[ "${inspected_container_id}" != "${container_id}" || "${container_service_id}" != "${service_id}" ]]; then
    write_status "failed" "El contenedor no pertenece al servicio solicitado."
    echo "Rejected a container that is not a task of the requested Swarm service." >&2
    exit 1
  fi
  if [[ "${container_running}" != "true" ]]; then
    write_status "failed" "El contenedor ya no está en ejecución; Swarm administra su recuperación."
    exit 1
  fi
  if [[ "${operation}" == "stop-container" && "${component_label}" == "api" ]]; then
    write_status "failed" "No se puede detener el contenedor del panel."
    exit 1
  fi
  if [[ "${operation}" == "stop-container" ]]; then
    if docker container stop --time 10 "${container_id}" >/dev/null; then
      write_status "succeeded" "Contenedor detenido; Swarm repondrá automáticamente la tarea."
    else
      write_status "failed" "Docker no pudo detener el contenedor solicitado."
      exit 1
    fi
  elif docker container restart --time 10 "${container_id}" >/dev/null; then
    write_status "succeeded" "Contenedor reiniciado correctamente."
  else
    write_status "failed" "Docker no pudo reiniciar el contenedor solicitado."
    exit 1
  fi
elif [[ "${operation}" == "scale-service" ]]; then
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
  if [[ "${component_label}" == "n8n" && "${replicas}" != "1" ]]; then
    write_status "failed" "n8n usa SQLite y almacenamiento local; debe conservar exactamente una réplica."
    echo "Rejected scaling n8n away from one replica." >&2
    exit 1
  fi
  if [[ "${component_label}" == "registry" && "${replicas}" != "1" ]]; then
    write_status "failed" "El registro privado debe conservar exactamente una réplica."
    echo "Rejected scaling the private registry away from one replica." >&2
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
