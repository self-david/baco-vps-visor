import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFile, statfs, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { collectContainerMetrics } from "./container-metrics.mjs";
import { createBackupManager } from "./backup-manager.mjs";
import { createBackupScheduler } from "./backup-scheduler.mjs";
import { createDiagnosticsCollector } from "./diagnostics.mjs";
import { createUpdateChecker } from "./update-checker.mjs";
import { createWebUpdater } from "./web-updater.mjs";
import { createCloudflareTunnelReconciler } from "./cloudflare-tunnel-reconciler.mjs";
import {
  createServiceOperationAgent,
  findManagedService,
  isPublicHostname,
  validateServiceScale,
} from "./service-operations.mjs";
import {
  createN8nInstallHandler,
  createManualApplicationDeployHandler,
  createPostgresqlInstallHandler,
  createServiceRestartHandler,
  createServiceScaleHandler,
  createContainerOperationHandler,
  createProjectBuildHandler,
  createProjectDeployHandler,
  createProjectPushDeployHandler,
  createProjectUndeployHandler,
  createRegistryConfigureHandler,
  createCloudflareTunnelConfigureHandler,
  createSwarmNodeEnrollHandler,
  createTaskQueueWorker,
} from "./task-queue.mjs";
import { evaluateDeploymentAlerts } from "./deployment-alerts.mjs";
import {
  validateN8nInstanceConfiguration,
  validateSupabaseInstanceConfiguration,
} from "./application-config.mjs";
import { createMetricsSampler } from "./metrics-sampler.mjs";
import { collectWebServiceAlerts } from "./web-service-alerts.mjs";
import { checkProjectHealth } from "./project-health.mjs";
import {
  createGiteaClient,
  validateRepositoryInput,
  validateRepositoryReference,
} from "./gitea-client.mjs";
import { createGiteaWebhookProcessor, deriveGiteaWebhookSecret } from "./gitea-webhooks.mjs";
import { createGithubOAuth } from "./github-oauth.mjs";
import { createGithubWebhookProcessor } from "./github-webhooks.mjs";
import { validateProjectId, validateProjectInput } from "./project-manager.mjs";
import { ProjectArchiveValidationError, validateProjectArchive } from "./project-archive-validation.mjs";
import { detectProjectBuildProfile } from "./public/project-archive.mjs";
import {
  getContainerMetricsHistory,
  getContainerMetricAlerts,
  getRecentAuditEvents,
  getRecentTasks,
  getTaskById,
  getLatestTaskByType,
  getLatestProjectBuilds,
  getLatestProjectBuildOperations,
  getRecentProjectDeployments,
  getProjects,
  getProject,
  getProjectUploadSource,
  getLatestProjectUploadSource,
  recordProjectUploadSource,
  getGithubInstallations,
  saveGithubInstallation,
  deleteGithubInstallation,
  getProjectDomains,
  getProjectDomain,
  getDomainZones,
  getDomainZone,
  getDomainZoneByName,
  saveProjectDomain,
  saveDomainZone,
  deleteProjectDomain,
  deleteDomainZone,
  getIngressIp,
  setIngressIp,
  getCloudflareTunnelSettings,
  saveCloudflareTunnelSettings,
  createProject,
  updateProject,
  deleteProject,
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
  recordGiteaWebhookDelivery,
  recordGithubWebhookDelivery,
  createGiteaInstallTask,
  createN8nInstallTask,
  beginApplicationInstanceDeployment,
  updateApplicationInstanceDeployment,
  createPostgresqlInstallTask,
  getApplicationCatalog,
  getApplicationInstances,
  saveApplicationInstanceConfiguration,
  createManualApplication,
  updateManualApplicationDeployment,
  createManualApplicationDeployTask,
  createRegistryConfigureTask,
  createCloudflareTunnelConfigureTask,
  createProjectBuildTask,
  createProjectDeployTask,
  createProjectUndeployTask,
  createSwarmNodeEnrollTask,
  createServiceRestartTask,
  createServiceScaleTask,
  createContainerOperationTask,
  updateMetricAlertThresholds,
  updateBackupIntervalHours,
  updateMetricsSamplingIntervalMinutes,
} from "./db.mjs";
import {
  deleteProjectConfig,
  getProjectEnvironment,
  saveProjectEnvironment,
  getProjectDeploymentConfig,
  saveProjectDeploymentConfig,
  saveProjectDeploymentType,
  saveCloudflareToken,
  getCloudflareToken,
  hasCloudflareToken,
  deleteCloudflareToken,
} from "./project-deployment-config.mjs";
import {
  buildDomainHostname,
  createCloudflareClient,
  isIpv4Address,
  validateDomainConfiguration,
  validateDomainZoneConfiguration,
} from "./cloudflare-client.mjs";
import { mapSwarmNode, validateSwarmNodeEnrollment } from "./swarm-node-manager.mjs";
import { validateManualApplicationInput } from "./application-template.mjs";

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
function matchDockerLogsPath(pathname) {
  const match = pathname.match(/^\/api\/docker\/(containers|services)\/([a-z0-9]{12,64})\/logs$/i);
  if (!match) return null;
  const [, resource, id] = match;
  if (resource.toLowerCase() === "containers" && !/^[a-f0-9]{12,64}$/i.test(id)) return null;
  return { resource, id };
}

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
const serviceOperationsDirectory = process.env.SERVICE_OPERATIONS_DIRECTORY ?? "/var/lib/vps-manager/service-operations";
const cloudflareTunnelCredentialId = "00000000-0000-4000-8000-000000000001";
let cloudflareTunnelConfigurationPending = false;
const githubOAuth = createGithubOAuth({ directory: serviceOperationsDirectory });
const cloudflareClient = createCloudflareClient();
function getCloudflareTunnelOriginProtocol(tunnel) {
  if (tunnel?.originProtocol === "http" || tunnel?.originProtocol === "https") {
    return tunnel.originProtocol;
  }
  return testMode ? "http" : "https";
}

function mapProjectBuildOperation(task, agentStatus) {
  if (!task) return null;
  const matchingAgentStatus = agentStatus?.id === task.id
    && agentStatus.operation === "build-project"
    && agentStatus.projectId === task.projectId
    ? agentStatus
    : null;
  const buildkitRunning = matchingAgentStatus?.state === "running"
    && /BuildKit está construyendo/i.test(matchingAgentStatus.message ?? "");
  const waitingForAgent = task.status === "in_progress"
    && !matchingAgentStatus
    && ["queued", "running"].includes(agentStatus?.state);
  const phase = task.status === "pending"
    ? "queued"
    : task.status === "failed"
      ? "failed"
      : task.status === "completed"
        ? "completed"
        : buildkitRunning
          ? "buildkit"
          : waitingForAgent ? "waiting-agent" : "preparing-source";
  return {
    taskId: task.id,
    status: task.status,
    phase,
    message: matchingAgentStatus?.message
      ?? (task.status === "pending"
        ? "En cola; esperando a que el agente del VPS tome la tarea."
        : task.status === "failed"
          ? task.error ?? "La construcción falló sin proporcionar detalles."
          : task.status === "completed"
            ? task.result?.message ?? "La construcción terminó."
            : waitingForAgent
              ? "Esperando a que termine otra operación del agente VPS; BuildKit todavía no ha comenzado."
              : buildkitRunning
                ? "BuildKit está construyendo la imagen."
                : "Preparando el código fuente y el contexto antes de iniciar BuildKit."),
    error: task.error,
    logs: matchingAgentStatus?.logs ?? task.result?.logs ?? "",
    startedAt: task.startedAt ?? task.createdAt,
    diagnostic: /(?:lookup auth\.docker\.io|127\.0\.0\.53[\s\S]{0,160}address family not supported|socket: address family not supported by protocol)/i
      .test(matchingAgentStatus?.logs ?? "")
      ? "El VPS no pudo resolver auth.docker.io por DNS; no parece un error del Dockerfile. Comprueba en el VPS `getent ahostsv4 auth.docker.io`, `resolvectl query auth.docker.io` y `cat /etc/resolv.conf`. Corrige el DNS del host o del proveedor y vuelve a construir. No reemplaces /etc/docker/daemon.json sin conservar su configuración; reiniciar Docker puede interrumpir servicios."
      : null,
    updatedAt: task.updatedAt,
  };
}

async function updateCloudflareTunnelHosts(
  tunnel,
  hostnames,
  originProtocol = getCloudflareTunnelOriginProtocol(tunnel),
  managerHostname = tunnel.managerHostname ?? null,
) {
  const token = await getCloudflareToken(serviceOperationsDirectory, cloudflareTunnelCredentialId);
  return cloudflareClient.updateTunnelConfiguration(
    token,
    tunnel.accountId,
    tunnel.tunnelId,
    [...new Set(hostnames)].sort(),
    { originProtocol, managerHostname },
  );
}
const reconcileCloudflareTunnel = createCloudflareTunnelReconciler({
  getSettings: getCloudflareTunnelSettings,
  hasApiToken: () => hasCloudflareToken(serviceOperationsDirectory, cloudflareTunnelCredentialId),
  getApiToken: () => getCloudflareToken(serviceOperationsDirectory, cloudflareTunnelCredentialId),
  getDomains: getProjectDomains,
  getDomainZones,
  hasZoneToken: (credentialId) => hasCloudflareToken(serviceOperationsDirectory, credentialId),
  getZoneToken: (credentialId) => getCloudflareToken(serviceOperationsDirectory, credentialId),
  saveDomain: saveProjectDomain,
  saveSettings: saveCloudflareTunnelSettings,
  getServices: () => dockerGet("/services"),
  getServiceTasks: (serviceId) => dockerGet(
    `/tasks?filters=${encodeURIComponent(JSON.stringify({ service: [serviceId] }))}`,
  ),
  getLatestTask: () => getLatestTaskByType("cloudflare.tunnel.configure"),
  cloudflareClient,
  stageCredentials: (taskId, token) =>
    serviceOperationAgent.stageCloudflareTunnelCredentials(taskId, token),
  removeCredentials: (taskId) =>
    serviceOperationAgent.removeCloudflareTunnelCredentials(taskId),
  createConfigureTask: createCloudflareTunnelConfigureTask,
});
let cloudflareTunnelReconcileInProgress = false;
async function recoverCloudflareTunnel() {
  if (cloudflareTunnelReconcileInProgress || cloudflareTunnelConfigurationPending) return;
  cloudflareTunnelReconcileInProgress = true;
  cloudflareTunnelConfigurationPending = true;
  try {
    const result = await reconcileCloudflareTunnel();
    if (result.state === "configuration-queued") {
      console.log(`Cloudflare Tunnel recovery queued: ${result.taskId}.`);
    }
  } catch (error) {
    console.error("Could not recover Cloudflare Tunnel:", error);
  } finally {
    cloudflareTunnelReconcileInProgress = false;
    cloudflareTunnelConfigurationPending = false;
  }
}
const taskQueueWorker = createTaskQueueWorker({
  store: { claimNextTask, completeTask, failTask, renewTaskLease },
  handlers: {
    "service.restart": createServiceRestartHandler(serviceOperationAgent),
    "service.scale": createServiceScaleHandler(serviceOperationAgent),
    "container.operation": createContainerOperationHandler(serviceOperationAgent),
    "application.n8n.install": createN8nInstallHandler(serviceOperationAgent, {
      updateInstance: updateApplicationInstanceDeployment,
    }),
    "application.postgresql.install": createPostgresqlInstallHandler(serviceOperationAgent),
    "application.custom.deploy": createManualApplicationDeployHandler(serviceOperationAgent, {
      updateDeployment: updateManualApplicationDeployment,
    }),
    "registry.configure": createRegistryConfigureHandler(serviceOperationAgent),
    "cloudflare.tunnel.configure": createCloudflareTunnelConfigureHandler(serviceOperationAgent),
    "swarm.node.enroll": createSwarmNodeEnrollHandler(serviceOperationAgent),
    "project.build": createProjectBuildHandler({
      agent: serviceOperationAgent,
      getBuildSource: getProjectBuildSource,
    }),
    "project.deploy": createProjectDeployHandler(serviceOperationAgent),
    "project.push-deploy": createProjectPushDeployHandler({
      agent: serviceOperationAgent,
      getBuildSource: getProjectBuildSource,
    }),
    "project.undeploy": createProjectUndeployHandler(serviceOperationAgent),
  },
  onError: (...args) => console.error("Task queue worker error:", ...args),
});
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
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

function getDomainConnectionErrorStatus(error) {
  if (error instanceof RequestError) return error.statusCode;
  return {
    CLOUDFLARE_TOKEN_INVALID: 401,
    CLOUDFLARE_ZONE_NOT_FOUND: 400,
    CLOUDFLARE_UNAVAILABLE: 502,
    CLOUDFLARE_REQUEST_FAILED: 502,
    CLOUDFLARE_RECORD_EXISTS: 409,
    CLOUDFLARE_RECORD_NOT_FOUND: 409,
    "23505": 409,
  }[error?.code] ?? (error instanceof TypeError || error instanceof RangeError ? 400 : 503);
}

function getDomainConnectionErrorMessage(error) {
  if (error?.code === "23505") return "Ese dominio ya está conectado.";
  if (error instanceof RequestError || error instanceof TypeError || error instanceof RangeError
    || error?.code?.startsWith("CLOUDFLARE_")) {
    return error.message;
  }
  return "No se pudo conectar el dominio. Inténtalo de nuevo.";
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

const processGiteaWebhook = createGiteaWebhookProcessor({
  signingKey: sessionKey,
  recordDelivery: recordGiteaWebhookDelivery,
});
const processGithubWebhook = createGithubWebhookProcessor({
  getSecret: async () => {
    return githubOAuth.getWebhookSecret();
  },
  recordDelivery: recordGithubWebhookDelivery,
});

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

async function readJson(request, maximumBytes = 8192) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maximumBytes) throw new RequestError(413, `Request body exceeds ${maximumBytes} bytes.`);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "Invalid JSON request body.");
  }
}

async function readRawBody(request, maximumBytes = 1_048_576) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maximumBytes) {
      throw new RequestError(413, `El cuerpo supera el límite de ${maximumBytes} bytes.`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
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
  const [containers, services] = await Promise.all([
    dockerGet("/containers/json?all=1"),
    dockerGet("/services"),
  ]);
  const projectServiceDisplayNames = await getProjectServiceDisplayNames(services);
  return containers.map((container) => ({
    id: container.Id.slice(0, 12),
    name: (container.Names?.[0] ?? "").replace(/^\//, ""),
    displayName: projectServiceDisplayNames.get(container.Labels?.["com.docker.swarm.service.id"]) ?? null,
    image: container.Image,
    state: container.State,
    status: container.Status,
    serviceId: container.Labels?.["com.docker.swarm.service.id"] ?? null,
    ports: (container.Ports ?? []).map(({ PublicPort, PrivatePort, Type }) => ({
      public: PublicPort,
      private: PrivatePort,
      type: Type,
    })),
  }));
}

async function getProjectServiceDisplayNames(services) {
  const projectServices = services.filter((service) =>
    service.Spec?.Labels?.["vps-manager.managed"] === "true"
    && service.Spec?.Labels?.["vps-manager.component"] === "project");
  const displayNames = new Map(services.map((service) => [
    service.ID,
    service.Spec?.Name ?? "Servicio sin nombre",
  ]));
  if (projectServices.length === 0) return displayNames;

  const projects = await getProjects();
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  for (const service of projectServices) {
    const projectName = projectNames.get(service.Spec.Labels["vps-manager.project-id"]);
    if (projectName) displayNames.set(service.ID, `P • ${projectName}`);
  }
  return displayNames;
}

async function getContainerMetrics(containers) {
  const [inventory, services, hostInfo] = await Promise.all([
    containers ?? dockerGet("/containers/json?all=1"),
    dockerGet("/services"),
    dockerGet("/info"),
  ]);
  const serviceDisplayNames = await getProjectServiceDisplayNames(services);
  const runningContainers = inventory.filter((container) => container.State === "running");
  const metrics = await collectContainerMetrics(
    runningContainers.map((container) => {
      const serviceId = container.Labels?.["com.docker.swarm.service.id"];
      return {
        ...container,
        group: (serviceDisplayNames.get(serviceId)
          ?? container.Labels?.["com.docker.stack.namespace"]
          ?? container.Labels?.["com.docker.compose.project"]
          ?? (container.Names?.[0] ?? "").replace(/^\//, ""))
          || "Sin grupo",
      };
    }),
    (container) => dockerGet(`/containers/${container.Id}/stats?stream=false`),
  );
  return {
    ...metrics,
    host: {
      cpuCount: hostInfo.NCPU,
      memoryBytes: hostInfo.MemTotal,
    },
    runningContainerCount: runningContainers.length,
  };
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
  const projectServiceDisplayNames = await getProjectServiceDisplayNames(services);
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
      displayName: projectServiceDisplayNames.get(service.ID) ?? null,
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

async function getProjectDeploymentState(projects) {
  const projectIds = projects.map((project) => project.id);
  const [builds, buildOperations, agentStatus, deploymentHistory, deploymentConfigs, services, tasks, nodes, uploadedSources] = await Promise.all([
    getLatestProjectBuilds(projectIds),
    getLatestProjectBuildOperations(projectIds),
    serviceOperationAgent.getStatus(),
    getRecentProjectDeployments(projectIds),
    Promise.all(projects.map(async (project) => [
      project.id,
      await getProjectDeploymentConfig(serviceOperationsDirectory, project.id),
    ])),
    dockerGet("/services"),
    dockerGet("/tasks?desired-state=running"),
    dockerGet("/nodes"),
    Promise.all(projects.map(async (project) => [
      project.id,
      await getLatestProjectUploadSource(project.id),
    ])),
  ]);
  const readyActiveNodes = nodes.filter((node) =>
    node.Spec?.Availability === "active" && node.Status?.State === "ready").length;
  const runningByService = new Map();
  for (const task of tasks) {
    if (task.Status?.State === "running") {
      runningByService.set(task.ServiceID, (runningByService.get(task.ServiceID) ?? 0) + 1);
    }
  }
  const latestBuilds = new Map(builds.map((build) => [build.projectId, {
    taskId: build.id,
    commitSha: build.result.commitSha,
    image: build.result.image,
    deploymentType: build.result.deploymentType,
    buildStrategy: build.result.buildStrategy,
    buildContext: build.result.buildContext,
    dockerfilePath: build.result.dockerfilePath,
    buildCommand: build.result.buildCommand,
    buildOutputDirectory: build.result.buildOutputDirectory,
  }]));
  const latestBuildOperations = new Map(buildOperations.map((task) => [
    task.projectId,
    mapProjectBuildOperation(task, agentStatus),
  ]));
  const deploymentsByProject = new Map();
  const deploymentConfigHashes = new Map(deploymentConfigs.map(([projectId, config]) =>
    [projectId, config.configHash]));
  const deploymentEnvironmentHashes = new Map(deploymentConfigs.map(([projectId, config]) =>
    [projectId, config.environmentHash]));
  const deploymentDomainsHashes = new Map(deploymentConfigs.map(([projectId, config]) =>
    [projectId, config.domainsHash]));
  const uploadSources = new Map(uploadedSources);
  for (const deployment of deploymentHistory) {
    const projectId = deployment.projectId;
    const history = deploymentsByProject.get(projectId) ?? [];
    history.push({
      taskId: deployment.id,
      status: deployment.status,
      commitSha: deployment.result?.commitSha ?? deployment.commitSha ?? null,
      image: deployment.result?.image ?? null,
      error: deployment.error,
      completedAt: deployment.completedAt ?? deployment.updatedAt,
    });
    deploymentsByProject.set(projectId, history);
  }
  for (const history of deploymentsByProject.values()) {
    history.sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  }
  const deployments = new Map();
  for (const service of services) {
    const labels = service.Spec?.Labels;
    if (labels?.["vps-manager.managed"] !== "true" || labels["vps-manager.component"] !== "project") continue;
    const projectId = labels["vps-manager.project-id"];
    try {
      validateProjectId(projectId);
    } catch (error) {
      throw new Error("A managed project service has an invalid project identifier.", { cause: error });
    }
    if (deployments.has(projectId)) {
      throw new Error("Multiple managed Swarm services are assigned to the same project.");
    }
    deployments.set(projectId, {
      serviceId: service.ID,
      serviceName: service.Spec?.Name ?? "unknown",
      image: service.Spec?.TaskTemplate?.ContainerSpec?.Image ?? "unknown",
      commitSha: labels["vps-manager.project-commit"] ?? null,
      runningReplicas: runningByService.get(service.ID) ?? 0,
      desiredReplicas: service.Spec?.Mode?.Global ? readyActiveNodes : service.Spec?.Mode?.Replicated?.Replicas ?? 1,
      mode: service.Spec?.Mode?.Global ? "global" : "replicated",
      routesCurrent: labels["vps-manager.project-domains-hash"] === deploymentDomainsHashes.get(projectId),
      configurationCurrent: (
        labels["vps-manager.project-environment-hash"] === deploymentEnvironmentHashes.get(projectId)
        && labels["vps-manager.project-domains-hash"] === deploymentDomainsHashes.get(projectId)
      ) || labels["vps-manager.project-config-hash"] === deploymentConfigHashes.get(projectId),
    });
  }
  return projects.map((project) => ({
    ...project,
    latestBuild: latestBuilds.get(project.id) ?? null,
    latestBuildOperation: latestBuildOperations.get(project.id) ?? null,
    latestSource: uploadSources.get(project.id) ?? null,
    deployment: deployments.get(project.id) ?? null,
    deploymentHistory: deploymentsByProject.get(project.id) ?? [],
  }));
}

async function getGiteaApplicationState() {
  const services = await dockerGet("/services");
  const service = services.find((item) => item.Spec?.Name === "vps-manager-gitea");
  const installed = service?.Spec?.Labels?.["vps-manager.component"] === "gitea"
    && service.Spec.Labels["vps-manager.managed"] === "true";
  const nameConflict = Boolean(service && !installed);
  const testModeLocal = testMode;
  const domain = !testModeLocal && isPublicHostname(managerDomain) ? `git.${managerDomain}` : null;
  const localRouteRule = "Host(`localhost`)&&PathPrefix(`/gitea`)";
  const isLocalService = installed
    && service.Spec.Labels["traefik.http.routers.vps-manager-gitea-local.rule"] === localRouteRule;
  const localOnly = testModeLocal || isLocalService;
  const needsLocalUpgrade = testModeLocal && installed && !isLocalService;
  const needsDomainMigration = !testModeLocal && installed && isLocalService;
  const url = isLocalService || testModeLocal
    ? "http://localhost:3001/gitea/"
    : domain ? `https://${domain}/` : null;
  const serviceTasks = installed
    ? await dockerGet(`/tasks?filters=${encodeURIComponent(JSON.stringify({ service: [service.ID] }))}`)
    : [];
  const runningTasks = serviceTasks.filter((task) => task.DesiredState === "running" && task.Status?.State === "running").length;
  const replicas = service?.Spec?.Mode?.Replicated?.Replicas ?? 1;
  const latestTask = await getLatestTaskByType("application.gitea.install");
  const installing = latestTask?.status === "pending" || latestTask?.status === "in_progress";
  const apiTokenConfigured = installed && await serviceOperationAgent.hasGiteaApiToken();
  const agentStatus = await serviceOperationAgent.getStatus();
  const tokenOperation = agentStatus?.operation === "configure-gitea-token"
    ? { state: agentStatus.state, message: agentStatus.message }
    : null;
  const credentialsAvailable = latestTask?.status === "completed"
    && latestTask.result?.credentialsAvailable === true
    && await serviceOperationAgent.hasGiteaCredentials(latestTask.id);

  return {
    application: {
      id: "gitea",
      domain,
      url,
      localOnly,
      needsLocalUpgrade,
      needsDomainMigration,
      privateApiReady: installed && !needsLocalUpgrade,
      installDomain: testModeLocal ? "localhost" : domain,
      sshPort: 2222,
      serviceId: installed ? service.ID : null,
      serviceState: installed ? `${runningTasks}/${replicas} tareas activas` : null,
      replicas,
      available: Boolean(testModeLocal || domain)
        && (!installed || needsLocalUpgrade || needsDomainMigration)
        && !nameConflict && !installing,
      installed,
      installing,
      nameConflict,
      apiTokenConfigured,
      tokenOperation,
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

async function getN8nApplicationState() {
  const [services, domains, savedDomainZones, latestTask, instances] = await Promise.all([
    dockerGet("/services"),
    getProjectDomains(),
    getDomainZones(),
    getLatestTaskByType("application.n8n.install"),
    getApplicationInstances("n8n"),
  ]);
  const domainZones = await Promise.all(savedDomainZones.map(async (domainZone) => ({
    ...domainZone,
    tokenConfigured: await hasCloudflareToken(serviceOperationsDirectory, domainZone.credentialId),
  }))).then((zones) => zones.filter((domainZone) =>
    domainZone.connectionStatus === "connected" && domainZone.tokenConfigured));
  const service = services.find((item) => item.Spec?.Name === "vps-manager-n8n");
  const instance = instances[0] ?? null;
  const installed = service?.Spec?.Labels?.["vps-manager.component"] === "n8n"
    && service.Spec.Labels["vps-manager.managed"] === "true";
  const nameConflict = Boolean(service && !installed);
  const domain = domains.find((item) => item.applicationId === "n8n") ?? null;
  const installing = latestTask?.status === "pending" || latestTask?.status === "in_progress";
  return {
    application: {
      id: "n8n",
      domain: domain?.hostname ?? null,
      url: domain ? `https://${domain.hostname}/` : null,
      configuration: instance?.configuration ?? latestTask?.configuration ?? null,
      instance,
      domainConfigured: Boolean(domain),
      available: (Boolean(domain) || domainZones.length > 0) && !testMode && !installed && !nameConflict && !installing,
      domainZones: domainZones.map((domainZone) => ({
        id: domainZone.id,
        zone: domainZone.zone,
        proxied: domainZone.proxied,
      })),
      installed,
      installing,
      nameConflict,
      latestTask: latestTask ? {
        id: latestTask.id,
        status: latestTask.status,
        message: latestTask.status === "completed"
          ? latestTask.result?.message ?? "n8n está instalado."
          : latestTask.status === "failed"
            ? latestTask.error ?? "La instalación de n8n falló."
            : "Instalación de n8n en curso.",
      } : null,
    },
  };
}

async function getPostgresqlApplicationState() {
  const [services, latestTask] = await Promise.all([
    dockerGet("/services"),
    getLatestTaskByType("application.postgresql.install"),
  ]);
  const service = services.find((item) => item.Spec?.Name === "vps-manager-postgresql");
  const installed = service?.Spec?.Labels?.["vps-manager.component"] === "postgresql"
    && service.Spec.Labels["vps-manager.managed"] === "true";
  const nameConflict = Boolean(service && !installed);
  const installing = latestTask?.status === "pending" || latestTask?.status === "in_progress";
  const credentialsAvailable = Boolean(latestTask)
    && await serviceOperationAgent.hasPostgresqlCredentials(latestTask.id);
  return {
    application: {
      id: "postgresql",
      host: "vps-manager-postgresql",
      port: 5432,
      database: "vps_manager_app",
      username: "vps_manager_app",
      available: !testMode && !installed && !nameConflict && !installing,
      installed,
      installing,
      nameConflict,
      credentialsAvailable,
      latestTask: latestTask ? {
        id: latestTask.id,
        status: latestTask.status,
        message: latestTask.status === "completed"
          ? latestTask.result?.message ?? "PostgreSQL está instalado."
          : latestTask.status === "failed"
            ? latestTask.error ?? "La instalación de PostgreSQL falló."
            : "Instalación de PostgreSQL en curso.",
      } : null,
    },
  };
}

async function getGiteaApiContext() {
  const { application } = await getGiteaApplicationState();
  if (!application.installed || (!application.domain && !application.localOnly)) {
    throw new RequestError(409, "Gitea no está instalado con un dominio válido.");
  }
  if (application.localOnly && !application.privateApiReady) {
    throw new RequestError(409, "Actualiza el acceso local de Gitea antes de administrar proyectos.");
  }
  if (!application.apiTokenConfigured) {
    throw new RequestError(409, "Conecta primero un token válido de Gitea.");
  }
  const token = await readFile(
    process.env.GITEA_API_TOKEN_FILE ?? "/run/secrets/gitea_api_token",
    "utf8",
  );
  const client = application.localOnly
    ? createGiteaClient({ baseUrl: "http://vps-manager-gitea:3000" })
    : createGiteaClient({ domain: application.domain });
  return { application, client, token };
}

function projectUploadSourcePath(projectId, sourceDigest) {
  if (!/^[a-f0-9-]{36}$/i.test(projectId ?? "") || !/^[a-f0-9]{64}$/i.test(sourceDigest ?? "")) {
    throw new TypeError("El identificador de fuente cargada no es válido.");
  }
  return join(serviceOperationsDirectory, `project-source-${projectId}-${sourceDigest}.zip`);
}

async function getProjectBuildSource({ projectId, repository, branch, commitSha, sourceType, sourceDigest }) {
  const project = await getProject(projectId);
  if (!project) {
    const error = new Error("No se encontró el proyecto.");
    error.code = "PROJECT_NOT_FOUND";
    throw error;
  }
  let resolvedCommit;
  let archive;
  if (sourceType === "upload") {
    if (project.sourceType !== "upload" || !/^[a-f0-9]{64}$/i.test(sourceDigest ?? "")) {
      throw new RequestError(409, "La fuente cargada ya no coincide con la configuración del proyecto.");
    }
    const source = await getProjectUploadSource(projectId, sourceDigest.toLowerCase());
    if (!source) throw new RequestError(404, "No se encontró la versión cargada seleccionada.");
    try {
      archive = await readFile(projectUploadSourcePath(projectId, source.sourceDigest));
    } catch (error) {
      if (error?.code === "ENOENT") throw new Error("No se encontró el archivo fuente guardado del proyecto.", { cause: error });
      throw error;
    }
    resolvedCommit = source.sourceDigest;
  } else {
    if (project.sourceType !== "github" || project.repository !== repository
      || project.githubInstallationId === null) {
      throw new RequestError(409, "La fuente GitHub no coincide con la configuración del proyecto.");
    }
    if (commitSha) {
      resolvedCommit = commitSha.toLowerCase();
    } else {
      if (branch !== project.productionBranch) {
        throw new RequestError(409, "La rama solicitada no es la rama de producción del proyecto.");
      }
      const branches = await githubOAuth.listBranches(project.githubInstallationId, project.repository);
      if (!branches.some((item) => item.name === branch)) {
        const invalid = new Error("La rama seleccionada ya no existe en el repositorio.");
        invalid.code = "GITHUB_BRANCH_NOT_FOUND";
        throw invalid;
      }
      resolvedCommit = await githubOAuth.getCommit(project.githubInstallationId, project.repository, branch);
    }
    archive = await githubOAuth.downloadArchive(project.githubInstallationId, project.repository, resolvedCommit);
  }
  return {
    commitSha: resolvedCommit,
    archive,
    deploymentType: project.deploymentType,
    buildStrategy: project.buildStrategy,
    buildContext: project.buildContext,
    dockerfilePath: project.dockerfilePath,
    buildCommand: project.buildCommand,
    buildOutputDirectory: project.buildOutputDirectory,
  };
}

async function validateProjectSource(project) {
  if (project.sourceType === "upload") return;
  const installations = await getGithubInstallations();
  if (!installations.some((installation) => installation.installationId === project.githubInstallationId)) {
    throw new RequestError(409, "Conecta la cuenta OAuth de GitHub que contiene el repositorio.");
  }
  const repositories = await githubOAuth.listRepositories(project.githubInstallationId);
  if (!repositories.some((item) => item.fullName === project.repository)) {
    throw new RequestError(404, "No se encontró el repositorio en la instalación seleccionada.");
  }
  const branches = await githubOAuth.listBranches(project.githubInstallationId, project.repository);
  if (!branches.some((branch) => branch.name === project.productionBranch)) {
    throw new RequestError(409, "La rama de producción seleccionada ya no existe en el repositorio.");
  }
}

async function configureGithubProjectWebhook(project) {
  if (project.sourceType !== "github" || !project.autoDeploy) return;
  if (testMode || !managerDomain) {
    throw new RequestError(409, "El despliegue automático de GitHub requiere que el panel esté publicado con HTTPS.");
  }
  await githubOAuth.configurePushWebhook(
    project.githubInstallationId,
    project.repository,
    `https://${managerDomain}/api/webhooks/github`,
  );
}

async function queueInitialGithubDeployment(project, commitSha) {
  if (project.sourceType !== "github" || !project.autoDeploy || !commitSha) return false;
  return recordGithubWebhookDelivery({
    deliveryId: randomUUID(),
    event: "push",
    repository: project.repository,
    ref: `refs/heads/${project.productionBranch}`,
    commitSha,
  });
}

async function saveProjectDomainAssignments(projectId, { force = false } = {}) {
  const domains = await getProjectDomains();
  await saveProjectDeploymentConfig(serviceOperationsDirectory, projectId, domains
    .filter((domain) => domain.projectId === projectId)
    .map((domain) => ({ hostname: domain.hostname, port: domain.port })));
  return synchronizeProjectRoutes(projectId, { force });
}

async function synchronizeProjectRoutes(projectId, { force = false } = {}) {
  const services = await dockerGet("/services");
  const service = services.find((candidate) =>
    candidate.Spec?.Labels?.["vps-manager.managed"] === "true"
    && candidate.Spec?.Labels?.["vps-manager.component"] === "project"
    && candidate.Spec.Labels["vps-manager.project-id"] === projectId);
  if (!service) return { state: "not-deployed" };

  const config = await getProjectDeploymentConfig(serviceOperationsDirectory, projectId);
  if (!force && service.Spec.Labels["vps-manager.project-domains-hash"] === config.domainsHash) {
    return { state: "current" };
  }
  const operation = await serviceOperationAgent.getStatus();
  if (operation?.state === "queued" || operation?.state === "running") {
    return { state: "pending" };
  }
  try {
    return await serviceOperationAgent.requestProjectRouteUpdate(projectId, config.domainsHash);
  } catch (error) {
    if (error?.code === "OPERATION_IN_PROGRESS") return { state: "pending" };
    throw error;
  }
}

let projectRouteReconcileInProgress = false;
const forcedProjectRouteReconcile = new Set();
async function reconcileProjectRoutes() {
  if (projectRouteReconcileInProgress) return;
  projectRouteReconcileInProgress = true;
  try {
    const operation = await serviceOperationAgent.getStatus();
    if (operation?.state === "queued" || operation?.state === "running") return;
    const [projects, services] = await Promise.all([getProjects(), dockerGet("/services")]);
    for (const project of projects) {
      const service = services.find((candidate) =>
        candidate.Spec?.Labels?.["vps-manager.managed"] === "true"
        && candidate.Spec?.Labels?.["vps-manager.component"] === "project"
        && candidate.Spec.Labels["vps-manager.project-id"] === project.id);
      if (!service) {
        forcedProjectRouteReconcile.delete(project.id);
        continue;
      }
      const config = await getProjectDeploymentConfig(serviceOperationsDirectory, project.id);
      const force = forcedProjectRouteReconcile.has(project.id);
      if (!force && service.Spec.Labels["vps-manager.project-domains-hash"] === config.domainsHash) continue;
      const result = await synchronizeProjectRoutes(project.id, { force });
      if (result.state === "queued") {
        forcedProjectRouteReconcile.delete(project.id);
        console.log(`Project route update queued for ${project.name}.`);
        return;
      }
      if (result.state === "current") forcedProjectRouteReconcile.delete(project.id);
    }
  } catch (error) {
    console.error("Could not reconcile project domain routes:", error);
  } finally {
    projectRouteReconcileInProgress = false;
  }
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
    const decodedPath = decodeURIComponent(pathname);
    fileName = decodedPath === "/"
      ? "index.html"
      : /^\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedPath)
        ? "index.html"
        : decodedPath.slice(1);
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

  if (url.pathname === "/api/webhooks/github") {
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    try {
      const result = await processGithubWebhook({
        body: await readRawBody(request),
        deliveryId: request.headers["x-github-delivery"],
        event: request.headers["x-github-event"],
        signature: request.headers["x-hub-signature-256"],
      });
      respondJson(response, 202, {
        accepted: true,
        duplicate: result.duplicate,
        ignored: result.delivery.ignored === true,
      });
    } catch (error) {
      const status = error?.code === "INVALID_WEBHOOK_SIGNATURE" ? 401
        : error?.code === "INVALID_WEBHOOK" ? 400
          : error instanceof RequestError ? error.statusCode : 503;
      if (status === 503) console.error("Could not process GitHub webhook:", error);
      respondJson(response, status, {
        error: status === 503 ? "No se pudo procesar el webhook de GitHub." : error.message,
      });
    }
    return;
  }

  if (url.pathname === "/api/webhooks/gitea"
    || url.pathname.startsWith("/api/system/applications/gitea")
    || url.pathname.startsWith("/api/git/")) {
    respondJson(response, 410, { error: "Esta función fue retirada de VPS Manager." });
    return;
  }

  if (url.pathname === "/api/github/callback") {
    if (request.method !== "GET") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET" });
      return;
    }
    if (url.searchParams.has("error")) {
      respond(response, 303, "", { Location: "/?github=denied" });
      return;
    }
    try {
      const account = await githubOAuth.completeAuthorization({
        code: url.searchParams.get("code"),
        state: url.searchParams.get("state"),
      });
      await saveGithubInstallation(account);
      respond(response, 303, "", { Location: "/?github=connected" });
    } catch (error) {
      const status = error?.code === "GITHUB_OAUTH_STATE_INVALID" || error instanceof TypeError ? 400
        : error?.code === "GITHUB_OAUTH_SCOPE_MISSING" ? 403
          : error?.code?.startsWith("GITHUB_") ? 502 : 503;
      if (status >= 500) console.error("Could not complete GitHub OAuth authorization:", error);
      const message = status >= 500
        ? "No se pudo completar la conexión con GitHub. Revisa la configuración OAuth."
        : error.message;
      respond(response, 303, "", { Location: `/?github=error&message=${encodeURIComponent(message)}` });
    }
    return;
  }

  if (url.pathname.startsWith("/api/github/")) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (url.pathname === "/api/github/status" && request.method === "GET") {
      try {
        respondJson(response, 200, {
          ...(await githubOAuth.getStatus()),
          accounts: await getGithubInstallations(),
        });
      } catch (error) {
        console.error("Could not read GitHub OAuth status:", error);
        respondJson(response, 503, { error: "No se pudo consultar la conexión con GitHub." });
      }
      return;
    }
    if (url.pathname === "/api/github/config" && request.method === "POST") {
      if (!hasSameOrigin(request)) {
        respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
        return;
      }
      try {
        const body = await readJson(request, 8_000);
        await githubOAuth.saveConfiguration(body);
        respondJson(response, 200, {
          configured: true,
          message: "La configuración cifrada de GitHub OAuth se guardó.",
        });
      } catch (error) {
        if (error instanceof TypeError || error instanceof RangeError || error instanceof RequestError) {
          respondJson(response, error instanceof RequestError ? error.statusCode : 400, { error: error.message });
          return;
        }
        console.error("Could not save GitHub OAuth configuration:", error);
        respondJson(response, 503, { error: "No se pudo guardar la configuración de GitHub OAuth." });
      }
      return;
    }
    if (url.pathname === "/api/github/connect" && request.method === "POST") {
      if (!hasSameOrigin(request)) {
        respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
        return;
      }
      try {
        if (!testMode && !isPublicHostname(managerDomain)) {
          throw new RequestError(409, "Configura primero un dominio público HTTPS para registrar el callback de GitHub OAuth.");
        }
        const scheme = testMode ? "http" : "https";
        const redirectUri = `${scheme}://${managerDomain}/api/github/callback`;
        respondJson(response, 200, { url: await githubOAuth.createAuthorizationUrl(redirectUri) });
      } catch (error) {
        if (error?.code === "GITHUB_OAUTH_NOT_CONFIGURED" || error instanceof TypeError || error instanceof RequestError) {
          respondJson(response, error instanceof RequestError ? error.statusCode : 409, { error: error.message });
          return;
        }
        console.error("Could not start GitHub OAuth authorization:", error);
        respondJson(response, 503, { error: "No se pudo iniciar la conexión OAuth con GitHub." });
      }
      return;
    }
    if (url.pathname === "/api/github/repositories" && request.method === "GET") {
      const accountId = Number(url.searchParams.get("accountId"));
      try {
        if (!Number.isSafeInteger(accountId) || accountId < 1
          || !(await getGithubInstallations()).some((item) => item.installationId === accountId)) {
          throw new RequestError(404, "No se encontró la cuenta conectada de GitHub.");
        }
        respondJson(response, 200, { repositories: await githubOAuth.listRepositories(accountId) });
      } catch (error) {
        const status = error instanceof RequestError ? error.statusCode
          : error?.code === "GITHUB_TOO_MANY_REPOSITORIES" ? 422
            : error?.code?.startsWith("GITHUB_") ? 502 : 503;
        if (status >= 500) console.error("Could not list GitHub repositories:", error);
        respondJson(response, status, { error: status >= 500 ? "No se pudieron consultar los repositorios." : error.message });
      }
      return;
    }
    if (url.pathname === "/api/github/branches" && request.method === "GET") {
      const accountId = Number(url.searchParams.get("accountId"));
      const repository = url.searchParams.get("repository");
      try {
        if (!Number.isSafeInteger(accountId) || accountId < 1
          || !(await getGithubInstallations()).some((item) => item.installationId === accountId)) {
          throw new RequestError(404, "No se encontró la cuenta conectada de GitHub.");
        }
        respondJson(response, 200, { branches: await githubOAuth.listBranches(accountId, repository) });
      } catch (error) {
        const status = error instanceof RequestError ? error.statusCode
          : error?.code === "GITHUB_TOO_MANY_BRANCHES" ? 422
            : error?.code?.startsWith("GITHUB_") ? 502 : error instanceof TypeError ? 400 : 503;
        if (status >= 500) console.error("Could not list GitHub branches:", error);
        respondJson(response, status, { error: status >= 500 ? "No se pudieron consultar las ramas." : error.message });
      }
      return;
    }
    if (url.pathname === "/api/github/project-profile" && request.method === "GET") {
      const accountId = Number(url.searchParams.get("accountId"));
      const repository = url.searchParams.get("repository");
      const branch = url.searchParams.get("branch");
      try {
        if (!Number.isSafeInteger(accountId) || accountId < 1
          || !(await getGithubInstallations()).some((item) => item.installationId === accountId)) {
          throw new RequestError(404, "No se encontró la cuenta conectada de GitHub.");
        }
        const profile = await githubOAuth.inspectRepository(accountId, repository, branch);
        respondJson(response, 200, { profile });
      } catch (error) {
        const status = error instanceof RequestError ? error.statusCode
          : error?.code === "GITHUB_TREE_TOO_LARGE" ? 422
            : error?.code?.startsWith("GITHUB_") ? 502 : error instanceof TypeError ? 400 : 503;
        if (status >= 500) console.error("Could not detect GitHub project profile:", error);
        respondJson(response, status, {
          error: status >= 500 ? "No se pudo analizar el repositorio de GitHub." : error.message,
        });
      }
      return;
    }
  }

  if (url.pathname === "/api/webhooks/gitea") {
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    try {
      const result = await processGiteaWebhook({
        body: await readRawBody(request),
        deliveryId: request.headers["x-gitea-delivery"],
        event: request.headers["x-gitea-event"],
        signature: request.headers["x-gitea-signature"],
      });
      respondJson(response, 202, {
        accepted: true,
        duplicate: result.duplicate,
      });
    } catch (error) {
      if (error?.code === "INVALID_WEBHOOK") {
        respondJson(response, 400, { error: error.message });
        return;
      }
      if (error?.code === "INVALID_WEBHOOK_SIGNATURE") {
        respondJson(response, 401, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: "El webhook supera el límite de tamaño permitido." });
        return;
      }
      console.error("Could not record Gitea webhook delivery:", error);
      respondJson(response, 503, { error: "No se pudo registrar la entrega del webhook." });
    }
    return;
  }

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

  if (request.method === "GET" && url.pathname === "/api/domains") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "GET") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET" });
      return;
    }
    try {
      const [domains, domainZones, projects, ingressIp] = await Promise.all([
        getProjectDomains(),
        getDomainZones(),
        getProjects(),
        getIngressIp(),
      ]);
      let tunnel = null;
      let tunnelStatusError = null;
      try {
        const settings = await getCloudflareTunnelSettings();
        if (settings) {
          tunnel = {
            provider: "cloudflare",
            name: settings.name,
            tunnelId: settings.tunnelId,
            accountId: settings.accountId,
            originProtocol: getCloudflareTunnelOriginProtocol(settings),
            managerHostname: typeof settings.managerHostname === "string" ? settings.managerHostname : null,
            managerSubdomain: typeof settings.managerSubdomain === "string" ? settings.managerSubdomain : "",
            managerZoneId: typeof settings.managerZoneId === "string" ? settings.managerZoneId : "",
            lastError: typeof settings.lastError === "string" ? settings.lastError : null,
            configured: await hasCloudflareToken(serviceOperationsDirectory, cloudflareTunnelCredentialId),
            latestTask: await getLatestTaskByType("cloudflare.tunnel.configure"),
          };
        }
      } catch (error) {
        console.error("Could not retrieve Cloudflare Tunnel status:", error);
        tunnelStatusError = "No se pudo consultar el estado de Cloudflare Tunnel; la lista de dominios sigue disponible.";
      }
      const projectNames = new Map(projects.map((project) => [project.id, project.name]));
      respondJson(response, 200, {
        ingressIp,
        ingressMode: tunnel ? "cloudflare-tunnel" : "direct",
        defaultTunnelOriginProtocol: testMode ? "http" : "https",
        localTunnelOriginAvailable: testMode,
        tunnel,
        tunnelStatusError,
        zones: await Promise.all(domainZones.map(async (domainZone) => {
          const tokenConfigured = await hasCloudflareToken(
            serviceOperationsDirectory,
            domainZone.credentialId,
          );
          return {
            id: domainZone.id,
            provider: domainZone.provider,
            zone: domainZone.zone,
            proxied: domainZone.proxied,
            connectionStatus: domainZone.connectionStatus === "connecting"
              ? "connecting"
              : tokenConfigured ? domainZone.connectionStatus : "failed",
            connectionError: domainZone.connectionStatus === "connecting"
              ? null
              : tokenConfigured
                ? domainZone.connectionError
                : "Falta el token protegido de Cloudflare. Vuelve a conectarlo.",
            lastCheckedAt: domainZone.lastCheckedAt,
            tokenConfigured,
          };
        })),
        domains: await Promise.all(domains.map(async (domain) => ({
          id: domain.id,
          provider: domain.provider,
          zone: domain.zone,
          hostname: domain.hostname,
          projectId: domain.projectId,
          applicationId: domain.applicationId,
          projectName: domain.applicationId
            ? (domain.applicationId === "n8n" ? "n8n" : "Aplicación desconocida")
            : projectNames.get(domain.projectId) ?? "Proyecto eliminado",
          port: domain.port,
          proxied: domain.proxied,
          tokenConfigured: await hasCloudflareToken(
            serviceOperationsDirectory,
            domainZones.find((domainZone) => domainZone.zone.toLowerCase() === domain.zone.toLowerCase())?.credentialId
              ?? domain.id,
          ),
        }))),
        projects,
      });
    } catch (error) {
      console.error("Could not retrieve project domains:", error);
      respondJson(response, 503, {
        error: error instanceof Error
          ? `No se pudieron consultar los dominios: ${error.message}`
          : "No se pudieron consultar los dominios por un error desconocido.",
      });
    }
    return;
  }

  if (url.pathname === "/api/cloudflare/tunnel/origin") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "PUT") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "PUT" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    if (cloudflareTunnelConfigurationPending) {
      respondJson(response, 409, { error: "Ya hay una configuración de Cloudflare Tunnel en curso." });
      return;
    }
    cloudflareTunnelConfigurationPending = true;
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).length !== 1 || !["http", "https"].includes(body.originProtocol)) {
        respondJson(response, 400, { error: "Selecciona HTTP local o HTTPS como origen del túnel." });
        return;
      }
      if (body.originProtocol === "http" && !testMode) {
        respondJson(response, 400, { error: "HTTP local solo está disponible en modo de prueba; en producción Traefik redirige HTTP a HTTPS." });
        return;
      }
      const tunnel = await getCloudflareTunnelSettings();
      if (!tunnel) {
        respondJson(response, 409, { error: "Configura primero Cloudflare Tunnel antes de cambiar su origen." });
        return;
      }
      const currentOriginProtocol = getCloudflareTunnelOriginProtocol(tunnel);
      if (currentOriginProtocol === body.originProtocol) {
        respondJson(response, 200, { originProtocol: body.originProtocol, message: "El origen del túnel ya usa esta opción." });
        return;
      }
      const domains = await getProjectDomains();
      if (domains.length + (tunnel.managerHostname ? 1 : 0) > 100) {
        respondJson(response, 409, { error: "Cloudflare Tunnel admite como máximo 100 hostnames administrados por VPS Manager." });
        return;
      }
      await updateCloudflareTunnelHosts(tunnel, domains.map((domain) => domain.hostname), body.originProtocol);
      await saveCloudflareTunnelSettings({
        ...tunnel,
        originProtocol: body.originProtocol,
        lastError: null,
      });
      respondJson(response, 200, {
        originProtocol: body.originProtocol,
        message: body.originProtocol === "http"
          ? "Origen actualizado a HTTP interno. El tráfico entre Cloudflare Tunnel y Traefik viaja solo por la red privada de Swarm."
          : "Origen actualizado a HTTPS. Cloudflare Tunnel verificará el servicio HTTPS de Traefik.",
      });
    } catch (error) {
      console.error("Could not update Cloudflare Tunnel origin:", error);
      const status = error?.code === "CLOUDFLARE_TOKEN_INVALID" ? 401
        : error?.code === "CLOUDFLARE_UNAVAILABLE" || error?.code === "CLOUDFLARE_REQUEST_FAILED" ? 502
          : error?.code === "ENOENT" ? 409 : 503;
      respondJson(response, status, {
        error: error instanceof Error ? `No se pudo cambiar el origen del túnel: ${error.message}` : "No se pudo cambiar el origen del túnel.",
      });
    } finally {
      cloudflareTunnelConfigurationPending = false;
    }
    return;
  }

  if (url.pathname === "/api/cloudflare/tunnel") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    let taskId;
    let attemptedTunnel;
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).some((key) => ![
          "accountId", "name", "token", "originProtocol", "managerSubdomain", "managerZoneId",
        ].includes(key))
        || !["accountId", "name"].every((key) => Object.hasOwn(body, key))) {
        respondJson(response, 400, { error: "La solicitud debe incluir Account ID y nombre del túnel; el API Token es obligatorio al crear el túnel." });
        return;
      }
      if (body.originProtocol !== undefined && !["http", "https"].includes(body.originProtocol)) {
        respondJson(response, 400, { error: "El origen del túnel debe ser HTTP local o HTTPS." });
        return;
      }
      if ((body.managerSubdomain !== undefined
        && (typeof body.managerSubdomain !== "string" || body.managerSubdomain.length > 253))
        || (body.managerZoneId !== undefined && typeof body.managerZoneId !== "string")) {
        respondJson(response, 400, { error: "El subdominio o la zona seleccionada para el panel no son válidos." });
        return;
      }
      if (body.originProtocol === "http" && !testMode) {
        respondJson(response, 400, { error: "HTTP local solo está disponible en modo de prueba; en producción Traefik redirige HTTP a HTTPS." });
        return;
      }
      if (typeof body.accountId !== "string" || !/^[a-f0-9]{32}$/i.test(body.accountId)) {
        respondJson(response, 400, { error: "El Account ID debe tener exactamente 32 caracteres hexadecimales. Cópialo de la información de tu cuenta Cloudflare." });
        return;
      }
      if (typeof body.name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(body.name)) {
        respondJson(response, 400, { error: "El nombre del túnel debe empezar con una letra o número y contener solo letras, números, guiones o guiones bajos (máximo 63 caracteres)." });
        return;
      }
      if (body.token !== undefined && body.token !== ""
        && (typeof body.token !== "string" || body.token.length < 20 || body.token.length > 512
          || /[\u0000-\u001f\u007f]/.test(body.token))) {
        respondJson(response, 400, { error: "El API Token debe tener entre 20 y 512 caracteres. Pega el token de API completo, no el token del conector de `cloudflared`." });
        return;
      }
      if (cloudflareTunnelConfigurationPending) {
        respondJson(response, 409, { error: "Ya hay una configuración de Cloudflare Tunnel en curso." });
        return;
      }
      cloudflareTunnelConfigurationPending = true;
      const current = await getCloudflareTunnelSettings();
      if (current && current.accountId !== body.accountId.toLowerCase()) {
        respondJson(response, 409, { error: "Ya existe un túnel conectado a otra cuenta de Cloudflare. Primero retira la configuración actual." });
        return;
      }
      if (current && current.name !== body.name) {
        respondJson(response, 409, { error: "El nombre del túnel es inmutable en esta configuración." });
        return;
      }
      let apiToken = body.token || undefined;
      if (!apiToken) {
        if (!current) {
          respondJson(response, 400, { error: "Pega un API Token de Cloudflare para crear el túnel." });
          return;
        }
        if (!await hasCloudflareToken(serviceOperationsDirectory, cloudflareTunnelCredentialId)) {
          respondJson(response, 409, { error: "Pega un API Token de Cloudflare para reconectar el túnel; no hay uno guardado." });
          return;
        }
        apiToken = await getCloudflareToken(serviceOperationsDirectory, cloudflareTunnelCredentialId);
      }
      const originProtocol = body.originProtocol
        ?? getCloudflareTunnelOriginProtocol(current);
      const [domains, domainZones] = await Promise.all([getProjectDomains(), getDomainZones()]);
      const managerSubdomain = body.managerSubdomain === undefined
        ? current?.managerSubdomain ?? ""
        : body.managerSubdomain.trim().toLowerCase();
      const managerZoneId = managerSubdomain
        ? (body.managerZoneId === undefined ? current?.managerZoneId ?? "" : body.managerZoneId.toLowerCase())
        : "";
      let managerZone = null;
      let managerHostname = null;
      if (managerSubdomain) {
        if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(managerZoneId)) {
          respondJson(response, 400, { error: "Selecciona un dominio raíz conectado para el subdominio del panel." });
          return;
        }
        managerZone = domainZones.find((candidate) => candidate.id === managerZoneId) ?? null;
        if (!managerZone || managerZone.connectionStatus !== "connected") {
          respondJson(response, 409, { error: "El dominio raíz seleccionado para el panel no está conectado a Cloudflare." });
          return;
        }
        managerHostname = buildDomainHostname(managerZone.zone, managerSubdomain);
        if (managerHostname === managerZone.zone) {
          respondJson(response, 400, { error: "Para el panel escribe un subdominio, no el dominio raíz." });
          return;
        }
        if (domains.some((domain) => domain.hostname.toLowerCase() === managerHostname)) {
          respondJson(response, 409, { error: "Ese hostname ya está asignado a un proyecto o aplicación." });
          return;
        }
        const registry = await serviceOperationAgent.getRegistryConfiguration();
        const reservedHostnames = new Set([
          managerDomain.toLowerCase(),
          managerDomain ? `git.${managerDomain}`.toLowerCase() : "",
          registry?.domain?.toLowerCase() ?? "",
        ].filter(Boolean));
        if (reservedHostnames.has(managerHostname) && managerHostname !== managerDomain.toLowerCase()) {
          respondJson(response, 409, { error: "Ese hostname ya está reservado por VPS Manager, Gitea o el registro privado." });
          return;
        }
        if (!await hasCloudflareToken(serviceOperationsDirectory, managerZone.credentialId)) {
          respondJson(response, 409, { error: "Actualiza el token de Cloudflare del dominio raíz seleccionado para el panel." });
          return;
        }
        const zoneToken = await getCloudflareToken(serviceOperationsDirectory, managerZone.credentialId);
        const verifiedZone = await cloudflareClient.verifyZone(zoneToken, managerZone.zone);
        if (verifiedZone.id !== managerZone.zoneId) {
          respondJson(response, 409, { error: "La zona de Cloudflare cambió. Actualiza la conexión en Dominios." });
          return;
        }
      }
      if (domains.length + (managerHostname ? 1 : 0) > 100) {
        respondJson(response, 409, { error: "Cloudflare Tunnel admite como máximo 100 hostnames administrados por VPS Manager." });
        return;
      }
      const tunnel = current
        ? {
          id: current.tunnelId,
          name: current.name,
          token: await cloudflareClient.getTunnelToken(apiToken, current.accountId, current.tunnelId),
        }
        : await cloudflareClient.createTunnel(
          apiToken,
          body.accountId.toLowerCase(),
          body.name,
          randomBytes(32).toString("base64"),
        );
      attemptedTunnel = {
        provider: "cloudflare",
        accountId: body.accountId.toLowerCase(),
        tunnelId: tunnel.id,
        name: body.name,
        originProtocol,
        ...(current?.managerHostname ? {
          managerHostname: current.managerHostname,
          managerSubdomain: current.managerSubdomain ?? "",
          managerZoneId: current.managerZoneId ?? "",
          managerDnsRecordId: current.managerDnsRecordId ?? null,
        } : {}),
      };
      await saveCloudflareToken(serviceOperationsDirectory, cloudflareTunnelCredentialId, apiToken);
      await saveCloudflareTunnelSettings({
        ...attemptedTunnel,
        lastError: null,
      });
      for (const domain of domains) {
        const domainZone = domainZones.find((candidate) =>
          candidate.zone.toLowerCase() === domain.zone.toLowerCase());
        if (!domainZone || domainZone.connectionStatus !== "connected") {
          throw new Error(`La zona Cloudflare de ${domain.hostname} no está conectada.`);
        }
        const zoneToken = await getCloudflareToken(serviceOperationsDirectory, domainZone.credentialId);
        const dnsRecord = await cloudflareClient.upsertTunnelCname(zoneToken, {
          zoneId: domain.zoneId,
          hostname: domain.hostname,
          tunnelId: tunnel.id,
          existingRecordId: domain.dnsRecordId,
        });
        await saveProjectDomain({ ...domain, proxied: true, dnsRecordId: dnsRecord.id });
      }
      let managerDnsRecord = null;
      let managerZoneToken = null;
      if (managerHostname && managerZone) {
        managerZoneToken = await getCloudflareToken(serviceOperationsDirectory, managerZone.credentialId);
        managerDnsRecord = await cloudflareClient.upsertTunnelCname(managerZoneToken, {
          zoneId: managerZone.zoneId,
          hostname: managerHostname,
          tunnelId: tunnel.id,
          existingRecordId: current?.managerHostname === managerHostname
            && current?.managerZoneId === managerZone.id
            ? current.managerDnsRecordId
            : undefined,
        });
      }
      try {
        await cloudflareClient.updateTunnelConfiguration(
          apiToken,
          body.accountId.toLowerCase(),
          tunnel.id,
          domains.map((domain) => domain.hostname),
          { originProtocol, managerHostname },
        );
      } catch (error) {
        if (managerDnsRecord && (current?.managerHostname !== managerHostname
          || current?.managerZoneId !== managerZone?.id)) {
          try {
            await cloudflareClient.deleteTunnelCname(managerZoneToken, {
              zoneId: managerZone.zoneId,
              hostname: managerHostname,
              tunnelId: tunnel.id,
              recordId: managerDnsRecord.id,
            });
          } catch (cleanupError) {
            console.error("Could not remove the panel DNS record after a tunnel update failure:", cleanupError);
            throw new AggregateError([error, cleanupError], "Cloudflare Tunnel failed and the new panel DNS record could not be removed.");
          }
        }
        throw error;
      }
      attemptedTunnel = {
        ...attemptedTunnel,
        managerHostname,
        managerSubdomain,
        managerZoneId: managerZone?.id ?? null,
        managerDnsRecordId: managerDnsRecord?.id ?? null,
        lastError: null,
      };
      await saveCloudflareTunnelSettings(attemptedTunnel);
      if (current?.managerHostname
        && (current.managerHostname !== managerHostname || current.managerZoneId !== managerZone?.id)) {
        const previousZone = await getDomainZone(current.managerZoneId);
        if (!previousZone || !current.managerDnsRecordId
          || !await hasCloudflareToken(serviceOperationsDirectory, previousZone.credentialId)) {
          throw new Error("No se pudo verificar el registro DNS anterior del panel; reconecta esa zona antes de cambiarlo.");
        }
        const previousZoneToken = await getCloudflareToken(serviceOperationsDirectory, previousZone.credentialId);
        await cloudflareClient.deleteTunnelCname(previousZoneToken, {
          zoneId: previousZone.zoneId,
          hostname: current.managerHostname,
          tunnelId: tunnel.id,
          recordId: current.managerDnsRecordId,
        });
      }

      taskId = randomUUID();
      await serviceOperationAgent.stageCloudflareTunnelCredentials(taskId, tunnel.token);
      try {
        await createCloudflareTunnelConfigureTask({
          id: taskId,
          tunnelId: tunnel.id,
          tunnelName: body.name,
        });
      } catch (error) {
        await serviceOperationAgent.removeCloudflareTunnelCredentials(taskId);
        throw error;
      }
      respondJson(response, 202, {
        tunnel: {
          provider: "cloudflare",
          accountId: body.accountId.toLowerCase(),
          tunnelId: tunnel.id,
          name: body.name,
          managerHostname,
        },
        task: {
          id: taskId,
          type: "cloudflare.tunnel.configure",
          status: "pending",
          message: managerHostname
            ? `Túnel y hostname del panel (${managerHostname}) configurados; esperando que el agente active el conector en Swarm.`
            : "Túnel y hostnames configurados; esperando que el agente active el conector en Swarm.",
        },
      });
    } catch (error) {
      if (attemptedTunnel) {
        try {
          const message = error instanceof Error ? error.message.slice(0, 1000) : "Error desconocido al activar el túnel.";
          await saveCloudflareTunnelSettings({ ...attemptedTunnel, lastError: message });
        } catch (saveError) {
          console.error("Could not persist Cloudflare Tunnel setup failure:", saveError);
        }
      }
      if (error?.code === "CLOUDFLARE_TOKEN_INVALID") {
        respondJson(response, 401, { error: error.message });
        return;
      }

      if (error instanceof TypeError) {
        respondJson(response, 400, { error: error.message });
        return;
      }
      if (error?.code === "CLOUDFLARE_RECORD_EXISTS") {
        respondJson(response, 409, { error: error.message });
        return;
      }
      if (error?.code === "CLOUDFLARE_UNAVAILABLE" || error?.code === "CLOUDFLARE_REQUEST_FAILED") {
        respondJson(response, 502, { error: error.message });
        return;
      }
      if (error?.code === "ENOENT") {
        respondJson(response, 409, { error: "Falta el token de Cloudflare de una zona conectada. Reconecta esa zona y vuelve a intentarlo." });
        return;
      }
      if (error?.code === "OPERATION_IN_PROGRESS" || error?.code === "CLOUDFLARE_TUNNEL_CONFIGURATION_IN_PROGRESS") {
        respondJson(response, 409, { error: error.message });
        return;
      }
      console.error("Could not configure Cloudflare Tunnel:", error);
      respondJson(response, 502, {
        error: error instanceof Error
          ? `No se pudo configurar Cloudflare Tunnel: ${error.message}`
          : "No se pudo configurar Cloudflare Tunnel por un error desconocido. Revisa los logs del servidor.",
      });
    } finally {
      cloudflareTunnelConfigurationPending = false;
    }
    return;
  }

  const domainZoneMatch = url.pathname.match(/^\/api\/domain-zones(?:\/([a-f0-9-]+)(\/verify)?)?$/i);
  if (domainZoneMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    const zoneId = domainZoneMatch[1]?.toLowerCase();
    const isVerification = domainZoneMatch[2] === "/verify";
    const isUpdateOrDelete = Boolean(zoneId) && !isVerification;
    const allowedMethods = isVerification
      ? ["POST"]
      : zoneId ? ["PUT", "DELETE"] : ["POST"];
    if (!allowedMethods.includes(request.method)) {
      respondJson(response, 405, { error: "Método no permitido." }, {
        Allow: allowedMethods.join(", "),
      });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    if (zoneId && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(zoneId)) {
      respondJson(response, 400, { error: "El identificador del dominio no es válido." });
      return;
    }
    if (isVerification) {
      try {
        const existing = await getDomainZone(zoneId);
        if (!existing) {
          respondJson(response, 404, { error: "No se encontró el dominio conectado." });
          return;
        }
        await saveDomainZone({
          ...existing,
          connectionStatus: "connecting",
          connectionError: null,
        });
        const token = await getCloudflareToken(serviceOperationsDirectory, existing.credentialId);
        const verifiedZone = await cloudflareClient.verifyZone(token, existing.zone);
        const tunnelSettings = await getCloudflareTunnelSettings();
        if (existing.zoneId && existing.zoneId !== verifiedZone.id
          && ((await getProjectDomains()).some((domain) =>
            domain.zone.toLowerCase() === existing.zone.toLowerCase())
            || tunnelSettings?.managerZoneId === existing.id)) {
          throw new RequestError(
            409,
            "La zona de Cloudflare cambió mientras tiene hostnames asignados. Quita las asignaciones de proyectos y del panel antes de actualizar la conexión.",
          );
        }
        const saved = await saveDomainZone({
          ...existing,
          zone: verifiedZone.name,
          zoneId: verifiedZone.id,
          connectionStatus: "connected",
          connectionError: null,
        });
        respondJson(response, 200, {
          zone: {
            id: saved.id,
            zone: saved.zone,
            connectionStatus: saved.connectionStatus,
            lastCheckedAt: saved.lastCheckedAt,
          },
          message: `La conexión de ${saved.zone} está activa en Cloudflare.`,
        });
      } catch (error) {
        const connectionError = getDomainConnectionErrorMessage(error);
        try {
          const existing = await getDomainZone(zoneId);
          if (existing) {
            await saveDomainZone({
              ...existing,
              connectionStatus: "failed",
              connectionError,
            });
          }
        } catch (saveError) {
          console.error("Could not save domain zone verification failure:", saveError);
        }
        if (getDomainConnectionErrorStatus(error) >= 500) {
          console.error("Could not verify connected domain zone:", error);
        }
        respondJson(response, getDomainConnectionErrorStatus(error), { error: connectionError });
      }
      return;
    }
    if (request.method === "DELETE") {
      try {
        const existing = await getDomainZone(zoneId);
        if (!existing) {
          respondJson(response, 404, { error: "No se encontró el dominio conectado." });
          return;
        }
        const tunnelSettings = await getCloudflareTunnelSettings();
        if (tunnelSettings?.managerZoneId === existing.id) {
          respondJson(response, 409, {
            error: "Quita primero el hostname del panel desde la configuración de Cloudflare Tunnel antes de desconectar esta zona.",
          });
          return;
        }
        if ((await getProjectDomains()).some((domain) =>
          domain.zone.toLowerCase() === existing.zone.toLowerCase())) {
          respondJson(response, 409, {
            error: "Quita primero las asignaciones de aplicaciones y proyectos antes de desconectar esta zona.",
          });
          return;
        }
        const removed = await deleteDomainZone(zoneId);
        if (removed) await deleteCloudflareToken(serviceOperationsDirectory, removed.credentialId);
        respondJson(response, 200, {
          deleted: true,
          message: `Se desconectó ${existing.zone}. No se eliminaron sus registros DNS de Cloudflare.`,
        });
      } catch (error) {
        if (error?.code === "23503") {
          respondJson(response, 409, {
            error: "Quita primero las asignaciones de aplicaciones y proyectos antes de desconectar esta zona.",
          });
          return;
        }
        console.error("Could not remove connected domain zone:", error);
        respondJson(response, 503, { error: "No se pudo desconectar el dominio." });
      }
      return;
    }
    let connectionAttempt;
    try {
      const body = await readJson(request);
      const input = validateDomainZoneConfiguration(body);
      const existing = isUpdateOrDelete ? await getDomainZone(zoneId) : null;
      if (isUpdateOrDelete && !existing) {
        respondJson(response, 404, { error: "No se encontró el dominio conectado." });
        return;
      }
      if (existing && existing.zone.toLowerCase() !== input.zone) {
        respondJson(response, 409, { error: "Para conectar otra zona, crea una conexión nueva." });
        return;
      }
      if (!existing && await getDomainZoneByName(input.zone)) {
        respondJson(response, 409, { error: "Ese dominio ya está registrado. Usa Reconectar en su fila." });
        return;
      }
      if (!existing && input.token === undefined) {
        respondJson(response, 400, { error: "Proporciona un token de Cloudflare para conectar el dominio." });
        return;
      }
      const savedId = existing?.id ?? randomUUID();
      const credentialId = existing?.credentialId ?? savedId;
      connectionAttempt = await saveDomainZone({
        id: savedId,
        provider: "cloudflare",
        zone: existing?.zone ?? input.zone,
        zoneId: existing?.zoneId ?? null,
        credentialId,
        proxied: input.proxied,
        connectionStatus: "connecting",
        connectionError: null,
      });
      if (input.token !== undefined) {
        await saveCloudflareToken(serviceOperationsDirectory, credentialId, input.token);
      }
      let token = input.token;
      if (token === undefined) {
        if (!await hasCloudflareToken(serviceOperationsDirectory, existing.credentialId)) {
          throw new RequestError(409, "Vuelve a proporcionar un token de Cloudflare para esta zona.");
        }
        token = await getCloudflareToken(serviceOperationsDirectory, existing.credentialId);
      }
      const verifiedZone = await cloudflareClient.verifyZone(token, input.zone);
      if (existing && existing.zoneId !== verifiedZone.id
        && (await getProjectDomains()).some((domain) => domain.zone.toLowerCase() === existing.zone.toLowerCase())) {
        throw new RequestError(
          409,
          "La zona de Cloudflare cambió mientras tiene hostnames asignados. Quita las asignaciones antes de actualizar la conexión.",
        );
      }
      const saved = await saveDomainZone({
        id: savedId,
        provider: "cloudflare",
        zone: verifiedZone.name,
        zoneId: verifiedZone.id,
        credentialId,
        proxied: input.proxied,
        connectionStatus: "connected",
        connectionError: null,
      });
      respondJson(response, existing ? 200 : 201, {
        zone: {
          id: saved.id,
          provider: saved.provider,
          zone: saved.zone,
          proxied: saved.proxied,
          tokenConfigured: true,
        },
        message: existing
          ? `Se verificó y actualizó la conexión de ${saved.zone}.`
          : `Se conectó ${saved.zone} con Cloudflare. La zona está activa y el token fue verificado.`,
      });
    } catch (error) {
      const connectionError = getDomainConnectionErrorMessage(error);
      if (connectionAttempt) {
        try {
          await saveDomainZone({
            ...connectionAttempt,
            connectionStatus: "failed",
            connectionError,
          });
        } catch (saveError) {
          console.error("Could not save domain zone connection failure:", saveError);
        }
      }
      if (getDomainConnectionErrorStatus(error) >= 500) {
        console.error("Could not connect domain zone:", error);
      }
      respondJson(response, getDomainConnectionErrorStatus(error), { error: connectionError });
    }
    return;
  }

  if (url.pathname === "/api/domains/ingress-ip") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "PUT") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "PUT" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).length !== 1 || !isIpv4Address(body.ipv4)) {
        respondJson(response, 400, { error: "Proporciona una dirección IPv4 pública válida para la entrada de Traefik." });
        return;
      }
      if (await getCloudflareTunnelSettings()) {
        respondJson(response, 409, { error: "La IPv4 directa no se usa mientras Cloudflare Tunnel está configurado." });
        return;
      }
      const ingressIp = await setIngressIp(body.ipv4);
      const [domains, domainZones] = await Promise.all([getProjectDomains(), getDomainZones()]);
      const failures = [];
      for (const domain of domains) {
        try {
          const domainZone = domainZones.find((candidate) =>
            candidate.zone.toLowerCase() === domain.zone.toLowerCase());
          if (!domainZone || domainZone.connectionStatus !== "connected") {
            throw new Error("La zona ya no está conectada correctamente.");
          }
          const token = await getCloudflareToken(serviceOperationsDirectory, domainZone.credentialId);
          await cloudflareClient.upsertARecord(token, {
            zoneId: domain.zoneId,
            hostname: domain.hostname,
            address: ingressIp,
            proxied: domain.proxied,
            existingRecordId: domain.dnsRecordId,
          });
        } catch (error) {
          failures.push({ hostname: domain.hostname, error: error.message });
        }
      }
      respondJson(response, failures.length ? 207 : 200, {
        ingressIp,
        synchronized: domains.length - failures.length,
        failures,
        message: failures.length
          ? "La IPv4 quedó guardada, pero algunos registros no se pudieron actualizar."
          : "La IPv4 quedó guardada y los registros DNS de Cloudflare están sincronizados.",
      });
    } catch (error) {
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not update the ingress IP:", error);
      respondJson(response, 503, { error: "No se pudo guardar la IPv4 de entrada." });
    }
    return;
  }

  const projectDomainMatch = url.pathname.match(/^\/api\/domains\/([a-f0-9-]+)$/i);
  if ((url.pathname === "/api/domains" && request.method === "POST") || projectDomainMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    const isUpdate = Boolean(projectDomainMatch);
    const allowedMethod = isUpdate ? "PUT" : "POST";
    if (request.method !== allowedMethod && !(isUpdate && request.method === "DELETE")) {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: isUpdate ? "PUT, DELETE" : "POST, GET" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    const domainId = projectDomainMatch?.[1]?.toLowerCase();
    if (isUpdate && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(domainId)) {
      respondJson(response, 400, { error: "El identificador del dominio no es válido." });
      return;
    }
    if (isUpdate && request.method === "DELETE") {
      try {
        const existing = await getProjectDomain(domainId);
        if (!existing) {
          respondJson(response, 404, { error: "No se encontró el dominio." });
          return;
        }
        if (existing.applicationId === "n8n") {
          const n8n = await getN8nApplicationState();
          if (n8n.application.installed || n8n.application.installing) {
            respondJson(response, 409, { error: "No se puede quitar el dominio de n8n mientras su servicio está instalado o en instalación." });
            return;
          }
        }
        const tunnel = await getCloudflareTunnelSettings();
        if (tunnel) {
          await updateCloudflareTunnelHosts(
            tunnel,
            (await getProjectDomains())
              .filter((domain) => domain.id !== domainId)
              .map((domain) => domain.hostname),
          );
        }
        const domainZone = await getDomainZoneByName(existing.zone);
        await deleteProjectDomain(domainId);
        if (!domainZone || domainZone.credentialId !== domainId) {
          await deleteCloudflareToken(serviceOperationsDirectory, domainId);
        }
        const routeUpdate = existing.projectId
          ? await saveProjectDomainAssignments(existing.projectId)
          : null;
        respondJson(response, 200, {
          deleted: true,
          message: tunnel
            ? "Se quitó la configuración del dominio y su hostname dejó de estar en el túnel. El registro DNS de Cloudflare se conserva."
            : existing.applicationId === "n8n"
            ? "Se quitó la configuración de n8n. El registro A de Cloudflare se conserva."
            : `Se quitó la configuración. El registro A de Cloudflare se conserva.${routeUpdate?.state === "not-deployed" ? " La ruta no está activa porque el proyecto aún no está desplegado." : " La ruta del proyecto se actualizará automáticamente."}`,
        });
      } catch (error) {
        console.error("Could not remove project domain:", error);
        respondJson(response, 503, { error: "No se pudo quitar la configuración del dominio." });
      }
      return;
    }
    try {
      const body = await readJson(request);
      const input = validateDomainConfiguration(body);
      const domainZone = await getDomainZoneByName(input.zone);
      if (!domainZone || domainZone.connectionStatus !== "connected") {
        respondJson(response, 409, { error: "Conecta primero el dominio raíz en la pestaña Dominios." });
        return;
      }
      const tunnel = await getCloudflareTunnelSettings();
      const ingressIp = tunnel ? null : await getIngressIp();
      if (!tunnel && !ingressIp) {
        respondJson(response, 409, { error: "Configura primero la IPv4 pública del VPS manager." });
        return;
      }
      const project = input.projectId ? await getProject(input.projectId) : null;
      if (input.projectId && !project) {
        respondJson(response, 404, { error: "No se encontró el proyecto seleccionado." });
        return;
      }
      const existing = isUpdate ? await getProjectDomain(domainId) : null;
      const n8n = input.applicationId === "n8n" || existing?.applicationId === "n8n"
        ? await getN8nApplicationState()
        : null;
      if ((input.applicationId === "n8n" || existing?.applicationId === "n8n")
        && (n8n?.application.installed || n8n?.application.installing)) {
        respondJson(response, 409, { error: "No se puede cambiar el dominio de n8n mientras su servicio está instalado o en instalación." });
        return;
      }
      const registryConfiguration = await serviceOperationAgent.getRegistryConfiguration();
      const reservedHostnames = new Set([
        managerDomain.toLowerCase(),
        managerDomain ? `git.${managerDomain}`.toLowerCase() : "",
        registryConfiguration?.domain?.toLowerCase() ?? "",
        tunnel?.managerHostname?.toLowerCase() ?? "",
      ].filter(Boolean));
      if (reservedHostnames.has(input.hostname)) {
        respondJson(response, 409, { error: "Ese hostname ya está reservado por VPS Manager, Gitea o el registro privado." });
        return;
      }
      if (isUpdate && !existing) {
        respondJson(response, 404, { error: "No se encontró el dominio." });
        return;
      }
      if (existing && (existing.zone !== input.zone || existing.hostname !== input.hostname)) {
        respondJson(response, 409, {
          error: "Para cambiar el hostname o la zona, quita esta configuración y crea otra. El registro A anterior se conservará en Cloudflare.",
        });
        return;
      }
      const currentDomains = await getProjectDomains();
      if (input.applicationId
        && currentDomains.some((domain) => domain.applicationId === input.applicationId && domain.id !== existing?.id)) {
        respondJson(response, 409, { error: "n8n admite un solo dominio conectado desde el panel central." });
        return;
      }
      if (input.projectId) {
        const projectDomainCount = currentDomains.filter((domain) =>
          domain.projectId === input.projectId && domain.id !== existing?.id).length;
        if (projectDomainCount >= 20) {
          respondJson(response, 409, { error: "Un proyecto admite como máximo 20 dominios." });
          return;
        }
      }
      let token = input.token;
      if (token === undefined) {
        if (!await hasCloudflareToken(serviceOperationsDirectory, domainZone.credentialId)) {
          respondJson(response, 409, { error: "Actualiza el token de Cloudflare de la zona conectada." });
          return;
        }
        token = await getCloudflareToken(serviceOperationsDirectory, domainZone.credentialId);
      }
      const zone = await cloudflareClient.verifyZone(token, input.zone);
      if (zone.id !== domainZone.zoneId) {
        respondJson(response, 409, { error: "La zona de Cloudflare cambió. Actualiza la conexión en Dominios." });
        return;
      }
      const existingRecordId = existing?.zoneId === zone.id && existing.hostname === input.hostname
        ? existing.dnsRecordId
        : undefined;
      const dnsRecord = tunnel
        ? await cloudflareClient.upsertTunnelCname(token, {
          zoneId: zone.id,
          hostname: input.hostname,
          tunnelId: tunnel.tunnelId,
          existingRecordId,
        })
        : await cloudflareClient.upsertARecord(token, {
          zoneId: zone.id,
          hostname: input.hostname,
          address: ingressIp,
          proxied: input.proxied,
          existingRecordId,
        });
      if (tunnel) {
        await updateCloudflareTunnelHosts(tunnel, [
          ...currentDomains.filter((domain) => domain.id !== existing?.id).map((domain) => domain.hostname),
          input.hostname,
        ]);
      }
      const id = domainId ?? randomUUID();
      const saved = await saveProjectDomain({
        id,
        provider: "cloudflare",
        zone: zone.name,
        domainZoneId: domainZone.id,
        zoneId: zone.id,
        hostname: input.hostname,
        projectId: input.projectId,
        applicationId: input.applicationId,
        port: input.port,
        proxied: tunnel ? true : input.proxied,
        dnsRecordId: dnsRecord.id,
      });
      if (input.token !== undefined) {
        await saveCloudflareToken(serviceOperationsDirectory, domainZone.credentialId, input.token);
      }
      const routeUpdate = input.projectId
        ? await saveProjectDomainAssignments(input.projectId)
        : null;
      if (existing?.projectId && existing.projectId !== input.projectId) {
        await saveProjectDomainAssignments(existing.projectId);
      }
      const targetName = project?.name ?? "n8n";
      respondJson(response, isUpdate ? 200 : 201, {
        domain: {
          id: saved.id,
          provider: saved.provider,
          zone: saved.zone,
          hostname: saved.hostname,
          projectId: saved.projectId,
          applicationId: saved.applicationId,
          projectName: targetName,
          port: saved.port,
          proxied: saved.proxied,
          tokenConfigured: true,
        },
        message: saved.applicationId === "n8n"
          ? `Se conectó ${saved.hostname} con Cloudflare${tunnel ? " Tunnel" : ""} para n8n. Instala n8n para activar el enrutamiento HTTPS.`
          : `Se conectó ${saved.hostname} con Cloudflare${tunnel ? " Tunnel" : ""} para ${project.name}. ${routeUpdate?.state === "not-deployed" ? "La ruta se activará automáticamente cuando despliegues el proyecto." : "La ruta se está activando automáticamente sin reconstruir el proyecto."}`,
      });
    } catch (error) {
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      const status = {
        CLOUDFLARE_TOKEN_INVALID: 401,
        CLOUDFLARE_ZONE_NOT_FOUND: 400,
        CLOUDFLARE_RECORD_EXISTS: 409,
        CLOUDFLARE_RECORD_NOT_FOUND: 409,
        CLOUDFLARE_UNAVAILABLE: 502,
        CLOUDFLARE_REQUEST_FAILED: 502,
        INVALID_PROJECT_ID: 400,
      }[error?.code];
      if (status) {
        respondJson(response, status, { error: error.message });
        return;
      }
      if (error instanceof TypeError || error instanceof RangeError) {
        respondJson(response, 400, { error: error.message });
        return;
      }
      if (error?.code === "23505" || error?.code === "APPLICATION_DOMAIN_CONFLICT") {
        respondJson(response, 409, { error: "Ese hostname ya está configurado." });
        return;
      }
      if (error?.code === "ENOENT") {
        respondJson(response, 409, { error: "Vuelve a proporcionar un token de Cloudflare para este dominio." });
        return;
      }
      console.error("Could not configure project domain:", error);
      respondJson(response, 503, { error: "No se pudo guardar la configuración del dominio." });
    }
    return;
  }

  const projectEnvironmentMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/environment$/);
  if (projectEnvironmentMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    let projectId;
    try {
      projectId = validateProjectId(projectEnvironmentMatch[1]);
    } catch (error) {
      respondJson(response, 400, { error: error.message });
      return;
    }
    if (request.method !== "GET" && request.method !== "PUT") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET, PUT" });
      return;
    }
    if (request.method === "PUT" && !hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    try {
      const project = await getProject(projectId);
      if (!project) {
        respondJson(response, 404, { error: "No se encontró el proyecto." });
        return;
      }
      if (request.method === "GET") {
        respondJson(response, 200, {
          environment: await getProjectEnvironment(serviceOperationsDirectory, projectId),
        });
        return;
      }
      const body = await readJson(request, 72_000);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).length !== 1 || !Object.hasOwn(body, "environment")) {
        respondJson(response, 400, { error: "Proporciona únicamente el objeto de variables del proyecto." });
        return;
      }
      const environment = await saveProjectEnvironment(
        serviceOperationsDirectory,
        projectId,
        body.environment,
      );
      await recordAuditEvent({
        action: "project.environment.updated",
        resourceType: "project",
        resourceId: projectId,
        details: { variableNames: Object.keys(environment), count: Object.keys(environment).length },
      });
      respondJson(response, 200, {
        variableNames: Object.keys(environment),
        message: `Se guardaron ${Object.keys(environment).length} variables para ${project.name}. Se aplicarán en su próximo despliegue.`,
      });
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        respondJson(response, 400, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not update project environment:", error);
      respondJson(response, 503, { error: "No se pudo guardar la configuración de variables." });
    }
    return;
  }

  if (url.pathname === "/api/projects") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method === "GET") {
      try {
        const projects = await getProjects();
        const [projectStates, projectDomains] = await Promise.all([
          getProjectDeploymentState(projects),
          getProjectDomains(),
        ]);
        const healthByProject = await checkProjectHealth(projectStates, projectDomains);
        respondJson(response, 200, {
          projects: projectStates.map((project) => ({
            ...project,
            health: healthByProject.get(project.id),
          })),
        });
      } catch (error) {
        console.error("Could not list projects:", error);
        respondJson(response, 503, { error: "No se pudieron consultar los proyectos." });
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
      const projectInput = validateProjectInput(await readJson(request));
      await validateProjectSource(projectInput);
      let initialCommitSha = null;
      if (projectInput.sourceType === "github" && projectInput.autoDeploy) {
        initialCommitSha = await githubOAuth.getCommit(
          projectInput.githubInstallationId,
          projectInput.repository,
          projectInput.productionBranch,
        );
      }
      await configureGithubProjectWebhook(projectInput);
      const project = await createProject(projectInput);
      if (project.deploymentType !== "dynamic") {
        await saveProjectDeploymentType(serviceOperationsDirectory, project.id, project.deploymentType);
      }
      let deploymentQueued = false;
      try {
        deploymentQueued = await queueInitialGithubDeployment(project, initialCommitSha);
      } catch (error) {
        console.error("Could not queue the initial GitHub project deployment:", error);
      }
      respondJson(response, 201, {
        project,
        deploymentQueued,
        ...(projectInput.sourceType === "github" && projectInput.autoDeploy && !deploymentQueued
          ? { warning: "El repositorio quedó conectado, pero no se pudo encolar el primer despliegue. Puedes iniciarlo desde el proyecto." }
          : {}),
      });
    } catch (error) {
      const status = {
        INVALID_PROJECT: 400,
        GITHUB_TOKEN_INVALID: 401,
        GITHUB_TOKEN_FORBIDDEN: 403,
        GITHUB_RESOURCE_NOT_FOUND: 404,
        GITHUB_BRANCH_NOT_FOUND: 409,
        GITHUB_ACCOUNT_NOT_CONNECTED: 409,
        GITHUB_OAUTH_NOT_CONFIGURED: 409,
        GITHUB_TOKEN_EXPIRED: 401,
        GITHUB_TOO_MANY_REPOSITORIES: 422,
        GITHUB_TOO_MANY_BRANCHES: 422,
        GITHUB_UNAVAILABLE: 502,
      }[error?.code];
      if (status) {
        respondJson(response, status, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      if (error?.code === "23505") {
        respondJson(response, 409, { error: "Ya existe un proyecto con ese nombre o repositorio." });
        return;
      }
      console.error("Could not create project:", error);
      respondJson(response, 503, { error: "No se pudo registrar el proyecto." });
    }
    return;
  }

  if (url.pathname === "/api/projects/import") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    let project;
    let path;
    let createdFile = false;
    try {
      if (!["application/zip", "application/x-zip-compressed"].includes(
        String(request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase(),
      )) {
        throw new RequestError(415, "Envía un archivo ZIP o una carpeta de proyecto.");
      }
      const archive = await readRawBody(request, 32 * 1024 * 1024);
      if (archive.length < 4 || archive[0] !== 0x50 || archive[1] !== 0x4b) {
        throw new RequestError(400, "El archivo no parece ser un ZIP válido.");
      }
      const projectFiles = validateProjectArchive(archive);
      const buildProfile = detectProjectBuildProfile(projectFiles);
      const name = request.headers["x-project-name"];
      const deploymentType = request.headers["x-deployment-type"] ?? buildProfile.recommendedDeploymentType;
      if (!["static", "dynamic", "build"].includes(deploymentType)) {
        throw new RequestError(400, "El perfil de despliegue debe ser estático, dinámico o build.");
      }
      const buildStrategy = deploymentType === "static"
        ? "dockerfile"
        : deploymentType === "build"
          ? "dockerfile"
          : request.headers["x-build-strategy"] ?? buildProfile.buildStrategy;
      project = validateProjectInput({
        name,
        sourceType: "upload",
        deploymentType,
        buildStrategy,
        framework: request.headers["x-project-framework"] ?? buildProfile.framework,
        internalPort: Number(request.headers["x-internal-port"] ?? buildProfile.internalPort),
        buildCommand: request.headers["x-build-command"] ?? buildProfile.buildCommand,
        buildOutputDirectory: request.headers["x-build-output-directory"] ?? buildProfile.buildOutputDirectory,
        buildContext: request.headers["x-build-context"] ?? buildProfile.buildContext,
        dockerfilePath: request.headers["x-dockerfile-path"] ?? buildProfile.dockerfilePath,
        autoDeploy: false,
      });
      project = await createProject(project);
      if (project.deploymentType !== "dynamic") {
        await saveProjectDeploymentType(serviceOperationsDirectory, project.id, project.deploymentType);
      }
      const sourceDigest = createHash("sha256").update(archive).digest("hex");
      path = projectUploadSourcePath(project.id, sourceDigest);
      await writeFile(path, archive, { flag: "wx", mode: 0o600 });
      createdFile = true;
      const source = await recordProjectUploadSource(project.id, sourceDigest, archive.length);
      await recordAuditEvent({
        action: "project.source.uploaded",
        resourceType: "project",
        resourceId: project.id,
        details: { sourceDigest, sizeBytes: archive.length, initialImport: true },
      });
      respondJson(response, 201, { project, source });
    } catch (error) {
      if (createdFile) {
        try {
          await unlink(path);
        } catch (cleanupError) {
          console.error("Could not remove a partially imported project archive:", cleanupError);
        }
      }
      if (project?.id) {
        try {
          await deleteProject(project.id);
          await deleteProjectConfig(serviceOperationsDirectory, project.id);
        } catch (cleanupError) {
          console.error("Could not remove a partially imported project record:", cleanupError);
        }
      }
      if (error instanceof RequestError || error instanceof ProjectArchiveValidationError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      if (error?.code === "INVALID_PROJECT") {
        respondJson(response, 400, { error: error.message });
        return;
      }
      if (error?.code === "23505") {
        respondJson(response, 409, { error: "Ya existe un proyecto con ese nombre." });
        return;
      }
      console.error("Could not import uploaded project:", error);
      respondJson(response, 503, { error: "No se pudo crear el proyecto a partir de los archivos." });
    }
    return;
  }

  const projectSourceFilesMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/source\/files$/);
  if (projectSourceFilesMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "GET") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET" });
      return;
    }
    try {
      const projectId = validateProjectId(projectSourceFilesMatch[1]);
      const project = await getProject(projectId);
      if (!project) throw new RequestError(404, "No se encontró el proyecto.");
      if (project.sourceType !== "upload") {
        throw new RequestError(409, "La lista de archivos solo está disponible para proyectos subidos.");
      }
      const source = await getLatestProjectUploadSource(projectId);
      if (!source) throw new RequestError(404, "El proyecto todavía no tiene archivos cargados.");
      const archive = await readFile(projectUploadSourcePath(projectId, source.sourceDigest));
      respondJson(response, 200, { files: validateProjectArchive(archive) });
    } catch (error) {
      if (error instanceof RequestError || error instanceof ProjectArchiveValidationError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      if (error?.code === "INVALID_PROJECT_ID") {
        respondJson(response, 400, { error: error.message });
        return;
      }
      console.error("Could not list uploaded project files:", error);
      respondJson(response, 503, { error: "No se pudieron consultar los archivos del proyecto." });
    }
    return;
  }

  const projectSourceMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/source$/);
  if (projectSourceMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "PUT") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "PUT" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    let projectId;
    try {
      projectId = validateProjectId(projectSourceMatch[1]);
    } catch (error) {
      respondJson(response, 400, { error: error.message });
      return;
    }
    try {
      if (!["application/zip", "application/x-zip-compressed"].includes(
        String(request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase(),
      )) {
        throw new RequestError(415, "Envía un archivo ZIP del código del proyecto.");
      }
      const archive = await readRawBody(request, 32 * 1024 * 1024);
      if (archive.length < 4 || archive[0] !== 0x50 || archive[1] !== 0x4b) {
        throw new RequestError(400, "El archivo no parece ser un ZIP válido.");
      }
      validateProjectArchive(archive);
      const project = await getProject(projectId);
      if (!project) throw new RequestError(404, "No se encontró el proyecto.");
      if (project.sourceType !== "upload") {
        throw new RequestError(409, "Cambia la fuente del proyecto a carga de archivos antes de subir código.");
      }
      const sourceDigest = createHash("sha256").update(archive).digest("hex");
      const path = projectUploadSourcePath(project.id, sourceDigest);
      let createdFile = false;
      try {
        await writeFile(path, archive, { flag: "wx", mode: 0o600 });
        createdFile = true;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
        const existing = await readFile(path);
        if (existing.length !== archive.length
          || createHash("sha256").update(existing).digest("hex") !== sourceDigest) {
          throw new Error("El archivo guardado no coincide con su digest.");
        }
      }
      let source;
      try {
        source = await recordProjectUploadSource(project.id, sourceDigest, archive.length);
      } catch (error) {
        if (createdFile) await unlink(path);
        throw error;
      }
      await recordAuditEvent({
        action: "project.source.uploaded",
        resourceType: "project",
        resourceId: project.id,
        details: { sourceDigest, sizeBytes: archive.length },
      });
      respondJson(response, 201, { source });
    } catch (error) {
      if (error instanceof RequestError || error instanceof ProjectArchiveValidationError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not save uploaded project source:", error);
      respondJson(response, 503, { error: "No se pudo guardar el archivo del proyecto." });
    }
    return;
  }

  const projectHealthMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/health$/);
  if (projectHealthMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "GET") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET" });
      return;
    }
    let projectId;
    try {
      projectId = validateProjectId(projectHealthMatch[1]);
    } catch (error) {
      respondJson(response, 400, { error: error.message });
      return;
    }
    try {
      const project = await getProject(projectId);
      if (!project) {
        respondJson(response, 404, { error: "No se encontró el proyecto." });
        return;
      }
      const [projectState, domains] = await Promise.all([
        getProjectDeploymentState([project]),
        getProjectDomains(),
      ]);
      const projectDomains = domains.filter((domain) => domain.projectId === projectId);
      const [health, operation] = await Promise.all([
        checkProjectHealth(projectState, projectDomains),
        serviceOperationAgent.getStatus(),
      ]);
      const routeUpdatePending = forcedProjectRouteReconcile.has(projectId)
        || (operation?.operation === "update-project-routes"
          && operation.projectId === projectId
          && ["queued", "running"].includes(operation.state));
      respondJson(response, 200, {
        deployment: projectState[0].deployment,
        routeUpdatePending,
        health: health.get(projectId),
      });
    } catch (error) {
      console.error("Could not check project health:", error);
      respondJson(response, 503, { error: "No se pudo consultar la salud del proyecto." });
    }
    return;
  }

  const projectRouteRepairMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/routes\/reconcile$/);
  if (projectRouteRepairMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    let projectId;
    try {
      projectId = validateProjectId(projectRouteRepairMatch[1]);
    } catch (error) {
      respondJson(response, 400, { error: error.message });
      return;
    }
    try {
      const project = await getProject(projectId);
      if (!project) {
        respondJson(response, 404, { error: "No se encontró el proyecto." });
        return;
      }
      const [projectState] = await getProjectDeploymentState([project]);
      if (!projectState.deployment) {
        respondJson(response, 409, { error: "Despliega el proyecto antes de reparar su ruta." });
        return;
      }
      forcedProjectRouteReconcile.add(projectId);
      const routeUpdate = await saveProjectDomainAssignments(projectId, { force: true });
      if (routeUpdate.state === "not-deployed") {
        forcedProjectRouteReconcile.delete(projectId);
        respondJson(response, 409, { error: "No se encontró el servicio desplegado para este proyecto." });
        return;
      }
      if (routeUpdate.state !== "pending") forcedProjectRouteReconcile.delete(projectId);
      respondJson(response, 202, {
        state: routeUpdate.state,
        message: routeUpdate.state === "pending"
          ? "La ruta se reparará cuando termine la operación actual del VPS."
          : "Se solicitó la resincronización de la ruta sin reconstruir el proyecto.",
      });
    } catch (error) {
      forcedProjectRouteReconcile.delete(projectId);
      console.error("Could not repair project route:", error);
      respondJson(response, 503, { error: "No se pudo solicitar la reparación de la ruta." });
    }
    return;
  }

  const projectBuildStatusMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/build-status$/);
  if (projectBuildStatusMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "GET") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET" });
      return;
    }
    let projectId;
    try {
      projectId = validateProjectId(projectBuildStatusMatch[1]);
    } catch (error) {
      respondJson(response, 400, { error: error.message });
      return;
    }
    try {
      const project = await getProject(projectId);
      if (!project) {
        respondJson(response, 404, { error: "No se encontró el proyecto." });
        return;
      }
      const [tasks, builds, agentStatus] = await Promise.all([
        getLatestProjectBuildOperations([project.id]),
        getLatestProjectBuilds([project.id]),
        serviceOperationAgent.getStatus(),
      ]);
      const latestOperation = tasks[0] ?? null;
      const savedBuildStatus = latestOperation
        && typeof serviceOperationAgent.getProjectBuildStatus === "function"
        ? await serviceOperationAgent.getProjectBuildStatus(latestOperation.id)
        : null;
      respondJson(response, 200, {
        operation: mapProjectBuildOperation(latestOperation, savedBuildStatus ?? agentStatus),
        latestBuild: builds[0] ? {
          taskId: builds[0].id,
          commitSha: builds[0].result.commitSha,
          image: builds[0].result.image,
          deploymentType: builds[0].result.deploymentType,
          buildStrategy: builds[0].result.buildStrategy,
          buildContext: builds[0].result.buildContext,
          dockerfilePath: builds[0].result.dockerfilePath,
          buildCommand: builds[0].result.buildCommand,
          buildOutputDirectory: builds[0].result.buildOutputDirectory,
          branch: builds[0].result.branch,
        } : null,
      });
    } catch (error) {
      console.error("Could not retrieve project build status:", error);
      respondJson(response, 503, { error: "No se pudo consultar el estado de la construcción." });
    }
    return;
  }

  const projectBuildMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/build$/);
  if (projectBuildMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    let projectId;
    try {
      projectId = validateProjectId(projectBuildMatch[1]);
    } catch (error) {
      respondJson(response, 400, { error: error.message });
      return;
    }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 0) {
        respondJson(response, 400, { error: "La construcción usa la fuente y rama configuradas en el proyecto." });
        return;
      }
      const project = await getProject(projectId);
      if (!project) {
        respondJson(response, 404, { error: "No se encontró el proyecto." });
        return;
      }
      let sourceDigest;
      if (project.sourceType === "github") {
        await validateProjectSource(project);
      } else {
        const source = await getLatestProjectUploadSource(project.id);
        if (!source) {
          respondJson(response, 409, { error: "Sube primero un archivo ZIP del código del proyecto." });
          return;
        }
        sourceDigest = source.sourceDigest;
      }
      const taskId = randomUUID();
      await createProjectBuildTask({
        id: taskId,
        projectId: project.id,
        projectName: project.name,
        repository: project.repository,
        branch: project.productionBranch,
        sourceType: project.sourceType,
        sourceDigest,
      });
      const task = await getTaskById(taskId);
      respondJson(response, 202, {
        task,
        message: "Construcción solicitada en el VPS; la imagen quedará disponible localmente y no se desplegarán servicios.",
      });
    } catch (error) {
      const status = {
        GITHUB_TOKEN_INVALID: 401,
        GITHUB_TOKEN_FORBIDDEN: 403,
        GITHUB_RESOURCE_NOT_FOUND: 404,
        PROJECT_NOT_FOUND: 404,
        PROJECT_BUILD_IN_PROGRESS: 409,
        GITHUB_BRANCH_NOT_FOUND: 409,
        GITHUB_ACCOUNT_NOT_CONNECTED: 409,
        GITHUB_OAUTH_NOT_CONFIGURED: 409,
        GITHUB_TOKEN_EXPIRED: 401,
        GITHUB_TOO_MANY_REPOSITORIES: 422,
        GITHUB_TOO_MANY_BRANCHES: 422,
        GITHUB_VALIDATION_FAILED: 422,
        GITHUB_UNAVAILABLE: 502,
        GITHUB_ARCHIVE_TOO_LARGE: 413,
      }[error?.code];
      if (status) {
        respondJson(response, status, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not request project image build:", error);
      respondJson(response, 503, { error: "No se pudo iniciar la construcción de la imagen." });
    }
    return;
  }

  const projectDeploymentMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/deploy$/);
  if (projectDeploymentMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    let projectId;
    try {
      projectId = validateProjectId(projectDeploymentMatch[1]);
    } catch (error) {
      respondJson(response, 400, { error: error.message });
      return;
    }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 0) {
        respondJson(response, 400, { error: "La solicitud de despliegue no admite parámetros adicionales." });
        return;
      }
      const project = await getProject(projectId);
      if (!project) {
        respondJson(response, 404, { error: "No se encontró el proyecto." });
        return;
      }
      const [latestBuild] = await getLatestProjectBuilds([project.id]);
      if (!latestBuild) {
        respondJson(response, 409, { error: "Construye una imagen del proyecto antes de desplegarlo." });
        return;
      }
      const commitSha = latestBuild.result?.commitSha;
      const expectedImage = `vps-manager-project-${project.id.replaceAll("-", "")}:${commitSha}`;
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha ?? "")
        || latestBuild.result?.image !== expectedImage) {
        respondJson(response, 409, { error: "El último build no coincide con la imagen local esperada. Vuelve a construir el proyecto." });
        return;
      }
      if (project.deploymentType === "build"
        && (latestBuild.result?.deploymentType !== project.deploymentType
          || latestBuild.result?.buildCommand !== project.buildCommand
          || latestBuild.result?.buildOutputDirectory !== project.buildOutputDirectory
          || latestBuild.result?.buildContext !== project.buildContext)) {
        respondJson(response, 409, { error: "La configuración Build cambió desde la última compilación. Vuelve a construir el proyecto antes de desplegar." });
        return;
      }
      await getProjectDeploymentConfig(serviceOperationsDirectory, project.id);
      const taskId = randomUUID();
      await createProjectDeployTask({
        id: taskId,
        projectId: project.id,
        projectName: project.name,
        commitSha,
      });
      respondJson(response, 202, {
        task: await getTaskById(taskId),
        message: `Despliegue solicitado para ${project.name} (${commitSha.slice(0, 12)}): Swarm ejecutará una tarea en el VPS principal. El servicio no publicará puertos.`,
      });
    } catch (error) {
      if (error?.code === "PROJECT_NOT_FOUND") {
        respondJson(response, 404, { error: error.message });
        return;
      }
      if (error?.code === "PROJECT_DEPLOYMENT_IN_PROGRESS" || error?.code === "OPERATION_IN_PROGRESS") {
        respondJson(response, 409, { error: error.message });
        return;
      }
      console.error("Could not request project deployment:", error);
      respondJson(response, 503, { error: "No se pudo iniciar el despliegue del proyecto." });
    }
    return;
  }

  const projectRollbackMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/rollback$/);
  if (projectRollbackMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    let projectId;
    try {
      projectId = validateProjectId(projectRollbackMatch[1]);
    } catch (error) {
      respondJson(response, 400, { error: error.message });
      return;
    }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).length !== 1
        || typeof body.commitSha !== "string"
        || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(body.commitSha)) {
        respondJson(response, 400, { error: "Selecciona un commit de despliegue anterior válido." });
        return;
      }
      const targetCommitSha = body.commitSha.toLowerCase();
      const project = await getProject(projectId);
      if (!project) {
        respondJson(response, 404, { error: "No se encontró el proyecto." });
        return;
      }
      const deployment = (await getProjectDeploymentState([project]))[0].deployment;
      if (!deployment) {
        respondJson(response, 409, { error: "El proyecto no tiene un servicio desplegado para revertir." });
        return;
      }
      if (deployment.commitSha === targetCommitSha) {
        respondJson(response, 409, { error: "El commit seleccionado ya está desplegado." });
        return;
      }
      const history = await getRecentProjectDeployments([projectId]);
      const previousDeployment = history.find((item) =>
        item.status === "completed" && item.result?.commitSha === targetCommitSha);
      if (!previousDeployment) {
        respondJson(response, 404, { error: "El commit no corresponde a un despliegue exitoso anterior de este proyecto." });
        return;
      }
      const expectedImage = `vps-manager-project-${projectId.replaceAll("-", "")}:${targetCommitSha}`;
      if (previousDeployment.result?.image !== expectedImage) {
        respondJson(response, 409, { error: "La imagen anterior no está disponible como imagen local del VPS." });
        return;
      }
      await getProjectDeploymentConfig(serviceOperationsDirectory, projectId);
      const taskId = randomUUID();
      await createProjectDeployTask({
        id: taskId,
        projectId,
        projectName: project.name,
        commitSha: targetCommitSha,
      });
      respondJson(response, 202, {
        task: await getTaskById(taskId),
        message: `Rollback solicitado para ${project.name} al commit ${targetCommitSha.slice(0, 12)}. Se conservarán las variables y dominios actuales del proyecto.`,
      });
    } catch (error) {
      if (error?.code === "PROJECT_DEPLOYMENT_IN_PROGRESS" || error?.code === "OPERATION_IN_PROGRESS") {
        respondJson(response, 409, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not request project rollback:", error);
      respondJson(response, 503, { error: "No se pudo iniciar el rollback del proyecto." });
    }
    return;
  }

  const projectUndeploymentMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/deployment$/);
  if (projectUndeploymentMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "DELETE") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "DELETE" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    let projectId;
    try {
      projectId = validateProjectId(projectUndeploymentMatch[1]);
    } catch (error) {
      respondJson(response, 400, { error: error.message });
      return;
    }
    try {
      const project = await getProject(projectId);
      if (!project) {
        respondJson(response, 404, { error: "No se encontró el proyecto." });
        return;
      }
      const taskId = randomUUID();
      await createProjectUndeployTask({ id: taskId, projectId: project.id, projectName: project.name });
      respondJson(response, 202, {
        task: await getTaskById(taskId),
        message: `Retiro solicitado para ${project.name}.`,
      });
    } catch (error) {
      if (error?.code === "PROJECT_NOT_FOUND") {
        respondJson(response, 404, { error: error.message });
        return;
      }
      if (error?.code === "PROJECT_DEPLOYMENT_IN_PROGRESS" || error?.code === "OPERATION_IN_PROGRESS") {
        respondJson(response, 409, { error: error.message });
        return;
      }
      console.error("Could not request project service removal:", error);
      respondJson(response, 503, { error: "No se pudo iniciar el retiro del servicio." });
    }
    return;
  }

  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    let projectId;
    try {
      projectId = validateProjectId(projectMatch[1]);
    } catch (error) {
      respondJson(response, 400, { error: error.message });
      return;
    }
    if (request.method === "GET") {
      try {
        const project = await getProject(projectId);
        respondJson(response, project ? 200 : 404, project
          ? { project }
          : { error: "No se encontró el proyecto." });
      } catch (error) {
        console.error("Could not retrieve project:", error);
        respondJson(response, 503, { error: "No se pudo consultar el proyecto." });
      }
      return;
    }
    if (request.method !== "PATCH" && request.method !== "DELETE") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET, PATCH, DELETE" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    if (request.method === "DELETE") {
      try {
        const services = await dockerGet("/services");
        const hasDeployment = services.some((service) => {
          const labels = service.Spec?.Labels;
          return service.Spec?.Name === `vps-manager-project-${projectId.replaceAll("-", "")}`
            || (labels?.["vps-manager.managed"] === "true"
              && labels["vps-manager.component"] === "project"
              && labels["vps-manager.project-id"] === projectId);
        });
        if (hasDeployment) {
          respondJson(response, 409, { error: "Retira primero el servicio desplegado antes de eliminar el proyecto." });
          return;
        }
        if ((await getProjectDomains()).some((domain) => domain.projectId === projectId)) {
          respondJson(response, 409, { error: "Quita primero los dominios asignados al proyecto." });
          return;
        }
        const deleted = await deleteProject(projectId);
        if (deleted) await deleteProjectConfig(serviceOperationsDirectory, projectId);
        respondJson(response, deleted ? 200 : 404, deleted
          ? { deleted: true }
          : { error: "No se encontró el proyecto." });
      } catch (error) {
        if (error?.code === "PROJECT_TASK_IN_PROGRESS") {
          respondJson(response, 409, { error: error.message });
          return;
        }
        console.error("Could not delete project:", error);
        respondJson(response, 503, { error: "No se pudo eliminar el proyecto." });
      }
      return;
    }
    try {
      const projectInput = validateProjectInput(await readJson(request));
      await validateProjectSource(projectInput);
      await configureGithubProjectWebhook(projectInput);
      const previousProject = await getProject(projectId);
      if (!previousProject) {
        respondJson(response, 404, { error: "No se encontró el proyecto." });
        return;
      }
      await saveProjectDeploymentType(serviceOperationsDirectory, projectId, projectInput.deploymentType);
      const project = await updateProject(projectId, projectInput);
      respondJson(response, project ? 200 : 404, project
        ? { project }
        : { error: "No se encontró el proyecto." });
    } catch (error) {
      const status = {
        INVALID_PROJECT: 400,
        GITHUB_TOKEN_INVALID: 401,
        GITHUB_TOKEN_FORBIDDEN: 403,
        GITHUB_RESOURCE_NOT_FOUND: 404,
        GITHUB_BRANCH_NOT_FOUND: 409,
        GITHUB_ACCOUNT_NOT_CONNECTED: 409,
        GITHUB_OAUTH_NOT_CONFIGURED: 409,
        GITHUB_TOKEN_EXPIRED: 401,
        GITHUB_TOO_MANY_REPOSITORIES: 422,
        GITHUB_TOO_MANY_BRANCHES: 422,
        GITHUB_VALIDATION_FAILED: 422,
        GITHUB_UNAVAILABLE: 502,
      }[error?.code];
      if (status) {
        respondJson(response, status, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      if (error?.code === "23505") {
        respondJson(response, 409, { error: "Ya existe un proyecto con ese nombre o repositorio." });
        return;
      }
      console.error("Could not update project:", error);
      respondJson(response, 503, { error: "No se pudo actualizar el proyecto." });
    }
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

  if (url.pathname === "/api/registry") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "GET") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET" });
      return;
    }
    try {
      respondJson(response, 200, { registry: await serviceOperationAgent.getRegistryConfiguration() });
    } catch (error) {
      console.error("Private registry status request failed:", error);
      respondJson(response, 503, { error: "No se pudo consultar la configuración del registro." });
    }
    return;
  }

  if (url.pathname === "/api/registry/configure") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    let taskId;
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).sort().join(",") !== ["domain", "password", "username"].sort().join(",")
        || !isPublicHostname(body.domain)
        || typeof body.username !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(body.username)
        || typeof body.password !== "string" || !/^[A-Za-z0-9._-]{20,72}$/.test(body.password)) {
        respondJson(response, 400, {
          error: "Proporciona un dominio público, un usuario válido y una contraseña de 20 a 72 caracteres (letras, números, punto, guion o guion bajo).",
        });
        return;
      }
      if (process.env.VPS_MANAGER_TEST_MODE === "true") {
        respondJson(response, 409, { error: "El registro requiere una instalación con dominio público y HTTPS; no está disponible en modo de prueba." });
        return;
      }

      taskId = randomUUID();
      const domain = body.domain.toLowerCase();
      await serviceOperationAgent.stageRegistryCredentials(taskId, {
        domain,
        username: body.username,
        password: body.password,
      });
      try {
        await createRegistryConfigureTask({ id: taskId, domain, username: body.username });
      } catch (error) {
        await serviceOperationAgent.removeRegistryCredentials(taskId);
        if (error?.code === "REGISTRY_CONFIGURATION_IN_PROGRESS") {
          respondJson(response, 409, { error: error.message });
          return;
        }
        throw error;
      }
      respondJson(response, 202, {
        task: {
          id: taskId,
          type: "registry.configure",
          status: "pending",
          domain,
          username: body.username,
          message: `Configuración del registro solicitada para https://${domain}/.`,
        },
      });
    } catch (error) {
      console.error("Could not request private registry configuration:", error);
      respondJson(response, 503, { error: "No se pudo iniciar la configuración del registro privado." });
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
        if (!application.installDomain) {
          respondJson(response, 409, {
            error: "Gitea necesita un dominio público con HTTPS o el modo de prueba local de VPS Manager.",
          });
          return;
        }
        if ((application.installed && !application.needsLocalUpgrade && !application.needsDomainMigration)
          || application.nameConflict) {
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
          await createGiteaInstallTask({ id: taskId, domain: application.installDomain });
        } catch (error) {
          if (error?.code === "APPLICATION_TASK_IN_PROGRESS") {
            respondJson(response, 409, { error: error.message });
            return;
          }
          if (error instanceof RequestError) {
            respondJson(response, error.statusCode, { error: error.message });
            return;
          }
          throw error;
        }
        respondJson(response, 202, {
          task: {
            id: taskId,
            type: "application.gitea.install",
            status: "pending",
            domain: application.installDomain,
            message: application.localOnly
              ? application.needsLocalUpgrade
                ? "Actualización local de Gitea solicitada. Se conservará el volumen con repositorios, usuarios y credenciales."
                : "Instalación local de Gitea solicitada. La interfaz se abrirá mediante un túnel SSH y la API quedará en la red privada de Swarm."
              : `Instalación de Gitea solicitada para https://${application.domain}/.`,
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

  if (url.pathname === "/api/system/applications/n8n") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method === "GET") {
      try {
        respondJson(response, 200, await getN8nApplicationState());
      } catch (error) {
        console.error("n8n application status request failed:", error);
        respondJson(response, 503, { error: "No se pudo consultar el estado de n8n." });
      }
      return;
    }
    if (request.method === "POST") {
      if (!hasSameOrigin(request)) {
        respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
        return;
      }
      try {
        const { application } = await getN8nApplicationState();
        if (testMode || (!application.domain && application.domainZones.length === 0)) {
          respondJson(response, 409, {
            error: "Conecta primero un dominio raíz en la pestaña Dominios para elegir dónde instalar n8n.",
          });
          return;
        }
        if (application.installed || application.nameConflict || application.installing) {
          respondJson(response, 409, {
            error: application.nameConflict
              ? "Ya existe un servicio con el nombre reservado para n8n que no pertenece a VPS Manager."
              : application.installed
                ? "n8n ya está instalado."
                : "Ya hay una instalación de n8n en curso.",
          });
          return;
        }
        const hasBody = Number(request.headers["content-length"] ?? 0) > 0
          || request.headers["transfer-encoding"] !== undefined;
        const body = hasBody ? await readJson(request) : undefined;
        const configuration = validateN8nInstanceConfiguration(body?.configuration ?? {});
        let hostname = application.domain;
        if (body !== undefined) {
          if (!body || typeof body !== "object" || Array.isArray(body)
            || Object.keys(body).some((key) => !["zoneId", "subdomain", "configuration"].includes(key))
            || typeof body.zoneId !== "string"
            || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.zoneId)
            || typeof body.subdomain !== "string") {
            respondJson(response, 400, { error: "Selecciona un dominio raíz y escribe un subdominio válido." });
            return;
          }
          const domainZone = await getDomainZone(body.zoneId);
          if (!domainZone || domainZone.connectionStatus !== "connected") {
            respondJson(response, 404, { error: "El dominio raíz seleccionado ya no está conectado." });
            return;
          }
          hostname = buildDomainHostname(domainZone.zone, body.subdomain);
          const tunnelSettings = await getCloudflareTunnelSettings();
          const reservedHostnames = new Set([
            managerDomain.toLowerCase(),
            managerDomain ? `git.${managerDomain}`.toLowerCase() : "",
            (await serviceOperationAgent.getRegistryConfiguration())?.domain?.toLowerCase() ?? "",
            tunnelSettings?.managerHostname?.toLowerCase() ?? "",
          ].filter(Boolean));
          if (reservedHostnames.has(hostname)) {
            respondJson(response, 409, { error: "Ese hostname ya está reservado por VPS Manager, Gitea o el registro privado." });
            return;
          }
          const domains = await getProjectDomains();
          const existingDomain = domains.find((domain) => domain.applicationId === "n8n");
          if (domains.some((domain) => domain.hostname === hostname && domain.id !== existingDomain?.id)) {
            respondJson(response, 409, { error: "Ese hostname ya está asignado a otro proyecto o aplicación." });
            return;
          }
          const ingressIp = await getIngressIp();
          if (!ingressIp) {
            respondJson(response, 409, { error: "Configura primero la IPv4 pública del VPS manager." });
            return;
          }
          if (!await hasCloudflareToken(serviceOperationsDirectory, domainZone.credentialId)) {
            respondJson(response, 409, { error: "Actualiza el token de Cloudflare del dominio raíz seleccionado." });
            return;
          }
          const token = await getCloudflareToken(serviceOperationsDirectory, domainZone.credentialId);
          const verifiedZone = await cloudflareClient.verifyZone(token, domainZone.zone);
          if (verifiedZone.id !== domainZone.zoneId) {
            respondJson(response, 409, { error: "La zona de Cloudflare cambió. Actualiza la conexión en Dominios." });
            return;
          }
          const dnsRecord = await cloudflareClient.upsertARecord(token, {
            zoneId: domainZone.zoneId,
            hostname,
            address: ingressIp,
            proxied: domainZone.proxied,
            existingRecordId: existingDomain?.zone === domainZone.zone && existingDomain.hostname === hostname
                ? existingDomain.dnsRecordId
                : undefined,
          });
          await saveProjectDomain({
            id: existingDomain?.id ?? randomUUID(),
            provider: "cloudflare",
            zone: domainZone.zone,
            domainZoneId: domainZone.id,
            zoneId: domainZone.zoneId,
            hostname,
            applicationId: "n8n",
            port: 5678,
            proxied: domainZone.proxied,
            dnsRecordId: dnsRecord.id,
          });
        }
        const [dockerInfo, nodes] = await Promise.all([dockerGet("/info"), dockerGet("/nodes")]);
        const serverNodeId = dockerInfo.Swarm?.NodeID;
        const serverNode = nodes.find((node) => node.ID === serverNodeId);
        if (typeof serverNodeId !== "string" || !serverNode
          || serverNode.Status?.State !== "ready" || serverNode.Spec?.Availability !== "active") {
          respondJson(response, 409, { error: "El manager de Swarm no está listo para alojar n8n." });
          return;
        }
        const instance = await saveApplicationInstanceConfiguration({
          applicationId: "n8n",
          serverNodeId,
          serverHostname: serverNode.Description?.Hostname ?? "manager",
          name: "n8n",
          configuration: { ...configuration, domain: hostname },
        });
        const taskId = randomUUID();
        if (!await beginApplicationInstanceDeployment(instance.id, taskId)) {
          throw new Error("No se pudo marcar la instancia n8n como en instalación.");
        }
        try {
          await createN8nInstallTask({
            id: taskId,
            domain: hostname,
            configuration,
            instanceId: instance.id,
          });
        } catch (error) {
          await updateApplicationInstanceDeployment(instance.id, taskId, { status: "configured" });
          throw error;
        }
        respondJson(response, 202, {
          task: {
            id: taskId,
            type: "application.n8n.install",
            status: "pending",
            domain: hostname,
            message: `Instalación de n8n solicitada para https://${hostname}/.`,
          },
        });
      } catch (error) {
        if (error?.code === "APPLICATION_TASK_IN_PROGRESS") {
          respondJson(response, 409, { error: error.message });
          return;
        }
        if (error instanceof RequestError) {
          respondJson(response, error.statusCode, { error: error.message });
          return;
        }
        const status = {
          CLOUDFLARE_TOKEN_INVALID: 401,
          CLOUDFLARE_ZONE_NOT_FOUND: 400,
          CLOUDFLARE_RECORD_EXISTS: 409,
          CLOUDFLARE_RECORD_NOT_FOUND: 409,
          CLOUDFLARE_UNAVAILABLE: 502,
          CLOUDFLARE_REQUEST_FAILED: 502,
          "23505": 409,
        }[error?.code];
        if (status) {
          respondJson(response, status, { error: error.message });
          return;
        }
        if (error instanceof TypeError || error instanceof RangeError) {
          respondJson(response, 400, { error: error.message });
          return;
        }
        console.error("Could not request n8n installation:", error);
        respondJson(response, 503, { error: "No se pudo iniciar la instalación de n8n." });
      }
      return;
    }
    respond(response, 405, "Method not allowed", { Allow: "GET, POST" });
    return;
  }

  if (url.pathname === "/api/system/applications/postgresql") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method === "GET") {
      try {
        respondJson(response, 200, await getPostgresqlApplicationState());
      } catch (error) {
        console.error("PostgreSQL application status request failed:", error);
        respondJson(response, 503, { error: "No se pudo consultar el estado de PostgreSQL." });
      }
      return;
    }
    if (request.method === "POST") {
      if (!hasSameOrigin(request)) {
        respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
        return;
      }
      try {
        const { application } = await getPostgresqlApplicationState();
        if (testMode || application.installed || application.nameConflict || application.installing) {
          respondJson(response, 409, {
            error: application.nameConflict
              ? "Ya existe un servicio con el nombre reservado para PostgreSQL que no pertenece a VPS Manager."
              : application.installed
                ? "PostgreSQL ya está instalado."
                : application.installing
                  ? "Ya hay una instalación de PostgreSQL en curso."
                  : "La instalación de PostgreSQL no está habilitada en modo de prueba.",
          });
          return;
        }
        const taskId = randomUUID();
        await createPostgresqlInstallTask({ id: taskId });
        try {
          await recordAuditEvent({
            action: "application.postgresql.installation.requested",
            resourceType: "application",
            resourceId: "postgresql",
            details: { taskId },
          });
        } catch (error) {
          console.error("PostgreSQL installation was queued, but the audit event could not be saved:", error);
        }
        respondJson(response, 202, {
          task: {
            id: taskId,
            type: "application.postgresql.install",
            status: "pending",
            message: "Instalación de PostgreSQL solicitada.",
          },
        });
      } catch (error) {
        if (error?.code === "APPLICATION_TASK_IN_PROGRESS") {
          respondJson(response, 409, { error: error.message });
          return;
        }
        console.error("Could not request PostgreSQL installation:", error);
        respondJson(response, 503, { error: "No se pudo iniciar la instalación de PostgreSQL." });
      }
      return;
    }
    respond(response, 405, "Method not allowed", { Allow: "GET, POST" });
    return;
  }

  if (url.pathname === "/api/system/applications/gitea/token") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).length !== 1 || !Object.hasOwn(body, "token")
        || typeof body.token !== "string" || !/^[A-Za-z0-9._-]{20,512}$/.test(body.token)) {
        respondJson(response, 400, { error: "Proporciona un token de Gitea válido, de 20 a 512 caracteres." });
        return;
      }
      const { application } = await getGiteaApplicationState();
      if (!application.installed || (!application.domain && !application.localOnly)) {
        respondJson(response, 409, { error: "Instala Gitea antes de conectarlo." });
        return;
      }
      if (application.localOnly && !application.privateApiReady) {
        respondJson(response, 409, { error: "Actualiza el acceso local de Gitea antes de conectar un token." });
        return;
      }
      const client = application.localOnly
        ? createGiteaClient({ baseUrl: "http://vps-manager-gitea:3000" })
        : createGiteaClient({ domain: application.domain });
      try {
        await client.verifyToken(body.token);
      } catch (error) {
        const status = {
          GITEA_TOKEN_INVALID: 400,
          GITEA_TOKEN_FORBIDDEN: 403,
          GITEA_UNAVAILABLE: 502,
        }[error?.code];
        if (status) {
          respondJson(response, status, { error: error.message });
          return;
        }
        throw error;
      }
      const operation = await serviceOperationAgent.requestGiteaApiToken(body.token);
      const audited = await recordAuditEventOrRespond(response, {
        action: "application.gitea.token_configuration.requested",
        resourceType: "application",
        resourceId: "gitea",
        details: { operationId: operation.id },
      }, "La configuración del token de Gitea");
      if (!audited) return;
      respondJson(response, 202, {
        operation: {
          id: operation.id,
          state: operation.state,
          message: "Token validado. Se guardará como secreto Swarm y el panel se reiniciará para montarlo.",
        },
      });
    } catch (error) {
      if (error?.code === "OPERATION_IN_PROGRESS") {
        respondJson(response, 409, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not configure Gitea API token:", error);
      respondJson(response, 503, { error: "No se pudo configurar el token de Gitea." });
    }
    return;
  }

  if (url.pathname === "/api/system/applications/gitea/repositories" && request.method === "GET") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      const { client, token } = await getGiteaApiContext();
      const repositories = await client.listRepositories(token);
      respondJson(response, 200, { repositories });
    } catch (error) {
      const status = {
        GITEA_TOKEN_INVALID: 401,
        GITEA_TOKEN_FORBIDDEN: 403,
        GITEA_TOO_MANY_REPOSITORIES: 422,
        GITEA_UNAVAILABLE: 502,
      }[error?.code];
      if (status) {
        respondJson(response, status, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not list Gitea repositories:", error);
      respondJson(response, 503, { error: "No se pudieron consultar los repositorios de Gitea." });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/system/applications/gitea/repositories") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    try {
      const repositoryInput = validateRepositoryInput(await readJson(request));
      const { application } = await getGiteaApplicationState();
      if (!application.installed || (!application.domain && !application.localOnly)) {
        respondJson(response, 409, { error: "Gitea no está instalado." });
        return;
      }
      if (!application.apiTokenConfigured) {
        respondJson(response, 409, { error: "Conecta primero un token de Gitea con permiso para crear repositorios." });
        return;
      }
      const token = await readFile(
        process.env.GITEA_API_TOKEN_FILE ?? "/run/secrets/gitea_api_token",
        "utf8",
      );
      const client = application.localOnly
        ? createGiteaClient({ baseUrl: "http://vps-manager-gitea:3000" })
        : createGiteaClient({ domain: application.domain });
      let repository;
      try {
        repository = await client.createRepository(token, repositoryInput);
      } catch (error) {
        const status = {
          GITEA_TOKEN_INVALID: 401,
          GITEA_TOKEN_FORBIDDEN: 403,
          GITEA_REPOSITORY_EXISTS: 409,
          GITEA_UNAVAILABLE: 502,
        }[error?.code];
        if (status) {
          respondJson(response, status, { error: error.message });
          return;
        }
        throw error;
      }
      const audited = await recordAuditEventOrRespond(response, {
        action: "application.gitea.repository.created",
        resourceType: "repository",
        resourceId: repository.name,
        details: { url: repository.url, visibility: "private" },
      }, "La creación del repositorio");
      if (!audited) return;
      respondJson(response, 201, { repository });
    } catch (error) {
      if (error instanceof TypeError && error.code === "INVALID_REPOSITORY") {
        respondJson(response, 400, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not create Gitea repository:", error);
      respondJson(response, 503, { error: "No se pudo crear el repositorio en Gitea." });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/system/applications/gitea/branches") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      const repositoryReference = validateRepositoryReference(url.searchParams.get("repository"));
      const { client, token } = await getGiteaApiContext();
      const repositories = await client.listRepositories(token);
      const repository = repositories.find((item) => item.fullName === repositoryReference.fullName);
      if (!repository) {
        respondJson(response, 404, { error: "No se encontró el repositorio en la cuenta conectada." });
        return;
      }
      const branches = await client.listBranches(token, repository.fullName);
      respondJson(response, 200, { repository, branches });
    } catch (error) {
      const status = {
        INVALID_REPOSITORY: 400,
        GITEA_TOKEN_INVALID: 401,
        GITEA_TOKEN_FORBIDDEN: 403,
        GITEA_RESOURCE_NOT_FOUND: 404,
        GITEA_TOO_MANY_REPOSITORIES: 422,
        GITEA_TOO_MANY_BRANCHES: 422,
        GITEA_UNAVAILABLE: 502,
      }[error?.code];
      if (status) {
        respondJson(response, status, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not list Gitea repository branches:", error);
      respondJson(response, 503, { error: "No se pudieron consultar las ramas de Gitea." });
    }
    return;
  }

  if (request.method === "PATCH" && url.pathname === "/api/system/applications/gitea/default-branch") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).length !== 2
        || !Object.hasOwn(body, "repository") || !Object.hasOwn(body, "branch")) {
        respondJson(response, 400, { error: "Indica el repositorio y la rama predeterminada." });
        return;
      }
      const reference = validateRepositoryReference(body.repository);
      if (typeof body.branch !== "string" || body.branch.length < 1 || body.branch.length > 255
        || /[\u0000-\u001f\u007f]/.test(body.branch)) {
        respondJson(response, 400, { error: "Selecciona una rama válida de Gitea." });
        return;
      }
      const { client, token } = await getGiteaApiContext();
      const repositories = await client.listRepositories(token);
      const repository = repositories.find((item) => item.fullName === reference.fullName);
      if (!repository) {
        respondJson(response, 404, { error: "No se encontró el repositorio en la cuenta conectada." });
        return;
      }
      if (!repository.canAdmin) {
        respondJson(response, 403, { error: "El token no tiene permisos de administración para cambiar la rama predeterminada." });
        return;
      }
      const result = await client.setDefaultBranch(token, repository.fullName, body.branch);
      const audited = await recordAuditEventOrRespond(response, {
        action: "application.gitea.default_branch.updated",
        resourceType: "repository",
        resourceId: repository.fullName,
        details: { defaultBranch: result.defaultBranch },
      }, "El cambio de rama predeterminada");
      if (!audited) return;
      respondJson(response, 200, { repository: result });
    } catch (error) {
      const status = {
        INVALID_REPOSITORY: 400,
        INVALID_BRANCH: 400,
        GITEA_TOKEN_INVALID: 401,
        GITEA_TOKEN_FORBIDDEN: 403,
        GITEA_RESOURCE_NOT_FOUND: 404,
        GITEA_REQUEST_CONFLICT: 409,
        GITEA_BRANCH_NOT_FOUND: 409,
        GITEA_TOO_MANY_REPOSITORIES: 422,
        GITEA_TOO_MANY_BRANCHES: 422,
        GITEA_UNAVAILABLE: 502,
      }[error?.code];
      if (status) {
        respondJson(response, status, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not change Gitea repository default branch:", error);
      respondJson(response, 503, { error: "No se pudo cambiar la rama predeterminada de Gitea." });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/system/applications/gitea/webhooks") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).length !== 1 || !Object.hasOwn(body, "repository")) {
        respondJson(response, 400, { error: "Indica el repositorio para configurar el webhook." });
        return;
      }
      const reference = validateRepositoryReference(body.repository);
      const { client, token } = await getGiteaApiContext();
      const repositories = await client.listRepositories(token);
      const repository = repositories.find((item) => item.fullName === reference.fullName);
      if (!repository) {
        respondJson(response, 404, { error: "No se encontró el repositorio en la cuenta conectada." });
        return;
      }
      if (!repository.canAdmin) {
        respondJson(response, 403, { error: "El token no tiene permisos de administración para configurar webhooks." });
        return;
      }
      if (testMode || !isPublicHostname(managerDomain)) {
        respondJson(response, 409, { error: "Configura un dominio público para VPS Manager antes de crear webhooks." });
        return;
      }
      const endpoint = `https://${managerDomain}/api/webhooks/gitea`;
      const secret = deriveGiteaWebhookSecret(sessionKey, repository.fullName);
      const webhook = await client.configurePushWebhook(token, repository.fullName, endpoint, secret);
      const audited = await recordAuditEventOrRespond(response, {
        action: "application.gitea.webhook.configured",
        resourceType: "repository",
        resourceId: repository.fullName,
        details: { endpoint, events: webhook.events, updated: webhook.updated },
      }, "La configuración del webhook");
      if (!audited) return;
      respondJson(response, 200, {
        webhook: {
          url: webhook.url,
          active: webhook.active,
          events: webhook.events,
          updated: webhook.updated,
        },
      });
    } catch (error) {
      const status = {
        INVALID_REPOSITORY: 400,
        INVALID_WEBHOOK: 400,
        GITEA_TOKEN_INVALID: 401,
        GITEA_TOKEN_FORBIDDEN: 403,
        GITEA_RESOURCE_NOT_FOUND: 404,
        GITEA_REQUEST_CONFLICT: 409,
        GITEA_TOO_MANY_REPOSITORIES: 422,
        GITEA_TOO_MANY_WEBHOOKS: 422,
        GITEA_UNAVAILABLE: 502,
      }[error?.code];
      if (status) {
        respondJson(response, status, { error: error.message });
        return;
      }
      if (error instanceof RequestError) {
        respondJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Could not configure Gitea webhook:", error);
      respondJson(response, 503, { error: "No se pudo configurar el webhook de Gitea." });
    }
    return;
  }

  const postgresqlCredentialsMatch = request.method === "GET"
    && url.pathname.match(/^\/api\/system\/applications\/postgresql\/credentials\/([a-f0-9-]{36})$/i);
  if (postgresqlCredentialsMatch) {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    try {
      const taskId = postgresqlCredentialsMatch[1];
      const task = await getTaskById(taskId);
      if (task?.type !== "application.postgresql.install"
        || !["completed", "failed"].includes(task.status)
        || !await serviceOperationAgent.hasPostgresqlCredentials(taskId)) {
        respondJson(response, 409, { error: "Las credenciales solo están disponibles durante 30 minutos tras iniciar la instalación de PostgreSQL." });
        return;
      }
      const credentials = await serviceOperationAgent.consumePostgresqlCredentials(taskId);
      try {
        await recordAuditEvent({
          action: "application.postgresql.credentials.revealed",
          resourceType: "application",
          resourceId: "postgresql",
          details: { taskId },
        });
      } catch (error) {
        console.error("PostgreSQL credentials were revealed, but the audit event could not be saved:", error);
      }
      respondJson(response, 200, { credentials });
    } catch (error) {
      if (error?.code === "CREDENTIALS_UNAVAILABLE") {
        respondJson(response, 410, { error: error.message });
        return;
      }
      console.error("Could not retrieve one-time PostgreSQL credentials:", error);
      respondJson(response, 503, { error: "No se pudieron consultar las credenciales de un solo uso." });
    }
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

  if (url.pathname === "/api/applications") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method === "GET") {
      try {
        const [catalog, instances, nodes, projects] = await Promise.all([
          getApplicationCatalog(),
          getApplicationInstances(),
          dockerGet("/nodes"),
          getProjects(),
        ]);
        respondJson(response, 200, {
          catalog,
          instances,
          servers: nodes.map(mapSwarmNode),
          projects: await getProjectDeploymentState(projects),
        });
      } catch (error) {
        console.error("Application catalog request failed:", error);
        respondJson(response, 503, { error: "No se pudo consultar el catálogo de aplicaciones." });
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
      const input = validateManualApplicationInput(await readJson(request));
      const nodes = await dockerGet("/nodes");
      const node = nodes.find((item) => item.ID?.toLowerCase() === input.serverNodeId);
      if (!node || node.Status?.State !== "ready" || node.Spec?.Availability !== "active") {
        respondJson(response, 409, { error: "Selecciona un VPS activo y listo del Swarm." });
        return;
      }
      const reservedDomains = await getProjectDomains();
      if (reservedDomains.some((domain) => domain.hostname.toLowerCase() === input.domain)) {
        respondJson(response, 409, { error: "El dominio ya está asignado a otro proyecto." });
        return;
      }
      const instanceId = randomUUID();
      const taskId = randomUUID();
      const environment = [
        ...Object.entries(input.environmentValues).map(([name]) => ({
          name,
          label: name,
          description: "Variable no confidencial.",
          required: false,
          secret: false,
        })),
        ...Object.keys(input.secretValues).map((name) => ({
          name,
          label: name,
          description: "Secreto Swarm montado en /run/secrets.",
          required: false,
          secret: true,
        })),
      ];
      const application = { ...input, environment };
      const created = await createManualApplication({
        application,
        instance: {
          id: instanceId,
          serverNodeId: input.serverNodeId,
          serverHostname: node.Description?.Hostname ?? input.serverNodeId,
          domain: input.domain,
          environmentValues: input.environmentValues,
          secretValues: input.secretValues,
        },
      });
      try {
        await serviceOperationAgent.stageApplicationDeployment(taskId, {
          applicationId: input.id,
          instanceId,
          applicationName: input.name,
          image: input.image,
          port: input.port,
          domain: input.domain,
          serverNodeId: input.serverNodeId,
          volumeTarget: input.volumeTarget,
          environment: input.environmentValues,
          secrets: input.secretValues,
        });
        await createManualApplicationDeployTask({
          id: taskId,
          instanceId,
          applicationId: input.id,
          applicationName: input.name,
        });
      } catch (error) {
        await serviceOperationAgent.removeApplicationDeployment(taskId);
        await updateManualApplicationDeployment(instanceId, taskId, { status: "failed" });
        throw error;
      }
      respondJson(response, 202, {
        application: created.application,
        instance: created.instance,
        task: { id: taskId, status: "queued" },
      });
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError || error instanceof RequestError) {
        respondJson(response, error instanceof RequestError ? error.statusCode : 400, { error: error.message });
        return;
      }
      if (error?.code === "23505") {
        respondJson(response, 409, { error: "Ya existe una aplicación con ese identificador o el dominio ya está ocupado." });
        return;
      }
      if (error?.code === "OPERATION_IN_PROGRESS") {
        respondJson(response, 409, { error: error.message });
        return;
      }
      console.error("Could not create and deploy manual application:", error);
      respondJson(response, 503, { error: "No se pudo registrar o desplegar la aplicación." });
    }
    return;
  }

  if (url.pathname === "/api/applications/supabase/instances") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).sort().join(",") !== ["configuration", "name", "serverNodeId"].sort().join(",")
        || typeof body.serverNodeId !== "string"
        || !/^[a-z0-9]{25,64}$/i.test(body.serverNodeId)
        || typeof body.name !== "string"
        || body.name.trim().length < 1 || body.name.trim().length > 100
        || /[\u0000-\u001f\u007f]/.test(body.name)) {
        respondJson(response, 400, { error: "Completa un servidor Swarm y un nombre de instalación válidos." });
        return;
      }
      const configuration = validateSupabaseInstanceConfiguration(body.configuration);
      const nodes = await dockerGet("/nodes");
      const node = nodes.find((item) => item.ID?.toLowerCase() === body.serverNodeId.toLowerCase());
      if (!node || node.Status?.State !== "ready" || node.Spec?.Availability !== "active") {
        respondJson(response, 409, { error: "Selecciona un VPS activo y listo del Swarm." });
        return;
      }
      const [domains, registry] = await Promise.all([
        getProjectDomains(),
        serviceOperationAgent.getRegistryConfiguration(),
      ]);
      const reservedDomains = new Set([
        managerDomain,
        managerDomain ? `git.${managerDomain}` : "",
        registry?.domain ?? "",
        ...domains.map((domain) => domain.hostname),
      ].filter(Boolean).map((domain) => domain.toLowerCase()));
      const requestedDomains = [configuration.apiDomain, configuration.studioDomain];
      if (requestedDomains.some((domain) => reservedDomains.has(domain))
        || requestedDomains[0] === requestedDomains[1]) {
        respondJson(response, 409, { error: "Los dominios de API y Studio deben ser distintos y no estar reservados ni conectados en el panel." });
        return;
      }
      const instance = await saveApplicationInstanceConfiguration({
        applicationId: "supabase",
        serverNodeId: node.ID,
        serverHostname: node.Description?.Hostname ?? "desconocido",
        name: body.name.trim(),
        configuration,
      });
      respondJson(response, 200, {
        instance,
        message: `Se guardó la configuración de Supabase para ${instance.serverHostname}. Los secretos se generarán y entregarán al desplegar la instancia.`,
      });
    } catch (error) {
      if (error?.code === "23505" || error?.code === "APPLICATION_DOMAIN_CONFLICT") {
        respondJson(response, 409, { error: "Uno de los dominios ya está asignado a otra instancia Supabase." });
        return;
      }
      if (error instanceof TypeError || error instanceof RangeError) {
        respondJson(response, 400, { error: error.message });
        return;
      }
      console.error("Could not save Supabase configuration:", error);
      respondJson(response, 503, { error: "No se pudo guardar la configuración de Supabase." });
    }
    return;
  }

  if (url.pathname === "/api/nodes") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "GET") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "GET" });
      return;
    }
    try {
      const nodes = await dockerGet("/nodes");
      respondJson(response, 200, { nodes: nodes.map(mapSwarmNode) });
    } catch (error) {
      console.error("Swarm node status request failed:", error);
      respondJson(response, 503, { error: "No se pudo consultar el estado de los nodos Swarm." });
    }
    return;
  }

  if (url.pathname === "/api/nodes/enroll") {
    if (!hasSession(request)) {
      respondJson(response, 401, { error: "Sesión requerida." });
      return;
    }
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "Método no permitido." }, { Allow: "POST" });
      return;
    }
    if (!hasSameOrigin(request)) {
      respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
      return;
    }
    let taskId;
    try {
      const enrollment = validateSwarmNodeEnrollment(await readJson(request, 40_000));
      const dockerInfo = await dockerGet("/info");
      if (dockerInfo.Swarm?.LocalNodeState !== "active" || dockerInfo.Swarm?.ControlAvailable !== true) {
        respondJson(response, 409, { error: "Este VPS no está disponible como manager activo de Swarm." });
        return;
      }
      const currentNodes = await dockerGet("/nodes");
      if (currentNodes.some((node) => node.Status?.Addr === enrollment.address)) {
        respondJson(response, 409, { error: "Ya existe un nodo Swarm con esa IP. Retira manualmente el nodo anterior antes de volver a unirlo." });
        return;
      }
      taskId = randomUUID();
      await serviceOperationAgent.stageNodeCredentials(taskId, enrollment.privateKey);
      try {
        await createSwarmNodeEnrollTask({ id: taskId, ...enrollment });
      } catch (error) {
        await serviceOperationAgent.removeNodeCredentials(taskId);
        throw error;
      }
      respondJson(response, 202, {
        task: await getTaskById(taskId),
        message: "Alta solicitada. El VPS manager instalará Docker y añadirá reglas UFW para el tráfico Swarm de la CIDR privada indicada.",
      });
    } catch (error) {
      if (taskId) {
        await serviceOperationAgent.removeNodeCredentials(taskId).catch((cleanupError) => {
          console.error("Could not remove staged SSH credentials after node enrollment request failure:", cleanupError);
        });
      }
      const status = error?.code === "SWARM_NODE_ENROLLMENT_IN_PROGRESS" || error?.code === "OPERATION_IN_PROGRESS"
        ? 409
        : error instanceof TypeError || error instanceof RangeError ? 400 : 503;
      if (status === 503) {
        console.error("Could not request Swarm node enrollment:", error);
      }
      respondJson(response, status, {
        error: status === 503 ? "No se pudo iniciar el aprovisionamiento del nodo." : error.message,
      });
    }
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
      const containerOperationMatch = request.method === "POST"
        && url.pathname.match(/^\/api\/docker\/containers\/([a-f0-9]{12,64})\/(stop|restart)$/i);
      if (containerOperationMatch) {
        if (!hasSameOrigin(request)) {
          respondJson(response, 403, { error: "Origen de la solicitud no permitido." });
          return;
        }
        const [, requestedContainerId, requestedAction] = containerOperationMatch;
        const action = requestedAction.toLowerCase();
        const matchingContainers = (await dockerGet("/containers/json?all=1")).filter((container) =>
          typeof container.Id === "string" && container.Id.toLowerCase().startsWith(requestedContainerId.toLowerCase()));
        if (matchingContainers.length === 0) {
          respondJson(response, 404, { error: "No se encontró el contenedor solicitado." });
          return;
        }
        if (matchingContainers.length !== 1) {
          respondJson(response, 409, { error: "El identificador coincide con más de un contenedor." });
          return;
        }
        const [container] = matchingContainers;
        const serviceId = container.Labels?.["com.docker.swarm.service.id"];
        if (!serviceId || container.State !== "running") {
          respondJson(response, 409, {
            error: "Solo se pueden operar contenedores activos que pertenezcan a un servicio Swarm administrado.",
          });
          return;
        }
        let service;
        try {
          service = findManagedService(await dockerGet("/services"), serviceId);
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
        if (action === "stop" && service.Spec?.Labels?.["vps-manager.component"] === "api") {
          respondJson(response, 409, { error: "No se puede detener el contenedor del panel; puedes reiniciarlo." });
          return;
        }
        const taskId = randomUUID();
        const containerId = container.Id;
        const containerName = (container.Names?.[0] ?? "").replace(/^\//, "") || containerId.slice(0, 12);
        const serviceName = service.Spec?.Name ?? "unknown";
        try {
          await createContainerOperationTask({
            id: taskId,
            serviceId: service.ID,
            serviceName,
            containerId,
            containerName,
            action,
          });
        } catch (error) {
          console.error("Could not persist the container operation task:", error);
          respondJson(response, 503, { error: "No se pudo guardar la tarea; no se envió la operación al host." });
          return;
        }
        respondJson(response, 202, {
          operation: {
            id: taskId,
            state: "queued",
            serviceId: service.ID,
            containerId,
            message: action === "stop"
              ? `Solicitud aceptada; Swarm repondrá el contenedor ${containerName}.`
              : `Solicitud aceptada; reiniciando el contenedor ${containerName}.`,
          },
          serviceName,
          containerName,
        });
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
          unavailable: result.errors.map(({ id, name, group }) => ({ id, name, group })),
          host: result.host,
          runningContainerCount: result.runningContainerCount,
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/docker/services") {
        respondJson(response, 200, { services: await getServices() });
        return;
      }
      const restartServiceMatch = request.method === "POST"
        && url.pathname.match(/^\/api\/docker\/services\/([a-z0-9]{12,64})\/restart$/i);
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
        && url.pathname.match(/^\/api\/docker\/services\/([a-z0-9]{12,64})\/scale$/i);
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
        && matchDockerLogsPath(url.pathname);
      if (resourceLogsMatch) {
        const logs = await dockerGetText(
          `/${resourceLogsMatch.resource}/${resourceLogsMatch.id}/logs?stdout=1&stderr=1&tail=100&timestamps=1`,
          1024 * 1024,
        );
        respond(response, 200, logs, { "Content-Type": "text/plain; charset=utf-8" });
        return;
      }
      respondJson(response, 404, { error: "Ruta no encontrada." });
    } catch (error) {
      console.error("Docker read operation failed:", error);
      const isLogsRequest = request.method === "GET"
        && matchDockerLogsPath(url.pathname) !== null;
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
    void recoverCloudflareTunnel();
    const cloudflareTunnelRecoveryTimer = setInterval(() => {
      void recoverCloudflareTunnel();
    }, 60_000);
    cloudflareTunnelRecoveryTimer.unref();
    void reconcileProjectRoutes();
    const projectRouteRecoveryTimer = setInterval(() => {
      void reconcileProjectRoutes();
    }, 15_000);
    projectRouteRecoveryTimer.unref();
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
