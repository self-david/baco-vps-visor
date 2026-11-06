#!/usr/bin/env bash
set -Eeuo pipefail

vps_manager_remove_supabase() {
  local instance_id="$1"
  local request_id="$2"
  local application_directory="/var/lib/vps-manager/applications/supabase-${instance_id}"
  local compose_project="vps-manager-supabase-${instance_id//-/}"
  local compose_file="${application_directory}/docker-compose.vps-manager.yml"
  local persistent_credentials_path="${STATE_DIRECTORY}/supabase-instance-credentials-${instance_id}.json"
  local containers

  if [[ ! "${instance_id}" =~ ^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$ ]]; then
    write_status "failed" "El identificador de instancia Supabase no es válido."
    return 1
  fi
  if [[ -L "${application_directory}" || (-e "${application_directory}" && ! -d "${application_directory}") ]]; then
    write_status "failed" "La carpeta de la instancia Supabase no es válida; no se eliminarán archivos."
    return 1
  fi
  if [[ -L "${persistent_credentials_path}" || (-e "${persistent_credentials_path}" && ! -f "${persistent_credentials_path}") ]]; then
    write_status "failed" "El archivo de credenciales de Supabase no es válido; se detuvo su eliminación."
    return 1
  fi
  if [[ -d "${application_directory}" ]]; then
    if [[ -L "${compose_file}" || ! -f "${compose_file}" ]]; then
      write_status "failed" "No se encontró el archivo Compose seguro de la instancia Supabase."
      return 1
    fi
    if ! docker compose --project-name "${compose_project}" \
      -f "${compose_file}" down --volumes --remove-orphans; then
      write_status "failed" "Docker Compose no pudo retirar Supabase y sus volúmenes persistentes."
      return 1
    fi
  else
    if ! containers="$(docker ps --all --quiet --filter "label=com.docker.compose.project=${compose_project}")"; then
      write_status "failed" "No se pudo verificar si quedan contenedores de la instancia Supabase."
      return 1
    fi
    if [[ -n "${containers}" ]]; then
      write_status "failed" "Hay contenedores de Supabase sin su configuración Compose; no se eliminarán recursos a ciegas."
      return 1
    fi
  fi

  if [[ -d "${application_directory}" ]]; then
    if ! rm -rf -- "${application_directory}"; then
      write_status "failed" "No se pudo retirar la configuración local de Supabase."
      return 1
    fi
  fi
  if ! rm -f -- "${persistent_credentials_path}" \
    "${STATE_DIRECTORY}/supabase-credentials-${request_id}.json"; then
    write_status "failed" "No se pudieron eliminar las credenciales protegidas de Supabase."
    return 1
  fi
  write_status "succeeded" "Servicios, volúmenes persistentes, secretos locales y credenciales de Supabase eliminados."
}

vps_manager_install_supabase() {
  local staged_config="$1"
  local request_id="$2"
  local instance_id="$3"
  local source_directory="/var/lib/vps-manager/supabase/source-v0.8.4"
  local application_directory="/var/lib/vps-manager/applications/supabase-${instance_id}"
  local temporary_directory=""
  local expected_manager_id
  local memory_capacity
  local requested_memory_mb
  local memory_budget_mb
  local compose_project="vps-manager-supabase-${instance_id//-/}"
  local persistent_credentials_path="${STATE_DIRECTORY}/supabase-instance-credentials-${instance_id}.json"
  local -a compose_command
  local -a selected_services
  local -a inactive_services
  local attempt
  local api_container_id
  local credentials_temp_path
  local compose_error

  if ! command -v git >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1 \
    || ! python3 -c 'import yaml' >/dev/null 2>&1; then
    write_status "failed" "El VPS necesita git, Python 3 y PyYAML para preparar el stack oficial de Supabase."
    return 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    write_status "failed" "Docker Compose no está disponible en el VPS."
    return 1
  fi
  if [[ ! -r "${staged_config}" || -L "${staged_config}" ]]; then
    write_status "failed" "No se encontró la configuración protegida de Supabase."
    return 1
  fi
  if [[ -L "${persistent_credentials_path}" || ( -e "${persistent_credentials_path}" && ! -f "${persistent_credentials_path}" ) ]]; then
    write_status "failed" "La ruta protegida de credenciales de Supabase no es un archivo regular."
    return 1
  fi

  temporary_directory="$(mktemp -d "${STATE_DIRECTORY}/supabase-deploy.XXXXXX")"
  chmod 0700 "${temporary_directory}"
  credentials_temp_path="${temporary_directory}/credentials.json"
  if ! python3 - "${staged_config}" "${temporary_directory}/metadata.json" "${request_id}" "${instance_id}" <<'PY'
import json
import os
import re
import stat
import sys

source_path, metadata_path, task_id, instance_id = sys.argv[1:]
descriptor = os.open(source_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
try:
    metadata = os.fstat(descriptor)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & 0o077 or metadata.st_size > 80000:
        raise SystemExit("Invalid staged Supabase configuration file.")
    with os.fdopen(descriptor, encoding="utf-8") as source_file:
        descriptor = -1
        staged = json.load(source_file)
finally:
    if descriptor >= 0:
        os.close(descriptor)

expected_fields = {
    "taskId", "applicationId", "instanceId", "applicationName",
    "serverNodeId", "configuration",
}
if not isinstance(staged, dict) or set(staged) != expected_fields \
    or staged["taskId"] != task_id or staged["applicationId"] != "supabase" \
    or not isinstance(staged["instanceId"], str) \
    or staged["instanceId"].lower() != instance_id.lower() \
    or not re.fullmatch(r"[a-f0-9-]{36}", instance_id, re.IGNORECASE) \
    or not isinstance(staged["applicationName"], str) \
    or not 1 <= len(staged["applicationName"]) <= 100 \
    or re.search(r"[\x00-\x1f\x7f]", staged["applicationName"]) \
    or not re.fullmatch(r"[a-zA-Z0-9]{25,64}", staged["serverNodeId"]):
    raise SystemExit("Invalid staged Supabase deployment metadata.")

configuration = staged["configuration"]
service_ids = [
    "db", "studio", "api-gw", "auth", "rest", "realtime", "storage",
    "imgproxy", "meta", "functions", "supavisor", "analytics", "vector",
]
required = {"db", "studio", "api-gw", "auth", "rest", "meta"}
expected_configuration = {
    "apiDomain", "studioDomain", "siteUrl", "enabledServices", "exposeDatabasePorts",
    "additionalRedirectUrls", "organizationName", "projectName", "disableSignup",
    "enableEmailSignup", "enableEmailAutoconfirm", "enableAnonymousUsers",
    "jwtExpirySeconds", "maxRows", "storageFileSizeLimitBytes", "storageRegion",
    "enableImageTransformation", "functionsVerifyJwt", "smtp", "oauthProviders",
    "resourceLimits",
}
hostname_pattern = re.compile(
    r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}",
    re.IGNORECASE,
)
if not isinstance(configuration, dict) or set(configuration) != expected_configuration \
    or not isinstance(configuration["apiDomain"], str) \
    or not hostname_pattern.fullmatch(configuration["apiDomain"]) \
    or not isinstance(configuration["studioDomain"], str) \
    or not hostname_pattern.fullmatch(configuration["studioDomain"]) \
    or configuration["apiDomain"].lower() == configuration["studioDomain"].lower() \
    or not isinstance(configuration["siteUrl"], str) \
    or not configuration["siteUrl"].startswith("https://") \
    or any(character in configuration["siteUrl"] for character in "\r\n\x00") \
    or not isinstance(configuration["enabledServices"], list) \
    or any(service not in service_ids for service in configuration["enabledServices"]) \
    or len(set(configuration["enabledServices"])) != len(configuration["enabledServices"]) \
    or not required.issubset(configuration["enabledServices"]) \
    or ("vector" in configuration["enabledServices"] and "analytics" not in configuration["enabledServices"]) \
    or (configuration["exposeDatabasePorts"] and "supavisor" not in configuration["enabledServices"]) \
    or ("storage" in configuration["enabledServices"]
        and configuration["enableImageTransformation"]
        and "imgproxy" not in configuration["enabledServices"]) \
    or not isinstance(configuration["exposeDatabasePorts"], bool):
    raise SystemExit("Invalid staged Supabase configuration.")

if not isinstance(configuration["additionalRedirectUrls"], list) \
    or len(configuration["additionalRedirectUrls"]) > 50 \
    or any(not isinstance(url, str) or not url.startswith("https://")
        or any(character in url for character in "\r\n\x00")
        for url in configuration["additionalRedirectUrls"]):
    raise SystemExit("Invalid staged Supabase redirect URLs.")
if any(not isinstance(configuration[field], str) or not configuration[field].strip()
    or len(configuration[field]) > 100 or re.search(r"[\x00-\x1f\x7f]", configuration[field])
    for field in ("organizationName", "projectName", "storageRegion")):
    raise SystemExit("Invalid staged Supabase text configuration.")
if not isinstance(configuration["resourceLimits"], dict) or set(configuration["resourceLimits"]) != set(service_ids):
    raise SystemExit("Invalid staged Supabase resource limits.")
for limits in configuration["resourceLimits"].values():
    if not isinstance(limits, dict) or set(limits) != {"cpus", "memoryMb"} \
        or isinstance(limits["cpus"], bool) or not isinstance(limits["cpus"], (int, float)) \
        or not 0.1 <= limits["cpus"] <= 16 \
        or isinstance(limits["memoryMb"], bool) or not isinstance(limits["memoryMb"], int) \
        or not 128 <= limits["memoryMb"] <= 32768:
        raise SystemExit("Invalid staged Supabase resource limits.")
for field in (
    "disableSignup", "enableEmailSignup", "enableEmailAutoconfirm",
    "enableAnonymousUsers", "enableImageTransformation", "functionsVerifyJwt",
):
    if not isinstance(configuration[field], bool):
        raise SystemExit("Invalid staged Supabase authentication or feature settings.")
if isinstance(configuration["jwtExpirySeconds"], bool) \
    or not isinstance(configuration["jwtExpirySeconds"], int) \
    or not 300 <= configuration["jwtExpirySeconds"] <= 604800 \
    or isinstance(configuration["maxRows"], bool) \
    or not isinstance(configuration["maxRows"], int) \
    or not 1 <= configuration["maxRows"] <= 10000 \
    or isinstance(configuration["storageFileSizeLimitBytes"], bool) \
    or not isinstance(configuration["storageFileSizeLimitBytes"], int) \
    or not 1048576 <= configuration["storageFileSizeLimitBytes"] <= 5368709120:
    raise SystemExit("Invalid staged Supabase numeric configuration.")
smtp = configuration["smtp"]
if smtp is not None and (
    not isinstance(smtp, dict)
    or set(smtp) != {"adminEmail", "host", "port", "senderName", "username"}
    or any(not isinstance(smtp[field], str) for field in ("adminEmail", "host", "senderName", "username"))
    or not isinstance(smtp["port"], int) or isinstance(smtp["port"], bool)
    or not 1 <= smtp["port"] <= 65535
):
    raise SystemExit("Invalid staged Supabase SMTP configuration.")
oauth_providers = configuration["oauthProviders"]
if not isinstance(oauth_providers, dict) or any(
    provider not in {"github", "google", "azure"}
    or not isinstance(value, dict)
    or set(value) != {"clientId", "enabled"}
    or not isinstance(value["clientId"], str)
    or not isinstance(value["enabled"], bool)
    for provider, value in oauth_providers.items()
):
    raise SystemExit("Invalid staged Supabase OAuth configuration.")

with open(metadata_path, "w", encoding="utf-8") as metadata_file:
    json.dump(staged, metadata_file, ensure_ascii=True)
os.chmod(metadata_path, 0o600)
PY
  then
    write_status "failed" "La configuración de Supabase no pasó la validación del agente del VPS."
    rm -rf -- "${temporary_directory}"
    return 1
  fi
  if ! memory_capacity="$(python3 - "${temporary_directory}/metadata.json" <<'PY'
import json
import re
import sys

with open("/proc/meminfo", encoding="utf-8") as memory_file:
    match = re.search(r"^MemTotal:\s+(\d+)\s+kB$", memory_file.read(), re.MULTILINE)
if not match:
    raise SystemExit("Cannot read the VPS physical memory capacity.")
with open(sys.argv[1], encoding="utf-8") as metadata_file:
    configuration = json.load(metadata_file)["configuration"]
selected = configuration["enabledServices"]
requested = sum(configuration["resourceLimits"][service]["memoryMb"] for service in selected)
total_mb = int(match.group(1)) // 1024
print(f"{requested}\t{int(total_mb * 0.85)}")
PY
  )"; then
    write_status "failed" "No se pudo calcular la capacidad de memoria disponible del VPS."
    rm -rf -- "${temporary_directory}"
    return 1
  fi
  IFS=$'\t' read -r requested_memory_mb memory_budget_mb <<< "${memory_capacity}"
  if [[ ! "${requested_memory_mb}" =~ ^[0-9]+$ || ! "${memory_budget_mb}" =~ ^[0-9]+$ ]]; then
    write_status "failed" "La capacidad de memoria reportada por el VPS no es válida."
    rm -rf -- "${temporary_directory}"
    return 1
  fi
  if (( requested_memory_mb > memory_budget_mb )); then
    write_status "failed" "Los límites configurados suman ${requested_memory_mb} MiB, pero el VPS admite como máximo ${memory_budget_mb} MiB para Supabase dejando memoria para el sistema. Reduce los límites de recursos o amplía la memoria del VPS."
    rm -rf -- "${temporary_directory}"
    return 1
  fi

  expected_manager_id="$(docker info --format '{{.Swarm.NodeID}}' 2>/dev/null || true)"
  if [[ ! "${expected_manager_id}" =~ ^[a-zA-Z0-9]{25,64}$ ]] \
    || ! python3 - "${temporary_directory}/metadata.json" "${expected_manager_id}" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as metadata_file:
    metadata = json.load(metadata_file)
raise SystemExit(0 if metadata["serverNodeId"].lower() == sys.argv[2].lower() else 1)
PY
  then
    write_status "failed" "El VPS configurado para Supabase no coincide con el manager de Swarm que ejecuta el agente."
    rm -rf -- "${temporary_directory}"
    return 1
  fi
  if ! docker network inspect vps-manager-proxy >/dev/null 2>&1; then
    write_status "failed" "No se encontró la red HTTPS vps-manager-proxy necesaria para publicar API y Studio."
    rm -rf -- "${temporary_directory}"
    return 1
  fi

  if [[ ! -f "${source_directory}/docker/docker-compose.yml" ]]; then
    if [[ -e "${source_directory}" || -L "${source_directory}" ]]; then
      write_status "failed" "La carpeta reservada para la fuente oficial de Supabase existe, pero no es válida."
      rm -rf -- "${temporary_directory}"
      return 1
    fi
    local clone_directory="${temporary_directory}/source"
    if ! git init --quiet "${clone_directory}" \
      || ! git -C "${clone_directory}" remote add origin https://github.com/supabase/supabase.git \
      || ! git -C "${clone_directory}" fetch --filter=blob:none --depth=1 --quiet origin \
        189adda99d1b56da55fc5a6ee3f849354aaea92a \
      || ! git -C "${clone_directory}" sparse-checkout init --cone \
      || ! git -C "${clone_directory}" sparse-checkout set docker \
      || ! git -C "${clone_directory}" checkout --quiet 189adda99d1b56da55fc5a6ee3f849354aaea92a \
      || [[ "$(git -C "${clone_directory}" rev-parse HEAD)" != "189adda99d1b56da55fc5a6ee3f849354aaea92a" ]]; then
      write_status "failed" "No se pudo obtener y verificar la configuración oficial fijada de Supabase v0.8.4."
      rm -rf -- "${temporary_directory}"
      return 1
    fi
    mv -- "${clone_directory}" "${source_directory}"
  fi

  if [[ ! -d "${application_directory}" ]]; then
    install -d -o root -g root -m 0700 "${application_directory}"
  elif [[ -L "${application_directory}" || ! -d "${application_directory}" ]]; then
    write_status "failed" "La carpeta persistente reservada para esta instancia Supabase no es válida."
    rm -rf -- "${temporary_directory}"
    return 1
  fi
  cp -a "${source_directory}/docker/." "${application_directory}/"

  if ! python3 - "${temporary_directory}/metadata.json" "${application_directory}" "${compose_project}" "${request_id}" "${instance_id}" "${credentials_temp_path}" <<'PY'
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import sys
import time
import yaml

metadata_path, application_directory, project, task_id, instance_id, credentials_path = sys.argv[1:]
with open(metadata_path, encoding="utf-8") as metadata_file:
    staged = json.load(metadata_file)
configuration = staged["configuration"]
env_example = os.path.join(application_directory, ".env.example")
compose_path = os.path.join(application_directory, "docker-compose.yml")
logs_compose_path = os.path.join(application_directory, "docker-compose.logs.yml")
vector_path = os.path.join(application_directory, "volumes", "logs", "vector.yml")
if not all(os.path.isfile(path) for path in (env_example, compose_path, logs_compose_path, vector_path)):
    raise SystemExit("The pinned Supabase distribution is missing required configuration files.")

secret_path = os.path.join(application_directory, ".manager-secrets.json")
if os.path.exists(secret_path):
    with open(secret_path, encoding="utf-8") as secret_file:
        private = json.load(secret_file)
    required_secrets = {
        "POSTGRES_PASSWORD", "JWT_SECRET", "ANON_KEY", "SERVICE_ROLE_KEY",
        "DASHBOARD_PASSWORD", "SECRET_KEY_BASE", "REALTIME_DB_ENC_KEY",
        "VAULT_ENC_KEY", "PG_META_CRYPTO_KEY", "LOGFLARE_PUBLIC_ACCESS_TOKEN",
        "LOGFLARE_PRIVATE_ACCESS_TOKEN", "S3_PROTOCOL_ACCESS_KEY_ID",
        "S3_PROTOCOL_ACCESS_KEY_SECRET", "POOLER_TENANT_ID",
    }
    if not isinstance(private, dict) or set(private) != required_secrets \
        or any(not isinstance(value, str) or not value for value in private.values()):
        raise SystemExit("The persisted Supabase secrets file is invalid.")
else:
    def token(length=48):
        return secrets.token_urlsafe(length)

    jwt_secret = secrets.token_hex(32)
    now = int(time.time())
    def jwt(role):
        encode = lambda value: base64.urlsafe_b64encode(
            json.dumps(value, separators=(",", ":")).encode()
        ).rstrip(b"=").decode()
        header = encode({"alg": "HS256", "typ": "JWT"})
        payload = encode({
            "role": role,
            "iss": "supabase",
            "iat": now,
            "exp": now + 315360000,
        })
        signing_input = f"{header}.{payload}".encode()
        signature = base64.urlsafe_b64encode(
            hmac.new(jwt_secret.encode(), signing_input, hashlib.sha256).digest()
        ).rstrip(b"=").decode()
        return f"{header}.{payload}.{signature}"

    private = {
        "POSTGRES_PASSWORD": token(),
        "JWT_SECRET": jwt_secret,
        "ANON_KEY": jwt("anon"),
        "SERVICE_ROLE_KEY": jwt("service_role"),
        "DASHBOARD_PASSWORD": token(),
        "SECRET_KEY_BASE": token(64),
        "REALTIME_DB_ENC_KEY": secrets.token_hex(8),
        "VAULT_ENC_KEY": secrets.token_hex(16),
        "PG_META_CRYPTO_KEY": token(32),
        "LOGFLARE_PUBLIC_ACCESS_TOKEN": token(32),
        "LOGFLARE_PRIVATE_ACCESS_TOKEN": token(32),
        "S3_PROTOCOL_ACCESS_KEY_ID": secrets.token_hex(16),
        "S3_PROTOCOL_ACCESS_KEY_SECRET": secrets.token_hex(32),
        "POOLER_TENANT_ID": re.sub(r"[^a-f0-9]", "", instance_id.lower())[:32],
    }
    temporary_secret_path = f"{secret_path}.{task_id}.tmp"
    descriptor = os.open(temporary_secret_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as secret_file:
        json.dump(private, secret_file, ensure_ascii=True)
        secret_file.write("\n")
    os.replace(temporary_secret_path, secret_path)
    os.chmod(secret_path, 0o600)

def quote_env(value):
    value = str(value)
    if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", value):
        raise SystemExit("A Supabase environment value contains unsupported control characters.")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"').replace("$", "$$") + '"'

site_url = configuration["siteUrl"].rstrip("/")
redirect_urls = ",".join(configuration["additionalRedirectUrls"])
values = {
    **private,
    "DASHBOARD_USERNAME": "supabase",
    "SUPABASE_PUBLIC_URL": f"https://{configuration['apiDomain']}",
    "API_EXTERNAL_URL": f"https://{configuration['apiDomain']}/auth/v1",
    "SITE_URL": site_url,
    "ADDITIONAL_REDIRECT_URLS": redirect_urls,
    "POSTGRES_HOST": "db",
    "POSTGRES_DB": "postgres",
    "POSTGRES_PORT": "5432",
    "POOLER_PROXY_PORT_TRANSACTION": "6543",
    "JWT_EXPIRY": configuration["jwtExpirySeconds"],
    "DISABLE_SIGNUP": str(configuration["disableSignup"]).lower(),
    "ENABLE_EMAIL_SIGNUP": str(configuration["enableEmailSignup"]).lower(),
    "ENABLE_EMAIL_AUTOCONFIRM": str(configuration["enableEmailAutoconfirm"]).lower(),
    "ENABLE_ANONYMOUS_USERS": str(configuration["enableAnonymousUsers"]).lower(),
    "ENABLE_PHONE_SIGNUP": "false",
    "ENABLE_PHONE_AUTOCONFIRM": "false",
    "PGRST_DB_MAX_ROWS": configuration["maxRows"],
    "REGION": configuration["storageRegion"],
    "FUNCTIONS_VERIFY_JWT": str(configuration["functionsVerifyJwt"]).lower(),
    "STUDIO_DEFAULT_ORGANIZATION": configuration["organizationName"],
    "STUDIO_DEFAULT_PROJECT": configuration["projectName"],
    "SMTP_HOST": "",
    "SMTP_PORT": "",
    "SMTP_USER": "",
    "SMTP_PASS": "",
    "SMTP_ADMIN_EMAIL": "",
    "SMTP_SENDER_NAME": "",
    "COMPOSE_PROJECT_NAME": project,
}
if configuration["smtp"] is not None:
    smtp = configuration["smtp"]
    values.update({
        "SMTP_HOST": smtp["host"],
        "SMTP_PORT": smtp["port"],
        "SMTP_USER": smtp["username"],
        "SMTP_ADMIN_EMAIL": smtp["adminEmail"],
        "SMTP_SENDER_NAME": smtp["senderName"],
    })

with open(env_example, encoding="utf-8") as source_file:
    lines = source_file.readlines()
seen = set()
env_lines = []
for line in lines:
    match = re.match(r"^([A-Z][A-Z0-9_]*)=", line)
    if match and match.group(1) in values:
        key = match.group(1)
        env_lines.append(f"{key}={quote_env(values[key])}\n")
        seen.add(key)
    else:
        env_lines.append(line)
for key, value in values.items():
    if key not in seen:
        env_lines.append(f"{key}={quote_env(value)}\n")
env_path = os.path.join(application_directory, ".env")
temporary_env_path = f"{env_path}.{task_id}.tmp"
descriptor = os.open(temporary_env_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w", encoding="utf-8") as env_file:
    env_file.writelines(env_lines)
os.replace(temporary_env_path, env_path)
os.chmod(env_path, 0o600)

with open(compose_path, encoding="utf-8") as compose_file:
    compose = yaml.safe_load(compose_file)
with open(logs_compose_path, encoding="utf-8") as logs_compose_file:
    logs_compose = yaml.safe_load(logs_compose_file)
services = compose.get("services")
if not isinstance(services, dict):
    raise SystemExit("The pinned Supabase compose file has no services map.")
overlay_services = logs_compose.get("services") if isinstance(logs_compose, dict) else None
if not isinstance(overlay_services, dict) or set(overlay_services) != {"studio", "analytics", "vector"}:
    raise SystemExit("The pinned Supabase logs overlay does not contain its expected services.")
for service_id, overlay in overlay_services.items():
    if service_id not in services:
        services[service_id] = overlay
        continue
    for field in ("depends_on", "environment"):
        services[service_id].setdefault(field, {}).update(overlay.get(field, {}))
    for field, value in overlay.items():
        if field not in {"depends_on", "environment"}:
            services[service_id][field] = value
for section in ("networks", "volumes"):
    compose.setdefault(section, {}).update(logs_compose.get(section, {}))
service_ids = [
    "db", "studio", "api-gw", "auth", "rest", "realtime", "storage",
    "imgproxy", "meta", "functions", "supavisor", "analytics", "vector",
]
enabled = set(configuration["enabledServices"])
optional = {"realtime", "storage", "imgproxy", "functions", "supavisor", "analytics", "vector"}
if "analytics" not in enabled:
    services["studio"].get("depends_on", {}).pop("analytics", None)
    services["studio"].setdefault("environment", {})["ENABLED_FEATURES_LOGS_ALL"] = "false"
    for key in list(services["studio"].get("environment", {})):
        if key.startswith("LOGFLARE_"):
            del services["studio"]["environment"][key]
    services["vector"].get("depends_on", {}).pop("analytics", None)
if not set(service_ids).issubset(services):
    raise SystemExit("The pinned Supabase distribution does not contain every managed service.")
for service_id in service_ids:
    service = services[service_id]
    service["container_name"] = f"vps-manager-supabase-{instance_id.replace('-', '')}-{service_id}"
    if service_id in optional and service_id not in enabled:
        service["profiles"] = ["vpsmanager-disabled"]
    else:
        service.pop("profiles", None)
    if service_id == "api-gw":
        service.pop("ports", None)
    if service_id == "supavisor" and not configuration["exposeDatabasePorts"]:
        service.pop("ports", None)
    if service_id in {"api-gw", "studio", "vector"}:
        networks = service.get("networks") or {"default": {}}
        if isinstance(networks, list):
            networks = {network: {} for network in networks}
        networks.setdefault("default", {})
        networks["proxy"] = {}
        service["networks"] = networks
    if service_id == "storage" and "imgproxy" not in enabled:
        service.get("depends_on", {}).pop("imgproxy", None)
        service.setdefault("environment", {})["ENABLE_IMAGE_TRANSFORMATION"] = "false"
    if service_id == "vector":
        def volume_target(volume):
            if isinstance(volume, dict):
                return volume.get("target")
            if isinstance(volume, str):
                parts = volume.split(":")
                return parts[1] if len(parts) > 1 else None
            return None
        service["volumes"] = [
            volume for volume in service.get("volumes", [])
            if volume_target(volume) != "/var/run/docker.sock"
        ]
    limits = configuration["resourceLimits"][service_id]
    deploy = service.setdefault("deploy", {})
    resources = deploy.setdefault("resources", {})
    resource_limits = resources.setdefault("limits", {})
    memory_limit = f"{limits['memoryMb']}M"
    resource_limits["cpus"] = str(limits["cpus"])
    resource_limits["memory"] = memory_limit
    service["mem_limit"] = memory_limit
    labels = service.get("labels") or {}
    if isinstance(labels, list):
        labels = dict(label.split("=", 1) for label in labels)
    labels.update({
        "vps-manager.managed": "true",
        "vps-manager.application": "supabase",
        "vps-manager.instance-id": instance_id,
        "vps-manager.component": f"supabase-{service_id}",
    })
    if service_id in {"api-gw", "studio"}:
        route = f"vps-manager-supabase-{instance_id.replace('-', '')}-{service_id}"
        hostname = configuration["apiDomain"] if service_id == "api-gw" else configuration["studioDomain"]
        port = "8000" if service_id == "api-gw" else "3000"
        labels.update({
            "traefik.enable": "true",
            "traefik.docker.network": "vps-manager-proxy",
            f"traefik.http.routers.{route}.rule": f"Host(`{hostname}`)",
            f"traefik.http.routers.{route}.entrypoints": "websecure",
            f"traefik.http.routers.{route}.tls": "true",
            f"traefik.http.routers.{route}.tls.certresolver": "vpsmanager",
            f"traefik.http.services.{route}.loadbalancer.server.port": port,
        })
    service["labels"] = labels
    if service_id == "storage":
        environment = service.setdefault("environment", {})
        environment["FILE_SIZE_LIMIT"] = str(configuration["storageFileSizeLimitBytes"])
        environment["ENABLE_IMAGE_TRANSFORMATION"] = str(configuration["enableImageTransformation"]).lower()

compose.setdefault("networks", {})["proxy"] = {
    "external": True,
    "name": "vps-manager-proxy",
}
compose["name"] = project
generated_compose = os.path.join(application_directory, "docker-compose.vps-manager.yml")
with open(generated_compose, "w", encoding="utf-8") as compose_file:
    yaml.safe_dump(compose, compose_file, sort_keys=False, allow_unicode=True)
os.chmod(generated_compose, 0o600)

with open(vector_path, encoding="utf-8") as vector_file:
    vector_config = yaml.safe_load(vector_file)
vector_source = vector_config["sources"]["docker_host"]
vector_source["docker_host"] = "tcp://docker-proxy:2375"
vector_source["include_containers"] = [
    services[service_id]["container_name"]
    for service_id in service_ids
    if service_id in enabled and service_id != "vector"
]
vector_source.pop("exclude_containers", None)
vector_routes = vector_config["transforms"]["router"]["route"]
vector_routes.update({
    "kong": f'.appname == "{services["api-gw"]["container_name"]}"',
    "auth": f'.appname == "{services["auth"]["container_name"]}"',
    "rest": f'.appname == "{services["rest"]["container_name"]}"',
    "realtime": f'.appname == "{services["realtime"]["container_name"]}"',
    "storage": f'.appname == "{services["storage"]["container_name"]}"',
    "functions": f'.appname == "{services["functions"]["container_name"]}"',
    "db": f'.appname == "{services["db"]["container_name"]}"',
})
with open(vector_path, "w", encoding="utf-8") as vector_file:
    yaml.safe_dump(vector_config, vector_file, sort_keys=False, allow_unicode=True)
os.chmod(vector_path, 0o644)

credentials = {
    "taskId": task_id,
    "instanceId": instance_id,
    "apiUrl": f"https://{configuration['apiDomain']}",
    "studioUrl": f"https://{configuration['studioDomain']}",
    "dashboardUsername": "supabase",
    "dashboardPassword": private["DASHBOARD_PASSWORD"],
    "postgresPassword": private["POSTGRES_PASSWORD"],
    "anonKey": private["ANON_KEY"],
    "serviceRoleKey": private["SERVICE_ROLE_KEY"],
}
descriptor = os.open(credentials_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w", encoding="utf-8") as credentials_file:
    json.dump(credentials, credentials_file, ensure_ascii=True)
    credentials_file.write("\n")
os.chmod(credentials_path, 0o600)
PY
  then
    write_status "failed" "No se pudo generar la configuración segura del stack Supabase."
    rm -rf -- "${temporary_directory}"
    return 1
  fi

  install -o root -g 1000 -m 0640 "${credentials_temp_path}" "${persistent_credentials_path}"

  mapfile -t selected_services < <(
    python3 - "${temporary_directory}/metadata.json" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as metadata_file:
    print(*json.load(metadata_file)["configuration"]["enabledServices"], sep="\n")
PY
  )
  mapfile -t inactive_services < <(
    python3 - "${temporary_directory}/metadata.json" <<'PY'
import json
import sys
optional = {"realtime", "storage", "imgproxy", "functions", "supavisor", "analytics", "vector"}
with open(sys.argv[1], encoding="utf-8") as metadata_file:
    enabled = set(json.load(metadata_file)["configuration"]["enabledServices"])
print(*sorted(optional - enabled), sep="\n")
PY
  )
  local -a compose_base=(docker compose --project-name "${compose_project}" -f "${application_directory}/docker-compose.vps-manager.yml")
  compose_command=("${compose_base[@]}")
  if ! compose_error="$("${compose_command[@]}" config -q 2>&1)"; then
    compose_error="$(printf '%s' "${compose_error}" | tr '\r\n' '  ' | cut -c1-600)"
    write_status "failed" "Docker Compose rechazó la configuración generada para Supabase. Detalle: ${compose_error:-sin detalle adicional}"
    rm -rf -- "${temporary_directory}"
    return 1
  fi

  if ((${#inactive_services[@]})); then
    if ! "${compose_base[@]}" --profile vpsmanager-disabled rm --stop --force "${inactive_services[@]}" >/dev/null 2>&1; then
      write_status "failed" "No se pudieron detener los servicios Supabase desactivados."
      rm -rf -- "${temporary_directory}"
      return 1
    fi
  fi
  if ! "${compose_command[@]}" pull; then
    write_status "failed" "No se pudieron descargar las imágenes oficiales de Supabase."
    rm -rf -- "${temporary_directory}"
    return 1
  fi
  if ! "${compose_command[@]}" up --detach --remove-orphans; then
    write_status "failed" "Docker Compose no pudo iniciar el stack self-hosted de Supabase."
    rm -rf -- "${temporary_directory}"
    return 1
  fi

  write_status "running" "Imágenes descargadas; esperando que los ${#selected_services[@]} servicios seleccionados queden corriendo."
  for attempt in $(seq 1 720); do
    local container_states
    if ! container_states="$("${compose_command[@]}" ps --all --format json 2>/dev/null)"; then
      write_status "failed" "No se pudo consultar el estado de los servicios Supabase."
      rm -rf -- "${temporary_directory}"
      return 1
    fi
    local -a state_result
    mapfile -t state_result < <(
      printf "%s\n" "${container_states}" | python3 -c '
import json
import sys
expected = set(sys.argv[1:])
raw = sys.stdin.read().strip()
if not raw:
    raise SystemExit(1)
containers = []
try:
    decoded = json.loads(raw)
    containers = decoded if isinstance(decoded, list) else [decoded]
except json.JSONDecodeError:
    for line in raw.splitlines():
        try:
            containers.append(json.loads(line))
        except json.JSONDecodeError:
            pass
running = set()
for container in containers:
    service = container.get("Service") or container.get("service")
    state = (container.get("State") or container.get("state") or "").lower()
    health = (container.get("Health") or container.get("health") or "").lower()
    if service in expected and state == "running" and health != "unhealthy":
        running.add(service)
print(f"{len(running)}\t{len(expected)}")
' "${selected_services[@]}" 2>/dev/null || true
    )
    local running_count="0"
    local desired_count="${#selected_services[@]}"
    if ((${#state_result[@]})); then
      IFS=$'\t' read -r running_count desired_count <<< "${state_result[0]}"
    fi
    if [[ "${running_count}" =~ ^[0-9]+$ && "${desired_count}" =~ ^[0-9]+$ ]] \
      && (( running_count == desired_count )); then
      break
    fi
    if (( attempt % 15 == 0 )); then
      write_status "running" "Supabase está iniciando: ${running_count:-0}/${#selected_services[@]} servicios corriendo."
    fi
    if (( attempt == 720 )); then
      write_status "failed" "El stack se creó, pero no todos los servicios quedaron corriendo en 24 minutos. Revisa los logs y el estado de cada componente."
      rm -rf -- "${temporary_directory}"
      return 1
    fi
    sleep 2
  done

  api_container_id="$("${compose_command[@]}" ps --all --quiet api-gw | head -n 1)"
  if [[ ! "${api_container_id}" =~ ^[a-fA-F0-9]{25,64}$ ]]; then
    write_status "failed" "Supabase quedó en ejecución parcial, pero no se pudo verificar el contenedor de API."
    rm -rf -- "${temporary_directory}"
    return 1
  fi
  local service_id="${api_container_id,,}"
  install -o root -g 1000 -m 0640 "${credentials_temp_path}" \
    "${STATE_DIRECTORY}/supabase-credentials-${request_id}.json"
  write_status "succeeded" "Supabase quedó instalado: ${#selected_services[@]} servicios seleccionados están corriendo. API y Studio quedaron publicados mediante HTTPS."
  rm -rf -- "${temporary_directory}"
}
