import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFile, statfs } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { collectContainerMetrics } from "./container-metrics.mjs";
import { createBackupManager } from "./backup-manager.mjs";
import { createBackupScheduler } from "./backup-scheduler.mjs";
import { createDiagnosticsCollector } from "./diagnostics.mjs";
import { createUpdateChecker } from "./update-checker.mjs";
import { createWebUpdater } from "./web-updater.mjs";
import {
  createServiceOperationAgent,
  findManagedService,
  isPublicHostname,
  validateServiceScale,
} from "./service-operations.mjs";
import {
  createGiteaInstallHandler,
  createServiceRestartHandler,
  createServiceScaleHandler,
  createTaskQueueWorker,
} from "./task-queue.mjs";
import { evaluateDeploymentAlerts } from "./deployment-alerts.mjs";
import { createMetricsSampler } from "./metrics-sampler.mjs";
import { collectWebServiceAlerts } from "./web-service-alerts.mjs";
import {
  getContainerMetricsHistory,
  getContainerMetricAlerts,
  getRecentAuditEvents,
  getRecentTasks,
  getTaskById,
  getLatestTaskByType,
  getBackupIntervalHours,
  getOperationalAlerts,
  getDatabaseStatus,
  getMetricAlertThresholds,
  getMetricsSamplingIntervalMinutes,
  initDatabase,
  claimNextTask,
  completeTask,
  failTask,
  renewTaskLease,
  saveContainerRestartSamples,
  saveContainerMetrics,
  recordAuditEvent,
  createGiteaInstallTask,
  createServiceRestartTask,
  createServiceScaleTask,
  updateMetricAlertThresholds,
  updateBackupIntervalHours,
  updateMetricsSamplingIntervalMinutes,
} from "./db.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, "dist");
const port = Number(process.env.PORT ?? 3000);
const sessionTtlSeconds = 8 * 60 * 60;
const cookieName = "vps_manager_session";
const secureCookies = process.env.COOKIE_SECURE !== "false";
const loginAttempts = new Map();
const dockerApi = process.env.DOCKER_API_URL ?? "http://docker-proxy:2375";
const managerDomain = process.env.VPS_MANAGER_DOMAIN ?? "";
const testMode = process.env.VPS_MANAGER_TEST_MODE === "true";
const metricsRetentionDays = 7;
const backupRetentionDays = 7;
const backupManager = createBackupManager();
const collectDiagnostics = createDiagnosticsCollector({
  dockerGet,
  getDatabaseStatus,
  listBackups: () => backupManager.list(),
});
const currentVersion = (await readFile(join(root, "VERSION"), "utf8")).trim();
const updateChecker = createUpdateChecker({
  repository: process.env.VPS_MANAGER_GITHUB_REPOSITORY ?? "self-david/baco-vps-visor",
  currentVersion,
});
const webUpdater = createWebUpdater();
const serviceOperationAgent = createServiceOperationAgent();
const taskQueueWorker = createTaskQueueWorker({
  store: { claimNextTask, completeTask, failTask, renewTaskLease },
  handlers: {
    "service.restart": createServiceRestartHandler(serviceOperationAgent),
    "service.scale": createServiceScaleHandler(serviceOperationAgent),
    "application.gitea.install": createGiteaInstallHandler(serviceOperationAgent),
  },
  onError: (...args) => console.error("Task queue worker error:", ...args),
});
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
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

async function recordAuditEventOrRespond(response, event, completedOperation) {
  try {
    await recordAuditEvent(event);
    return true;
  } catch (error) {
    console.error(`${completedOperation} completed, but its audit event could not be saved:`, error);
    respondJson(response, 503, {
      error: `${completedOperation} se completó, pero no se pudo registrar la auditoría. La operación ya se realizó.`,
    });
    return false;
  }
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

function hasSameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin !== "string" || typeof host !== "string") return false;
  try {
    const originUrl = new URL(origin);
    const expectedUrl = new URL(`${secureCookies ? "https" : "http"}://${host}`);
    return originUrl.origin === expectedUrl.origin;
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

async function getContainerMetrics(containers) {
  const inventory = containers ?? await dockerGet("/containers/json?all=1");
  const runningContainers = inventory.filter((container) => container.State === "running");
  return collectContainerMetrics(
    runningContainers,
    (container) => dockerGet(`/containers/${container.Id}/stats?stream=false`),
  );
}

async function getContainerRestartSamples(containers) {
  const samples = [];
  const errors = [];
  let nextIndex = 0;

  async function collectNext() {
    while (nextIndex < containers.length) {
      const container = containers[nextIndex];
      nextIndex += 1;
      try {
        const inspection = await dockerGet(`/containers/${container.Id}/json`);
        if (!Number.isInteger(inspection.RestartCount) || inspection.RestartCount < 0) {
          throw new Error("Docker returned an invalid container restart count.");
        }
        samples.push({
          id: container.Id,
          name: (container.Names?.[0] ?? "").replace(/^\//, ""),
          group: container.Labels?.["com.docker.stack.namespace"]
            ?? container.Labels?.["com.docker.compose.project"]
            ?? "Sin grupo",
          restartCount: inspection.RestartCount,
        });
      } catch (error) {
        errors.push({
          id: container.Id.slice(0, 12),
          name: (container.Names?.[0] ?? "").replace(/^\//, ""),
          message: error instanceof Error ? error.message : "Unknown Docker error.",
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(4, containers.length) }, () => collectNext()),
  );
  return { samples, errors };
}

async function collectAndStoreContainerMetrics() {
  const containers = await dockerGet("/containers/json?all=1");
  const result = await getContainerMetrics(containers);
  for (const error of result.errors) {
    console.warn(`Container metrics unavailable for ${error.name || error.id}:`, error.message);
  }
  await saveContainerMetrics(result.metrics);
  const restartResult = await getContainerRestartSamples(containers);
  for (const error of restartResult.errors) {
    console.warn(`Container restart count unavailable for ${error.name || error.id}:`, error.message);
  }
  if (containers.length > 0 && restartResult.samples.length === 0) {
    throw new Error("Could not read restart counts from any Docker container.");
  }
  await saveContainerRestartSamples(restartResult.samples);
  console.log(`Stored metrics for ${result.metrics.length} running container(s).`);
}

async function getDiskUsage() {
  const filesystem = await statfs("/", { bigint: true });
  const totalBytes = Number(filesystem.blocks * filesystem.bsize);
  const freeBytes = Number(filesystem.bavail * filesystem.bsize);
  if (!Number.isFinite(totalBytes) || totalBytes <= 0 || !Number.isFinite(freeBytes) || freeBytes < 0) {
    throw new Error("The panel filesystem returned invalid disk usage.");
  }
  return {
    totalBytes,
    freeBytes,
    freePercent: (freeBytes / totalBytes) * 100,
  };
}

async function getOperationalServiceStatuses(services) {
  const taskFilters = encodeURIComponent(JSON.stringify({
    "desired-state": ["shutdown"],
    status: ["failed", "rejected"],
  }));
  const [tasks, nodes, failedTasks] = await Promise.all([
    dockerGet("/tasks?desired-state=running"),
    dockerGet("/nodes"),
    dockerGet(`/tasks?filters=${taskFilters}`),
  ]);
  const runningByService = new Map();
  const desiredByService = new Map();
  for (const task of tasks) {
    desiredByService.set(task.ServiceID, (desiredByService.get(task.ServiceID) ?? 0) + 1);
    if (task.Status?.State === "running") {
      runningByService.set(task.ServiceID, (runningByService.get(task.ServiceID) ?? 0) + 1);
    }
  }
  const activeNodes = nodes.filter((node) =>
    node.Status?.State === "ready" && node.Spec?.Availability === "active").length;

  const statuses = services.map((service) => {
    const replicated = service.Spec?.Mode?.Replicated;
    const desiredTasks = replicated
      ? replicated.Replicas ?? 1
      : desiredByService.get(service.ID) || Math.max(activeNodes, 1);
    return {
      name: service.Spec?.Name ?? "unknown",
      group: service.Spec?.Labels?.["com.docker.stack.namespace"] ?? "Sin grupo",
      desiredTasks,
      runningTasks: runningByService.get(service.ID) ?? 0,
    };
  });
  return {
    statuses,
    deploymentAlerts: evaluateDeploymentAlerts(services, failedTasks),
  };
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
      desiredReplicas: replicated ? replicated.Replicas ?? 1 : null,
      managed: service.Spec?.Labels?.["vps-manager.managed"] === "true",
      component: service.Spec?.Labels?.["vps-manager.component"] ?? null,
    };
  });
}

async function getServices() {
  const services = await getServicesWithStacks();
  return services.map(({ stack, ...service }) => service);
}

async function getGiteaApplicationState() {
  const services = await dockerGet("/services");
  const service = services.find((item) => item.Spec?.Name === "vps-manager-gitea");
  const installed = service?.Spec?.Labels?.["vps-manager.component"] === "gitea"
    && service.Spec.Labels["vps-manager.managed"] === "true";
  const nameConflict = Boolean(service && !installed);
  const domain = !testMode && isPublicHostname(managerDomain) ? `git.${managerDomain}` : null;
  const latestTask = await getLatestTaskByType("application.gitea.install");
  const installing = latestTask?.status === "pending" || latestTask?.status === "in_progress";
  const credentialsAvailable = latestTask?.status === "completed"
    && latestTask.result?.credentialsAvailable === true
    && await serviceOperationAgent.hasGiteaCredentials(latestTask.id);

  return {
    application: {
      id: "gitea",
      domain,
      url: domain ? `https://${domain}/` : null,
      sshPort: 2222,
      available: Boolean(domain) && !installed && !nameConflict && !installing,
      installed,
      installing,
      nameConflict,
      credentialsAvailable,
      latestTask: latestTask ? {
        id: latestTask.id,
        status: latestTask.status,
        message: latestTask.status === "completed"
          ? latestTask.result?.message ?? "Gitea está instalado."
          : latestTask.status === "failed"
            ? latestTask.error ?? "La instalación de Gitea falló."
            : "Instalación de Gitea en curso.",
      } : null,
    },
  };
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
  let fileName;
  try {
    fileName = pathname === "/" ? "index.html" : decodeURIComponent(pathname).slice(1);
  } catch {
    respond(response, 400, "Invalid asset path");
    return;
  }

  const filePath = resolve(publicDir, fileName);
  const relativePath = relative(publicDir, filePath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    respond(response, 404, "Not found");
    return;
  }

  try {
    const body = await readFile(filePath);
    respond(response, 200, body, {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    });
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      respond(response, 404, "Not found");
      return;
    }
    console.error("Unable to read frontend asset:", error);
    respond(response, 500, "Internal server error");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/api/health") {
    const database = await getDatabaseStatus();
    if (!database.connected) {
      respondJson(response, 503, { status: "starting", database: "disconnected" });
      return;
    }
    respondJson(response, 200, { status: "ok", database: "connected" });
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

  if (request.method === "GET" && url.pathname === "/api/system/status") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    respondJson(response, 200, { database: await getDatabaseStatus() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/system/diagnostics") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      respondJson(response, 200, await collectDiagnostics());
    } catch (error) {
      console.error("System diagnostics request failed:", error);
      respondJson(response, 503, { error: "No se pudo completar el diagnóstico del sistema." });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/system/updates") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      respondJson(response, 200, await updateChecker.check());
    } catch (error) {
      console.error("Update check failed:", error);
      respondJson(response, 503, {
        error: "No se pudo consultar o verificar la release de GitHub. Inténtalo más tarde.",
      });
    }
    return;
  }

  if (url.pathname === "/api/system/web-update") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method === "GET") {
      try {
        respondJson(response, 200, { update: await webUpdater.getStatus() });
      } catch (error) {
        console.error("Web update status request failed:", error);
        respondJson(response, 503, { error: "No se pudo consultar el estado de la actualización." });
      }
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET, POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    try {
      const release = await updateChecker.check();
      if (!release.configured || !release.updateAvailable || !release.updateReady) {
        respondJson(response, 409, {
          error: "No hay una nueva release estable verificada disponible para instalar.",
        });
        return;
      }
      const update = await webUpdater.requestUpdate();
      const audited = await recordAuditEventOrRespond(response, {
        action: "system.update.requested",
        resourceType: "system",
        resourceId: "vps-manager",
        details: { requestId: update.id, latestVersion: release.latestVersion, source: "web" },
      }, "La solicitud de actualización");
      if (!audited) return;
      respondJson(response, 202, { update, latestVersion: release.latestVersion });
    } catch (error) {
      if (error?.code === "UPDATE_IN_PROGRESS") {
        respondJson(response, 409, { error: error.message });
        return;
      }
      console.error("Web update request failed:", error);
      respondJson(response, 503, { error: "No se pudo iniciar la actualización desde el panel." });
    }
    return;
  }

  if (url.pathname === "/api/system/applications/gitea") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method === "GET") {
      try {
        respondJson(response, 200, await getGiteaApplicationState());
      } catch (error) {
        console.error("Gitea application status request failed:", error);
        respondJson(response, 503, { error: "No se pudo consultar el estado de Gitea." });
      }
      return;
    }
    if (request.method === "POST") {
      if (!hasSameOrigin(request)) {
        respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
        return;
      }
      try {
        const { application } = await getGiteaApplicationState();
        if (!application.domain) {
          respondJson(response, 409, {
            error: "Gitea requiere que VPS Manager esté instalado con un dominio público y HTTPS; no está disponible en modo de prueba ni con una dirección IP.",
          });
          return;
        }
        if (application.installed || application.nameConflict) {
          respondJson(response, 409, {
            error: application.nameConflict
              ? "Ya existe un servicio con el nombre reservado para Gitea que no pertenece a VPS Manager."
              : "Gitea ya está instalado.",
          });
          return;
        }
        if (application.installing) {
          respondJson(response, 409, { error: "Ya hay una instalación de Gitea en curso." });
          return;
        }

        const taskId = randomUUID();
        try {
          await createGiteaInstallTask({ id: taskId, domain: application.domain });
        } catch (error) {
          if (error?.code === "APPLICATION_TASK_IN_PROGRESS") {
            respondJson(response, 409, { error: error.message });
            return;
          }
          throw error;
        }
        respondJson(response, 202, {
          task: {
            id: taskId,
            type: "application.gitea.install",
            status: "pending",
            domain: application.domain,
            message: `Instalación de Gitea solicitada para https://${application.domain}/.`,
          },
        });
      } catch (error) {
        console.error("Could not request Gitea installation:", error);
        respondJson(response, 503, { error: "No se pudo iniciar la instalación de Gitea." });
      }
      return;
    }
    respond(response, 405, "Method not allowed", { Allow: "GET, POST" });
    return;
  }

  const giteaCredentialsMatch = request.method === "GET"
    && url.pathname.match(/^\/api\/system\/applications\/gitea\/credentials\/([a-f0-9-]{36})$/i);
  if (giteaCredentialsMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      const task = await getTaskById(giteaCredentialsMatch[1]);
      if (task?.type !== "application.gitea.install"
        || task.status !== "completed"
        || task.result?.credentialsAvailable !== true) {
        respondJson(response, 409, { error: "Las credenciales solo están disponibles tras completar la instalación de Gitea." });
        return;
      }
      const credentials = await serviceOperationAgent.consumeGiteaCredentials(giteaCredentialsMatch[1]);
      try {
        await recordAuditEvent({
          action: "application.gitea.credentials.revealed",
          resourceType: "application",
          resourceId: "gitea",
          details: { taskId: giteaCredentialsMatch[1] },
        });
      } catch (error) {
        console.error("Gitea credentials were revealed, but the audit event could not be saved:", error);
      }
      respondJson(response, 200, { credentials });
    } catch (error) {
      if (error?.code === "CREDENTIALS_UNAVAILABLE") {
        respondJson(response, 410, { error: error.message });
        return;
      }
      console.error("Could not retrieve one-time Gitea credentials:", error);
      respondJson(response, 503, { error: "No se pudieron consultar las credenciales de un solo uso." });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/system/service-operations") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      const recentServiceTask = (await getRecentTasks()).find((task) =>
        task.type === "service.restart" || task.type === "service.scale");
      const operation = recentServiceTask
        ? {
          id: recentServiceTask.id,
          state: {
            pending: "queued",
            in_progress: "running",
            completed: "succeeded",
            failed: "failed",
          }[recentServiceTask.status],
          serviceId: recentServiceTask.serviceId,
          operation: recentServiceTask.type === "service.scale" ? "scale-service" : "restart-service",
          replicas: recentServiceTask.desiredReplicas,
          message: recentServiceTask.status === "completed"
            ? recentServiceTask.result?.message
              ?? (recentServiceTask.type === "service.scale"
                ? `Servicio escalado a ${recentServiceTask.desiredReplicas} réplicas.`
                : "Servicio reiniciado correctamente.")
            : recentServiceTask.error
              ?? (recentServiceTask.type === "service.scale"
                ? recentServiceTask.status === "pending"
                  ? `Solicitud aceptada; esperando que el agente escale a ${recentServiceTask.desiredReplicas} réplicas.`
                  : `Escalado a ${recentServiceTask.desiredReplicas} réplicas en curso.`
                : recentServiceTask.status === "pending"
                  ? "Solicitud aceptada; esperando que el agente del VPS reinicie el servicio."
                  : "Reinicio de servicio en curso."),
        }
        : await serviceOperationAgent.getStatus();
      respondJson(response, 200, { operation });
    } catch (error) {
      console.error("Service operation status request failed:", error);
      respondJson(response, 503, { error: "No se pudo consultar el estado de la operación." });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/system/tasks") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      respondJson(response, 200, { tasks: await getRecentTasks() });
    } catch (error) {
      console.error("Task history request failed:", error);
      respondJson(response, 503, { error: "No se pudo consultar o actualizar el historial de tareas." });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/system/audit-log") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      respondJson(response, 200, { events: await getRecentAuditEvents() });
    } catch (error) {
      console.error("Audit log request failed:", error);
      respondJson(response, 503, { error: "No se pudo consultar el historial de auditoría." });
    }
    return;
  }

  if (url.pathname === "/api/system/backups") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      if (request.method === "GET") {
        const [backups, intervalHours] = await Promise.all([
          backupManager.list(),
          getBackupIntervalHours(),
        ]);
        respondJson(response, 200, { backups, intervalHours, retentionDays: backupRetentionDays });
        return;
      }
      if (request.method === "POST") {
        const backup = await backupManager.create();
        const recorded = await recordAuditEventOrRespond(response, {
          action: "backup.created",
          resourceType: "backup",
          resourceId: backup.id,
          details: { sizeBytes: backup.sizeBytes, source: "manual" },
        }, "El respaldo");
        if (!recorded) return;
        respondJson(response, 201, { backup });
        return;
      }
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET, POST" });
    } catch (error) {
      console.error("Backup request failed:", error);
      const busy = error.message === "Another backup operation is already running.";
      respondJson(response, busy ? 409 : 503, {
        error: busy
          ? "Ya hay una operación de respaldo o restauración en curso."
          : "No se pudo consultar o crear el respaldo. Revisa los logs del servicio.",
      });
    }
    return;
  }

  if (url.pathname === "/api/system/backup-settings") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      if (request.method === "GET") {
        respondJson(response, 200, {
          intervalHours: await getBackupIntervalHours(),
          retentionDays: backupRetentionDays,
        });
        return;
      }
      if (request.method === "PATCH") {
        const body = await readJson(request);
        if (!body || typeof body !== "object" || Array.isArray(body)
          || !Number.isInteger(body.intervalHours)
          || body.intervalHours < 1
          || body.intervalHours > 168) {
          respondJson(response, 400, { error: "El intervalo debe ser un número entero entre 1 y 168 horas." });
          return;
        }
        const intervalHours = await updateBackupIntervalHours(body.intervalHours);
        backupScheduler?.setIntervalHours(intervalHours);
        respondJson(response, 200, { intervalHours, retentionDays: backupRetentionDays });
        return;
      }
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET, PATCH" });
    } catch (error) {
      console.error("Backup settings request failed:", error);
      const status = error instanceof RequestError ? error.statusCode : 503;
      respondJson(response, status, {
        error: status === 413
          ? "La solicitud excede el límite permitido."
          : status === 400
            ? "Solicitud inválida."
            : "No se pudo consultar o guardar la configuración de respaldos.",
      });
    }
    return;
  }

  const restoreMatch = request.method === "POST"
    && url.pathname.match(/^\/api\/system\/backups\/(\d{13}-[a-f0-9]{24})\/restore$/);
  if (restoreMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      const body = await readJson(request);
      if (body?.confirmation !== "RESTAURAR") {
        respondJson(response, 400, { error: "Escribe RESTAURAR para confirmar la sobrescritura de la base de datos." });
        return;
      }
      const result = await backupManager.restore(restoreMatch[1]);
      const recorded = await recordAuditEventOrRespond(response, {
        action: "backup.restored",
        resourceType: "backup",
        resourceId: result.id,
        details: { restoredAt: result.restoredAt },
      }, "La restauración");
      if (!recorded) return;
      respondJson(response, 200, { restored: result });
    } catch (error) {
      console.error("Backup restore failed:", error);
      const busy = error.message === "Another backup operation is already running.";
      const status = error instanceof RequestError ? error.statusCode : busy ? 409 : 503;
      respondJson(response, status, {
        error: status === 413
          ? "La solicitud excede el límite permitido."
          : status === 400
            ? "Solicitud inválida."
            : busy
              ? "Ya hay una operación de respaldo o restauración en curso."
              : "No se pudo restaurar el respaldo. La base de datos no se modificó si la validación del cifrado falló.",
      });
    }
    return;
  }

  if (url.pathname === "/api/system/metrics-settings") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      if (request.method === "GET") {
        respondJson(response, 200, {
          intervalMinutes: await getMetricsSamplingIntervalMinutes(),
          retentionDays: metricsRetentionDays,
          ...await getMetricAlertThresholds(),
          consecutiveSamples: 2,
        });
        return;
      }
      if (request.method === "PATCH") {
        const body = await readJson(request);
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          respondJson(response, 400, { error: "La configuración debe ser un objeto JSON." });
          return;
        }
        const hasInterval = Object.hasOwn(body, "intervalMinutes");
        const thresholdKeys = [
          "cpuPercent",
          "memoryPercent",
          "diskFreePercent",
          "restartCount",
          "restartWindowMinutes",
          "certificateWarningDays",
          "httpTimeoutSeconds",
        ];
        const hasThresholds = thresholdKeys.some((key) => Object.hasOwn(body, key));
        if (!hasInterval && !hasThresholds) {
          respondJson(response, 400, { error: "No se proporcionó ningún ajuste para guardar." });
          return;
        }
        if (hasInterval
          && (!Number.isInteger(body.intervalMinutes)
            || body.intervalMinutes < 1
            || body.intervalMinutes > 1440)) {
          respondJson(response, 400, { error: "El intervalo debe ser un número entero entre 1 y 1440 minutos." });
          return;
        }
        let thresholds;
        if (hasThresholds) {
          thresholds = await getMetricAlertThresholds();
          for (const key of thresholdKeys) {
            if (Object.hasOwn(body, key)) thresholds[key] = body[key];
          }
        }
        if (thresholds
          && (!Number.isInteger(thresholds.cpuPercent)
            || thresholds.cpuPercent < 1
            || thresholds.cpuPercent > 10000
            || !Number.isInteger(thresholds.memoryPercent)
            || thresholds.memoryPercent < 1
            || thresholds.memoryPercent > 100
            || !Number.isInteger(thresholds.diskFreePercent)
            || thresholds.diskFreePercent < 1
            || thresholds.diskFreePercent > 99
            || !Number.isInteger(thresholds.restartCount)
            || thresholds.restartCount < 1
            || thresholds.restartCount > 100
            || !Number.isInteger(thresholds.restartWindowMinutes)
            || thresholds.restartWindowMinutes < 5
            || thresholds.restartWindowMinutes > 1440
            || !Number.isInteger(thresholds.certificateWarningDays)
            || thresholds.certificateWarningDays < 1
            || thresholds.certificateWarningDays > 90
            || !Number.isInteger(thresholds.httpTimeoutSeconds)
            || thresholds.httpTimeoutSeconds < 1
            || thresholds.httpTimeoutSeconds > 30)) {
          respondJson(response, 400, {
            error: "Hay umbrales inválidos. Revisa CPU, RAM, disco, reinicios, días de certificado (1–90) y timeout HTTP (1–30 s).",
          });
          return;
        }
        const intervalMinutes = hasInterval
          ? await updateMetricsSamplingIntervalMinutes(body.intervalMinutes)
          : await getMetricsSamplingIntervalMinutes();
        if (hasInterval) metricsSampler?.setIntervalMinutes(intervalMinutes);
        thresholds = hasThresholds
          ? await updateMetricAlertThresholds(thresholds)
          : await getMetricAlertThresholds();
        respondJson(response, 200, {
          intervalMinutes,
          retentionDays: metricsRetentionDays,
          ...thresholds,
          consecutiveSamples: 2,
        });
        return;
      }
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET, PATCH" });
    } catch (error) {
      console.error("Metrics settings request failed:", error);
      const status = error instanceof RequestError ? error.statusCode : 503;
      respondJson(response, status, {
        error: status === 413
          ? "La solicitud excede el límite permitido."
          : status === 400
            ? "Solicitud inválida."
            : "No se pudo consultar o guardar la configuración de métricas.",
      });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/system/metrics-history") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      respondJson(response, 200, {
        hours: 24,
        retentionDays: metricsRetentionDays,
        samples: await getContainerMetricsHistory(),
      });
    } catch (error) {
      console.error("Metrics history request failed:", error);
      respondJson(response, 503, { error: "No se pudo consultar el histórico de métricas." });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/system/metric-alerts") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      const [metricAlerts, disk, services, thresholds] = await Promise.all([
        getContainerMetricAlerts(),
        getDiskUsage(),
        dockerGet("/services"),
        getMetricAlertThresholds(),
      ]);
      const { statuses: operationalServices, deploymentAlerts } =
        await getOperationalServiceStatuses(services);
      const [operationalAlerts, webAlerts] = await Promise.all([
        getOperationalAlerts(disk, operationalServices),
        collectWebServiceAlerts(services, thresholds),
      ]);
      respondJson(response, 200, {
        consecutiveSamples: 2,
        alerts: [...metricAlerts, ...operationalAlerts, ...webAlerts, ...deploymentAlerts],
      });
    } catch (error) {
      console.error("Operational alerts request failed:", error);
      respondJson(response, 503, { error: "No se pudieron consultar las alertas de monitoreo." });
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
      if (request.method === "GET" && url.pathname === "/api/docker/container-metrics") {
        const result = await getContainerMetrics();
        for (const error of result.errors) {
          console.warn(`Container metrics unavailable for ${error.name || error.id}:`, error.message);
        }
        await saveContainerMetrics(result.metrics);
        respondJson(response, 200, {
          metrics: result.metrics,
          unavailable: result.errors.map(({ id, name }) => ({ id, name })),
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/docker/services") {
        respondJson(response, 200, { services: await getServices() });
        return;
      }
      const restartServiceMatch = request.method === "POST"
        && url.pathname.match(/^\/api\/docker\/services\/([a-f0-9]{12,64})\/restart$/i);
      if (restartServiceMatch) {
        if (!hasSameOrigin(request)) {
          respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
          return;
        }
        let service;
        try {
          service = findManagedService(await dockerGet("/services"), restartServiceMatch[1]);
        } catch (error) {
          const status = {
            SERVICE_NOT_FOUND: 404,
            SERVICE_ID_AMBIGUOUS: 409,
            SERVICE_NOT_MANAGED: 403,
          }[error?.code];
          if (status) {
            respondJson(response, status, { error: error.message });
            return;
          }
          throw error;
        }
        const taskId = randomUUID();
        const serviceName = service.Spec?.Name ?? "unknown";
        try {
          await createServiceRestartTask({ id: taskId, serviceId: service.ID, serviceName });
        } catch (error) {
          console.error("Could not persist the service restart task:", error);
          respondJson(response, 503, { error: "No se pudo guardar la tarea; no se envió el reinicio al host." });
          return;
        }
        respondJson(response, 202, {
          operation: {
            id: taskId,
            state: "queued",
            serviceId: service.ID,
            message: "Solicitud aceptada; esperando que el agente del VPS reinicie el servicio.",
          },
          serviceName,
        });
        return;
      }
      const scaleServiceMatch = request.method === "POST"
        && url.pathname.match(/^\/api\/docker\/services\/([a-f0-9]{12,64})\/scale$/i);
      if (scaleServiceMatch) {
        if (!hasSameOrigin(request)) {
          respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
          return;
        }
        let body;
        try {
          body = await readJson(request);
        } catch (error) {
          if (error instanceof RequestError) {
            respondJson(response, error.statusCode, { error: error.message });
            return;
          }
          throw error;
        }
        if (!body || typeof body !== "object" || Array.isArray(body)
          || Object.keys(body).length !== 1 || !Object.hasOwn(body, "replicas")) {
          respondJson(response, 400, { error: "Indica únicamente el número deseado de réplicas." });
          return;
        }

        let service;
        let originalReplicas;
        try {
          service = findManagedService(await dockerGet("/services"), scaleServiceMatch[1]);
          originalReplicas = validateServiceScale(service, body.replicas);
        } catch (error) {
          const status = {
            SERVICE_NOT_FOUND: 404,
            SERVICE_ID_AMBIGUOUS: 409,
            SERVICE_NOT_MANAGED: 403,
            INVALID_REPLICA_COUNT: 400,
            SERVICE_NOT_REPLICATED: 409,
            PANEL_REPLICA_COUNT: 400,
            APPLICATION_REPLICA_COUNT: 400,
          }[error?.code];
          if (status) {
            respondJson(response, status, { error: error.message });
            return;
          }
          throw error;
        }
        if (body.replicas === originalReplicas) {
          respondJson(response, 409, { error: `El servicio ya tiene ${originalReplicas} réplicas deseadas.` });
          return;
        }

        const taskId = randomUUID();
        const serviceName = service.Spec?.Name ?? "unknown";
        try {
          await createServiceScaleTask({
            id: taskId,
            serviceId: service.ID,
            serviceName,
            desiredReplicas: body.replicas,
            originalReplicas,
          });
        } catch (error) {
          console.error("Could not persist the service scale task:", error);
          respondJson(response, 503, { error: "No se pudo guardar la tarea; no se envió el escalado al host." });
          return;
        }
        respondJson(response, 202, {
          operation: {
            id: taskId,
            state: "queued",
            serviceId: service.ID,
            operation: "scale-service",
            replicas: body.replicas,
            message: `Solicitud aceptada; esperando que el agente escale ${serviceName} a ${body.replicas} réplicas.`,
          },
          serviceName,
        });
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
      if (error?.code === "OPERATION_IN_PROGRESS") {
        respondJson(response, 409, { error: error.message });
        return;
      }
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

let metricsSampler;
let backupScheduler;

server.listen(port, "0.0.0.0", () => {
  console.log(`VPS Manager listening on port ${port}`);
});

initDatabase()
  .then(async () => {
    taskQueueWorker.start();
    const intervalMinutes = await getMetricsSamplingIntervalMinutes();
    metricsSampler = createMetricsSampler({
      intervalMinutes,
      collect: collectAndStoreContainerMetrics,
      onError: (error) => console.error("Scheduled container metrics collection failed:", error),
    });
    metricsSampler.start();
    const backupIntervalHours = await getBackupIntervalHours();
    const backups = await backupManager.list();
    const lastBackupAt = backups[0] ? Date.parse(backups[0].createdAt) : undefined;
    const initialBackupDelayMs = lastBackupAt === undefined
      ? backupIntervalHours * 60 * 60 * 1000
      : Math.max(0, backupIntervalHours * 60 * 60 * 1000 - (Date.now() - lastBackupAt));
    backupScheduler = createBackupScheduler({
      intervalHours: backupIntervalHours,
      initialDelayMs: initialBackupDelayMs,
      createBackup: async () => {
        const backup = await backupManager.create();
        try {
          await recordAuditEvent({
            action: "backup.created",
            resourceType: "backup",
            resourceId: backup.id,
            details: { sizeBytes: backup.sizeBytes, source: "scheduled" },
          });
        } catch (error) {
          console.error(`Scheduled backup ${backup.id} completed, but its audit event could not be saved:`, error);
        }
        console.log(`Scheduled PostgreSQL backup completed: ${backup.id}.`);
      },
      onError: (error) => console.error("Scheduled PostgreSQL backup failed:", error),
    });
    backupScheduler.start();
  })
  .catch((error) => {
    console.error("PostgreSQL initialization failed:", error.message);
    process.exitCode = 1;
  });

server.on("close", () => {
  void taskQueueWorker.stop();
  metricsSampler?.stop();
  backupScheduler?.stop();
});

server.on("error", (error) => {
  console.error("VPS Manager server failed:", error);
  process.exitCode = 1;
});
