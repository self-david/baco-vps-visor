import { randomUUID } from "node:crypto";
import { link, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const allowedStates = new Set(["running", "succeeded", "failed"]);

function isMissing(error) {
  return error && typeof error === "object" && error.code === "ENOENT";
}

export function createWebUpdater({
  directory = process.env.WEB_UPDATE_DIRECTORY ?? "/var/lib/vps-manager/web-update",
  createId = randomUUID,
} = {}) {
  const requestPath = join(directory, "request");
  const statusPath = join(directory, "status.json");

  async function readOptional(path) {
    try {
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
    if (statusContents !== undefined) {
      status = JSON.parse(statusContents);
      if (!status || typeof status !== "object"
        || !requestIdPattern.test(status.id ?? "")
        || !allowedStates.has(status.state)
        || typeof status.updatedAt !== "string"
        || typeof status.message !== "string") {
        throw new Error("The web updater status file has an invalid format.");
      }
    }

    const requestId = requestContents?.trim();
    if (requestContents !== undefined && !requestIdPattern.test(requestId ?? "")) {
      throw new Error("The web updater request file has an invalid format.");
    }
    if (requestId && status?.id !== requestId) {
      return {
        id: requestId,
        state: "queued",
        message: "Solicitud aceptada; esperando que el servicio del VPS inicie la actualización.",
      };
    }
    return status ?? null;
  }

  async function requestUpdate() {
    const currentStatus = await getStatus();
    if (currentStatus?.state === "queued" || currentStatus?.state === "running") {
      const error = new Error("Ya hay una actualización en curso.");
      error.code = "UPDATE_IN_PROGRESS";
      throw error;
    }

    const id = createId();
    if (!requestIdPattern.test(id)) {
      throw new Error("The web updater generated an invalid request identifier.");
    }
    const temporaryPath = join(directory, `.request-${id}.tmp`);
    try {
      await writeFile(temporaryPath, `${id}\n`, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, requestPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        const conflict = new Error("Ya hay una actualización en curso.");
        conflict.code = "UPDATE_IN_PROGRESS";
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
      message: "Solicitud aceptada; la actualización comenzará en el VPS.",
    };
  }

  return { getStatus, requestUpdate };
}
