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

if [[ -f /etc/systemd/system/vps-manager-web-update.path ]]; then
  systemctl disable --now vps-manager-web-update.path
  rm -f -- \
    /etc/systemd/system/vps-manager-web-update.path \
    /etc/systemd/system/vps-manager-web-update.service \
    /usr/local/libexec/vps-manager-web-update
  systemctl daemon-reload
fi

docker stack rm vps-manager
for _ in $(seq 1 60); do
  if ! docker service ls --filter label=com.docker.stack.namespace=vps-manager --format '{{.ID}}' | grep -q .; then
    break
  fi
  sleep 2
done

if [[ "${1:-}" == "--purge-secrets" ]]; then
  for secret in vps_manager_admin_credentials vps_manager_session_key vps_manager_backup_key; do
    if docker secret inspect "${secret}" >/dev/null 2>&1; then
      docker secret rm "${secret}"
    fi
  done
fi

if [[ "${1:-}" == "--purge-secrets" ]]; then
  echo "Stack eliminado. PostgreSQL y los respaldos se conservaron, pero se eliminaron secretos seleccionados."
else
  echo "Stack eliminado. PostgreSQL, los respaldos y su clave de cifrado se conservaron."
fi
