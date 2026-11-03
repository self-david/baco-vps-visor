import { randomUUID } from "node:crypto";
import { lstat, link, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const serviceIdPattern = /^[a-f0-9]{25,64}$/i;
const allowedOperations = new Set(["restart-service", "scale-service"]);
const activeStates = new Set(["queued", "running"]);
const statusStates = new Set(["running", "succeeded", "failed"]);

export function findManagedService(services, requestedId) {
  if (typeof requestedId !== "string" || !/^[a-f0-9]{12,64}$/i.test(requestedId)) {
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
  return Number.isInteger(replicatedMode.Replicas) ? replicatedMode.Replicas : 1;
}

function isMissing(error) {
  return error && typeof error === "object" && error.code === "ENOENT";
}

function validateStatus(status) {
  if (!status || typeof status !== "object"
    || !requestIdPattern.test(status.id ?? "")
    || !serviceIdPattern.test(status.serviceId ?? "")
    || !statusStates.has(status.state)
    || typeof status.updatedAt !== "string"
    || typeof status.message !== "string"
    || (status.operation !== undefined && !allowedOperations.has(status.operation))
    || (status.operation === "scale-service"
      && (!Number.isInteger(status.replicas) || status.replicas < 1 || status.replicas > 100))) {
    throw new Error("The service operation status file has an invalid format.");
  }
  return status;
}

export function createServiceOperationAgent({
  directory = process.env.SERVICE_OPERATIONS_DIRECTORY ?? "/var/lib/vps-manager/service-operations",
  createId = randomUUID,
} = {}) {
  const requestPath = join(directory, "request.json");
  const statusPath = join(directory, "status.json");

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
        && serviceIdPattern.test(queuedRequest.serviceId ?? ""));
      if (!validCommonFields) {
        throw new Error("The service operation request file has an invalid format.");
      }
      const validScaleRequest = queuedRequest.operation !== "scale-service"
        || (Number.isInteger(queuedRequest.replicas) && queuedRequest.replicas >= 1 && queuedRequest.replicas <= 100);
      const expectedFields = queuedRequest.operation === "scale-service"
        ? ["id", "operation", "serviceId", "replicas"]
        : ["id", "operation", "serviceId"];
      if (!validScaleRequest
        || Object.keys(queuedRequest).sort().join(",") !== expectedFields.sort().join(",")) {
        throw new Error("The service operation request file has an invalid format.");
      }
      if (queuedRequest.id !== status?.id) {
        return {
          id: queuedRequest.id,
          state: "queued",
          serviceId: queuedRequest.serviceId,
          operation: queuedRequest.operation,
          replicas: queuedRequest.replicas,
          message: queuedRequest.operation === "scale-service"
            ? "Solicitud aceptada; esperando que el agente del VPS escale el servicio."
            : "Solicitud aceptada; esperando que el agente del VPS reinicie el servicio.",
        };
      }
    }
    return status ?? null;
  }

  async function requestOperation(operation, serviceId, requestId, replicas) {
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
    const currentStatus = await getStatus();
    if (currentStatus?.id === requestId) {
      if (currentStatus.serviceId !== serviceId
        || (currentStatus.operation && currentStatus.operation !== operation)
        || (operation === "scale-service" && currentStatus.replicas !== replicas)) {
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
      message: operation === "scale-service"
        ? "Solicitud aceptada; el escalado comenzará en el VPS."
        : "Solicitud aceptada; el reinicio comenzará en el VPS.",
    };
  }

  return {
    getStatus,
    requestRestart: (serviceId, requestId = createId()) =>
      requestOperation("restart-service", serviceId, requestId),
    requestScale: (serviceId, replicas, requestId = createId()) =>
      requestOperation("scale-service", serviceId, requestId, replicas),
  };
}
