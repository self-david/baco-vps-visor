import { randomUUID } from "node:crypto";
import { lstat, link, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const serviceIdPattern = /^[a-f0-9]{25,64}$/i;
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

function isMissing(error) {
  return error && typeof error === "object" && error.code === "ENOENT";
}

function validateStatus(status) {
  if (!status || typeof status !== "object"
    || !requestIdPattern.test(status.id ?? "")
    || !serviceIdPattern.test(status.serviceId ?? "")
    || !statusStates.has(status.state)
    || typeof status.updatedAt !== "string"
    || typeof status.message !== "string") {
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
      if (!queuedRequest || typeof queuedRequest !== "object"
        || !requestIdPattern.test(queuedRequest.id ?? "")
        || queuedRequest.operation !== "restart-service"
        || !serviceIdPattern.test(queuedRequest.serviceId ?? "")) {
        throw new Error("The service operation request file has an invalid format.");
      }
      if (queuedRequest.id !== status?.id) {
        return {
          id: queuedRequest.id,
          state: "queued",
          serviceId: queuedRequest.serviceId,
          message: "Solicitud aceptada; esperando que el agente del VPS reinicie el servicio.",
        };
      }
    }
    return status ?? null;
  }

  async function requestRestart(serviceId) {
    if (typeof serviceId !== "string" || !serviceIdPattern.test(serviceId)) {
      throw new TypeError("A full Docker Swarm service identifier is required.");
    }
    const currentStatus = await getStatus();
    if (activeStates.has(currentStatus?.state)) {
      const error = new Error("Ya hay una operación de servicio en curso.");
      error.code = "OPERATION_IN_PROGRESS";
      throw error;
    }

    const id = createId();
    if (!requestIdPattern.test(id)) {
      throw new Error("The service operation agent generated an invalid request identifier.");
    }
    const request = JSON.stringify({ id, operation: "restart-service", serviceId });
    const temporaryPath = join(directory, `.request-${id}.tmp`);
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
      id,
      state: "queued",
      serviceId,
      message: "Solicitud aceptada; el reinicio comenzará en el VPS.",
    };
  }

  return { getStatus, requestRestart };
}
