const apiBase = "https://api.cloudflare.com/client/v4";
const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function validateDomainZoneConfiguration(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some((key) => !["zone", "token", "proxied"].includes(key))
    || typeof input.zone !== "string"
    || (input.token !== undefined && typeof input.token !== "string")
    || (input.proxied !== undefined && typeof input.proxied !== "boolean")) {
    throw new TypeError("Proporciona un dominio raíz, un token de Cloudflare y un proxy válidos.");
  }
  const zone = input.zone.trim().toLowerCase().replace(/\.$/, "");
  if (!hostnamePattern.test(zone)) {
    throw new TypeError("El dominio raíz no tiene un formato válido.");
  }
  if (input.token !== undefined
    && (input.token.length < 20 || input.token.length > 512 || /[\u0000-\u001f\u007f]/.test(input.token))) {
    throw new TypeError("El token de Cloudflare no tiene un formato válido.");
  }
  return {
    zone,
    ...(input.token !== undefined ? { token: input.token } : {}),
    proxied: input.proxied ?? false,
  };
}

export function buildDomainHostname(zone, subdomain) {
  if (typeof zone !== "string" || !hostnamePattern.test(zone)
    || typeof subdomain !== "string" || subdomain.length > 253
    || /[\u0000-\u0020\u007f]/.test(subdomain)) {
    throw new TypeError("La zona o el subdominio no tienen un formato válido.");
  }
  const normalizedSubdomain = subdomain.trim().toLowerCase();
  if (!normalizedSubdomain || normalizedSubdomain === "@") return zone;
  const hostname = `${normalizedSubdomain}.${zone}`;
  if (!hostnamePattern.test(hostname)) {
    throw new TypeError("Escribe un subdominio válido, por ejemplo app o automatizacion.");
  }
  return hostname;
}

export function validateDomainConfiguration(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some((key) => ![
      "zone",
      "hostname",
      "projectId",
      "applicationId",
      "port",
      "token",
      "proxied",
      "provider",
    ].includes(key))
    || typeof input.zone !== "string"
    || typeof input.hostname !== "string"
    || ((input.projectId === undefined) === (input.applicationId === undefined))
    || (input.projectId !== undefined && typeof input.projectId !== "string")
    || (input.applicationId !== undefined && input.applicationId !== "n8n")
    || !Number.isInteger(input.port)
    || typeof input.proxied !== "boolean"
    || (input.provider !== undefined && input.provider !== "cloudflare")
    || (input.token !== undefined && typeof input.token !== "string")) {
    throw new TypeError("Proporciona zona, dominio, destino, puerto y estado del proxy válidos.");
  }
  const zone = input.zone.trim().toLowerCase().replace(/\.$/, "");
  const hostname = input.hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!hostnamePattern.test(zone) || !hostnamePattern.test(hostname)
    || (hostname !== zone && !hostname.endsWith(`.${zone}`))) {
    throw new TypeError("El dominio debe pertenecer a la zona seleccionada.");
  }
  if ((input.projectId !== undefined && !uuidPattern.test(input.projectId))
    || input.port < 1 || input.port > 65535
    || (input.applicationId === "n8n" && input.port !== 5678)) {
    throw new TypeError("Selecciona un destino y puerto válidos.");
  }
  if (input.token !== undefined
    && (input.token.length < 20 || input.token.length > 512 || /[\u0000-\u001f\u007f]/.test(input.token))) {
    throw new TypeError("El token de Cloudflare no tiene un formato válido.");
  }
  return {
    zone,
    hostname,
    ...(input.projectId !== undefined ? { projectId: input.projectId.toLowerCase() } : {}),
    ...(input.applicationId !== undefined ? { applicationId: input.applicationId } : {}),
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
      const details = Array.isArray(payload?.errors)
        ? payload.errors
          .map((item) => typeof item?.message === "string"
            ? item.message.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 240)
            : "")
          .filter(Boolean)
          .slice(0, 3)
          .join("; ")
        : "";
      const message = response.status === 401 || response.status === 403
        ? "Cloudflare rechazó el API Token. Comprueba que sea válido y tenga permiso Account → Cloudflare Tunnel → Edit."
        : "Cloudflare rechazó la operación.";
      const error = new Error(details ? `${message} Motivo de Cloudflare: ${details}` : message);
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
    return {
      id: match.id,
      name: match.name,
      ...(typeof match.account?.id === "string" ? { accountId: match.account.id } : {}),
    };
  }

  async function createTunnel(token, accountId, name, tunnelSecret) {
    if (!/^[a-f0-9]{32}$/i.test(accountId ?? "")
      || typeof name !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/.test(name)
      || typeof tunnelSecret !== "string" || !/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/.test(tunnelSecret)) {
      throw new TypeError("La cuenta, el nombre o el secreto del túnel de Cloudflare no son válidos.");
    }
    const tunnel = await request(token, `/accounts/${accountId}/cfd_tunnel`, {
      method: "POST",
      body: JSON.stringify({ name, tunnel_secret: tunnelSecret, config_src: "cloudflare" }),
    });
    if (!tunnel || typeof tunnel.id !== "string" || !/^[a-f0-9-]{36}$/i.test(tunnel.id)) {
      throw new Error("Cloudflare devolvió un identificador de túnel inválido.");
    }
    const tunnelToken = await getTunnelToken(token, accountId, tunnel.id);
    if (typeof tunnelToken !== "string" || tunnelToken.length < 20 || tunnelToken.length > 4096) {
      throw new Error("Cloudflare no devolvió un token válido para el túnel.");
    }
    return { id: tunnel.id, name: tunnel.name, token: tunnelToken };
  }

  async function getTunnelToken(token, accountId, tunnelId) {
    if (!/^[a-f0-9]{32}$/i.test(accountId ?? "") || !/^[a-f0-9-]{36}$/i.test(tunnelId ?? "")) {
      throw new TypeError("La cuenta o el identificador de túnel de Cloudflare no son válidos.");
    }
    const tunnelToken = await request(token, `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`);
    if (typeof tunnelToken !== "string" || tunnelToken.length < 20 || tunnelToken.length > 4096) {
      throw new Error("Cloudflare no devolvió un token válido para el túnel.");
    }
    return tunnelToken;
  }

  async function updateTunnelConfiguration(
    token,
    accountId,
    tunnelId,
    hostnames,
    { originProtocol = "https" } = {},
  ) {
    if (!/^[a-f0-9]{32}$/i.test(accountId ?? "")
      || !/^[a-f0-9-]{36}$/i.test(tunnelId ?? "")
      || !Array.isArray(hostnames)
      || hostnames.length > 100
      || hostnames.some((hostname) => !hostnamePattern.test(hostname))
      || !["http", "https"].includes(originProtocol)) {
      throw new TypeError("La configuración de hostnames del túnel no es válida.");
    }
    const originPort = originProtocol === "https" ? 443 : 80;
    const ingress = [
      ...hostnames.map((hostname) => ({
        hostname,
        service: `${originProtocol}://vps-manager_traefik:${originPort}`,
        originRequest: {
          httpHostHeader: hostname,
          ...(originProtocol === "https" ? { noTLSVerify: true } : {}),
        },
      })),
      { service: "http_status:404" },
    ];
    await request(token, `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
      method: "PUT",
      body: JSON.stringify({ config: { ingress } }),
    });
    return { hostnameCount: hostnames.length };
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

  async function upsertTunnelCname(token, { zoneId, hostname, tunnelId, existingRecordId }) {
    if (!/^[a-f0-9]{32}$/i.test(zoneId ?? "")
      || !hostnamePattern.test(hostname ?? "")
      || !/^[a-f0-9-]{36}$/i.test(tunnelId ?? "")) {
      throw new TypeError("La zona, el hostname o el túnel de Cloudflare no son válidos.");
    }
    const records = await request(
      token,
      `/zones/${encodeURIComponent(zoneId)}/dns_records?name=${encodeURIComponent(hostname)}&per_page=100`,
    );
    if (!Array.isArray(records)) throw new Error("Cloudflare devolvió una lista DNS inválida.");
    const recordsForHost = records.filter((record) => record.name === hostname);
    const trackedRecord = existingRecordId
      ? recordsForHost.find((record) => record.id === existingRecordId)
      : undefined;
    if (existingRecordId && !trackedRecord && recordsForHost.length > 0) {
      const missing = new Error("El registro DNS administrado ya no existe en Cloudflare; vuelve a guardar el dominio para crearlo.");
      missing.code = "CLOUDFLARE_RECORD_NOT_FOUND";
      throw missing;
    }
    if (recordsForHost.some((record) => record.id !== trackedRecord?.id)) {
      const conflict = new Error("Ya existe un registro DNS no administrado para este hostname.");
      conflict.code = "CLOUDFLARE_RECORD_EXISTS";
      throw conflict;
    }
    const body = JSON.stringify({
      type: "CNAME",
      name: hostname,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
      ttl: 1,
    });
    if (trackedRecord && trackedRecord.type !== "CNAME") {
      if (trackedRecord.type !== "A") {
        const conflict = new Error("El registro DNS administrado no se puede convertir automáticamente a CNAME.");
        conflict.code = "CLOUDFLARE_RECORD_EXISTS";
        throw conflict;
      }
      await request(
        token,
        `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(trackedRecord.id)}`,
        { method: "DELETE" },
      );
    }
    const result = trackedRecord?.type === "CNAME"
      ? await request(token, `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(trackedRecord.id)}`, {
        method: "PUT",
        body,
      })
      : await request(token, `/zones/${encodeURIComponent(zoneId)}/dns_records`, {
        method: "POST",
        body,
      });
    if (!result || typeof result.id !== "string") throw new Error("Cloudflare devolvió un registro DNS inválido.");
    return { id: result.id };
  }

  return { verifyZone, createTunnel, getTunnelToken, updateTunnelConfiguration, upsertARecord, upsertTunnelCname };
}

function validateRecord(record) {
  if (!record || typeof record.id !== "string" || record.type !== "A") {
    throw new Error("Cloudflare devolvió un registro DNS inválido.");
  }
  return { id: record.id };
}
