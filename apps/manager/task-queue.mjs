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

export function createGiteaInstallHandler(agent, { pollIntervalMs = 1000 } = {}) {
  if (!agent || typeof agent.requestGiteaInstall !== "function" || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100) {
    throw new TypeError("The Gitea installation task handler configuration is invalid.");
  }

  return async (task, signal) => {
    const domain = task.payload?.domain;
    if (task.type !== "application.gitea.install"
      || typeof domain !== "string"
      || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)) {
      throw new TaskExecutionError("La tarea contiene un dominio de Gitea inválido.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("La ejecución de la tarea fue interrumpida.");
    await agent.requestGiteaInstall(domain, task.id);

    while (!signal.aborted) {
      const operation = await agent.getStatus();
      if (operation?.id === task.id) {
        if (operation.state === "succeeded") {
          if (!operation.credentialsAvailable) {
            return {
              message: operation.message,
              url: `https://${domain}/`,
              credentialsAvailable: false,
            };
          }
          return {
            message: `Gitea está disponible en https://${domain}/. Las credenciales de administrador están disponibles una sola vez.`,
            url: `https://${domain}/`,
            credentialsAvailable: true,
          };
        }
        if (operation.state === "failed") {
          throw new TaskExecutionError(operation.message, { retryable: false });
        }
      }
      await waitForRetry(signal, pollIntervalMs);
    }
    throw signal.reason ?? new Error("La ejecución de la tarea fue interrumpida.");
  };
}

export function createN8nInstallHandler(agent, { pollIntervalMs = 1000 } = {}) {
  if (!agent || typeof agent.requestN8nInstall !== "function" || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100) {
    throw new TypeError("The n8n installation task handler configuration is invalid.");
  }

  return async (task, signal) => {
    const domain = task.payload?.domain;
    if (task.type !== "application.n8n.install"
      || typeof domain !== "string"
      || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)) {
      throw new TaskExecutionError("La tarea contiene un dominio de n8n inválido.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("La ejecución de la tarea fue interrumpida.");
    await agent.requestN8nInstall(domain, task.id);

    while (!signal.aborted) {
      const operation = await agent.getStatus();
      if (operation?.id === task.id) {
        if (operation.operation !== "install-n8n" || operation.domain !== domain) {
          throw new TaskExecutionError("El agente devolvió un resultado de instalación de n8n inconsistente.", {
            retryable: false,
          });
        }
        if (operation.state === "succeeded") {
          return {
            message: `n8n está disponible en https://${domain}/.`,
            url: `https://${domain}/`,
          };
        }
        if (operation.state === "failed") {
          throw new TaskExecutionError(operation.message, { retryable: false });
        }
      }
      await waitForRetry(signal, pollIntervalMs);
    }
    throw signal.reason ?? new Error("La ejecución de la tarea fue interrumpida.");
  };
}

export function createRegistryConfigureHandler(agent, {
  pollIntervalMs = 1000,
  maximumDurationMs = 14 * 60 * 1000,
} = {}) {
  if (!agent || typeof agent.requestRegistryConfiguration !== "function"
    || typeof agent.removeRegistryCredentials !== "function"
    || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100
    || !Number.isInteger(maximumDurationMs) || maximumDurationMs < pollIntervalMs) {
    throw new TypeError("The private registry configuration handler is invalid.");
  }

  return async (task, signal) => {
    const { domain, username } = task.payload ?? {};
    if (task.type !== "registry.configure"
      || typeof domain !== "string"
      || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
      || typeof username !== "string"
      || !/^[A-Za-z0-9._-]{1,64}$/.test(username)) {
      throw new TaskExecutionError("La tarea contiene una configuración de registro inválida.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("La configuración fue interrumpida.");
    const deadline = Date.now() + maximumDurationMs;
    try {
      await agent.requestRegistryConfiguration(domain, username, task.id);
      while (!signal.aborted) {
        const operation = await agent.getStatus();
        if (operation?.id === task.id) {
          if (operation.operation !== "configure-registry"
            || operation.domain !== domain
            || operation.username !== username) {
            throw new TaskExecutionError("El agente devolvió una configuración de registro inconsistente.", { retryable: false });
          }
          if (operation.state === "succeeded") {
            return { message: operation.message, domain };
          }
          if (operation.state === "failed") {
            throw new TaskExecutionError(operation.message, { retryable: false });
          }
        }
        if (Date.now() >= deadline) {
          throw new TaskExecutionError("La configuración del registro superó el límite de 14 minutos.", { retryable: false });
        }
        await waitForRetry(signal, Math.min(pollIntervalMs, deadline - Date.now()));
      }
      throw signal.reason ?? new Error("La configuración fue interrumpida.");
    } finally {
      await agent.removeRegistryCredentials(task.id);
    }
  };
}

export function createProjectBuildHandler({
  agent,
  getBuildSource,
  pollIntervalMs = 1000,
  maximumDurationMs = 14 * 60 * 1000,
} = {}) {
  if (!agent || typeof agent.requestProjectBuild !== "function"
    || typeof agent.stageProjectBuildArchive !== "function"
    || typeof agent.removeProjectBuildArchive !== "function"
    || typeof agent.getStatus !== "function"
    || typeof getBuildSource !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100
    || !Number.isInteger(maximumDurationMs) || maximumDurationMs < pollIntervalMs) {
    throw new TypeError("The project image build task handler configuration is invalid.");
  }
  return async (task, signal) => {
    const { projectId, projectName, repository, branch } = task.payload ?? {};
    if (task.type !== "project.build"
      || typeof projectId !== "string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(projectId)
      || typeof projectName !== "string"
      || typeof repository !== "string"
      || typeof branch !== "string") {
      throw new TaskExecutionError("La tarea contiene una configuración de proyecto inválida.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("La construcción fue interrumpida.");

    let staged = false;
    const deadline = Date.now() + maximumDurationMs;
    try {
      const source = await getBuildSource({ repository, branch });
      if (!source || typeof source.commitSha !== "string"
        || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(source.commitSha)
        || !Buffer.isBuffer(source.archive)) {
        throw new TaskExecutionError("Gitea devolvió una fuente inválida para construir.", { retryable: false });
      }
      await agent.stageProjectBuildArchive(task.id, source.archive);
      staged = true;
      await agent.requestProjectBuild(projectId, source.commitSha, task.id);

      while (!signal.aborted) {
        const operation = await agent.getStatus();
        if (operation?.id === task.id) {
          if (operation.operation !== "build-project"
            || operation.projectId !== projectId
            || operation.commitSha !== source.commitSha) {
            throw new TaskExecutionError("El agente devolvió un resultado de construcción inconsistente.", { retryable: false });
          }
          if (operation.state === "succeeded") {
            return {
              message: `Imagen construida para ${projectName} (${branch} · ${source.commitSha.slice(0, 12)}).`,
              image: operation.image,
              commitSha: source.commitSha,
              branch,
            };
          }
          if (operation.state === "failed") {
            throw new TaskExecutionError(operation.message, { retryable: false });
          }
        }
        if (Date.now() >= deadline) {
          throw new TaskExecutionError("La construcción superó el límite de 14 minutos.", { retryable: false });
        }
        await waitForRetry(signal, Math.min(pollIntervalMs, deadline - Date.now()));
      }
      throw signal.reason ?? new Error("La construcción fue interrumpida.");
    } finally {
      if (staged) await agent.removeProjectBuildArchive(task.id);
    }
  };
}

export function createProjectDeployHandler(agent, {
  pollIntervalMs = 1000,
  maximumDurationMs = 17 * 60 * 1000,
} = {}) {
  if (!agent || typeof agent.requestProjectDeploy !== "function" || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100
    || !Number.isInteger(maximumDurationMs) || maximumDurationMs < pollIntervalMs) {
    throw new TypeError("The project deployment task handler configuration is invalid.");
  }
  return async (task, signal) => {
    const { projectId, projectName, commitSha } = task.payload ?? {};
    if (task.type !== "project.deploy"
      || typeof projectId !== "string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(projectId)
      || typeof projectName !== "string"
      || typeof commitSha !== "string"
      || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha)) {
      throw new TaskExecutionError("La tarea contiene una configuración de despliegue inválida.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("El despliegue fue interrumpido.");
    const deadline = Date.now() + maximumDurationMs;
    await agent.requestProjectDeploy(projectId, commitSha, task.id);
    while (!signal.aborted) {
      const operation = await agent.getStatus();
      if (operation?.id === task.id) {
        if (operation.operation !== "deploy-project"
          || operation.projectId !== projectId
          || operation.commitSha !== commitSha) {
          throw new TaskExecutionError("El agente devolvió un resultado de despliegue inconsistente.", { retryable: false });
        }
        if (operation.state === "succeeded") {
          return {
            message: `Servicio global de ${projectName} desplegado con el commit ${commitSha.slice(0, 12)}; Swarm programa una tarea por nodo activo y no se publicaron puertos.`,
            image: operation.image,
            commitSha,
            serviceId: operation.serviceId,
          };
        }
        if (operation.state === "failed") {
          throw new TaskExecutionError(operation.message, { retryable: false });
        }
      }
      if (Date.now() >= deadline) {
        throw new TaskExecutionError("El despliegue superó el límite de 17 minutos.", { retryable: false });
      }
      await waitForRetry(signal, Math.min(pollIntervalMs, deadline - Date.now()));
    }
    throw signal.reason ?? new Error("El despliegue fue interrumpido.");
  };
}

export function createProjectUndeployHandler(agent, {
  pollIntervalMs = 1000,
  maximumDurationMs = 17 * 60 * 1000,
} = {}) {
  if (!agent || typeof agent.requestProjectUndeploy !== "function" || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100
    || !Number.isInteger(maximumDurationMs) || maximumDurationMs < pollIntervalMs) {
    throw new TypeError("The project removal task handler configuration is invalid.");
  }
  return async (task, signal) => {
    const { projectId, projectName } = task.payload ?? {};
    if (task.type !== "project.undeploy"
      || typeof projectId !== "string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(projectId)
      || typeof projectName !== "string") {
      throw new TaskExecutionError("La tarea contiene una configuración de retiro inválida.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("El retiro fue interrumpido.");
    const deadline = Date.now() + maximumDurationMs;
    await agent.requestProjectUndeploy(projectId, task.id);
    while (!signal.aborted) {
      const operation = await agent.getStatus();
      if (operation?.id === task.id) {
        if (operation.operation !== "remove-project" || operation.projectId !== projectId) {
          throw new TaskExecutionError("El agente devolvió un resultado de retiro inconsistente.", { retryable: false });
        }
        if (operation.state === "succeeded") {
          return { message: `Se retiró el servicio Swarm de ${projectName}.` };
        }
        if (operation.state === "failed") {
          throw new TaskExecutionError(operation.message, { retryable: false });
        }
      }
      if (Date.now() >= deadline) {
        throw new TaskExecutionError("El retiro del servicio superó el límite de 17 minutos.", { retryable: false });
      }
      await waitForRetry(signal, Math.min(pollIntervalMs, deadline - Date.now()));
    }
    throw signal.reason ?? new Error("El retiro fue interrumpido.");
  };
}

export function createSwarmNodeEnrollHandler(agent, {
  pollIntervalMs = 1000,
  maximumDurationMs = 30 * 60 * 1000,
} = {}) {
  if (!agent || typeof agent.requestSwarmNodeEnrollment !== "function"
    || typeof agent.removeNodeCredentials !== "function"
    || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100
    || !Number.isInteger(maximumDurationMs) || maximumDurationMs < pollIntervalMs) {
    throw new TypeError("The Swarm node enrollment task handler configuration is invalid.");
  }
  return async (task, signal) => {
    const node = task.payload ?? {};
    if (task.type !== "swarm.node.enroll") {
      throw new TaskExecutionError("La tarea no corresponde al alta de un nodo Swarm.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("El alta del nodo fue interrumpida.");
    const deadline = Date.now() + maximumDurationMs;
    try {
      await agent.requestSwarmNodeEnrollment(node, task.id);
      while (!signal.aborted) {
        const operation = await agent.getStatus();
        if (operation?.id === task.id) {
          if (operation.operation !== "enroll-swarm-node"
            || operation.nodeAddress !== node.address
            || operation.role !== node.role) {
            throw new TaskExecutionError("El agente devolvió un resultado de alta de nodo inconsistente.", {
              retryable: false,
            });
          }
          if (operation.state === "succeeded") {
            return {
              message: `El nodo ${node.address} se unió al Swarm como ${node.role}.`,
              nodeId: operation.nodeId,
              nodeAddress: node.address,
            };
          }
          if (operation.state === "failed") {
            throw new TaskExecutionError(operation.message, { retryable: false });
          }
        }
        if (Date.now() >= deadline) {
          throw new TaskExecutionError("El aprovisionamiento del nodo superó el límite de 30 minutos.", {
            retryable: false,
          });
        }
        await waitForRetry(signal, Math.min(pollIntervalMs, deadline - Date.now()));
      }
      throw signal.reason ?? new Error("El alta del nodo fue interrumpida.");
    } finally {
      await agent.removeNodeCredentials(task.id);
    }
  };
}
