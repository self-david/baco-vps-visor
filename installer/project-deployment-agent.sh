if [[ "${operation}" == "update-project-routes" ]]; then
  project_service="vps-manager-project-${project_id//-/}"
  if ! service_info="$(docker service inspect --format '{{.ID}} {{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}} {{index .Spec.Labels "vps-manager.project-id"}}' "${project_service}" 2>/dev/null)"; then
    write_status "failed" "No se encontró el servicio desplegado del proyecto para actualizar sus rutas."
    exit 1
  fi
  IFS=' ' read -r _ managed_label component_label inspected_project_id <<< "${service_info}"
  if [[ "${managed_label}" != "true" || "${component_label}" != "project" || "${inspected_project_id}" != "${project_id}" ]]; then
    write_status "failed" "El servicio reservado no pertenece a este proyecto administrado."
    exit 1
  fi

  route_metadata_file="$(mktemp "${STATE_DIRECTORY}/project-routes.XXXXXX")"
  cleanup_project_routes() { rm -f -- "${route_metadata_file}"; }
  trap cleanup_project_routes EXIT
  if ! python3 - "${STATE_DIRECTORY}/project-config-${project_id}.json" "${domains_hash}" > "${route_metadata_file}" <<'PY'
import hashlib
import json
import os
import re
import stat
import sys

config_path, expected_hash = sys.argv[1:]
try:
    descriptor = os.open(config_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
except FileNotFoundError:
    configuration = {"domains": []}
else:
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & 0o077 or metadata.st_size > 80000:
            raise SystemExit("Invalid project domain configuration file.")
        with os.fdopen(descriptor, encoding="utf-8") as config_file:
            descriptor = -1
            configuration = json.load(config_file)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
if not isinstance(configuration, dict):
    raise SystemExit("Invalid project domain configuration.")
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
domains = sorted(domains, key=lambda item: item["hostname"])
canonical = json.dumps(domains, ensure_ascii=False, separators=(",", ":"))
if hashlib.sha256(canonical.encode()).hexdigest() != expected_hash:
    raise SystemExit("Project domains changed while the route update was queued.")
for domain in domains:
    print(f"{domain['hostname']}\t{domain['port']}")
PY
  then
    write_status "failed" "No se pudo validar la configuración de dominios del proyecto."
    exit 1
  fi

  project_test_mode="$(sed -n 's/^VPS_MANAGER_TEST_MODE=//p' /opt/vps-manager/install.env | head -n 1)"
  project_domains=()
  while IFS= read -r project_domain; do
    [[ -n "${project_domain}" ]] && project_domains+=("${project_domain}")
  done < "${route_metadata_file}"
  route_remove_args=(--label-rm traefik.enable --label-rm traefik.swarm.network)
  route_add_args=(--label-add "vps-manager.project-domains-hash=${domains_hash}")
  for index in {0..19}; do
    project_router="vps-manager-project-${project_id//-/}-${index}"
    route_remove_args+=(
      --label-rm "traefik.http.routers.${project_router}.rule"
      --label-rm "traefik.http.routers.${project_router}.entrypoints"
      --label-rm "traefik.http.routers.${project_router}.service"
      --label-rm "traefik.http.routers.${project_router}.tls"
      --label-rm "traefik.http.routers.${project_router}.tls.certresolver"
      --label-rm "traefik.http.services.${project_router}.loadbalancer.server.port"
      --label-rm "traefik.http.routers.${project_router}-http.rule"
      --label-rm "traefik.http.routers.${project_router}-http.entrypoints"
      --label-rm "traefik.http.routers.${project_router}-http.service"
      --label-rm "traefik.http.services.${project_router}-http.loadbalancer.server.port"
    )
  done
  for index in "${!project_domains[@]}"; do
    IFS=$'\t' read -r project_domain project_port <<< "${project_domains[$index]}"
    project_router="vps-manager-project-${project_id//-/}-${index}"
    route_add_args+=(
      --label-add "traefik.http.routers.${project_router}.rule=Host(\`${project_domain}\`)"
      --label-add "traefik.http.routers.${project_router}.entrypoints=websecure"
      --label-add "traefik.http.routers.${project_router}.service=${project_router}"
      --label-add "traefik.http.routers.${project_router}.tls=true"
      --label-add "traefik.http.services.${project_router}.loadbalancer.server.port=${project_port}"
    )
    if [[ "${project_test_mode}" == "true" ]]; then
      project_http_router="${project_router}-http"
      route_add_args+=(
        --label-add "traefik.http.routers.${project_http_router}.rule=Host(\`${project_domain}\`)"
        --label-add "traefik.http.routers.${project_http_router}.entrypoints=web"
        --label-add "traefik.http.routers.${project_http_router}.service=${project_http_router}"
        --label-add "traefik.http.services.${project_http_router}.loadbalancer.server.port=${project_port}"
      )
    else
      route_add_args+=(--label-add "traefik.http.routers.${project_router}.tls.certresolver=vpsmanager")
    fi
  done
  if (( ${#project_domains[@]} > 0 )); then
    route_add_args+=(--label-add traefik.enable=true --label-add traefik.swarm.network=vps-manager-proxy)
  fi
  if ! docker service update --detach=false \
    "${route_remove_args[@]}" "${route_add_args[@]}" "${project_service}" >/dev/null; then
    write_status "failed" "Swarm no pudo actualizar las rutas del proyecto."
    exit 1
  fi
  write_status "succeeded" "Rutas del proyecto actualizadas automáticamente sin reiniciar el contenedor."
  exit 0
fi

if [[ "${operation}" == "build-project" ]]; then
  archive="${STATE_DIRECTORY}/build-source-${request_id}.zip"
  build_directory=""
  cleanup_project_build() {
    if [[ -n "${build_directory}" ]]; then rm -rf -- "${build_directory}"; fi
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

  build_directory="$(mktemp -d "${STATE_DIRECTORY}/project-build.XXXXXX")"
  build_log_file="${build_directory}/build.log"
  build_log_done="${build_directory}/build.done"
  build_log_writer="${build_directory}/capture-build-log.py"
  cat > "${build_log_writer}" <<'PY'
import sys

path = sys.argv[1]
done_path = sys.argv[2]
limit = 1048576
tail = bytearray()
while True:
    chunk = sys.stdin.buffer.read1(4096)
    if not chunk:
        break
    tail.extend(chunk)
    if len(tail) > limit:
        del tail[:-limit]
    with open(path, "wb") as log_file:
        log_file.write(tail)
        log_file.flush()
with open(done_path, "w", encoding="ascii"):
    pass
PY
  chmod 0600 "${build_log_writer}"
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
        total_size = 0
        file_count = 0
        top_level_directories = {
            entry.filename.rstrip("/")
            for entry in entries
            if entry.is_dir() and "/" not in entry.filename.rstrip("/")
        }
        first_root = entries[0].filename.rstrip("/").split("/", 1)[0]
        has_root_contents = any(entry.filename.startswith(first_root + "/") for entry in entries)
        strip_root = all(
            entry.filename.rstrip("/") == first_root or entry.filename.startswith(first_root + "/")
            for entry in entries
        ) and (len(top_level_directories) == 1 or has_root_contents)
        root_name = None
        for entry in entries:
            name = entry.filename
            if not name or "\\" in name or name.startswith("/"):
                raise ValueError("archive path is invalid")
            parts = name.rstrip("/").split("/")
            if not parts or any(part in {"", ".", ".."} for part in parts):
                raise ValueError("archive path traversal rejected")
            if root_name is None:
                root_name = parts[0]
            mode = (entry.external_attr >> 16) & 0o170000
            if mode == stat.S_IFLNK or mode not in {0, stat.S_IFREG, stat.S_IFDIR}:
                raise ValueError("archive contains a non-regular file")
            relative_parts = parts[1:] if strip_root else parts
            if not relative_parts:
                continue
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
  build_context_directory="${context_directory}/${build_context}"
  if [[ -L "${build_context_directory}" || ! -d "${build_context_directory}" ]]; then
    write_status "failed" "La ruta de contexto configurada no es un directorio válido del código."
    exit 1
  fi
  pnpm_lock_file="${build_context_directory}/pnpm-lock.yaml"
  if [[ -f "${build_context_directory}/package.json" ]] \
    && { [[ -f "${pnpm_lock_file}" || -f "${build_context_directory}/pnpm-workspace.yaml" ]] \
      || grep -Eq '"packageManager"[[:space:]]*:[[:space:]]*"pnpm@' "${build_context_directory}/package.json"; }; then
    pnpm_lock_cache="${STATE_DIRECTORY}/project-pnpm-lock-${project_id}.yaml"
    pnpm_lock_cache_source="${STATE_DIRECTORY}/project-pnpm-lock-${project_id}.source"
    pnpm_lock_repaired=false
    if [[ -L "${pnpm_lock_cache}" || -L "${pnpm_lock_cache_source}" \
      || ( -e "${pnpm_lock_cache}" && ! -f "${pnpm_lock_cache}" )
      || ( -e "${pnpm_lock_cache_source}" && ! -f "${pnpm_lock_cache_source}" ) ]]; then
      write_status "failed" "El caché protegido del lockfile de pnpm no es válido."
      exit 1
    fi
    pnpm_lock_cached=false
    if [[ -f "${pnpm_lock_cache}" && -f "${pnpm_lock_cache_source}" ]]; then
      cached_commit_sha=""
      cached_build_context=""
      cached_lock_digest=""
      if IFS=' ' read -r cached_commit_sha cached_build_context cached_lock_digest \
        < "${pnpm_lock_cache_source}" \
        && [[ "${cached_commit_sha}" == "${commit_sha}" && "${cached_build_context}" == "${build_context}" \
          && "${cached_lock_digest}" =~ ^[a-fA-F0-9]{64}$ ]]; then
        actual_lock_digest="$(sha256sum "${pnpm_lock_cache}" | awk '{print $1}')"
        if [[ "${actual_lock_digest}" == "${cached_lock_digest}" ]]; then
          if ! cp -- "${pnpm_lock_cache}" "${pnpm_lock_file}"; then
            write_status "failed" "No se pudo restaurar el lockfile de pnpm previamente validado."
            exit 1
          fi
          pnpm_lock_cached=true
        fi
      fi
    fi
    pnpm_lock_log="${build_directory}/pnpm-lock-validation.log"
    pnpm_lock_original_digest=""
    if [[ -f "${pnpm_lock_file}" ]]; then
      pnpm_lock_original_digest="$(sha256sum "${pnpm_lock_file}" | awk '{print $1}')"
    fi
    write_status "running" "Actualizando automáticamente el lockfile de pnpm y preparando las dependencias."
    if ! docker run --rm --network bridge \
      --env CI=true --env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
      --volume "${build_context_directory}:/project" --workdir /project \
      node:22.23.4-alpine3.23 sh -ec \
      'corepack pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts' \
      >"${pnpm_lock_log}" 2>&1; then
      pnpm_error_code="$(grep -Eo 'ERR_PNPM_[A-Z0-9_]+' "${pnpm_lock_log}" | tail -n 1 || true)"
      write_status "failed" "No se pudo actualizar el lockfile de pnpm automáticamente.${pnpm_error_code:+ Error: ${pnpm_error_code}.} Revisa pnpm-workspace.yaml, package.json y el acceso al registro."
      exit 1
    fi
    if [[ ! -f "${pnpm_lock_file}" ]]; then
      write_status "failed" "PNPM terminó sin generar pnpm-lock.yaml."
      exit 1
    fi
    if ! docker run --rm --network bridge \
      --env CI=true --env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
      --volume "${build_context_directory}:/project" \
      --volume /project/node_modules --workdir /project \
      node:22.23.4-alpine3.23 sh -ec \
      'corepack pnpm install --frozen-lockfile --ignore-scripts' \
      >"${pnpm_lock_log}" 2>&1; then
      pnpm_error_code="$(grep -Eo 'ERR_PNPM_[A-Z0-9_]+' "${pnpm_lock_log}" | tail -n 1 || true)"
      write_status "failed" "No se pudieron instalar las dependencias con el lockfile de pnpm validado.${pnpm_error_code:+ Error: ${pnpm_error_code}.} Revisa la salida de pnpm."
      exit 1
    fi
    pnpm_lock_updated_digest="$(sha256sum "${pnpm_lock_file}" | awk '{print $1}')"
    if [[ "${pnpm_lock_updated_digest}" != "${pnpm_lock_original_digest}" ]]; then
      pnpm_lock_repaired=true
    fi
    lockfile_size="$(stat -c '%s' "${pnpm_lock_file}")"
    if (( lockfile_size > 33554432 )); then
      write_status "failed" "El lockfile de pnpm supera el límite de 32 MiB."
      exit 1
    fi
    lockfile_digest="${pnpm_lock_updated_digest}"
    pnpm_lock_cache_temp="${build_directory}/pnpm-lock-cache"
    pnpm_lock_cache_source_temp="${build_directory}/pnpm-lock-cache.source"
    if ! cp -- "${pnpm_lock_file}" "${pnpm_lock_cache_temp}" \
      || ! chmod 0600 "${pnpm_lock_cache_temp}" \
      || ! mv -f -- "${pnpm_lock_cache_temp}" "${pnpm_lock_cache}"; then
      write_status "failed" "No se pudo guardar el lockfile de pnpm validado para builds reproducibles."
      exit 1
    fi
    if ! printf '%s %s %s\n' "${commit_sha}" "${build_context}" "${lockfile_digest}" \
      > "${pnpm_lock_cache_source_temp}" \
      || ! chmod 0600 "${pnpm_lock_cache_source_temp}" \
      || ! mv -f -- "${pnpm_lock_cache_source_temp}" "${pnpm_lock_cache_source}"; then
      write_status "failed" "No se pudo guardar la referencia segura del lockfile de pnpm."
      exit 1
    fi
  fi
  build_dockerfile="${build_context_directory}/${dockerfile_path}"
  if [[ "${deployment_type}" == "static" ]]; then
    build_dockerfile="${build_directory}/Dockerfile.static"
    printf '%s\n' 'FROM nginx:alpine' 'COPY . /usr/share/nginx/html' > "${build_dockerfile}"
    chmod 0600 "${build_dockerfile}"
  elif [[ "${deployment_type}" == "build" ]]; then
    if [[ ! -f "${build_context_directory}/package.json" ]]; then
      write_status "failed" "El perfil Build requiere package.json con un script de compilación."
      exit 1
    fi
    build_dockerfile="${build_directory}/Dockerfile.build"
    {
      printf '%s\n' 'FROM node:22-alpine AS builder' 'WORKDIR /app' 'COPY . .' \
        'RUN if [ -f package-lock.json ]; then npm ci; elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile --ignore-scripts; elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; else npm install; fi'
      printf 'RUN %s\n' "${build_command}"
      printf 'RUN test -s "/app/%s/index.html" || { echo "El build no generó index.html en %s; revisa el comando o directorio de salida. Si Astro usa output: server, configura una aplicación dinámica." >&2; exit 1; }\n' \
        "${build_output_directory}" "${build_output_directory}"
      printf '%s\n' 'FROM nginx:alpine'
      printf 'COPY --from=builder /app/%s /usr/share/nginx/html\n' "${build_output_directory}"
    } > "${build_dockerfile}"
    chmod 0600 "${build_dockerfile}"
  elif [[ "${build_strategy}" == "dockerfile" ]]; then
    configured_dockerfile="${build_context_directory}/${dockerfile_path}"
    if [[ -L "${configured_dockerfile}" ]]; then
      write_status "failed" "La ruta configurada no contiene un Dockerfile regular."
      exit 1
    fi
    if [[ ! -f "${configured_dockerfile}" ]]; then
      if [[ "${dockerfile_path}" == "Dockerfile" \
        && -f "${build_context_directory}/server.js" \
        && ! -f "${build_context_directory}/package.json" ]]; then
        build_dockerfile="${build_directory}/Dockerfile.node"
        printf '%s\n' 'FROM node:22-alpine' 'WORKDIR /app' 'COPY . .' 'EXPOSE 3000' 'CMD ["node", "server.js"]' > "${build_dockerfile}"
        chmod 0600 "${build_dockerfile}"
      elif [[ "${dockerfile_path}" == "Dockerfile" \
        && -f "${build_context_directory}/main.py" \
        && ! -f "${build_context_directory}/requirements.txt" \
        && ! -f "${build_context_directory}/pyproject.toml" \
        && ! -f "${build_context_directory}/Pipfile" ]]; then
        build_dockerfile="${build_directory}/Dockerfile.python"
        printf '%s\n' 'FROM python:3.13-slim' 'WORKDIR /app' 'COPY . .' 'EXPOSE 3000' 'CMD ["python", "main.py"]' > "${build_dockerfile}"
        chmod 0600 "${build_dockerfile}"
      elif [[ "${dockerfile_path}" == "Dockerfile" \
        && ( -f "${build_context_directory}/main.cpp" || -f "${build_context_directory}/CMakeLists.txt" || -f "${build_context_directory}/Makefile" ) ]]; then
        write_status "failed" "C++ requiere un Dockerfile que compile el proyecto y exponga el puerto HTTP configurado."
        exit 1
      elif [[ "${dockerfile_path}" == "Dockerfile" && -f "${build_context_directory}/index.html" ]]; then
        write_status "failed" "Seleccionaste un despliegue dinámico, pero solo se detectaron archivos estáticos. Cambia el tipo a estático o añade un servidor."
        exit 1
      else
        write_status "failed" "La ruta configurada no contiene un Dockerfile regular."
        exit 1
      fi
    fi
  fi
  if [[ "${deployment_type}" == "dynamic" && "${build_strategy}" == "railpack" ]] && ! command -v railpack >/dev/null 2>&1; then
    write_status "failed" "Railpack no está instalado en el host. Actualiza el instalador y vuelve a intentar."
    exit 1
  fi

  built_image="vps-manager-project-${project_id//-/}:${commit_sha}"
  if [[ "${deployment_type}" != "dynamic" || "${build_strategy}" == "dockerfile" ]]; then
    build_arguments=(
      --pull
      --load
      --tag "${built_image}"
      --label vps-manager.managed=true
      --label "vps-manager.project-id=${project_id}"
      --label "vps-manager.commit=${commit_sha}"
      --file "${build_dockerfile}"
      "${build_context_directory}"
    )
  else
    railpack_plan="${build_directory}/railpack-plan.json"
    if ! railpack prepare "${build_context_directory}" --plan-out "${railpack_plan}"; then
      write_status "failed" "Railpack no pudo detectar o preparar la configuración de build del proyecto."
      exit 1
    fi
    build_arguments=(
      --pull
      --load
      --tag "${built_image}"
      --label vps-manager.managed=true
      --label "vps-manager.project-id=${project_id}"
      --label "vps-manager.commit=${commit_sha}"
      --build-arg BUILDKIT_SYNTAX=ghcr.io/railwayapp/railpack-frontend:v0.43.0
      --file "${railpack_plan}"
      "${build_context_directory}"
    )
  fi
  write_status "running" "BuildKit está construyendo la imagen local; se muestran los mensajes recientes."
  DOCKER_CONFIG="${BUILDX_CONFIG_DIRECTORY}" \
    docker buildx build --builder "${PROJECT_BUILDER_NAME}" --progress plain "${build_arguments[@]}" \
    2>&1 | python3 "${build_log_writer}" "${build_log_file}" "${build_log_done}" &
  build_process_id=$!
  while [[ ! -f "${build_log_done}" ]] && kill -0 "${build_process_id}" 2>/dev/null; do
    write_status "running" "BuildKit está construyendo la imagen local; se muestran los mensajes recientes."
    sleep 1
  done
  build_succeeded=false
  if wait "${build_process_id}"; then
    build_succeeded=true
  fi
  if [[ "${build_succeeded}" != "true" ]]; then
    write_status "failed" "BuildKit no pudo construir y cargar la imagen local en el VPS."
    exit 1
  fi
  build_success_message="Imagen construida y cargada localmente en el VPS; no fue desplegada."
  if [[ "${pnpm_lock_repaired:-false}" == "true" ]]; then
    build_success_message="Imagen construida y cargada localmente en el VPS; lockfile de pnpm regenerado y validado en modo congelado."
  fi
  write_status "succeeded" "${build_success_message}"
  exit 0
fi

if [[ "${operation}" == "deploy-project" || "${operation}" == "remove-project" ]]; then
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

  if ! project_manager_node_id="$(docker info --format '{{.Swarm.NodeID}}')" \
    || ! [[ "${project_manager_node_id}" =~ ^[a-zA-Z0-9]{25,64}$ ]]; then
    write_status "failed" "El VPS no tiene un identificador válido de nodo manager en Swarm."
    exit 1
  fi
  built_image="vps-manager-project-${project_id//-/}:${commit_sha}"
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
    or set(configuration) - {"environment", "domain", "port", "domains", "deploymentType"} \
    or not isinstance(configuration.get("environment", {}), dict):
    raise SystemExit("Invalid project deployment configuration.")
deployment_type = configuration.get("deploymentType", "dynamic")
if deployment_type not in {"static", "dynamic", "build"}:
    raise SystemExit("Invalid project deployment type.")
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
    sorted_domains = sorted(domains, key=lambda domain: domain["hostname"])
    canonical = json.dumps({
        "deploymentType": deployment_type,
        "environment": dict(sorted(environment.items())),
        "domains": sorted_domains,
    }, ensure_ascii=False, separators=(",", ":"))
    metadata_file.write(hashlib.sha256(canonical.encode()).hexdigest() + "\n")
    environment_canonical = json.dumps({
        "deploymentType": deployment_type,
        "environment": dict(sorted(environment.items())),
    }, ensure_ascii=False, separators=(",", ":"))
    domains_canonical = json.dumps(sorted_domains, ensure_ascii=False, separators=(",", ":"))
    metadata_file.write(hashlib.sha256(environment_canonical.encode()).hexdigest() + "\n")
    metadata_file.write(hashlib.sha256(domains_canonical.encode()).hexdigest() + "\n")
    for domain in sorted_domains:
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
    IFS= read -r project_environment_hash
    IFS= read -r project_domains_hash
    while IFS=$'\t' read -r project_domain project_port; do
      [[ -n "${project_domain}" ]] && project_domains+=("${project_domain}"$'\t'"${project_port}")
    done
  } < "${deployment_metadata_file}"
  mapfile -d '' -t project_environment_entries < "${deployment_environment_file}"
  project_environment_args=()
  project_environment_create_args=()
  for environment_entry in "${project_environment_entries[@]}"; do
    project_environment_args+=(--env-add "${environment_entry}")
    project_environment_create_args+=(--env "${environment_entry}")
  done
  project_test_mode="$(sed -n 's/^VPS_MANAGER_TEST_MODE=//p' /opt/vps-manager/install.env | head -n 1)"
  project_traefik_label_args=()
  for index in "${!project_domains[@]}"; do
    IFS=$'\t' read -r project_domain project_port <<< "${project_domains[$index]}"
    project_router="vps-manager-project-${project_id//-/}-${index}"
    project_traefik_label_args+=(
      --label-add "traefik.http.routers.${project_router}.rule=Host(\`${project_domain}\`)"
      --label-add "traefik.http.routers.${project_router}.entrypoints=websecure"
      --label-add "traefik.http.routers.${project_router}.service=${project_router}"
      --label-add "traefik.http.routers.${project_router}.tls=true"
      --label-add "traefik.http.services.${project_router}.loadbalancer.server.port=${project_port}"
    )
    if [[ "${project_test_mode}" == "true" ]]; then
      project_http_router="${project_router}-http"
      project_traefik_label_args+=(
        --label-add "traefik.http.routers.${project_http_router}.rule=Host(\`${project_domain}\`)"
        --label-add "traefik.http.routers.${project_http_router}.entrypoints=web"
        --label-add "traefik.http.routers.${project_http_router}.service=${project_http_router}"
        --label-add "traefik.http.services.${project_http_router}.loadbalancer.server.port=${project_port}"
      )
    else
      project_traefik_label_args+=(--label-add "traefik.http.routers.${project_router}.tls.certresolver=vpsmanager")
    fi
  done
  if (( ${#project_domains[@]} > 0 )); then
    project_traefik_label_args+=(--label-add traefik.enable=true --label-add traefik.swarm.network=vps-manager-proxy)
  fi
  project_traefik_create_label_args=()
  for (( index=0; index<${#project_traefik_label_args[@]}; index+=2 )); do
    project_traefik_create_label_args+=(--label "${project_traefik_label_args[index + 1]}")
  done
  project_traefik_remove_args=()
  for index in {0..19}; do
    project_router="vps-manager-project-${project_id//-/}-${index}"
    project_traefik_remove_args+=(
      --label-rm "traefik.http.routers.${project_router}.rule"
      --label-rm "traefik.http.routers.${project_router}.entrypoints"
      --label-rm "traefik.http.routers.${project_router}.service"
      --label-rm "traefik.http.routers.${project_router}.tls"
      --label-rm "traefik.http.routers.${project_router}.tls.certresolver"
      --label-rm "traefik.http.services.${project_router}.loadbalancer.server.port"
      --label-rm "traefik.http.routers.${project_router}-http.rule"
      --label-rm "traefik.http.routers.${project_router}-http.entrypoints"
      --label-rm "traefik.http.routers.${project_router}-http.service"
      --label-rm "traefik.http.services.${project_router}-http.loadbalancer.server.port"
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
    if ! existing_constraints="$(docker service inspect --format '{{json .Spec.TaskTemplate.Placement.Constraints}}' "${PROJECT_SERVICE}")"; then
      write_status "failed" "No se pudieron consultar las restricciones del servicio existente."
      exit 1
    fi
    project_manager_constraint_args=()
    if [[ "${existing_constraints}" != *"node.id==${project_manager_node_id}"* ]]; then
      project_manager_constraint_args+=(--constraint-add "node.id==${project_manager_node_id}")
    fi
    if ! docker service update --detach=false \
      --mode replicated \
      --replicas 1 \
      --restart-condition any \
      --image "${built_image}" \
      --resolve-image never \
      --force \
      "${project_environment_remove_args[@]}" \
      "${project_environment_args[@]}" \
      "${project_network_args[@]}" \
      "${project_manager_constraint_args[@]}" \
      --label-rm traefik.enable \
      --label-rm traefik.swarm.network \
      "${project_traefik_remove_args[@]}" \
      --label-add vps-manager.managed=true \
      --label-add vps-manager.component=project \
      --label-add "vps-manager.project-id=${project_id}" \
      --label-add "vps-manager.project-commit=${commit_sha}" \
      --label-add "vps-manager.project-image=${built_image}" \
      --label-add "vps-manager.project-config-hash=${project_config_hash}" \
      --label-add "vps-manager.project-environment-hash=${project_environment_hash}" \
      --label-add "vps-manager.project-domains-hash=${project_domains_hash}" \
      "${project_traefik_label_args[@]}" \
      "${PROJECT_SERVICE}" >/dev/null; then
      write_status "failed" "Swarm no pudo actualizar el servicio del proyecto."
      exit 1
    fi
  else
    if ! docker service create --detach=false \
      --name "${PROJECT_SERVICE}" \
      --mode replicated \
      --replicas 1 \
      --constraint "node.id==${project_manager_node_id}" \
      --restart-condition any \
      --network vps-manager-proxy \
      "${project_environment_create_args[@]}" \
      --label vps-manager.managed=true \
      --label vps-manager.component=project \
      --label "vps-manager.project-id=${project_id}" \
      --label "vps-manager.project-commit=${commit_sha}" \
      --label "vps-manager.project-image=${built_image}" \
      --label "vps-manager.project-config-hash=${project_config_hash}" \
      --label "vps-manager.project-environment-hash=${project_environment_hash}" \
      --label "vps-manager.project-domains-hash=${project_domains_hash}" \
      "${project_traefik_create_label_args[@]}" \
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
  write_status "succeeded" "Servicio desplegado con una tarea en el nodo manager y sin puertos publicados."
  exit 0
fi
