#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta como root: sudo bash installer/uninstall.sh" >&2
  exit 1
fi

if [[ "${1:-}" != "" && "${1:-}" != "--purge-secrets" ]]; then
  echo "Uso: sudo bash installer/uninstall.sh [--purge-secrets]" >&2
  exit 2
fi

if [[ "${1:-}" == "--purge-secrets" ]]; then
  echo "ADVERTENCIA: eliminar el secreto de cifrado hará irrecuperables los respaldos existentes."
  read -r -p "Escribe ELIMINAR SECRETOS para continuar: " secret_confirmation
  if [[ "${secret_confirmation}" != "ELIMINAR SECRETOS" ]]; then
    echo "Cancelado."
    exit 0
  fi
fi

echo "Esto eliminará el stack de VPS Manager."
echo "Se conservarán volúmenes persistentes, respaldos cifrados, imágenes y secretos por defecto."
read -r -p "Escribe ELIMINAR para continuar: " confirmation
if [[ "${confirmation}" != "ELIMINAR" ]]; then
  echo "Cancelado."
  exit 0
fi

if systemctl is-active --quiet vps-manager-web-update.service; then
  echo "No se puede desinstalar mientras una actualización web está en curso." >&2
  exit 1
fi
if systemctl is-active --quiet vps-manager-service-agent.service; then
  echo "No se puede desinstalar mientras una operación de servicio está en curso." >&2
  exit 1
fi

if [[ -f /etc/systemd/system/vps-manager-web-update.path ]]; then
  systemctl disable --now vps-manager-web-update.path
fi
if [[ -f /etc/systemd/system/vps-manager-service-agent.path ]]; then
  systemctl disable --now vps-manager-service-agent.path
fi
if [[ -f /etc/systemd/system/vps-manager-web-update.path \
  || -f /etc/systemd/system/vps-manager-service-agent.path \
  || -f /etc/systemd/system/vps-manager-web-update.service \
  || -f /etc/systemd/system/vps-manager-service-agent.service ]]; then
  rm -f -- \
    /etc/systemd/system/vps-manager-web-update.path \
    /etc/systemd/system/vps-manager-web-update.service \
    /usr/local/libexec/vps-manager-web-update \
    /usr/local/libexec/vps-manager-swarm-node-enroll \
    /etc/systemd/system/vps-manager-service-agent.path \
    /etc/systemd/system/vps-manager-service-agent.service \
    /usr/local/libexec/vps-manager-service-agent
  systemctl daemon-reload
fi

docker stack rm vps-manager
for _ in $(seq 1 60); do
  if ! docker service ls --filter label=com.docker.stack.namespace=vps-manager --format '{{.ID}}' | grep -q .; then
    break
  fi
  sleep 2
done

if docker service inspect vps-manager_registry >/dev/null 2>&1; then
  registry_labels="$(docker service inspect \
    --format '{{index .Spec.Labels "vps-manager.managed"}} {{index .Spec.Labels "vps-manager.component"}}' \
    vps-manager_registry)"
  if [[ "${registry_labels}" == "true registry" ]]; then
    docker service rm vps-manager_registry
    for _ in $(seq 1 60); do
      if ! docker service inspect vps-manager_registry >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done
    if docker service inspect vps-manager_registry >/dev/null 2>&1; then
      echo "No se pudo retirar el servicio del registro privado." >&2
      exit 1
    fi
  else
    echo "Se conservó un servicio no administrado llamado vps-manager_registry." >&2
  fi
fi

rm -f -- /var/lib/vps-manager/registry/config.json /var/lib/vps-manager/service-operations/registry-status.json

if [[ "${1:-}" == "--purge-secrets" ]]; then
  for secret in vps_manager_admin_credentials vps_manager_session_key vps_manager_backup_key; do
    if docker secret inspect "${secret}" >/dev/null 2>&1; then
      docker secret rm "${secret}"
    fi
  done
  while IFS= read -r secret; do
    if [[ "${secret}" =~ ^vps_manager_gitea_api_(initial|[a-f0-9]{32})$ ]]; then
      docker secret rm "${secret}"
    fi
  done < <(docker secret ls --filter label=vps-manager.component=gitea-api-token --format '{{.Name}}')
  while IFS= read -r secret; do
    if [[ "${secret}" =~ ^vps_manager_registry_auth_[a-f0-9]{32}$ ]]; then
      docker secret rm "${secret}"
    fi
  done < <(docker secret ls --filter label=vps-manager.component=registry-auth --format '{{.Name}}')
fi

if [[ "${1:-}" == "--purge-secrets" ]]; then
  echo "Stack eliminado. PostgreSQL, las imágenes del registro y los respaldos se conservaron, pero se eliminaron secretos seleccionados."
else
  echo "Stack eliminado. PostgreSQL, los datos del registro privado, los respaldos y sus secretos se conservaron."
fi
