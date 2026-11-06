import { isPublicHostname } from "./service-operations.mjs";

const resourceServices = [
  "db",
  "studio",
  "api-gw",
  "auth",
  "rest",
  "realtime",
  "storage",
  "imgproxy",
  "meta",
  "functions",
  "supavisor",
];
const supabaseDefaults = {
  db: { cpus: 2, memoryMb: 4096 },
  studio: { cpus: 1, memoryMb: 1024 },
  "api-gw": { cpus: 1, memoryMb: 512 },
  auth: { cpus: 0.5, memoryMb: 512 },
  rest: { cpus: 0.5, memoryMb: 512 },
  realtime: { cpus: 1, memoryMb: 1024 },
  storage: { cpus: 1, memoryMb: 1024 },
  imgproxy: { cpus: 0.5, memoryMb: 512 },
  meta: { cpus: 0.25, memoryMb: 256 },
  functions: { cpus: 1, memoryMb: 2048 },
  supavisor: { cpus: 1, memoryMb: 1024 },
};

function isPublicHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && isPublicHostname(url.hostname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

export function getSupabaseDefaultConfiguration() {
  return {
    additionalRedirectUrls: [],
    organizationName: "Default Organization",
    projectName: "Default Project",
    disableSignup: true,
    enableEmailSignup: true,
    enableEmailAutoconfirm: false,
    enableAnonymousUsers: false,
    jwtExpirySeconds: 3600,
    maxRows: 1000,
    storageFileSizeLimitBytes: 52428800,
    storageRegion: "local",
    enableImageTransformation: true,
    functionsVerifyJwt: true,
    smtp: null,
    oauthProviders: {},
    resourceLimits: structuredClone(supabaseDefaults),
  };
}

export function getN8nDefaultConfiguration() {
  return {
    version: "2.46.4",
    timezone: "UTC",
    cpus: 1,
    memoryMb: 1536,
  };
}

export function validateN8nInstanceConfiguration(input) {
  const defaults = getN8nDefaultConfiguration();
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some((key) => !Object.hasOwn(defaults, key))) {
    throw new TypeError("La configuración de n8n contiene campos no permitidos.");
  }
  const configuration = { ...defaults, ...input };
  if (typeof configuration.version !== "string"
    || !/^\d+\.\d+\.\d+$/.test(configuration.version)) {
    throw new TypeError("La versión de n8n debe ser una versión estable fijada como X.Y.Z.");
  }
  let validTimezone = false;
  if (typeof configuration.timezone === "string" && configuration.timezone.length <= 100) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: configuration.timezone });
      validTimezone = true;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  if (!validTimezone) {
    throw new TypeError("Selecciona una zona horaria IANA válida para n8n.");
  }
  if (typeof configuration.cpus !== "number" || !Number.isFinite(configuration.cpus)
    || configuration.cpus < 0.25 || configuration.cpus > 8) {
    throw new RangeError("El límite de CPU de n8n debe estar entre 0.25 y 8.");
  }
  if (!Number.isInteger(configuration.memoryMb)
    || configuration.memoryMb < 256 || configuration.memoryMb > 16384) {
    throw new RangeError("La memoria de n8n debe estar entre 256 y 16384 MB.");
  }
  return configuration;
}

export function validateSupabaseInstanceConfiguration(input) {
  const defaults = getSupabaseDefaultConfiguration();
  const allowedFields = new Set([
    "apiDomain",
    "studioDomain",
    "siteUrl",
    ...Object.keys(defaults),
    "smtp",
    "oauthProviders",
  ]);
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some((key) => !allowedFields.has(key))) {
    throw new TypeError("La configuración de Supabase contiene campos no permitidos.");
  }

  const apiDomain = typeof input.apiDomain === "string" ? input.apiDomain.trim().toLowerCase() : "";
  const studioDomain = typeof input.studioDomain === "string" ? input.studioDomain.trim().toLowerCase() : "";
  const siteUrl = typeof input.siteUrl === "string" ? input.siteUrl.trim() : "";
  if (!isPublicHostname(apiDomain) || !isPublicHostname(studioDomain) || apiDomain === studioDomain
    || !isPublicHttpsUrl(siteUrl)) {
    throw new TypeError("Configura dominios públicos distintos para API y Studio y una URL HTTPS pública para el sitio.");
  }

  const configuration = {
    ...defaults,
    ...input,
    apiDomain,
    studioDomain,
    siteUrl,
  };
  if (!Array.isArray(configuration.additionalRedirectUrls)
    || configuration.additionalRedirectUrls.length > 50
    || !configuration.additionalRedirectUrls.every(isPublicHttpsUrl)) {
    throw new TypeError("Las URLs de redirección deben ser URLs HTTPS públicas (máximo 50).");
  }
  for (const field of ["organizationName", "projectName", "storageRegion"]) {
    if (typeof configuration[field] !== "string"
      || configuration[field].trim().length < 1
      || configuration[field].trim().length > 100
      || /[\u0000-\u001f\u007f]/.test(configuration[field])) {
      throw new TypeError(`El campo ${field} debe contener entre 1 y 100 caracteres válidos.`);
    }
    configuration[field] = configuration[field].trim();
  }
  for (const field of [
    "disableSignup",
    "enableEmailSignup",
    "enableEmailAutoconfirm",
    "enableAnonymousUsers",
    "enableImageTransformation",
    "functionsVerifyJwt",
  ]) {
    if (typeof configuration[field] !== "boolean") {
      throw new TypeError(`El campo ${field} debe ser booleano.`);
    }
  }
  const integerRanges = {
    jwtExpirySeconds: [300, 604800],
    maxRows: [1, 10000],
    storageFileSizeLimitBytes: [1048576, 5368709120],
  };
  for (const [field, [minimum, maximum]] of Object.entries(integerRanges)) {
    if (!Number.isInteger(configuration[field])
      || configuration[field] < minimum || configuration[field] > maximum) {
      throw new RangeError(`El campo ${field} debe estar entre ${minimum} y ${maximum}.`);
    }
  }
  if (configuration.smtp !== null) {
    const smtp = configuration.smtp;
    if (!smtp || typeof smtp !== "object" || Array.isArray(smtp)
      || Object.keys(smtp).sort().join(",") !== ["adminEmail", "host", "port", "senderName", "username"].sort().join(",")
      || typeof smtp.host !== "string" || smtp.host.trim().length < 1 || smtp.host.length > 253 || /[\s\u0000-\u001f\u007f]/.test(smtp.host.trim())
      || typeof smtp.adminEmail !== "string" || smtp.adminEmail.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(smtp.adminEmail)
      || typeof smtp.senderName !== "string" || smtp.senderName.trim().length < 1 || smtp.senderName.length > 100 || /[\u0000-\u001f\u007f]/.test(smtp.senderName)
      || typeof smtp.username !== "string" || smtp.username.length > 255 || /[\u0000-\u001f\u007f]/.test(smtp.username)
      || !Number.isInteger(smtp.port) || smtp.port < 1 || smtp.port > 65535) {
      throw new TypeError("La configuración SMTP no es válida; no incluyas contraseñas en ella.");
    }
    configuration.smtp = {
      host: smtp.host.trim(),
      port: smtp.port,
      adminEmail: smtp.adminEmail.trim(),
      senderName: smtp.senderName.trim(),
      username: smtp.username.trim(),
    };
  }
  if (!configuration.oauthProviders || typeof configuration.oauthProviders !== "object"
    || Array.isArray(configuration.oauthProviders)
    || Object.keys(configuration.oauthProviders).some((provider) => !["github", "google", "azure"].includes(provider))) {
    throw new TypeError("Configura únicamente proveedores OAuth compatibles.");
  }
  for (const [provider, oauth] of Object.entries(configuration.oauthProviders)) {
    if (!oauth || typeof oauth !== "object" || Array.isArray(oauth)
      || Object.keys(oauth).sort().join(",") !== "clientId,enabled"
      || typeof oauth.enabled !== "boolean"
      || typeof oauth.clientId !== "string" || oauth.clientId.length > 512
      || (oauth.enabled && oauth.clientId.trim().length === 0)) {
      throw new TypeError(`La configuración OAuth de ${provider} no es válida; no incluyas secretos de cliente.`);
    }
    configuration.oauthProviders[provider] = {
      enabled: oauth.enabled,
      clientId: oauth.clientId.trim(),
    };
  }
  if (!configuration.resourceLimits || typeof configuration.resourceLimits !== "object"
    || Array.isArray(configuration.resourceLimits)
    || Object.keys(configuration.resourceLimits).sort().join(",") !== [...resourceServices].sort().join(",")) {
    throw new TypeError("Los límites de recursos deben declarar todos los servicios de Supabase.");
  }
  for (const service of resourceServices) {
    const limits = configuration.resourceLimits[service];
    if (!limits || typeof limits !== "object" || Array.isArray(limits)
      || Object.keys(limits).sort().join(",") !== "cpus,memoryMb"
      || typeof limits.cpus !== "number" || !Number.isFinite(limits.cpus)
      || limits.cpus < 0.1 || limits.cpus > 16
      || !Number.isInteger(limits.memoryMb) || limits.memoryMb < 128 || limits.memoryMb > 32768) {
      throw new RangeError(`Los recursos asignados a ${service} no son válidos.`);
    }
  }
  configuration.additionalRedirectUrls = configuration.additionalRedirectUrls
    .map((url) => url.trim());
  return configuration;
}
