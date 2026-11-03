import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, "public");
const port = Number(process.env.PORT ?? 3000);
const sessionTtlSeconds = 8 * 60 * 60;
const cookieName = "vps_manager_session";
const secureCookies = process.env.COOKIE_SECURE !== "false";
const loginAttempts = new Map();
const dockerApi = process.env.DOCKER_API_URL ?? "http://docker-proxy:2375";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

class RequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const credentials = (await readFile(
  process.env.ADMIN_CREDENTIALS_FILE ?? "/run/secrets/admin_credentials",
  "utf8",
)).trim();
const sessionKey = Buffer.from(
  (await readFile(process.env.SESSION_KEY_FILE ?? "/run/secrets/session_key", "utf8")).trim(),
  "hex",
);

if (!/^[a-f0-9]{64}$/i.test(sessionKey.toString("hex"))) {
  throw new Error("The session key secret must contain 32 bytes encoded as hex.");
}

const [passwordSalt, passwordHash] = credentials.split(":");
if (!/^[a-f0-9]{32}$/i.test(passwordSalt ?? "") || !/^[a-f0-9]{128}$/i.test(passwordHash ?? "")) {
  throw new Error("The admin credentials secret has an invalid format.");
}

function respond(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...headers,
  });
  response.end(body);
}

function respondJson(response, status, value, headers = {}) {
  respond(response, status, JSON.stringify(value), {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
}

function readCookie(request) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === cookieName) return valueParts.join("=");
  }
  return "";
}

function sign(payload) {
  return createHmac("sha256", sessionKey).update(payload).digest("base64url");
}

function createSession() {
  const payload = Buffer.from(JSON.stringify({
    expiresAt: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
    nonce: randomBytes(16).toString("hex"),
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function hasSession(request) {
  const token = readCookie(request);
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isInteger(decoded.expiresAt) && decoded.expiresAt > Date.now() / 1000;
  } catch {
    return false;
  }
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 8192) throw new RequestError(413, "Request body exceeds 8 KB.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "Invalid JSON request body.");
  }
}

function clientKey(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    const addresses = forwardedFor.split(",");
    const clientAddress = addresses.at(-1)?.trim();
    if (clientAddress) return clientAddress;
  }
  return request.socket.remoteAddress ?? "unknown";
}

function isRateLimited(request) {
  const key = clientKey(request);
  const now = Date.now();
  if (!loginAttempts.has(key) && loginAttempts.size >= 4096) {
    const oldestKey = loginAttempts.keys().next().value;
    if (oldestKey) loginAttempts.delete(oldestKey);
  }
  const recentAttempts = (loginAttempts.get(key) ?? []).filter((time) => now - time < 60_000);
  loginAttempts.set(key, recentAttempts);
  return recentAttempts.length >= 10;
}

function recordLoginAttempt(request) {
  const key = clientKey(request);
  const attempts = loginAttempts.get(key) ?? [];
  attempts.push(Date.now());
  loginAttempts.set(key, attempts);
}

function passwordMatches(password) {
  const actualHash = scryptSync(password, Buffer.from(passwordSalt, "hex"), 64, {
    maxmem: 64 * 1024 * 1024,
  });
  const expectedHash = Buffer.from(passwordHash, "hex");
  return timingSafeEqual(actualHash, expectedHash);
}

async function dockerGet(path) {
  const response = await fetch(`${dockerApi}${path}`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`Docker API returned HTTP ${response.status} for ${path}.`);
  }
  return response.json();
}

async function dockerGetText(path, contentLimit) {
  const response = await fetch(`${dockerApi}${path}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Docker API returned HTTP ${response.status} for ${path}.`);
  }

  if (!response.body) {
    throw new Error("Docker API returned an empty log stream.");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalLength += value.length;
    if (totalLength > contentLimit) {
      await reader.cancel();
      throw new Error("Container logs exceed the 1 MiB response limit.");
    }
    chunks.push(value);
  }

  const content = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalLength);
  if (response.headers.get("content-type")?.includes("application/vnd.docker.raw-stream")) {
    return content.toString("utf8");
  }

  const logLines = [];
  let offset = 0;
  while (offset < content.length) {
    if (content.length - offset < 8) {
      throw new Error("Docker API returned a truncated log frame.");
    }
    const streamType = content[offset];
    if ((streamType !== 1 && streamType !== 2)
      || content[offset + 1] !== 0
      || content[offset + 2] !== 0
      || content[offset + 3] !== 0) {
      throw new Error("Docker API returned an invalid log frame.");
    }

    const frameLength = content.readUInt32BE(offset + 4);
    offset += 8;
    if (frameLength > content.length - offset) {
      throw new Error("Docker API returned a truncated log frame.");
    }
    logLines.push(content.toString("utf8", offset, offset + frameLength));
    offset += frameLength;
  }

  return logLines.join("");
}

async function getContainers() {
  const containers = await dockerGet("/containers/json?all=1");
  return containers.map((container) => ({
    id: container.Id.slice(0, 12),
    name: (container.Names?.[0] ?? "").replace(/^\//, ""),
    image: container.Image,
    state: container.State,
    status: container.Status,
    ports: (container.Ports ?? []).map(({ PublicPort, PrivatePort, Type }) => ({
      public: PublicPort,
      private: PrivatePort,
      type: Type,
    })),
  }));
}

async function getServicesWithStacks() {
  const services = await dockerGet("/services");
  const tasks = await dockerGet("/tasks?desired-state=running");
  const runningByService = new Map();
  for (const task of tasks) {
    if (task.Status?.State === "running") {
      runningByService.set(task.ServiceID, (runningByService.get(task.ServiceID) ?? 0) + 1);
    }
  }

  return services.map((service) => {
    const running = runningByService.get(service.ID) ?? 0;
    const replicated = service.Spec?.Mode?.Replicated;
    const mode = replicated ? "replicado" : "global";
    return {
      stack: service.Spec?.Labels?.["com.docker.stack.namespace"] ?? null,
      id: service.ID.slice(0, 12),
      name: service.Spec?.Name ?? "unknown",
      image: service.Spec?.TaskTemplate?.ContainerSpec?.Image ?? "unknown",
      mode,
      replicas: replicated ? `${running}/${replicated.Replicas ?? 1}` : `${running} activos`,
    };
  });
}

async function getServices() {
  const services = await getServicesWithStacks();
  return services.map(({ stack, ...service }) => service);
}

async function getStacks() {
  const services = await getServicesWithStacks();
  const stacks = new Map();

  for (const service of services) {
    const stackName = service.stack;
    if (!stackName) continue;

    const stack = stacks.get(stackName) ?? { name: stackName, services: [] };
    stack.services.push({
      id: service.id,
      name: service.name,
      image: service.image,
      mode: service.mode,
      replicas: service.replicas,
    });
    stacks.set(stackName, stack);
  }

  return [...stacks.values()]
    .map((stack) => ({
      ...stack,
      services: stack.services.sort((left, right) => left.name.localeCompare(right.name)),
      serviceCount: stack.services.length,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function getDockerInfo() {
  const info = await dockerGet("/info");
  return {
    name: info.Name,
    serverVersion: info.ServerVersion,
    operatingSystem: info.OperatingSystem,
    architecture: info.Architecture,
    cpuCount: info.NCPU,
    memoryBytes: info.MemTotal,
    containers: {
      total: info.Containers,
      running: info.ContainersRunning,
      paused: info.ContainersPaused,
      stopped: info.ContainersStopped,
    },
    swarmState: info.Swarm?.LocalNodeState ?? "unknown",
  };
}

async function serveStatic(pathname, response) {
  const fileName = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!["index.html", "app.js", "styles.css"].includes(fileName)) {
    respond(response, 404, "Not found");
    return;
  }

  try {
    const body = await readFile(join(publicDir, normalize(fileName)));
    respond(response, 200, body, {
      "Content-Type": contentTypes[extname(fileName)],
    });
  } catch (error) {
    console.error("Unable to read frontend asset:", error);
    respond(response, 500, "Internal server error");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/api/health") {
    respondJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    respondJson(response, 200, { authenticated: hasSession(request) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    if (isRateLimited(request)) {
      respondJson(response, 429, { error: "Demasiados intentos. Espera un minuto." });
      return;
    }
    try {
      const body = await readJson(request);
      recordLoginAttempt(request);
      if (typeof body.password !== "string" || body.password.length > 1024 || !passwordMatches(body.password)) {
        respondJson(response, 401, { error: "Credenciales incorrectas." });
        return;
      }
      loginAttempts.delete(clientKey(request));
      respondJson(response, 200, { authenticated: true }, {
        "Set-Cookie": `${cookieName}=${createSession()}; HttpOnly${secureCookies ? "; Secure" : ""}; SameSite=Strict; Path=/; Max-Age=${sessionTtlSeconds}`,
      });
    } catch (error) {
      if (!(error instanceof RequestError)) {
        console.error("Login request failed:", error);
      }
      const status = error instanceof RequestError ? error.statusCode : 500;
      const message = status === 413
        ? "La solicitud excede el límite permitido."
        : status === 400
          ? "Solicitud inválida."
          : "No se pudo completar el inicio de sesión.";
      respondJson(response, status, { error: message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    respondJson(response, 200, { authenticated: false }, {
      "Set-Cookie": `${cookieName}=; HttpOnly${secureCookies ? "; Secure" : ""}; SameSite=Strict; Path=/; Max-Age=0`,
    });
    return;
  }

  if (url.pathname.startsWith("/api/docker/")) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      if (request.method === "GET" && url.pathname === "/api/docker/containers") {
        respondJson(response, 200, { containers: await getContainers() });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/docker/services") {
        respondJson(response, 200, { services: await getServices() });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/docker/info") {
        respondJson(response, 200, { server: await getDockerInfo() });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/docker/stacks") {
        respondJson(response, 200, { stacks: await getStacks() });
        return;
      }
      const resourceLogsMatch = request.method === "GET"
        && url.pathname.match(/^\/api\/docker\/(containers|services)\/([a-f0-9]{12,64})\/logs$/i);
      if (resourceLogsMatch) {
        const logs = await dockerGetText(
          `/${resourceLogsMatch[1]}/${resourceLogsMatch[2]}/logs?stdout=1&stderr=1&tail=100&timestamps=1`,
          1024 * 1024,
        );
        respond(response, 200, logs, { "Content-Type": "text/plain; charset=utf-8" });
        return;
      }
      respondJson(response, 404, { error: "Ruta no encontrada." });
    } catch (error) {
      console.error("Docker read operation failed:", error);
      const isLogsRequest = request.method === "GET"
        && /^\/api\/docker\/(containers|services)\/[a-f0-9]{12,64}\/logs$/i.test(url.pathname);
      respondJson(response, 502, {
        error: isLogsRequest
          ? "No se pudieron consultar los logs del contenedor. Revisa el estado del proxy Docker."
          : "No se pudo consultar Docker. Revisa el estado del proxy y sus logs.",
      });
    }
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    respondJson(response, 404, { error: "Ruta no encontrada." });
    return;
  }

  if (request.method !== "GET") {
    respond(response, 405, "Method not allowed", { Allow: "GET" });
    return;
  }
  await serveStatic(url.pathname, response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`VPS Manager listening on port ${port}`);
});

server.on("error", (error) => {
  console.error("VPS Manager server failed:", error);
  process.exitCode = 1;
});
