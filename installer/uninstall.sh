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

echo "Esto eliminará el stack de VPS Manager."
echo "Se conservarán volúmenes persistentes, imágenes y secretos por defecto."
read -r -p "Escribe ELIMINAR para continuar: " confirmation
if [[ "${confirmation}" != "ELIMINAR" ]]; then
  echo "Cancelado."
  exit 0
fi

docker stack rm vps-manager
for _ in $(seq 1 60); do
  if ! docker service ls --filter label=com.docker.stack.namespace=vps-manager --format '{{.ID}}' | grep -q .; then
    break
  fi
  sleep 2
done

if [[ "${1:-}" == "--purge-secrets" ]]; then
  for secret in vps_manager_admin_credentials vps_manager_session_key; do
    if docker secret inspect "${secret}" >/dev/null 2>&1; then
      docker secret rm "${secret}"
    fi
  done
fi

echo "Stack eliminado. Los datos persistentes se conservaron."
