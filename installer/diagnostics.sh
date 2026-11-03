#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este diagnóstico como root: sudo bash installer/diagnostics.sh" >&2
  exit 1
fi

echo "== VPS Manager: diagnóstico =="
if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  printf 'Sistema: %s %s\n' "${PRETTY_NAME:-desconocido}" "${VERSION_ID:-}"
fi
printf 'Arquitectura: %s\n' "$(uname -m)"
printf 'Memoria disponible: %s MiB\n' "$(awk '/MemAvailable:/ { print int($2 / 1024) }' /proc/meminfo)"
df -h /

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker: no instalado"
  exit 0
fi

docker --version
printf 'Estado Docker: '
systemctl is-active docker || true
printf 'Estado Swarm: '
docker info --format '{{.Swarm.LocalNodeState}} (manager={{.Swarm.ControlAvailable}})' 2>/dev/null || true
echo
docker stack services vps-manager 2>/dev/null || echo "Stack vps-manager: no desplegado"
docker stack ps vps-manager --no-trunc 2>/dev/null || true
docker network inspect vps-manager-proxy --format 'Red: {{.Driver}}, attachable={{.Attachable}}' 2>/dev/null || true
echo "Puertos TCP escuchando en 80/443:"
ss -H -ltn '( sport = :80 or sport = :443 )' 2>/dev/null || true
echo "Fin del diagnóstico."
