#!/usr/bin/env bash
set -Eeuo pipefail

readonly STATE_DIRECTORY="/var/lib/vps-manager/service-operations"
readonly request_id="${1:-}"
readonly node_address="${2:-}"
readonly ssh_user="${3:-}"
readonly ssh_port="${4:-}"
readonly host_fingerprint="${5:-}"
readonly private_cidr="${6:-}"
readonly manager_address="${7:-}"
readonly node_role="${8:-}"
readonly key_file="${STATE_DIRECTORY}/node-ssh-key-${request_id}"
temporary_directory=""

fail() {
  printf 'VPS_MANAGER_ERROR=%s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [[ -n "${temporary_directory}" ]]; then
    rm -rf -- "${temporary_directory}"
  fi
}
trap cleanup EXIT

if [[ "${EUID}" -ne 0 ]]; then
  fail "El agente host no tiene permisos de administrador."
fi
if [[ ! "${request_id}" =~ ^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$ \
  || ! "${node_address}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ \
  || ! "${manager_address}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ \
  || ! "${ssh_user}" =~ ^[a-z_][a-z0-9_-]{0,31}$ || "${ssh_user}" == "root" \
  || ! "${ssh_port}" =~ ^[0-9]{1,5}$ || "${ssh_port}" -lt 1 || "${ssh_port}" -gt 65535 \
  || ! "${host_fingerprint}" =~ ^SHA256:[A-Za-z0-9+/]{43}$ \
  || ! "${node_role}" =~ ^(worker|manager)$ ]]; then
  fail "Los parámetros de alta del nodo no son válidos."
fi

network_values="$(python3 - "${node_address}" "${manager_address}" "${private_cidr}" <<'PY'
import ipaddress
import sys

node, manager, cidr = sys.argv[1:]
try:
    network = ipaddress.ip_network(cidr, strict=False)
    addresses = [ipaddress.ip_address(node), ipaddress.ip_address(manager)]
except ValueError:
    raise SystemExit(1)
if network.version != 4 or network.prefixlen < 8 or network.prefixlen > 30:
    raise SystemExit(1)
def private(address):
    return address.is_private or address in ipaddress.ip_network("100.64.0.0/10")
if not all(private(address) and address in network for address in addresses):
    raise SystemExit(1)
print(f"{network}\t{network.network_address}\t{network.broadcast_address}")
PY
)" || fail "La IP del manager y del VPS deben pertenecer a una CIDR IPv4 privada."
IFS=$'\t' read -r private_cidr _ _ <<< "${network_values}"

if [[ -L "${key_file}" || ! -f "${key_file}" ]]; then
  fail "No se encontró la llave privada SSH temporal del alta."
fi
key_metadata="$(stat -c '%a %s' "${key_file}")"
read -r key_mode key_size <<< "${key_metadata}"
if [[ "${key_mode}" != "600" ]] || (( key_size == 0 || key_size > 32768 )); then
  fail "La llave SSH temporal tiene permisos o tamaño no válidos."
fi
for command_name in docker ufw ssh ssh-keyscan ssh-keygen python3; do
  command -v "${command_name}" >/dev/null 2>&1 || fail "Falta la herramienta ${command_name} en el VPS manager."
done

swarm_state="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null)" \
  || fail "No se pudo consultar el estado Swarm del manager."
[[ "${swarm_state}" == "active" ]] || fail "El VPS manager no pertenece a un Swarm activo."
manager_node_id="$(docker info --format '{{.Swarm.NodeID}}' 2>/dev/null)" \
  || fail "No se pudo consultar el nodo manager."
manager_node_info="$(docker node inspect --format '{{.Status.Addr}} {{.ManagerStatus.Leader}}' "${manager_node_id}" 2>/dev/null)" \
  || fail "El Docker local no está disponible como manager Swarm."
read -r swarm_manager_address manager_is_leader <<< "${manager_node_info}"
[[ "${swarm_manager_address}" == "${manager_address}" ]] \
  || fail "La IP privada indicada no coincide con la dirección anunciada por el manager."
[[ "${manager_is_leader}" == "true" ]] \
  || fail "La operación debe ejecutarse desde el manager líder del Swarm."

ufw_status="$(ufw status 2>/dev/null)" || fail "No se pudo consultar UFW en el manager."
grep -q '^Status: active$' <<< "${ufw_status}" \
  || fail "UFW debe estar activo en el manager; no se habilitó para evitar bloquear accesos existentes."

temporary_directory="$(mktemp -d "${STATE_DIRECTORY}/node-enroll-${request_id}.XXXXXX")"
chmod 0700 "${temporary_directory}"
known_hosts_file="${temporary_directory}/known_hosts"
remote_script="${temporary_directory}/remote-enroll.sh"
ssh_output="${temporary_directory}/ssh-output"
ssh_error="${temporary_directory}/ssh-error"

if ! ssh-keyscan -T 10 -p "${ssh_port}" -t ed25519,ecdsa,rsa "${node_address}" \
  > "${temporary_directory}/scanned_hosts" 2>/dev/null; then
  fail "No se pudo consultar la llave pública SSH del VPS."
fi
if ! python3 - "${node_address}" "${ssh_port}" "${host_fingerprint}" \
  "${temporary_directory}/scanned_hosts" "${known_hosts_file}" <<'PY'
import base64
import hashlib
import sys

address, port, expected, source, destination = sys.argv[1:]
expected_digest = expected.removeprefix("SHA256:")
expected_host = address if port == "22" else f"[{address}]:{port}"
matched = []
with open(source, encoding="utf-8") as scanned:
    for line in scanned:
        fields = line.split()
        if len(fields) < 3 or fields[0] != expected_host:
            continue
        try:
            key = base64.b64decode(fields[2], validate=True)
        except ValueError:
            continue
        digest = base64.b64encode(hashlib.sha256(key).digest()).decode().rstrip("=")
        if digest == expected_digest:
            matched.append(line)
if len(matched) != 1:
    raise SystemExit(1)
with open(destination, "w", encoding="utf-8") as known_hosts:
    known_hosts.write(matched[0])
PY
then
  fail "El fingerprint SSH no coincide con el VPS indicado."
fi
chmod 0600 "${known_hosts_file}"

join_token="$(docker swarm join-token --quiet "${node_role}" 2>/dev/null)" \
  || fail "No se pudo obtener el token de unión para el rol solicitado."
[[ "${join_token}" =~ ^[A-Za-z0-9_-]{20,128}$ ]] || fail "Docker devolvió un token de unión no válido."

cat > "${remote_script}" <<EOF
JOIN_TOKEN='${join_token}'
set -Eeuo pipefail
fail() {
  printf 'VPS_MANAGER_ERROR=%s\\n' "\$1" >&2
  exit 1
}
role="\$1"
node_address="\$2"
manager_address="\$3"
private_cidr="\$4"
[[ "\${EUID}" -eq 0 ]] || fail "La cuenta SSH requiere sudo sin contraseña."
[[ "\${role}" == "worker" || "\${role}" == "manager" ]] || fail "El rol de nodo no es válido."
. /etc/os-release
[[ "\${ID:-}" == "ubuntu" && "\${VERSION_ID:-}" == "24.04" ]] \
  || fail "El VPS destino debe usar Ubuntu Server 24.04."
ufw_status="\$(ufw status 2>/dev/null)" || fail "UFW debe estar instalado y configurado en el VPS destino."
grep -q '^Status: active$' <<< "\${ufw_status}" \
  || fail "UFW debe estar activo en el VPS destino; no se habilitó para evitar bloquear SSH."
swarm_state="\$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || true)"
[[ "\${swarm_state}" != "active" && "\${swarm_state}" != "pending" && "\${swarm_state}" != "error" ]] \
  || fail "El VPS destino ya está unido a un Swarm; no se modificó ese clúster."

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq || fail "No se pudieron actualizar los índices de paquetes de Ubuntu."
apt-get install -y -qq ca-certificates curl || fail "No se pudieron instalar dependencias de Docker."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL --retry 3 https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc \
  || fail "No se pudo descargar la llave oficial del repositorio Docker."
chmod a+r /etc/apt/keyrings/docker.asc
architecture="\$(dpkg --print-architecture)"
codename="\${UBUNTU_CODENAME:-\${VERSION_CODENAME:-}}"
[[ "\${codename}" == "noble" ]] || fail "La versión Ubuntu del VPS destino no corresponde a noble."
printf 'Types: deb\\nURIs: https://download.docker.com/linux/ubuntu\\nSuites: %s\\nComponents: stable\\nArchitectures: %s\\nSigned-By: /etc/apt/keyrings/docker.asc\\n' \
  "\${codename}" "\${architecture}" > /etc/apt/sources.list.d/docker.sources
apt-get update -qq || fail "No se pudo validar el repositorio oficial de Docker."
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin \
  || fail "No se pudo instalar Docker Engine en el VPS destino."
systemctl enable --now docker || fail "No se pudo iniciar Docker Engine en el VPS destino."
swarm_state="\$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null)" \
  || fail "Docker se instaló, pero no se pudo consultar Swarm en el VPS destino."
[[ "\${swarm_state}" != "active" && "\${swarm_state}" != "pending" && "\${swarm_state}" != "error" ]] \
  || fail "El VPS destino ya está unido a un Swarm."

ufw allow from "\${private_cidr}" to any port 2377 proto tcp >/dev/null \
  || fail "No se pudo agregar la regla UFW TCP 2377."
ufw allow from "\${private_cidr}" to any port 7946 proto tcp >/dev/null \
  || fail "No se pudo agregar la regla UFW TCP 7946."
ufw allow from "\${private_cidr}" to any port 7946 proto udp >/dev/null \
  || fail "No se pudo agregar la regla UFW UDP 7946."
ufw allow from "\${private_cidr}" to any port 4789 proto udp >/dev/null \
  || fail "No se pudo agregar la regla UFW UDP 4789."
docker swarm join --token "\${JOIN_TOKEN}" --advertise-addr "\${node_address}" "\${manager_address}:2377" \
  || fail "Docker no pudo unir el VPS al Swarm. Revisa la conectividad privada entre nodos."
node_id="\$(docker info --format '{{.Swarm.NodeID}}' 2>/dev/null)" \
  || fail "El VPS se unió, pero no se pudo leer su identificador de nodo."
[[ "\${node_id}" =~ ^[a-fA-F0-9]{25,64}$ ]] || fail "Docker devolvió un identificador de nodo no válido."
printf 'VPS_MANAGER_NODE_ID=%s\\n' "\${node_id}"
EOF
chmod 0600 "${remote_script}"

remote_script_with_token="${temporary_directory}/remote-enroll-token.sh"
{
  printf "JOIN_TOKEN='%s'\n" "${join_token}"
  tail -n +2 "${remote_script}"
} > "${remote_script_with_token}"
chmod 0600 "${remote_script_with_token}"
rm -f -- "${remote_script}"

ufw allow from "${private_cidr}" to any port 2377 proto tcp >/dev/null \
  || fail "No se pudo agregar la regla UFW TCP 2377 en el manager."
ufw allow from "${private_cidr}" to any port 7946 proto tcp >/dev/null \
  || fail "No se pudo agregar la regla UFW TCP 7946 en el manager."
ufw allow from "${private_cidr}" to any port 7946 proto udp >/dev/null \
  || fail "No se pudo agregar la regla UFW UDP 7946 en el manager."
ufw allow from "${private_cidr}" to any port 4789 proto udp >/dev/null \
  || fail "No se pudo agregar la regla UFW UDP 4789 en el manager."

if ! ssh -i "${key_file}" -p "${ssh_port}" \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o PasswordAuthentication=no \
  -o KbdInteractiveAuthentication=no \
  -o ConnectTimeout=15 \
  -o StrictHostKeyChecking=yes \
  -o GlobalKnownHostsFile=/dev/null \
  -o UserKnownHostsFile="${known_hosts_file}" \
  -o CheckHostIP=no \
  "${ssh_user}@${node_address}" \
  "sudo -n bash -s -- '${node_role}' '${node_address}' '${manager_address}' '${private_cidr}'" \
  < "${remote_script_with_token}" > "${ssh_output}" 2> "${ssh_error}"; then
  remote_error="$(grep '^VPS_MANAGER_ERROR=' "${ssh_error}" | tail -n 1 | cut -d= -f2- || true)"
  [[ -n "${remote_error}" ]] || remote_error="No se pudo conectar por SSH o el VPS remoto rechazó la operación."
  fail "${remote_error}"
fi

node_id="$(sed -n 's/^VPS_MANAGER_NODE_ID=//p' "${ssh_output}" | tail -n 1)"
[[ "${node_id}" =~ ^[a-fA-F0-9]{25,64}$ ]] || fail "El VPS se unió, pero no devolvió un identificador de nodo válido."
node_state=""
for _ in {1..30}; do
  node_state="$(docker node inspect --format '{{.Status.State}}' "${node_id}" 2>/dev/null || true)"
  if [[ "${node_state}" == "ready" ]]; then break; fi
  sleep 2
done
[[ "${node_state}" == "ready" ]] || fail "El nodo se unió al Swarm, pero aún no aparece como ready. Verifica conectividad y vuelve a actualizar."
printf '%s\n' "${node_id}"
