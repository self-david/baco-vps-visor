import { randomUUID } from "node:crypto";
import { lstat, link, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateSwarmNodeRequest } from "./swarm-node-manager.mjs";

const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const serviceIdPattern = /^[a-z0-9]{25,64}$/i;
const containerIdPattern = /^[a-f0-9]{12,64}$/i;
const allowedOperations = new Set([
  "restart-service",
  "scale-service",
  "stop-container",
  "restart-container",
  "install-gitea",
  "install-n8n",
  "install-postgresql",
  "configure-gitea-token",
  "configure-registry",
  "build-project",
  "deploy-project",
  "remove-project",
  "deploy-application",
  "enroll-swarm-node",
]);
const activeStates = new Set(["queued", "running"]);
const statusStates = new Set(["running", "succeeded", "failed"]);
const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const registryUsernamePattern = /^[A-Za-z0-9._-]{1,64}$/;
const registryPasswordPattern = /^[A-Za-z0-9._-]{20,72}$/;
const applicationIdPattern = /^[a-z][a-z0-9-]{0,62}$/;

function safeProjectPath(value) {
  return typeof value === "string"
    && /^[A-Za-z0-9._/-]{1,255}$/.test(value)
    && !value.startsWith("/")
    && !value.split("/").some((part) => part === ".." || part === "");
}

function safeProjectCommand(value) {
  return typeof value === "string"
    && value.length <= 255
    && /^[A-Za-z0-9._:/@+-]+(?: [A-Za-z0-9._:/@+-]+)*$/.test(value);
}

export function isPublicHostname(hostname) {
  return typeof hostname === "string" && hostnamePattern.test(hostname)
    && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    && !/\.(?:localhost|local|internal|test|example|invalid|onion|home|lan)$/i.test(hostname);
}

export function findManagedService(services, requestedId) {
  if (typeof requestedId !== "string" || !/^[a-z0-9]{12,64}$/i.test(requestedId)) {
    throw new TypeError("A valid Docker Swarm service identifier is required.");
  }
  const normalizedId = requestedId.toLowerCase();
  const matches = services.filter((service) =>
    typeof service.ID === "string" && service.ID.toLowerCase().startsWith(normalizedId));
  if (matches.length === 0) {
    const error = new Error("No se encontró el servicio solicitado.");
    error.code = "SERVICE_NOT_FOUND";
    throw error;
  }
  if (matches.length !== 1) {
    const error = new Error("El identificador coincide con más de un servicio.");
    error.code = "SERVICE_ID_AMBIGUOUS";
    throw error;
  }
  if (matches[0].Spec?.Labels?.["vps-manager.managed"] !== "true") {
    const error = new Error("Solo se permite reiniciar servicios administrados por VPS Manager.");
    error.code = "SERVICE_NOT_MANAGED";
    throw error;
  }
  return matches[0];
}

export function validateServiceScale(service, replicas) {
  if (!Number.isInteger(replicas) || replicas < 1 || replicas > 100) {
    const error = new TypeError("El número de réplicas debe estar entre 1 y 100.");
    error.code = "INVALID_REPLICA_COUNT";
    throw error;
  }
  const replicatedMode = service?.Spec?.Mode?.Replicated;
  if (!replicatedMode || typeof replicatedMode !== "object") {
    const error = new Error("Solo se pueden escalar servicios Swarm en modo replicado.");
    error.code = "SERVICE_NOT_REPLICATED";
    throw error;
  }
  if (service.Spec.Labels?.["vps-manager.component"] === "api" && replicas !== 1) {
    const error = new Error("El servicio del panel debe conservar exactamente una réplica.");
    error.code = "PANEL_REPLICA_COUNT";
    throw error;
  }
  if (service.Spec.Labels?.["vps-manager.component"] === "gitea" && replicas !== 1) {
    const error = new Error("Gitea usa SQLite y debe conservar exactamente una réplica.");
    error.code = "APPLICATION_REPLICA_COUNT";
    throw error;
  }
  if (service.Spec.Labels?.["vps-manager.component"] === "n8n" && replicas !== 1) {
    const error = new Error("n8n usa SQLite y almacenamiento local; debe conservar exactamente una réplica.");
    error.code = "APPLICATION_REPLICA_COUNT";
    throw error;
  }
  if (service.Spec.Labels?.["vps-manager.component"] === "registry" && replicas !== 1) {
    const error = new Error("El registro privado conserva una sola réplica.");
    error.code = "APPLICATION_REPLICA_COUNT";
    throw error;
  }
  if (service.Spec.Labels?.["vps-manager.component"] === "project" && replicas !== 1) {
    const error = new Error("Los servicios de proyecto conservan una réplica hasta configurar persistencia y publicación.");
    error.code = "PROJECT_REPLICA_COUNT";
    throw error;
  }
  return Number.isInteger(replicatedMode.Replicas) ? replicatedMode.Replicas : 1;
}

function isMissing(error) {
  return error && typeof error === "object" && error.code === "ENOENT";
}

function validateStatus(status) {
  if (!status || typeof status !== "object"
    || !requestIdPattern.test(status.id ?? "")
    || !statusStates.has(status.state)
    || typeof status.updatedAt !== "string"
    || typeof status.message !== "string"
    || (status.operation !== undefined && !allowedOperations.has(status.operation))
    || (status.operation === "install-gitea"
      ? ((!isPublicHostname(status.domain) && status.domain !== "localhost")
        || typeof status.credentialsAvailable !== "boolean")
      : status.operation === "install-n8n"
        ? !isPublicHostname(status.domain)
      : status.operation === "install-postgresql"
        ? typeof status.credentialsAvailable !== "boolean"
      : status.operation === "configure-registry"
        ? (!isPublicHostname(status.domain) || !registryUsernamePattern.test(status.username ?? ""))
      : status.operation === "build-project"
        ? (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(status.projectId ?? "")
          || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(status.commitSha ?? "")
          || !["static", "dynamic", "build"].includes(status.deploymentType)
          || !["dockerfile", "railpack"].includes(status.buildStrategy)
          || (status.deploymentType === "static" && status.buildStrategy !== "dockerfile")
          || (status.deploymentType === "build" && status.buildStrategy !== "dockerfile")
          || !safeProjectPath(status.buildContext)
          || !safeProjectPath(status.dockerfilePath)
          || (status.buildCommand !== undefined && !safeProjectCommand(status.buildCommand))
          || (status.buildOutputDirectory !== undefined && !safeProjectPath(status.buildOutputDirectory))
          || (status.deploymentType === "build"
            && (!safeProjectCommand(status.buildCommand) || !safeProjectPath(status.buildOutputDirectory)))
          || (status.state === "succeeded" && typeof status.image !== "string"))
        : status.operation === "deploy-project"
          ? (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(status.projectId ?? "")
            || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(status.commitSha ?? "")
            || (status.state === "succeeded"
              && (!serviceIdPattern.test(status.serviceId ?? "") || typeof status.image !== "string")))
          : status.operation === "remove-project"
            ? !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(status.projectId ?? "")
            : status.operation === "deploy-application"
              ? (!applicationIdPattern.test(status.applicationId ?? "")
                || !requestIdPattern.test(status.instanceId ?? "")
                || (status.state === "succeeded" && !serviceIdPattern.test(status.serviceId ?? "")))
            : status.operation === "enroll-swarm-node"
              ? (() => {
                try {
                  validateSwarmNodeRequest({
                    address: status.nodeAddress,
                    sshUser: status.sshUser,
                    sshPort: status.sshPort,
                    hostFingerprint: status.hostFingerprint,
                    privateCidr: status.privateCidr,
                    managerAddress: status.managerAddress,
                    role: status.role,
                  });
                  return status.state === "succeeded" && !serviceIdPattern.test(status.nodeId ?? "");
                } catch {
                  return true;
                }
              })()
            : status.operation !== "configure-gitea-token" && !serviceIdPattern.test(status.serviceId ?? ""))
    || (status.operation === "scale-service"
      && (!Number.isInteger(status.replicas) || status.replicas < 1 || status.replicas > 100))
    || ((status.operation === "stop-container" || status.operation === "restart-container")
      && !containerIdPattern.test(status.containerId ?? ""))
    || (status.operation === "configure-registry"
      && Object.keys(status).sort().join(",")
        !== ["domain", "id", "message", "operation", "state", "updatedAt", "username"].sort().join(","))) {
    throw new Error("The service operation status file has an invalid format.");
  }
  return status;
}

export function createServiceOperationAgent({
  directory = process.env.SERVICE_OPERATIONS_DIRECTORY ?? "/var/lib/vps-manager/service-operations",
  giteaApiTokenPath = process.env.GITEA_API_TOKEN_FILE ?? "/run/secrets/gitea_api_token",
  createId = randomUUID,
} = {}) {
  const requestPath = join(directory, "request.json");
  const statusPath = join(directory, "status.json");
  const credentialsPath = (requestId) => join(directory, `gitea-credentials-${requestId}.json`);
  const postgresqlCredentialsPath = (requestId) => join(directory, `postgresql-credentials-${requestId}.json`);
  const projectBuildArchivePath = (requestId) => join(directory, `build-source-${requestId}.zip`);
  const applicationDeploymentPath = (requestId) => join(directory, `application-deploy-${requestId}.json`);
  const registryCredentialsPath = (requestId) => join(directory, `registry-credentials-${requestId}.json`);
  const nodeCredentialsPath = (requestId) => join(directory, `node-ssh-key-${requestId}`);
  const registryStatusPath = join(directory, "registry-status.json");

  async function readOptional(path) {
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile()) {
        throw new Error("The service operation state path must be a regular file.");
      }
      return await readFile(path, "utf8");
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  async function getStatus() {
    const [requestContents, statusContents] = await Promise.all([
      readOptional(requestPath),
      readOptional(statusPath),
    ]);
    let status;
    if (statusContents !== undefined) status = validateStatus(JSON.parse(statusContents));

    if (requestContents !== undefined) {
      let queuedRequest;
      try {
        queuedRequest = JSON.parse(requestContents);
      } catch {
        throw new Error("The service operation request file has an invalid format.");
      }
      const validCommonFields = Boolean(queuedRequest && typeof queuedRequest === "object"
        && !Array.isArray(queuedRequest)
        && requestIdPattern.test(queuedRequest.id ?? "")
        && allowedOperations.has(queuedRequest.operation)
        && (queuedRequest.operation === "install-gitea"
          ? isPublicHostname(queuedRequest.domain) || queuedRequest.domain === "localhost"
          : queuedRequest.operation === "install-n8n"
            ? isPublicHostname(queuedRequest.domain)
          : queuedRequest.operation === "install-postgresql"
            ? true
          : queuedRequest.operation === "configure-gitea-token"
            ? typeof queuedRequest.token === "string" && /^[A-Za-z0-9._-]{20,512}$/.test(queuedRequest.token)
            : queuedRequest.operation === "configure-registry"
              ? isPublicHostname(queuedRequest.domain) && registryUsernamePattern.test(queuedRequest.username ?? "")
            : queuedRequest.operation === "build-project"
              ? /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(queuedRequest.projectId ?? "")
                && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(queuedRequest.commitSha ?? "")
                && ["static", "dynamic", "build"].includes(queuedRequest.deploymentType)
                && ["dockerfile", "railpack"].includes(queuedRequest.buildStrategy)
                && !(queuedRequest.deploymentType === "static" && queuedRequest.buildStrategy !== "dockerfile")
                && !(queuedRequest.deploymentType === "build" && queuedRequest.buildStrategy !== "dockerfile")
                && safeProjectPath(queuedRequest.buildContext)
                && safeProjectPath(queuedRequest.dockerfilePath)
                && (queuedRequest.buildCommand === undefined || safeProjectCommand(queuedRequest.buildCommand))
                && (queuedRequest.buildOutputDirectory === undefined || safeProjectPath(queuedRequest.buildOutputDirectory))
                && (queuedRequest.deploymentType !== "build"
                  || (safeProjectCommand(queuedRequest.buildCommand)
                    && safeProjectPath(queuedRequest.buildOutputDirectory)))
              : queuedRequest.operation === "deploy-project"
                ? /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(queuedRequest.projectId ?? "")
                  && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(queuedRequest.commitSha ?? "")
                : queuedRequest.operation === "remove-project"
                  ? /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(queuedRequest.projectId ?? "")
                  : queuedRequest.operation === "deploy-application"
                    ? applicationIdPattern.test(queuedRequest.applicationId ?? "")
                      && requestIdPattern.test(queuedRequest.instanceId ?? "")
                  : queuedRequest.operation === "enroll-swarm-node"
                    ? (() => {
                      try {
                        validateSwarmNodeRequest({
                          address: queuedRequest.address,
                          sshUser: queuedRequest.sshUser,
                          sshPort: queuedRequest.sshPort,
                          hostFingerprint: queuedRequest.hostFingerprint,
                          privateCidr: queuedRequest.privateCidr,
                          managerAddress: queuedRequest.managerAddress,
                          role: queuedRequest.role,
                        });
                        return true;
                      } catch {
                        return false;
                      }
                    })()
                : serviceIdPattern.test(queuedRequest.serviceId ?? "")
                  && ((queuedRequest.operation !== "stop-container" && queuedRequest.operation !== "restart-container")
                    || containerIdPattern.test(queuedRequest.containerId ?? ""))));
      if (!validCommonFields) {
        throw new Error("The service operation request file has an invalid format.");
      }
      const validScaleRequest = queuedRequest.operation !== "scale-service"
        || (Number.isInteger(queuedRequest.replicas) && queuedRequest.replicas >= 1 && queuedRequest.replicas <= 100);
      const expectedFields = queuedRequest.operation === "install-gitea" || queuedRequest.operation === "install-n8n"
        ? ["id", "operation", "domain"]
        : queuedRequest.operation === "install-postgresql"
          ? ["id", "operation"]
        : queuedRequest.operation === "configure-gitea-token"
          ? ["id", "operation", "token"]
          : queuedRequest.operation === "configure-registry"
            ? ["id", "operation", "domain", "username"]
          : queuedRequest.operation === "build-project"
            ? [
              "id", "operation", "projectId", "commitSha", "deploymentType", "buildStrategy", "buildContext", "dockerfilePath",
              ...(queuedRequest.buildCommand === undefined && queuedRequest.buildOutputDirectory === undefined
                ? []
                : ["buildCommand", "buildOutputDirectory"]),
            ]
          : queuedRequest.operation === "deploy-project"
            ? ["id", "operation", "projectId", "commitSha"]
            : queuedRequest.operation === "remove-project"
              ? ["id", "operation", "projectId"]
              : queuedRequest.operation === "deploy-application"
                ? ["id", "operation", "applicationId", "instanceId"]
              : queuedRequest.operation === "enroll-swarm-node"
                ? ["id", "operation", "address", "sshUser", "sshPort", "hostFingerprint", "privateCidr", "managerAddress", "role"]
        : queuedRequest.operation === "scale-service"
        ? ["id", "operation", "serviceId", "replicas"]
        : queuedRequest.operation === "stop-container" || queuedRequest.operation === "restart-container"
          ? ["id", "operation", "serviceId", "containerId"]
        : ["id", "operation", "serviceId"];
      if (!validScaleRequest
        || Object.keys(queuedRequest).sort().join(",") !== expectedFields.sort().join(",")) {
        throw new Error("The service operation request file has an invalid format.");
      }
      if (queuedRequest.id !== status?.id) {
        return {
          id: queuedRequest.id,
          state: "queued",
          operation: queuedRequest.operation,
          ...(queuedRequest.operation === "install-gitea" || queuedRequest.operation === "install-n8n"
            ? { domain: queuedRequest.domain }
            : queuedRequest.operation === "install-postgresql"
              ? {}
            : queuedRequest.operation === "configure-gitea-token"
              ? {}
              : queuedRequest.operation === "configure-registry"
                ? { domain: queuedRequest.domain, username: queuedRequest.username }
              : queuedRequest.operation === "build-project"
                ? {
                  projectId: queuedRequest.projectId,
                  commitSha: queuedRequest.commitSha,
                  deploymentType: queuedRequest.deploymentType,
                  buildStrategy: queuedRequest.buildStrategy,
                  buildContext: queuedRequest.buildContext,
                  dockerfilePath: queuedRequest.dockerfilePath,
                  buildCommand: queuedRequest.buildCommand,
                  buildOutputDirectory: queuedRequest.buildOutputDirectory,
                }
                : queuedRequest.operation === "deploy-project"
                  ? { projectId: queuedRequest.projectId, commitSha: queuedRequest.commitSha }
                  : queuedRequest.operation === "remove-project"
                    ? { projectId: queuedRequest.projectId }
                    : queuedRequest.operation === "deploy-application"
                      ? { applicationId: queuedRequest.applicationId, instanceId: queuedRequest.instanceId }
                    : queuedRequest.operation === "enroll-swarm-node"
                      ? {
                        nodeAddress: queuedRequest.address,
                        sshUser: queuedRequest.sshUser,
                        sshPort: queuedRequest.sshPort,
                        hostFingerprint: queuedRequest.hostFingerprint,
                        privateCidr: queuedRequest.privateCidr,
                        managerAddress: queuedRequest.managerAddress,
                        role: queuedRequest.role,
                      }
              : { serviceId: queuedRequest.serviceId }),
          replicas: queuedRequest.replicas,
          ...(queuedRequest.containerId ? { containerId: queuedRequest.containerId } : {}),
          message: queuedRequest.operation === "install-gitea"
            ? `Instalación de Gitea aceptada para ${queuedRequest.domain}; esperando al agente del VPS.`
            : queuedRequest.operation === "install-n8n"
              ? `Instalación de n8n aceptada para ${queuedRequest.domain}; esperando al agente del VPS.`
            : queuedRequest.operation === "install-postgresql"
              ? "Instalación de PostgreSQL aceptada; esperando al agente del VPS."
            : queuedRequest.operation === "configure-gitea-token"
              ? "Configuración del token de Gitea aceptada; esperando al agente del VPS."
              : queuedRequest.operation === "configure-registry"
                ? `Configuración del registro aceptada para ${queuedRequest.domain}; esperando al agente del VPS.`
              : queuedRequest.operation === "build-project"
                ? "Construcción aceptada; esperando al agente BuildKit del VPS."
                : queuedRequest.operation === "deploy-project"
                  ? "Despliegue aceptado; esperando al agente Swarm del VPS."
                  : queuedRequest.operation === "remove-project"
                    ? "Retiro aceptado; esperando al agente Swarm del VPS."
                    : queuedRequest.operation === "deploy-application"
                      ? `Despliegue de ${queuedRequest.applicationId} aceptado; esperando al agente del VPS.`
                    : queuedRequest.operation === "enroll-swarm-node"
                      ? `Alta de nodo ${queuedRequest.address} aceptada; esperando al agente host.`
            : queuedRequest.operation === "stop-container"
              ? "Solicitud aceptada; Swarm repondrá el contenedor detenido."
            : queuedRequest.operation === "restart-container"
              ? "Solicitud aceptada; reiniciando el contenedor."
            : queuedRequest.operation === "scale-service"
            ? "Solicitud aceptada; esperando que el agente del VPS escale el servicio."
            : "Solicitud aceptada; esperando que el agente del VPS reinicie el servicio.",
        };
      }
    }
    return status ?? null;
  }

  async function requestOperation(operation, serviceId, requestId, replicas, containerId) {
    if (!allowedOperations.has(operation)) {
      throw new TypeError("The service operation is not allowed.");
    }
    if (typeof serviceId !== "string" || !serviceIdPattern.test(serviceId)) {
      throw new TypeError("A full Docker Swarm service identifier is required.");
    }
    if (!requestIdPattern.test(requestId)) {
      throw new Error("The service operation request identifier is invalid.");
    }
    if (operation === "scale-service" && (!Number.isInteger(replicas) || replicas < 1 || replicas > 100)) {
      throw new TypeError("The desired replica count must be between 1 and 100.");
    }
    if (operation === "restart-service" && replicas !== undefined) {
      throw new TypeError("The restart operation does not accept a replica count.");
    }
    const containerOperation = operation === "stop-container" || operation === "restart-container";
    if (containerOperation !== (containerId !== undefined)
      || (containerOperation && !containerIdPattern.test(containerId))) {
      throw new TypeError("A valid Docker container identifier is required for container operations.");
    }
    const currentStatus = await getStatus();
    if (currentStatus?.id === requestId) {
      if (currentStatus.serviceId !== serviceId
        || (currentStatus.operation && currentStatus.operation !== operation)
        || (operation === "scale-service" && currentStatus.replicas !== replicas)
        || (containerOperation && currentStatus.containerId !== containerId)) {
        throw new Error("The task identifier already belongs to a different service operation.");
      }
      return currentStatus;
    }
    if (activeStates.has(currentStatus?.state)) {
      const error = new Error("Ya hay una operación de servicio en curso.");
      error.code = "OPERATION_IN_PROGRESS";
      throw error;
    }

    const requestData = { id: requestId, operation, serviceId };
    if (operation === "scale-service") {
      requestData.replicas = replicas;
    }
    if (containerOperation) {
      requestData.containerId = containerId;
    }
    const request = JSON.stringify(requestData);
    const temporaryPath = join(directory, `.request-${requestId}.tmp`);
    try {
      await writeFile(temporaryPath, `${request}\n`, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, requestPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        const conflict = new Error("Ya hay una operación de servicio en curso.");
        conflict.code = "OPERATION_IN_PROGRESS";
        throw conflict;
      }
      throw error;
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }

    return {
      id: requestId,
      state: "queued",
      serviceId,
      operation,
      replicas,
      ...(containerOperation ? { containerId } : {}),
      message: operation === "scale-service"
        ? "Solicitud aceptada; el escalado comenzará en el VPS."
        : operation === "stop-container"
          ? "Solicitud aceptada; Swarm repondrá el contenedor detenido."
          : operation === "restart-container"
            ? "Solicitud aceptada; reiniciando el contenedor."
            : "Solicitud aceptada; el reinicio comenzará en el VPS.",
    };
  }

  async function requestApplicationInstall(operation, domain, requestId, displayName) {
    if (!isPublicHostname(domain) && !(operation === "install-gitea" && domain === "localhost")) {
      throw new TypeError(`El dominio de ${displayName} debe ser un hostname público válido.`);
    }
    if (!requestIdPattern.test(requestId)) {
      throw new Error("The service operation request identifier is invalid.");
    }
    const currentStatus = await getStatus();
    if (currentStatus?.id === requestId) {
      if (currentStatus.operation !== operation || currentStatus.domain !== domain) {
        throw new Error("The task identifier already belongs to a different application operation.");
      }
      return currentStatus;
    }
    if (activeStates.has(currentStatus?.state)) {
      const error = new Error("Ya hay una operación de servicio en curso.");
      error.code = "OPERATION_IN_PROGRESS";
      throw error;
    }
    const temporaryPath = join(directory, `.request-${requestId}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify({
        id: requestId,
        operation,
        domain,
      })}\n`, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, requestPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        const conflict = new Error("Ya hay una operación de servicio en curso.");
        conflict.code = "OPERATION_IN_PROGRESS";
        throw conflict;
      }
      throw error;
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }

    return {
      id: requestId,
      state: "queued",
      operation,
      domain,
      message: `Instalación de ${displayName} aceptada para ${domain}; el agente del VPS iniciará el servicio.`,
    };
  }

  async function requestGiteaInstall(domain, requestId = createId()) {
    return requestApplicationInstall("install-gitea", domain, requestId, "Gitea");
  }

  async function requestN8nInstall(domain, requestId = createId()) {
    return requestApplicationInstall("install-n8n", domain, requestId, "n8n");
  }

  async function requestPostgresqlInstall(requestId = createId()) {
    if (!requestIdPattern.test(requestId)) {
      throw new Error("The service operation request identifier is invalid.");
    }
    const currentStatus = await getStatus();
    if (currentStatus?.id === requestId) {
      if (currentStatus.operation !== "install-postgresql") {
        throw new Error("The task identifier already belongs to a different PostgreSQL operation.");
      }
      return currentStatus;
    }
    if (activeStates.has(currentStatus?.state)) {
      const error = new Error("Ya hay una operación de servicio en curso.");
      error.code = "OPERATION_IN_PROGRESS";
      throw error;
    }
    const temporaryPath = join(directory, `.request-${requestId}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify({
        id: requestId,
        operation: "install-postgresql",
      })}\n`, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, requestPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        const conflict = new Error("Ya hay una operación de servicio en curso.");
        conflict.code = "OPERATION_IN_PROGRESS";
        throw conflict;
      }
      throw error;
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
    return {
      id: requestId,
      state: "queued",
      operation: "install-postgresql",
      message: "Instalación de PostgreSQL aceptada; el agente del VPS iniciará el servicio.",
    };
  }

  async function requestGiteaApiToken(token, requestId = createId()) {
    if (typeof token !== "string" || !/^[A-Za-z0-9._-]{20,512}$/.test(token)) {
      throw new TypeError("El token de Gitea debe contener entre 20 y 512 caracteres válidos.");
    }
    if (!requestIdPattern.test(requestId)) {
      throw new Error("The service operation request identifier is invalid.");
    }
    const currentStatus = await getStatus();
    if (activeStates.has(currentStatus?.state)) {
      const error = new Error("Ya hay una operación de servicio en curso.");
      error.code = "OPERATION_IN_PROGRESS";
      throw error;
    }
    const temporaryPath = join(directory, `.request-${requestId}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify({
        id: requestId,
        operation: "configure-gitea-token",
        token,
      })}\n`, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, requestPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        const conflict = new Error("Ya hay una operación de servicio en curso.");
        conflict.code = "OPERATION_IN_PROGRESS";
        throw conflict;
      }
      throw error;
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
    return {
      id: requestId,
      state: "queued",
      operation: "configure-gitea-token",
      message: "Configuración del token de Gitea aceptada; el agente del VPS iniciará el cambio.",
    };
  }

  async function stageProjectBuildArchive(requestId, archive) {
    if (!requestIdPattern.test(requestId ?? "")
      || !Buffer.isBuffer(archive)
      || archive.length < 4
      || archive.length > 32 * 1024 * 1024
      || archive[0] !== 0x50
      || archive[1] !== 0x4b) {
      throw new TypeError("The project build archive is invalid.");
    }
    await writeFile(projectBuildArchivePath(requestId), archive, { flag: "wx", mode: 0o600 });
  }

  async function removeProjectBuildArchive(requestId) {
    if (!requestIdPattern.test(requestId ?? "")) {
      throw new TypeError("The project build request identifier is invalid.");
    }
    await unlink(projectBuildArchivePath(requestId)).catch((error) => {
      if (!isMissing(error)) throw error;
    });
  }

  async function requestProjectBuild(projectId, commitSha, requestId, configuration = {}) {
    const deploymentType = configuration.deploymentType ?? "dynamic";
    const buildStrategy = configuration.buildStrategy ?? "dockerfile";
    const buildContext = configuration.buildContext ?? ".";
    const dockerfilePath = configuration.dockerfilePath ?? "Dockerfile";
    const buildCommand = configuration.buildCommand ?? "npm run build";
    const buildOutputDirectory = configuration.buildOutputDirectory ?? "dist";
    if (!requestIdPattern.test(requestId ?? "")
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(projectId ?? "")
      || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha ?? "")
      || !["static", "dynamic", "build"].includes(deploymentType)
      || !["dockerfile", "railpack"].includes(buildStrategy)
      || (deploymentType === "static" && buildStrategy !== "dockerfile")
      || (deploymentType === "build" && (buildStrategy !== "dockerfile"
        || !safeProjectCommand(buildCommand)
        || !safeProjectPath(buildOutputDirectory)))
      || !safeProjectPath(buildContext)
      || !safeProjectPath(dockerfilePath)) {
      throw new TypeError("Project build request fields are invalid.");
    }
    const currentStatus = await getStatus();
    if (currentStatus?.id === requestId) {
      if (currentStatus.operation !== "build-project"
        || currentStatus.projectId !== projectId
        || currentStatus.commitSha !== commitSha
        || currentStatus.deploymentType !== deploymentType
        || currentStatus.buildStrategy !== buildStrategy
        || currentStatus.buildContext !== buildContext
        || currentStatus.dockerfilePath !== dockerfilePath
        || (currentStatus.buildCommand !== undefined && currentStatus.buildCommand !== buildCommand)
        || (currentStatus.buildOutputDirectory !== undefined && currentStatus.buildOutputDirectory !== buildOutputDirectory)
        || (deploymentType === "build"
          && (currentStatus.buildCommand !== buildCommand || currentStatus.buildOutputDirectory !== buildOutputDirectory))) {
        throw new Error("The task identifier already belongs to a different project build.");
      }
      return currentStatus;
    }
    if (activeStates.has(currentStatus?.state)) {
      const error = new Error("Ya hay una operación de servicio en curso.");
      error.code = "OPERATION_IN_PROGRESS";
      throw error;
    }

    const requestData = {
      id: requestId,
      operation: "build-project",
      projectId,
      commitSha: commitSha.toLowerCase(),
      deploymentType,
      buildStrategy,
      buildContext,
      dockerfilePath,
      buildCommand,
      buildOutputDirectory,
    };
    const temporaryPath = join(directory, `.request-${requestId}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify(requestData)}\n`, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, requestPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        const conflict = new Error("Ya hay una operación de servicio en curso.");
        conflict.code = "OPERATION_IN_PROGRESS";
        throw conflict;
      }
      throw error;
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
    return {
      id: requestId,
      operation: "build-project",
      state: "queued",
      projectId,
      commitSha: commitSha.toLowerCase(),
      deploymentType,
      buildStrategy,
      buildContext,
      dockerfilePath,
      buildCommand,
      buildOutputDirectory,
      message: "Construcción aceptada; esperando al agente BuildKit del VPS.",
    };
  }

  async function requestProjectServiceOperation(operation, projectId, commitSha, requestId) {
    const validProjectId = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
    if (!["deploy-project", "remove-project"].includes(operation)
      || !validProjectId.test(projectId ?? "")
      || (operation === "deploy-project" && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha ?? ""))
      || (operation === "remove-project" && commitSha !== undefined)
      || !requestIdPattern.test(requestId ?? "")) {
      throw new TypeError("Project service operation fields are invalid.");
    }
    const currentStatus = await getStatus();
    if (currentStatus?.id === requestId) {
      if (currentStatus.operation !== operation
        || currentStatus.projectId !== projectId
        || (operation === "deploy-project" && currentStatus.commitSha !== commitSha)) {
        throw new Error("The task identifier already belongs to a different project operation.");
      }
      return currentStatus;
    }
    if (activeStates.has(currentStatus?.state)) {
      const error = new Error("Ya hay una operación de servicio en curso.");
      error.code = "OPERATION_IN_PROGRESS";
      throw error;
    }
    const requestData = { id: requestId, operation, projectId };
    if (operation === "deploy-project") requestData.commitSha = commitSha.toLowerCase();
    const temporaryPath = join(directory, `.request-${requestId}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify(requestData)}\n`, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, requestPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        const conflict = new Error("Ya hay una operación de servicio en curso.");
        conflict.code = "OPERATION_IN_PROGRESS";
        throw conflict;
      }
      throw error;
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
    return {
      id: requestId,
      operation,
      state: "queued",
      projectId,
      ...(operation === "deploy-project" ? { commitSha: commitSha.toLowerCase() } : {}),
      message: operation === "deploy-project"
        ? "Despliegue aceptado; el servicio se mantendrá sin puertos publicados."
        : "Retiro aceptado; el agente validará la propiedad del servicio.",
    };
  }

  async function stageApplicationDeployment(requestId, configuration) {
    if (!requestIdPattern.test(requestId ?? "")
      || !configuration || typeof configuration !== "object" || Array.isArray(configuration)
      || !applicationIdPattern.test(configuration.applicationId ?? "")
      || !requestIdPattern.test(configuration.instanceId ?? "")) {
      throw new TypeError("The manual application deployment configuration is invalid.");
    }
    const staged = { ...configuration, taskId: requestId };
    const serialized = `${JSON.stringify(staged)}\n`;
    if (Buffer.byteLength(serialized) > 80_000) {
      throw new TypeError("The manual application deployment configuration is too large.");
    }
    await writeFile(applicationDeploymentPath(requestId), serialized, { flag: "wx", mode: 0o600 });
  }

  async function removeApplicationDeployment(requestId) {
    if (!requestIdPattern.test(requestId ?? "")) {
      throw new TypeError("The application deployment request identifier is invalid.");
    }
    await unlink(applicationDeploymentPath(requestId)).catch((error) => {
      if (!isMissing(error)) throw error;
    });
  }

  async function requestApplicationDeploy(applicationId, instanceId, requestId) {
    if (!applicationIdPattern.test(applicationId ?? "")
      || !requestIdPattern.test(instanceId ?? "")
      || !requestIdPattern.test(requestId ?? "")) {
      throw new TypeError("Manual application deployment request fields are invalid.");
    }
    const currentStatus = await getStatus();
    if (currentStatus?.id === requestId) {
      if (currentStatus.operation !== "deploy-application"
        || currentStatus.applicationId !== applicationId
        || currentStatus.instanceId !== instanceId) {
        throw new Error("The task identifier already belongs to a different application deployment.");
      }
      return currentStatus;
    }
    if (activeStates.has(currentStatus?.state)) {
      const error = new Error("Ya hay una operación de servicio en curso.");
      error.code = "OPERATION_IN_PROGRESS";
      throw error;
    }
    const requestData = { id: requestId, operation: "deploy-application", applicationId, instanceId };
    const temporaryPath = join(directory, `.request-${requestId}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify(requestData)}\n`, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, requestPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        const conflict = new Error("Ya hay una operación de servicio en curso.");
        conflict.code = "OPERATION_IN_PROGRESS";
        throw conflict;
      }
      throw error;
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
    return {
      id: requestId,
      operation: "deploy-application",
      state: "queued",
      applicationId,
      instanceId,
      message: `Despliegue de ${applicationId} aceptado; esperando al agente del VPS.`,
    };
  }

  async function stageNodeCredentials(requestId, privateKey) {
    if (!requestIdPattern.test(requestId ?? "")
      || typeof privateKey !== "string"
      || Buffer.byteLength(privateKey) > 32_768
      || !/-----BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY-----/.test(privateKey)
      || /[\u0000]/.test(privateKey)) {
      throw new TypeError("The SSH private key is invalid.");
    }
    await writeFile(nodeCredentialsPath(requestId), privateKey, { flag: "wx", mode: 0o600 });
  }

  async function removeNodeCredentials(requestId) {
    if (!requestIdPattern.test(requestId ?? "")) {
      throw new TypeError("The node enrollment request identifier is invalid.");
    }
    await unlink(nodeCredentialsPath(requestId)).catch((error) => {
      if (!isMissing(error)) throw error;
    });
  }

  async function requestSwarmNodeEnrollment(input, requestId) {
    if (!requestIdPattern.test(requestId ?? "")) {
      throw new TypeError("The node enrollment request identifier is invalid.");
    }
    const node = validateSwarmNodeRequest(input);
    const keyMetadata = await lstat(nodeCredentialsPath(requestId));
    if (!keyMetadata.isFile() || (process.platform !== "win32" && (keyMetadata.mode & 0o077) !== 0)) {
      throw new Error("The staged SSH private key has unsafe permissions.");
    }
    const currentStatus = await getStatus();
    if (currentStatus?.id === requestId) {
      if (currentStatus.operation !== "enroll-swarm-node"
        || currentStatus.nodeAddress !== node.address
        || currentStatus.role !== node.role) {
        throw new Error("The task identifier already belongs to a different Swarm node enrollment.");
      }
      return currentStatus;
    }
    if (activeStates.has(currentStatus?.state)) {
      const error = new Error("Ya hay una operación de servicio en curso.");
      error.code = "OPERATION_IN_PROGRESS";
      throw error;
    }
    const requestData = { id: requestId, operation: "enroll-swarm-node", ...node };
    const temporaryPath = join(directory, `.request-${requestId}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify(requestData)}\n`, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, requestPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        const conflict = new Error("Ya hay una operación de servicio en curso.");
        conflict.code = "OPERATION_IN_PROGRESS";
        throw conflict;
      }
      throw error;
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
    return {
      id: requestId,
      operation: "enroll-swarm-node",
      state: "queued",
      nodeAddress: node.address,
      role: node.role,
      message: `Alta de ${node.address} aceptada; el agente host iniciará el aprovisionamiento.`,
    };
  }

  async function getRegistryConfiguration() {
    const contents = await readOptional(registryStatusPath);
    if (contents === undefined) return null;
    let configuration;
    try {
      configuration = JSON.parse(contents);
    } catch {
      throw new Error("The registry configuration status file has an invalid format.");
    }
    if (!configuration || typeof configuration !== "object"
      || !isPublicHostname(configuration.domain)
      || !registryUsernamePattern.test(configuration.username ?? "")
      || Object.keys(configuration).sort().join(",") !== ["domain", "username"].sort().join(",")) {
      throw new Error("The registry configuration status file has an invalid format.");
    }
    return { domain: configuration.domain, username: configuration.username };
  }

  async function stageRegistryCredentials(requestId, { domain, username, password } = {}) {
    if (!requestIdPattern.test(requestId ?? "")
      || !isPublicHostname(domain)
      || !registryUsernamePattern.test(username ?? "")
      || !registryPasswordPattern.test(password ?? "")) {
      throw new TypeError("The private registry configuration fields are invalid.");
    }
    await writeFile(registryCredentialsPath(requestId), `${JSON.stringify({
      requestId,
      domain,
      username,
      password,
    })}\n`, { flag: "wx", mode: 0o600 });
  }

  async function removeRegistryCredentials(requestId) {
    if (!requestIdPattern.test(requestId ?? "")) {
      throw new TypeError("The registry configuration request identifier is invalid.");
    }
    await unlink(registryCredentialsPath(requestId)).catch((error) => {
      if (!isMissing(error)) throw error;
    });
  }

  async function requestRegistryConfiguration(domain, username, requestId) {
    if (!requestIdPattern.test(requestId ?? "")
      || !isPublicHostname(domain)
      || !registryUsernamePattern.test(username ?? "")) {
      throw new TypeError("The private registry configuration fields are invalid.");
    }
    const currentStatus = await getStatus();
    if (currentStatus?.id === requestId) {
      if (currentStatus.operation !== "configure-registry"
        || currentStatus.domain !== domain
        || currentStatus.username !== username) {
        throw new Error("The task identifier already belongs to a different registry configuration.");
      }
      return currentStatus;
    }
    if (activeStates.has(currentStatus?.state)) {
      const error = new Error("Ya hay una operación de servicio en curso.");
      error.code = "OPERATION_IN_PROGRESS";
      throw error;
    }

    const requestData = { id: requestId, operation: "configure-registry", domain, username };
    const temporaryPath = join(directory, `.request-${requestId}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify(requestData)}\n`, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, requestPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        const conflict = new Error("Ya hay una operación de servicio en curso.");
        conflict.code = "OPERATION_IN_PROGRESS";
        throw conflict;
      }
      throw error;
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
    return {
      id: requestId,
      operation: "configure-registry",
      state: "queued",
      domain,
      username,
      message: `Configuración del registro aceptada para ${domain}; el agente del VPS iniciará el cambio.`,
    };
  }

  async function hasGiteaApiToken() {
    try {
      const metadata = await stat(giteaApiTokenPath);
      if (!metadata.isFile()) throw new Error("The Gitea API token secret must be a regular file.");
      const token = await readFile(giteaApiTokenPath, "utf8");
      if (token === "NOT_CONFIGURED") return false;
      if (!/^[A-Za-z0-9._-]{20,512}$/.test(token)) {
        throw new Error("The Gitea API token secret has an invalid format.");
      }
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async function hasGiteaCredentials(requestId) {
    if (!requestIdPattern.test(requestId ?? "")) return false;
    const path = credentialsPath(requestId);
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile()) throw new Error("The Gitea credential state path must be a regular file.");
      if (Date.now() - metadata.mtimeMs > 30 * 60 * 1000) {
        await unlink(path);
        return false;
      }
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async function consumeGiteaCredentials(requestId) {
    if (!requestIdPattern.test(requestId ?? "")) {
      throw new TypeError("A valid Gitea installation task identifier is required.");
    }
    const path = credentialsPath(requestId);
    const claimedPath = `${path}.claimed-${createId()}`;
    try {
      await rename(path, claimedPath);
    } catch (error) {
      if (isMissing(error)) {
        const expired = new Error("Las credenciales de un solo uso ya fueron consultadas o expiraron.");
        expired.code = "CREDENTIALS_UNAVAILABLE";
        throw expired;
      }
      throw error;
    }

    try {
      const metadata = await lstat(claimedPath);
      if (!metadata.isFile() || Date.now() - metadata.mtimeMs > 30 * 60 * 1000) {
        const expired = new Error("Las credenciales de un solo uso expiraron.");
        expired.code = "CREDENTIALS_UNAVAILABLE";
        throw expired;
      }
      const credentials = JSON.parse(await readFile(claimedPath, "utf8"));
      if (credentials?.taskId !== requestId
        || credentials.username !== "vpsadmin"
        || typeof credentials.password !== "string"
        || !/^[a-f0-9]{64}$/.test(credentials.password)
        || (!isPublicHostname(credentials.domain) && credentials.domain !== "localhost")) {
        throw new Error("The Gitea credential file has an invalid format.");
      }
      return {
        username: credentials.username,
        password: credentials.password,
        url: credentials.domain === "localhost" ? "http://localhost:3001/gitea/" : `https://${credentials.domain}/`,
        sshCommand: credentials.domain === "localhost"
          ? "ssh -L 3001:127.0.0.1:80 usuario@IP_DEL_VPS; abre http://localhost:3001/gitea/"
          : `ssh -p 2222 git@${credentials.domain}`,
      };
    } finally {
      await unlink(claimedPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
  }

  async function hasPostgresqlCredentials(requestId) {
    if (!requestIdPattern.test(requestId ?? "")) return false;
    const path = postgresqlCredentialsPath(requestId);
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile()) throw new Error("The PostgreSQL credential state path must be a regular file.");
      if (Date.now() - metadata.mtimeMs > 30 * 60 * 1000) {
        await unlink(path);
        return false;
      }
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async function consumePostgresqlCredentials(requestId) {
    if (!requestIdPattern.test(requestId ?? "")) {
      throw new TypeError("A valid PostgreSQL installation task identifier is required.");
    }
    const path = postgresqlCredentialsPath(requestId);
    const claimedPath = `${path}.claimed-${createId()}`;
    try {
      await rename(path, claimedPath);
    } catch (error) {
      if (isMissing(error)) {
        const expired = new Error("Las credenciales de un solo uso ya fueron consultadas o expiraron.");
        expired.code = "CREDENTIALS_UNAVAILABLE";
        throw expired;
      }
      throw error;
    }
    try {
      const metadata = await lstat(claimedPath);
      if (!metadata.isFile() || Date.now() - metadata.mtimeMs > 30 * 60 * 1000) {
        const expired = new Error("Las credenciales de un solo uso expiraron.");
        expired.code = "CREDENTIALS_UNAVAILABLE";
        throw expired;
      }
      const credentials = JSON.parse(await readFile(claimedPath, "utf8"));
      if (credentials?.taskId !== requestId
        || credentials.username !== "vps_manager_app"
        || credentials.database !== "vps_manager_app"
        || typeof credentials.password !== "string"
        || !/^[a-f0-9]{64}$/.test(credentials.password)) {
        throw new Error("The PostgreSQL credential file has an invalid format.");
      }
      return {
        host: "vps-manager-postgresql",
        port: 5432,
        database: credentials.database,
        username: credentials.username,
        password: credentials.password,
      };
    } finally {
      await unlink(claimedPath).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
  }

  return {
    getStatus,
    hasGiteaCredentials,
    consumeGiteaCredentials,
    hasPostgresqlCredentials,
    consumePostgresqlCredentials,
    requestRestart: (serviceId, requestId = createId()) =>
      requestOperation("restart-service", serviceId, requestId),
    requestContainerOperation: (operation, serviceId, containerId, requestId = createId()) =>
      requestOperation(operation, serviceId, requestId, undefined, containerId),
    requestScale: (serviceId, replicas, requestId = createId()) =>
      requestOperation("scale-service", serviceId, requestId, replicas),
    requestGiteaInstall,
    requestN8nInstall,
    requestPostgresqlInstall,
    requestGiteaApiToken,
    requestProjectBuild,
    requestProjectDeploy: (projectId, commitSha, requestId = createId()) =>
      requestProjectServiceOperation("deploy-project", projectId, commitSha, requestId),
    stageApplicationDeployment,
    removeApplicationDeployment,
    requestApplicationDeploy,
    requestProjectUndeploy: (projectId, requestId = createId()) =>
      requestProjectServiceOperation("remove-project", projectId, undefined, requestId),
    stageNodeCredentials,
    removeNodeCredentials,
    requestSwarmNodeEnrollment,
    stageProjectBuildArchive,
    removeProjectBuildArchive,
    getRegistryConfiguration,
    stageRegistryCredentials,
    removeRegistryCredentials,
    requestRegistryConfiguration,
    hasGiteaApiToken,
  };
}
