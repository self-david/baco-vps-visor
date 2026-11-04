import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { chmod, lstat, open, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const variableNamePattern = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const projectConfigLocks = new Map();

export function validateProjectEnvironment(environment) {
  if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
    throw new TypeError("Las variables del proyecto deben ser un objeto.");
  }
  const entries = Object.entries(environment);
  if (entries.length > 100) {
    throw new RangeError("Un proyecto admite como máximo 100 variables.");
  }
  const validated = Object.create(null);
  let totalBytes = 0;
  for (const [name, value] of entries) {
    if (!variableNamePattern.test(name) || typeof value !== "string"
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
      throw new TypeError("Cada variable debe tener un nombre válido y un valor de texto.");
    }
    totalBytes += Buffer.byteLength(name) + Buffer.byteLength(value);
    if (Buffer.byteLength(value) > 8192 || totalBytes > 24_576) {
      throw new RangeError("La configuración de variables supera el límite permitido.");
    }
    validated[name] = value;
  }
  return validated;
}

function projectConfigPath(directory, projectId) {
  if (!uuidPattern.test(projectId ?? "")) {
    throw new TypeError("El identificador del proyecto no es válido.");
  }
  return join(directory, `project-config-${projectId.toLowerCase()}.json`);
}

async function withProjectConfigLock(path, operation) {
  const previous = projectConfigLocks.get(path) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  projectConfigLocks.set(path, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (projectConfigLocks.get(path) === current) projectConfigLocks.delete(path);
  }
}

async function writeConfigAtomically(directory, path, value) {
  const temporary = join(directory, `.project-config-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value)}\n`, { flag: "wx", mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch((cleanupError) => {
      if (cleanupError?.code !== "ENOENT") throw cleanupError;
    });
    throw error;
  }
}

async function readConfig(path) {
  let descriptor;
  try {
    const pathMetadata = await lstat(path);
    if (!pathMetadata.isFile()) throw new Error("La configuración del proyecto debe ser un archivo regular.");
    descriptor = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
  try {
    const metadata = await descriptor.stat();
    if (!metadata.isFile()
      || (process.platform !== "win32" && (metadata.mode & 0o077) !== 0)
      || metadata.size > 80_000) {
      throw new Error("El archivo de configuración del proyecto tiene permisos o tamaño inválidos.");
    }
    const configuration = JSON.parse(await descriptor.readFile("utf8"));
    if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
      throw new Error("El archivo de configuración del proyecto no es válido.");
    }
    return configuration;
  } finally {
    await descriptor.close();
  }
}

export async function getProjectEnvironment(directory, projectId) {
  const configuration = await readConfig(projectConfigPath(directory, projectId));
  return validateProjectEnvironment(configuration.environment ?? {});
}

export async function getProjectDeploymentConfig(directory, projectId) {
  const configuration = await readConfig(projectConfigPath(directory, projectId));
  const environment = validateProjectEnvironment(configuration.environment ?? {});
  const deploymentType = configuration.deploymentType ?? "dynamic";
  if (!["static", "dynamic", "build"].includes(deploymentType)) {
    throw new Error("El tipo de despliegue del proyecto no es válido.");
  }
  const domains = configuration.domains ?? (configuration.domain ? [{
    hostname: configuration.domain,
    port: configuration.port,
  }] : []);
  if (!Array.isArray(domains) || domains.length > 20 || domains.some((domain) =>
    !domain || typeof domain !== "object"
      || typeof domain.hostname !== "string"
      || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain.hostname)
      || !Number.isInteger(domain.port) || domain.port < 1 || domain.port > 65535)) {
    throw new Error("La configuración de despliegue del proyecto no es válida.");
  }
  const sortedEnvironment = Object.fromEntries(
    Object.entries(environment).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
  );
  const sortedDomains = [...domains].sort((left, right) =>
    left.hostname < right.hostname ? -1 : left.hostname > right.hostname ? 1 : 0);
  const canonical = JSON.stringify({ deploymentType, environment: sortedEnvironment, domains: sortedDomains });
  const configHash = createHash("sha256").update(canonical).digest("hex");
  return { deploymentType, environment, domains, configHash };
}

export async function saveProjectDeploymentType(directory, projectId, deploymentType) {
  if (!["static", "dynamic", "build"].includes(deploymentType)) {
    throw new TypeError("El tipo de despliegue del proyecto no es válido.");
  }
  const path = projectConfigPath(directory, projectId);
  await withProjectConfigLock(path, async () => {
    const current = await readConfig(path);
    await writeConfigAtomically(directory, path, { ...current, deploymentType });
  });
}

export async function saveProjectEnvironment(directory, projectId, environment) {
  const path = projectConfigPath(directory, projectId);
  const validated = validateProjectEnvironment(environment);
  await withProjectConfigLock(path, async () => {
    const current = await readConfig(path);
    await writeConfigAtomically(directory, path, { ...current, environment: validated });
  });
  return validated;
}

export async function deleteProjectConfig(directory, projectId) {
  const path = projectConfigPath(directory, projectId);
  await withProjectConfigLock(path, async () => {
    await unlink(path).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  });
}

export async function saveProjectDeploymentConfig(directory, projectId, domains) {
  if (!Array.isArray(domains) || domains.length > 20 || domains.some((domain) =>
    !domain || typeof domain !== "object"
      || typeof domain.hostname !== "string"
      || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain.hostname)
      || !Number.isInteger(domain.port) || domain.port < 1 || domain.port > 65535)) {
    throw new TypeError("La lista de dominios del proyecto no es válida.");
  }
  const path = projectConfigPath(directory, projectId);
  await withProjectConfigLock(path, async () => {
    const current = await readConfig(path);
    await writeConfigAtomically(directory, path, { ...current, domains });
  });
}

function domainTokenPath(directory, domainId) {
  if (!uuidPattern.test(domainId ?? "")) throw new TypeError("El identificador del dominio no es válido.");
  return join(directory, `cloudflare-token-${domainId.toLowerCase()}.json`);
}

export async function hasCloudflareToken(directory, domainId) {
  const configuration = await readConfig(domainTokenPath(directory, domainId));
  return typeof configuration.token === "string";
}

export async function saveCloudflareToken(directory, domainId, token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 512
    || /[\u0000-\u001f\u007f]/.test(token)) {
    throw new TypeError("El token de Cloudflare no es válido.");
  }
  const path = domainTokenPath(directory, domainId);
  const temporary = join(directory, `.cloudflare-token-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify({ token })}\n`, { flag: "wx", mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch((cleanupError) => {
      if (cleanupError?.code !== "ENOENT") throw cleanupError;
    });
    throw error;
  }
}

export async function getCloudflareToken(directory, domainId) {
  const path = domainTokenPath(directory, domainId);
  const configuration = await readConfig(path);
  const token = configuration.token;
  if (typeof token !== "string" || token.length < 20 || token.length > 512
    || /[\u0000-\u001f\u007f]/.test(token)) {
    throw new Error("El archivo de credenciales de Cloudflare no es válido.");
  }
  return token;
}

export async function deleteCloudflareToken(directory, domainId) {
  const path = domainTokenPath(directory, domainId);
  await unlink(path).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
}
