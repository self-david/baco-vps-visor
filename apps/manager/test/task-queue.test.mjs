import assert from "node:assert/strict";
import test from "node:test";
import {
  createGiteaInstallHandler,
  createServiceRestartHandler,
  createServiceScaleHandler,
  createTaskQueueWorker,
  TaskExecutionError,
} from "../task-queue.mjs";

const task = {
  id: "d909f79b-e7f9-41e7-9e7a-6ea000000001",
  type: "service.restart",
  payload: {
    serviceId: "9a7f51bdff120d8d0d48d4ca5",
    serviceName: "manager",
  },
};
const workerId = "a3f51b09-13bf-4c7a-9b03-9ba000000002";

function createStore(taskToClaim = task) {
  const calls = [];
  let pending = taskToClaim;
  return {
    calls,
    async claimNextTask(id) {
      calls.push(["claim", id]);
      const result = pending;
      pending = null;
      return result;
    },
    async renewTaskLease(...args) {
      calls.push(["renew", ...args]);
      return true;
    },
    async completeTask(...args) {
      calls.push(["complete", ...args]);
      return true;
    },
    async failTask(...args) {
      calls.push(["fail", ...args]);
      return true;
    },
  };
}

test("runs a registered handler and persists its result", async () => {
  const store = createStore();
  const worker = createTaskQueueWorker({
    store,
    workerId,
    handlers: { "service.restart": async () => ({ message: "done" }) },
  });

  assert.equal(await worker.runOnce(), true);
  assert.equal(await worker.runOnce(), false);
  assert.deepEqual(store.calls.find(([action]) => action === "complete"), [
    "complete",
    task.id,
    workerId,
    { message: "done" },
  ]);
});

test("retries recoverable handler errors and terminalizes unregistered task types", async () => {
  const retryStore = createStore();
  const retryWorker = createTaskQueueWorker({
    store: retryStore,
    workerId,
    handlers: { "service.restart": async () => { throw new Error("temporary"); } },
  });
  await retryWorker.runOnce();
  assert.deepEqual(retryStore.calls.find(([action]) => action === "fail"), [
    "fail",
    task.id,
    workerId,
    "temporary",
    true,
  ]);

  const unknownTaskStore = createStore({ ...task, type: "toString" });
  const unknownTaskWorker = createTaskQueueWorker({
    store: unknownTaskStore,
    workerId,
    handlers: {},
  });
  await unknownTaskWorker.runOnce();
  assert.equal(unknownTaskStore.calls.find(([action]) => action === "fail")[4], false);
});

test("resumes a service operation by its durable task ID and does not repeat completed work", async () => {
  const statusSequence = [
    { id: task.id, state: "running" },
    { id: task.id, state: "succeeded", message: "Servicio reiniciado." },
  ];
  const requests = [];
  const handler = createServiceRestartHandler({
    async requestRestart(serviceId, requestId) {
      requests.push({ serviceId, requestId });
      return { id: requestId, state: "running" };
    },
    async getStatus() {
      return statusSequence.shift();
    },
  }, { pollIntervalMs: 100 });

  assert.deepEqual(await handler(task, new AbortController().signal), {
    message: "Servicio reiniciado.",
  });
  assert.deepEqual(requests, [{ serviceId: task.payload.serviceId, requestId: task.id }]);
});

test("dispatches scale tasks through the scale-only agent method", async () => {
  const scaleTask = {
    ...task,
    type: "service.scale",
    payload: { ...task.payload, originalReplicas: 2, desiredReplicas: 5 },
  };
  const requests = [];
  const handler = createServiceScaleHandler({
    async requestScale(serviceId, replicas, requestId) {
      requests.push({ serviceId, replicas, requestId });
      return { id: requestId, state: "running" };
    },
    async getStatus() {
      return {
        id: scaleTask.id,
        state: "succeeded",
        message: "Escalado solicitado.",
      };
    },
  });
  assert.deepEqual(await handler(scaleTask, new AbortController().signal), {
    message: "Escalado solicitado.",
  });
  assert.deepEqual(requests, [{
    serviceId: scaleTask.payload.serviceId,
    replicas: 5,
    requestId: scaleTask.id,
  }]);
});

test("installs Gitea through the fixed agent operation and stores no credentials in task results", async () => {
  const giteaTask = {
    id: task.id,
    type: "application.gitea.install",
    payload: { domain: "git.example.com" },
  };
  const requests = [];
  const handler = createGiteaInstallHandler({
    async requestGiteaInstall(domain, requestId) {
      requests.push({ domain, requestId });
    },
    async getStatus() {
      return {
        id: giteaTask.id,
        operation: "install-gitea",
        state: "succeeded",
        domain: "git.example.com",
        credentialsAvailable: true,
        message: "Gitea instalado.",
      };
    },
  });

  assert.deepEqual(await handler(giteaTask, new AbortController().signal), {
    message: "Gitea está disponible en https://git.example.com/. Las credenciales de administrador están disponibles una sola vez.",
    url: "https://git.example.com/",
    credentialsAvailable: true,
  });
  assert.deepEqual(requests, [{ domain: "git.example.com", requestId: giteaTask.id }]);
});

test("does not automatically retry a host-reported operation failure", async () => {
  const handler = createServiceRestartHandler({
    async requestRestart() {
      return { id: task.id, state: "failed" };
    },
    async getStatus() {
      return { id: task.id, state: "failed", message: "Docker rechazó el reinicio." };
    },
  });

  await assert.rejects(handler(task, new AbortController().signal), (error) =>
    error instanceof TaskExecutionError && error.retryable === false);
});
