import { randomUUID } from "node:crypto";

export class TaskExecutionError extends Error {
  constructor(message, { retryable = true } = {}) {
    super(message);
    this.name = "TaskExecutionError";
    this.retryable = retryable;
  }
}

function waitForRetry(signal, milliseconds) {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, milliseconds);
    if (signal.aborted) finish();
    else signal.addEventListener("abort", finish, { once: true });
  });
}

export function createTaskQueueWorker({
  store,
  handlers,
  workerId = randomUUID(),
  pollIntervalMs = 1000,
  leaseSeconds = 60,
  onError = console.error,
} = {}) {
  if (!store || typeof store.claimNextTask !== "function"
    || typeof store.completeTask !== "function"
    || typeof store.failTask !== "function"
    || typeof store.renewTaskLease !== "function"
    || !handlers || typeof handlers !== "object" || Array.isArray(handlers)
    || typeof workerId !== "string"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100
    || !Number.isInteger(leaseSeconds) || leaseSeconds < 5
    || typeof onError !== "function") {
    throw new TypeError("The task queue worker configuration is invalid.");
  }
  for (const [type, handler] of Object.entries(handlers)) {
    if (!/^[a-z][a-z0-9._-]{0,119}$/.test(type) || typeof handler !== "function") {
      throw new TypeError("Task handlers must be functions registered by a valid task type.");
    }
  }

  let stopped = true;
  let timer;
  let activeRun;
  let activeController;

  async function runOnce() {
    const task = await store.claimNextTask(workerId, leaseSeconds);
    if (!task) return false;
    const handler = Object.hasOwn(handlers, task.type) ? handlers[task.type] : undefined;
    if (!handler) {
      await store.failTask(task.id, workerId, `No hay un handler registrado para ${task.type}.`, false);
      return true;
    }

    const controller = new AbortController();
    activeController = controller;
    const heartbeat = setInterval(async () => {
      try {
        const renewed = await store.renewTaskLease(task.id, workerId, leaseSeconds);
        if (!renewed) controller.abort(new Error("La lease de la tarea expiró."));
      } catch (error) {
        onError("Could not renew task lease:", error);
      }
    }, Math.max(1000, Math.floor((leaseSeconds * 1000) / 3)));

    try {
      const result = await handler(task, controller.signal);
      if (!controller.signal.aborted) {
        await store.completeTask(task.id, workerId, result ?? {});
      }
    } catch (error) {
      if (controller.signal.aborted) return true;
      const message = error instanceof Error ? error.message : "La tarea falló por un error desconocido.";
      try {
        await store.failTask(task.id, workerId, message, error?.retryable !== false);
      } catch (storeError) {
        onError("Could not persist task execution failure:", storeError);
      }
    } finally {
      clearInterval(heartbeat);
      if (activeController === controller) activeController = undefined;
    }
    return true;
  }

  async function tick() {
    if (stopped) return;
    activeRun = runOnce();
    try {
      await activeRun;
    } catch (error) {
      onError("Task queue worker iteration failed:", error);
    } finally {
      activeRun = undefined;
      if (!stopped) timer = setTimeout(tick, pollIntervalMs);
    }
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      void tick();
    },
    async stop() {
      stopped = true;
      clearTimeout(timer);
      activeController?.abort(new Error("Task queue worker is stopping."));
      if (activeRun) await activeRun;
    },
    runOnce,
  };
}

function createServiceOperationHandler(agent, operation, { pollIntervalMs = 1000 } = {}) {
  const requestOperation = operation === "restart-service" ? agent?.requestRestart : agent?.requestScale;
  if (!agent || typeof requestOperation !== "function" || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100) {
    throw new TypeError("The service operation task handler configuration is invalid.");
  }

  return async (task, signal) => {
    const serviceId = task.payload?.serviceId;
    if (typeof serviceId !== "string" || !/^[a-f0-9]{25,64}$/i.test(serviceId)) {
      throw new TaskExecutionError("La tarea contiene un identificador de servicio inválido.", { retryable: false });
    }
    const replicas = operation === "scale-service" ? task.payload?.desiredReplicas : undefined;
    if (operation === "scale-service" && (!Number.isInteger(replicas) || replicas < 1 || replicas > 100)) {
      throw new TaskExecutionError("La tarea contiene un número de réplicas inválido.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("La ejecución de la tarea fue interrumpida.");

    if (operation === "scale-service") await agent.requestScale(serviceId, replicas, task.id);
    else await agent.requestRestart(serviceId, task.id);
    while (!signal.aborted) {
      const operation = await agent.getStatus();
      if (operation?.id === task.id) {
        if (operation.state === "succeeded") return { message: operation.message };
        if (operation.state === "failed") {
          throw new TaskExecutionError(operation.message, { retryable: false });
        }
      }
      await waitForRetry(signal, pollIntervalMs);
    }
    throw signal.reason ?? new Error("La ejecución de la tarea fue interrumpida.");
  };
}

export function createServiceRestartHandler(agent, options) {
  return createServiceOperationHandler(agent, "restart-service", options);
}

export function createServiceScaleHandler(agent, options) {
  return createServiceOperationHandler(agent, "scale-service", options);
}
