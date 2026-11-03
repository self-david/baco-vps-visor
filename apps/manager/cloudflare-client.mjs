const apiBase = "https://api.cloudflare.com/client/v4";
const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function validateDomainConfiguration(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some((key) => ![
      "zone",
      "hostname",
      "projectId",
      "port",
      "token",
      "proxied",
      "provider",
    ].includes(key))
    || typeof input.zone !== "string"
    || typeof input.hostname !== "string"
    || typeof input.projectId !== "string"
    || !Number.isInteger(input.port)
    || typeof input.proxied !== "boolean"
    || (input.provider !== undefined && input.provider !== "cloudflare")
    || (input.token !== undefined && typeof input.token !== "string")) {
    throw new TypeError("Proporciona zona, dominio, proyecto, puerto y estado del proxy válidos.");
  }
  const zone = input.zone.trim().toLowerCase().replace(/\.$/, "");
  const hostname = input.hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!hostnamePattern.test(zone) || !hostnamePattern.test(hostname)
    || (hostname !== zone && !hostname.endsWith(`.${zone}`))) {
    throw new TypeError("El dominio debe pertenecer a la zona seleccionada.");
  }
  if (!uuidPattern.test(input.projectId) || input.port < 1 || input.port > 65535) {
    throw new TypeError("Selecciona un proyecto y puerto válidos.");
  }
  if (input.token !== undefined
    && (input.token.length < 20 || input.token.length > 512 || /[\u0000-\u001f\u007f]/.test(input.token))) {
    throw new TypeError("El token de Cloudflare no tiene un formato válido.");
  }
  return {
    zone,
    hostname,
    projectId: input.projectId.toLowerCase(),
    port: input.port,
    proxied: input.proxied,
    provider: "cloudflare",
    ...(input.token !== undefined ? { token: input.token } : {}),
  };
}

export function isIpv4Address(value) {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 4 || !parts.every((part) =>
    /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)) return false;
  const [first, second, third] = parts.map(Number);
  return first !== 0 && first !== 10 && first !== 127 && first < 224
    && !(first === 100 && second >= 64 && second <= 127)
    && !(first === 169 && second === 254)
    && !(first === 172 && second >= 16 && second <= 31)
    && !(first === 192 && second === 168)
    && !(first === 192 && second === 0 && third === 0)
    && !(first === 192 && second === 0 && third === 2)
    && !(first === 198 && (second === 18 || second === 19 || second === 51 && third === 100))
    && !(first === 203 && second === 0 && third === 113);
}

export function createCloudflareClient({
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
} = {}) {
  if (typeof fetchImpl !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 100) {
    throw new TypeError("La configuración del cliente Cloudflare no es válida.");
  }

  async function request(token, path, options = {}) {
    if (typeof token !== "string" || token.length < 20 || token.length > 512) {
      throw new TypeError("El token de Cloudflare no es válido.");
    }
    let response;
    try {
      response = await fetchImpl(`${apiBase}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const unavailable = new Error("No se pudo conectar con Cloudflare.");
      unavailable.code = "CLOUDFLARE_UNAVAILABLE";
      throw unavailable;
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Cloudflare devolvió una respuesta inválida.");
    }
    if (!response.ok || payload?.success !== true) {
      const error = new Error("Cloudflare rechazó la operación. Verifica el token y sus permisos de lectura de zona y edición DNS.");
      error.code = response.status === 401 || response.status === 403
        ? "CLOUDFLARE_TOKEN_INVALID"
        : "CLOUDFLARE_REQUEST_FAILED";
      throw error;
    }
    return payload.result;
  }

  async function verifyZone(token, zone) {
    const zones = await request(token, `/zones?name=${encodeURIComponent(zone)}&status=active`);
    const match = Array.isArray(zones) ? zones.find((item) => item.name === zone && item.status === "active") : null;
    if (!match || typeof match.id !== "string") {
      const error = new Error("No se encontró una zona activa para ese dominio en la cuenta de Cloudflare.");
      error.code = "CLOUDFLARE_ZONE_NOT_FOUND";
      throw error;
    }
    return { id: match.id, name: match.name };
  }

  async function upsertARecord(token, { zoneId, hostname, address, proxied, existingRecordId }) {
    const records = await request(
      token,
      `/zones/${encodeURIComponent(zoneId)}/dns_records?type=A&name=${encodeURIComponent(hostname)}&per_page=100`,
    );
    if (!Array.isArray(records)) throw new Error("Cloudflare devolvió una lista DNS inválida.");
    const recordsForHost = records.filter((record) => record.type === "A" && record.name === hostname);
    if (existingRecordId) {
      const record = recordsForHost.find((candidate) => candidate.id === existingRecordId);
      if (!record && recordsForHost.length > 0) {
        const missing = new Error("El registro DNS administrado ya no existe en Cloudflare; vuelve a guardar el dominio para crearlo.");
        missing.code = "CLOUDFLARE_RECORD_NOT_FOUND";
        throw missing;
      }
      if (record) {
        const result = await request(token, `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(record.id)}`, {
          method: "PUT",
          body: JSON.stringify({ type: "A", name: hostname, content: address, proxied }),
        });
        return validateRecord(result);
      }
    }
    if (recordsForHost.length > 0) {
      const conflict = new Error("Ya existe un registro A para este dominio. Elimínalo o cambia su nombre en Cloudflare antes de conectarlo.");
      conflict.code = "CLOUDFLARE_RECORD_EXISTS";
      throw conflict;
    }
    const result = await request(token, `/zones/${encodeURIComponent(zoneId)}/dns_records`, {
      method: "POST",
      body: JSON.stringify({ type: "A", name: hostname, content: address, proxied }),
    });
    return validateRecord(result);
  }

  return { verifyZone, upsertARecord };
}

function validateRecord(record) {
  if (!record || typeof record.id !== "string" || record.type !== "A") {
    throw new Error("Cloudflare devolvió un registro DNS inválido.");
  }
  return { id: record.id };
}
