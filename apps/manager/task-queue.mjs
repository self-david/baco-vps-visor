import { createHash, randomUUID } from "node:crypto";

export class TaskExecutionError extends Error {
  constructor(message, { retryable = true, result } = {}) {
    super(message);
    this.name = "TaskExecutionError";
    this.retryable = retryable;
    this.result = result;
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
        const failureArguments = [task.id, workerId, message, error?.retryable !== false];
        if (error?.result !== undefined) failureArguments.push(error.result);
        await store.failTask(...failureArguments);
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
    if (typeof serviceId !== "string" || !/^[a-z0-9]{25,64}$/i.test(serviceId)) {
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

export function createContainerOperationHandler(agent, { pollIntervalMs = 1000 } = {}) {
  if (!agent || typeof agent.requestContainerOperation !== "function" || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100) {
    throw new TypeError("The container operation task handler configuration is invalid.");
  }

  return async (task, signal) => {
    const { serviceId, containerId, action } = task.payload ?? {};
    if (task.type !== "container.operation"
      || typeof serviceId !== "string" || !/^[a-z0-9]{25,64}$/i.test(serviceId)
      || typeof containerId !== "string" || !/^[a-f0-9]{12,64}$/i.test(containerId)
      || !["stop", "restart"].includes(action)) {
      throw new TaskExecutionError("La tarea contiene una operación de contenedor inválida.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("La ejecución de la tarea fue interrumpida.");
    await agent.requestContainerOperation(`${action}-container`, serviceId, containerId, task.id);

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

export function createGiteaInstallHandler(agent, { pollIntervalMs = 1000 } = {}) {
  if (!agent || typeof agent.requestGiteaInstall !== "function" || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100) {
    throw new TypeError("The Gitea installation task handler configuration is invalid.");
  }

  return async (task, signal) => {
    const domain = task.payload?.domain;
    if (task.type !== "application.gitea.install"
      || typeof domain !== "string"
      || (domain !== "localhost"
        && (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
          || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)))) {
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
              url: domain === "localhost" ? "http://localhost:3001/gitea/" : `https://${domain}/`,
              credentialsAvailable: false,
            };
          }
          return {
            message: domain === "localhost"
              ? "Gitea está disponible por túnel SSH en http://localhost:3001/gitea/. Las credenciales están disponibles una sola vez."
              : `Gitea está disponible en https://${domain}/. Las credenciales de administrador están disponibles una sola vez.`,
            url: domain === "localhost" ? "http://localhost:3001/gitea/" : `https://${domain}/`,
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

export function createN8nInstallHandler(agent, { updateInstance, pollIntervalMs = 1000 } = {}) {
  if (!agent || typeof agent.requestN8nInstall !== "function" || typeof agent.getStatus !== "function"
    || (updateInstance !== undefined && typeof updateInstance !== "function")
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100) {
    throw new TypeError("The n8n installation task handler configuration is invalid.");
  }

  return async (task, signal) => {
    const domain = task.payload?.domain;
    const configuration = task.payload?.configuration;
    const instanceId = task.payload?.instanceId;
    if (task.type !== "application.n8n.install"
      || typeof domain !== "string"
      || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)
      || !configuration || typeof configuration !== "object" || Array.isArray(configuration)
      || typeof instanceId !== "string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(instanceId)) {
      throw new TaskExecutionError("La tarea contiene una configuración de n8n inválida.", { retryable: false });
    }
    try {
      if (signal.aborted) throw signal.reason ?? new Error("La ejecución de la tarea fue interrumpida.");
      await agent.requestN8nInstall(domain, configuration, task.id);

      while (!signal.aborted) {
        const operation = await agent.getStatus();
        if (operation?.id === task.id) {
          if (operation.operation !== "install-n8n" || operation.domain !== domain) {
            throw new TaskExecutionError("El agente devolvió un resultado de instalación de n8n inconsistente.", {
              retryable: false,
            });
          }
          if (operation.state === "succeeded") {
            if (updateInstance && !await updateInstance(instanceId, task.id, { status: "installed" })) {
              throw new Error("No se pudo guardar el estado instalado de la instancia n8n.");
            }
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
    } catch (error) {
      if (updateInstance && !await updateInstance(instanceId, task.id, { status: "failed" })) {
        throw new AggregateError([error], "No se pudo guardar el estado fallido de la instancia n8n.");
      }
      throw error;
    }
  };
}

export function createPostgresqlInstallHandler(agent, { pollIntervalMs = 1000 } = {}) {
  if (!agent || typeof agent.requestPostgresqlInstall !== "function" || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100) {
    throw new TypeError("The PostgreSQL installation task handler configuration is invalid.");
  }

  return async (task, signal) => {
    if (task.type !== "application.postgresql.install"
      || !task.payload || typeof task.payload !== "object" || Object.keys(task.payload).length !== 0) {
      throw new TaskExecutionError("La tarea contiene una solicitud de instalación de PostgreSQL inválida.", {
        retryable: false,
      });
    }
    if (signal.aborted) throw signal.reason ?? new Error("La ejecución de la tarea fue interrumpida.");
    await agent.requestPostgresqlInstall(task.id);

    while (!signal.aborted) {
      const operation = await agent.getStatus();
      if (operation?.id === task.id) {
        if (operation.operation !== "install-postgresql"
          || typeof operation.credentialsAvailable !== "boolean") {
          throw new TaskExecutionError("El agente devolvió un resultado de PostgreSQL inconsistente.", {
            retryable: false,
          });
        }
        if (operation.state === "succeeded") {
          return {
            message: "PostgreSQL está disponible en la red privada de Swarm como vps-manager-postgresql:5432.",
            credentialsAvailable: operation.credentialsAvailable,
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

export function createCloudflareTunnelConfigureHandler(agent, { pollIntervalMs = 1000 } = {}) {
  if (!agent || typeof agent.requestCloudflareTunnelConfiguration !== "function"
    || typeof agent.removeCloudflareTunnelCredentials !== "function"
    || typeof agent.getStatus !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100) {
    throw new TypeError("The Cloudflare Tunnel configuration task handler is invalid.");
  }
  return async (task, signal) => {
    const { tunnelId, tunnelName } = task.payload ?? {};
    if (task.type !== "cloudflare.tunnel.configure"
      || typeof tunnelId !== "string" || !/^[a-f0-9-]{36}$/i.test(tunnelId)
      || typeof tunnelName !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(tunnelName)) {
      throw new TaskExecutionError("La tarea contiene una configuración de túnel inválida.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("La configuración fue interrumpida.");
    try {
      await agent.requestCloudflareTunnelConfiguration(tunnelId, task.id);
      while (!signal.aborted) {
        const operation = await agent.getStatus();
        if (operation?.id === task.id) {
          if (operation.operation !== "configure-cloudflare-tunnel" || operation.tunnelId !== tunnelId) {
            throw new TaskExecutionError("El agente devolvió una configuración de túnel inconsistente.", {
              retryable: false,
            });
          }
          if (operation.state === "succeeded") {
            return { message: operation.message, tunnelId };
          }
          if (operation.state === "failed") {
            throw new TaskExecutionError(operation.message, { retryable: false });
          }
        }
        await waitForRetry(signal, pollIntervalMs);
      }
      throw signal.reason ?? new Error("La configuración fue interrumpida.");
    } finally {
      await agent.removeCloudflareTunnelCredentials(task.id);
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
    const {
      projectId,
      projectName,
      repository = "",
      branch = "",
      commitSha,
      sourceType = "github",
      sourceDigest,
    } = task.payload ?? {};
    if (task.type !== "project.build"
      || typeof projectId !== "string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(projectId)
      || typeof projectName !== "string"
      || !["github", "upload"].includes(sourceType)
      || (sourceType === "github"
        && (typeof repository !== "string" || typeof branch !== "string"))
      || (sourceType === "upload"
        && (typeof sourceDigest !== "string" || !/^[a-f0-9]{64}$/i.test(sourceDigest)))
      || (commitSha !== undefined && (typeof commitSha !== "string"
        || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha)))) {
      throw new TaskExecutionError("La tarea contiene una configuración de proyecto inválida.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("La construcción fue interrumpida.");

    let staged = false;
    let buildLogs = "";
    const deadline = Date.now() + maximumDurationMs;
    try {
      const source = await getBuildSource({
        ...task.payload,
        projectId,
        repository,
        branch,
        commitSha,
        sourceType,
        ...(sourceDigest ? { sourceDigest } : {}),
      });
      if (!source || typeof source.commitSha !== "string"
        || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(source.commitSha)
        || !Buffer.isBuffer(source.archive)
        || (commitSha !== undefined && source.commitSha.toLowerCase() !== commitSha.toLowerCase())) {
        throw new TaskExecutionError("El proveedor devolvió una fuente inválida para construir.", { retryable: false });
      }
      await agent.stageProjectBuildArchive(task.id, source.archive);
      staged = true;
      const buildConfiguration = {
        deploymentType: source.deploymentType,
        buildStrategy: source.buildStrategy,
        buildContext: source.buildContext,
        dockerfilePath: source.dockerfilePath,
        buildCommand: source.buildCommand,
        buildOutputDirectory: source.buildOutputDirectory,
      };
      while (!signal.aborted && Date.now() < deadline) {
        try {
          await agent.requestProjectBuild(projectId, source.commitSha, task.id, buildConfiguration);
          break;
        } catch (error) {
          if (error?.code !== "OPERATION_IN_PROGRESS") throw error;
          await waitForRetry(signal, Math.min(pollIntervalMs, deadline - Date.now()));
        }
      }
      if (signal.aborted) throw signal.reason ?? new Error("La construcción fue interrumpida.");
      if (Date.now() >= deadline) {
        throw new TaskExecutionError(
          "El agente del VPS estuvo ocupado demasiado tiempo; BuildKit no llegó a iniciar.",
          { retryable: false },
        );
      }

      while (!signal.aborted) {
        const currentOperation = await agent.getStatus();
        const savedOperation = typeof agent.getProjectBuildStatus === "function"
          ? await agent.getProjectBuildStatus(task.id)
          : null;
        const operation = savedOperation?.id === task.id ? savedOperation : currentOperation;
        if (operation?.id === task.id) {
          if (typeof operation.logs === "string") buildLogs = operation.logs;
          if (operation.operation !== "build-project"
            || operation.projectId !== projectId
            || operation.commitSha !== source.commitSha) {
            throw new TaskExecutionError("El agente devolvió un resultado de construcción inconsistente.", { retryable: false });
          }
          if (operation.state === "succeeded") {
            if (operation.deploymentType !== source.deploymentType
              || operation.buildStrategy !== source.buildStrategy
              || operation.buildContext !== source.buildContext
              || operation.dockerfilePath !== source.dockerfilePath
              || (operation.buildCommand !== undefined && operation.buildCommand !== source.buildCommand)
              || (operation.buildOutputDirectory !== undefined
                && operation.buildOutputDirectory !== source.buildOutputDirectory)
              || (source.deploymentType === "build"
                && (operation.buildCommand !== source.buildCommand
                  || operation.buildOutputDirectory !== source.buildOutputDirectory))) {
              throw new TaskExecutionError("La configuración devuelta por el agente no coincide con la del build.", { retryable: false });
            }
            return {
              message: branch
                ? `Imagen local construida para ${projectName} (${branch} · ${source.commitSha.slice(0, 12)}).`
                : `Imagen local construida para ${projectName} · ${source.commitSha.slice(0, 12)}.`,
              image: operation.image,
              ...(typeof operation.logs === "string" && operation.logs ? { logs: operation.logs } : {}),
              commitSha: source.commitSha,
              ...(source.deploymentType ? {
                deploymentType: source.deploymentType,
                buildStrategy: source.buildStrategy,
                buildContext: source.buildContext,
                dockerfilePath: source.dockerfilePath,
                buildCommand: source.buildCommand,
                buildOutputDirectory: source.buildOutputDirectory,
              } : {}),
              ...(branch ? { branch } : {}),
            };
          }
          if (operation.state === "failed") {
            throw new TaskExecutionError(operation.message, {
              retryable: false,
              ...(buildLogs
                ? { result: { message: operation.message, logs: buildLogs } }
                : {}),
            });
          }
        }
        if (Date.now() >= deadline) {
          throw new TaskExecutionError("La construcción superó el límite de 14 minutos.", {
            retryable: false,
            ...(buildLogs ? { result: { logs: buildLogs } } : {}),
          });
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
            message: `Servicio de ${projectName} desplegado con el commit ${commitSha.slice(0, 12)}; Swarm mantiene una tarea en el VPS principal y no se publicaron puertos.`,
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

export function createManualApplicationDeployHandler(agent, {
  updateDeployment,
  pollIntervalMs = 1000,
  maximumDurationMs = 17 * 60 * 1000,
} = {}) {
  if (!agent || typeof agent.requestApplicationDeploy !== "function"
    || typeof agent.removeApplicationDeployment !== "function"
    || typeof agent.getStatus !== "function"
    || typeof updateDeployment !== "function"
    || !Number.isInteger(pollIntervalMs) || pollIntervalMs < 100
    || !Number.isInteger(maximumDurationMs) || maximumDurationMs < pollIntervalMs) {
    throw new TypeError("The manual application deployment handler configuration is invalid.");
  }
  return async (task, signal) => {
    const { applicationId, applicationName, instanceId } = task.payload ?? {};
    if (task.type !== "application.custom.deploy"
      || typeof applicationId !== "string" || !/^[a-z][a-z0-9-]{0,62}$/.test(applicationId)
      || typeof applicationName !== "string"
      || typeof instanceId !== "string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(instanceId)) {
      throw new TaskExecutionError("La tarea contiene una aplicación manual inválida.", { retryable: false });
    }
    if (signal.aborted) throw signal.reason ?? new Error("El despliegue fue interrumpido.");
    const deadline = Date.now() + maximumDurationMs;
    try {
      await agent.requestApplicationDeploy(applicationId, instanceId, task.id);
      while (!signal.aborted) {
        const operation = await agent.getStatus();
        if (operation?.id === task.id) {
          if (operation.operation !== "deploy-application"
            || operation.applicationId !== applicationId
            || operation.instanceId !== instanceId) {
            throw new TaskExecutionError("El agente devolvió un despliegue de aplicación inconsistente.", { retryable: false });
          }
          if (operation.state === "succeeded") {
            await updateDeployment(instanceId, task.id, { status: "installed", serviceId: operation.serviceId });
            return {
              message: `${applicationName} se desplegó en el VPS principal de Swarm.`,
              serviceId: operation.serviceId,
            };
          }
          if (operation.state === "failed") {
            await updateDeployment(instanceId, task.id, { status: "failed" });
            throw new TaskExecutionError(operation.message, { retryable: false });
          }
        }
        if (Date.now() >= deadline) {
          await updateDeployment(instanceId, task.id, { status: "failed" });
          throw new TaskExecutionError("El despliegue de la aplicación superó el límite de 17 minutos.", { retryable: false });
        }
        await waitForRetry(signal, Math.min(pollIntervalMs, deadline - Date.now()));
      }
      throw signal.reason ?? new Error("El despliegue fue interrumpido.");
    } catch (error) {
      if (!(error instanceof TaskExecutionError)) {
        await updateDeployment(instanceId, task.id, { status: "failed" });
      }
      throw error;
    } finally {
      await agent.removeApplicationDeployment(task.id);
    }
  };
}

function derivePushPhaseTaskId(taskId, phase, attempt) {
  const bytes = createHash("sha256").update(`vps-manager:project-push:${phase}:${taskId}:${attempt}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createProjectPushDeployHandler(options = {}) {
  const build = createProjectBuildHandler(options);
  const deploy = createProjectDeployHandler(options.agent, options);
  return async (task, signal) => {
    const { projectId, projectName, repository, branch, commitSha } = task.payload ?? {};
    if (task.type !== "project.push-deploy"
      || typeof projectId !== "string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(projectId)
      || typeof projectName !== "string"
      || typeof repository !== "string"
      || typeof branch !== "string"
      || typeof commitSha !== "string"
      || !Number.isInteger(task.attempts) || task.attempts < 1
      || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha)) {
      throw new TaskExecutionError("La tarea de despliegue por push contiene una configuración inválida.", { retryable: false });
    }

    const buildTask = {
      id: derivePushPhaseTaskId(task.id, "build", task.attempts),
      type: "project.build",
      payload: { projectId, projectName, repository, branch, commitSha },
    };
    const buildResult = await build(buildTask, signal);
    const deployTask = {
      id: derivePushPhaseTaskId(task.id, "deploy", task.attempts),
      type: "project.deploy",
      payload: { projectId, projectName, commitSha: buildResult.commitSha },
    };
    const deployResult = await deploy(deployTask, signal);
    return {
      message: `Push a ${branch}: ${buildResult.message} ${deployResult.message}`,
      image: deployResult.image,
      commitSha: deployResult.commitSha,
      serviceId: deployResult.serviceId,
    };
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
