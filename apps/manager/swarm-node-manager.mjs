import { isIP } from "node:net";

const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const usernamePattern = /^[a-z_][a-z0-9_-]{0,31}$/;
const fingerprintPattern = /^SHA256:[A-Za-z0-9+/]{43}$/;
const privateKeyPattern = /-----BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY-----/;

function ipv4Number(address) {
  return address.split(".").reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function isPrivateAddress(address) {
  if (isIP(address) !== 4) return false;
  const [first, second] = address.split(".").map(Number);
  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 100 && second >= 64 && second <= 127);
}

function parsePrivateNetwork(cidr) {
  if (typeof cidr !== "string") throw new TypeError("Proporciona una CIDR IPv4 privada válida.");
  const match = cidr.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/);
  if (!match || isIP(match[1]) !== 4) throw new TypeError("Proporciona una CIDR IPv4 privada válida.");
  const prefix = Number(match[2]);
  if (prefix < 8 || prefix > 30 || !isPrivateAddress(match[1])) {
    throw new TypeError("La CIDR debe ser una subred privada IPv4 con prefijo entre /8 y /30.");
  }
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ipv4Number(match[1]) & mask) >>> 0;
  return {
    cidr: `${[
      (network >>> 24) & 255,
      (network >>> 16) & 255,
      (network >>> 8) & 255,
      network & 255,
    ].join(".")}/${prefix}`,
    contains(address) {
      return isPrivateAddress(address) && (ipv4Number(address) & mask) >>> 0 === network;
    },
  };
}

export function validateSwarmNodeRequest(input) {
  const expectedKeys = [
    "address",
    "sshUser",
    "sshPort",
    "hostFingerprint",
    "privateCidr",
    "managerAddress",
    "role",
  ];
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).sort().join(",") !== expectedKeys.sort().join(",")) {
    throw new TypeError("Completa los datos de conexión del VPS y la red privada.");
  }
  if (typeof input.address !== "string" || !isPrivateAddress(input.address)
    || typeof input.managerAddress !== "string" || !isPrivateAddress(input.managerAddress)) {
    throw new TypeError("La IP del VPS y la IP privada del manager deben ser IPv4 privadas.");
  }
  const network = parsePrivateNetwork(input.privateCidr);
  if (!network.contains(input.address) || !network.contains(input.managerAddress)) {
    throw new TypeError("La IP del manager y la del VPS deben pertenecer a la CIDR privada indicada.");
  }
  if (typeof input.sshUser !== "string" || !usernamePattern.test(input.sshUser) || input.sshUser === "root"
    || !Number.isInteger(input.sshPort) || input.sshPort < 1 || input.sshPort > 65535) {
    throw new TypeError("Usa una cuenta SSH no root con sudo sin contraseña y un puerto válido.");
  }
  if (typeof input.hostFingerprint !== "string" || !fingerprintPattern.test(input.hostFingerprint)) {
    throw new TypeError("El fingerprint SSH debe tener formato SHA256.");
  }
  if (input.role !== "worker" && input.role !== "manager") {
    throw new TypeError("Selecciona el rol worker o manager.");
  }
  return {
    address: input.address,
    sshUser: input.sshUser,
    sshPort: input.sshPort,
    hostFingerprint: input.hostFingerprint,
    privateCidr: network.cidr,
    managerAddress: input.managerAddress,
    role: input.role,
  };
}

export function validateSwarmNodeEnrollment(input) {
  const { privateKey } = input ?? {};
  const request = Object.fromEntries(
    Object.entries(input ?? {}).filter(([key]) => key !== "privateKey"),
  );
  const validated = validateSwarmNodeRequest(request);
  if (typeof input.privateKey !== "string" || Buffer.byteLength(input.privateKey) > 32_768
    || !privateKeyPattern.test(input.privateKey) || /[\u0000]/.test(input.privateKey)) {
    throw new TypeError("La llave privada SSH no tiene un formato compatible o supera 32 KiB.");
  }
  return {
    ...validated,
    privateKey,
  };
}

export function mapSwarmNode(node) {
  const spec = node?.Spec ?? {};
  const status = node?.Status ?? {};
  const description = node?.Description ?? {};
  return {
    id: node?.ID,
    hostname: description.Hostname ?? "desconocido",
    address: status.Addr ?? null,
    role: spec.Role ?? "worker",
    availability: spec.Availability ?? "unknown",
    state: status.State ?? "unknown",
    message: status.Message ?? "",
    engineVersion: description.Engine?.EngineVersion ?? null,
    architecture: description.Platform
      ? `${description.Platform.Architecture ?? "?"}/${description.Platform.OS ?? "?"}`
      : null,
    cpuCount: description.Resources?.NanoCPUs
      ? description.Resources.NanoCPUs / 1_000_000_000
      : null,
    memoryBytes: description.Resources?.MemoryBytes ?? null,
    managerReachability: node?.ManagerStatus?.Reachability ?? null,
    leader: node?.ManagerStatus?.Leader === true,
  };
}
