import assert from "node:assert/strict";
import test from "node:test";
import {
  createGiteaInstallHandler,
  createN8nInstallHandler,
  createPostgresqlInstallHandler,
  createProjectBuildHandler,
  createProjectDeployHandler,
  createProjectPushDeployHandler,
  createProjectUndeployHandler,
  createRegistryConfigureHandler,
  createSwarmNodeEnrollHandler,
  createServiceRestartHandler,
  createServiceScaleHandler,
  createContainerOperationHandler,
  createTaskQueueWorker,
  TaskExecutionError,
} from "../task-queue.mjs";

const task = {
  id: "d909f79b-e7f9-41e7-9e7a-6ea000000001",
  type: "service.restart",
  payload: {
    serviceId: "7p9aac885t16uxz1f5gdftz17",
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

test("dispatches a container stop through the host agent and waits for completion", async () => {
  const containerTask = {
    id: task.id,
    type: "container.operation",
    payload: {
      serviceId: task.payload.serviceId,
      serviceName: task.payload.serviceName,
      containerId: "a".repeat(64),
      containerName: "manager.1.example",
      action: "stop",
    },
  };
  const requests = [];
  const handler = createContainerOperationHandler({
    async requestContainerOperation(operation, serviceId, containerId, requestId) {
      requests.push({ operation, serviceId, containerId, requestId });
    },
    async getStatus() {
      return { id: containerTask.id, state: "succeeded", message: "Swarm repondrá la tarea." };
    },
  });

  assert.deepEqual(await handler(containerTask, new AbortController().signal), {
    message: "Swarm repondrá la tarea.",
  });
  assert.deepEqual(requests, [{
    operation: "stop-container",
    serviceId: containerTask.payload.serviceId,
    containerId: containerTask.payload.containerId,
    requestId: containerTask.id,
  }]);
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

  test("installs n8n through the fixed host-agent operation and returns its HTTPS URL", async () => {
    const n8nTask = {
      id: task.id,
      type: "application.n8n.install",
      payload: { domain: "automation.example.com" },
    };
    const requests = [];
    const handler = createN8nInstallHandler({
      async requestN8nInstall(domain, requestId) {
        requests.push({ domain, requestId });
      },
      async getStatus() {
        return {
          id: n8nTask.id,
          operation: "install-n8n",
          state: "succeeded",
          domain: n8nTask.payload.domain,
          message: "n8n ready",
        };
      },
    });

    assert.deepEqual(await handler(n8nTask, new AbortController().signal), {
      message: "n8n está disponible en https://automation.example.com/.",
      url: "https://automation.example.com/",
    });
    assert.deepEqual(requests, [{
      domain: n8nTask.payload.domain,
      requestId: n8nTask.id,
    }]);
  });

  assert.deepEqual(await handler(giteaTask, new AbortController().signal), {
    message: "Gitea está disponible en https://git.example.com/. Las credenciales de administrador están disponibles una sola vez.",
    url: "https://git.example.com/",
    credentialsAvailable: true,
  });
  assert.deepEqual(requests, [{ domain: "git.example.com", requestId: giteaTask.id }]);
});

test("installs local Gitea on the loopback-only test URL", async () => {
  const giteaTask = {
    id: task.id,
    type: "application.gitea.install",
    payload: { domain: "localhost" },
  };
  const handler = createGiteaInstallHandler({
    async requestGiteaInstall() {},
    async getStatus() {
      return {
        id: giteaTask.id,
        operation: "install-gitea",
        state: "succeeded",
        domain: "localhost",
        credentialsAvailable: true,
        message: "Gitea local listo.",
      };
    },
  });

  assert.deepEqual(await handler(giteaTask, new AbortController().signal), {
    message: "Gitea está disponible por túnel SSH en http://localhost:3001/gitea/. Las credenciales están disponibles una sola vez.",
    url: "http://localhost:3001/gitea/",
    credentialsAvailable: true,
  });
});

test("returns Gitea HTTPS migration success without exposing new credentials", async () => {
  const migrationTask = {
    id: task.id,
    type: "application.gitea.install",
    payload: { domain: "git.example.com" },
  };
  const message = "Gitea migró a HTTPS; se conservaron los datos y las credenciales existentes.";
  const handler = createGiteaInstallHandler({
    async requestGiteaInstall() {},
    async getStatus() {
      return {
        id: migrationTask.id,
        operation: "install-gitea",
        state: "succeeded",
        domain: migrationTask.payload.domain,
        credentialsAvailable: false,
        message,
      };
    },
  });

  assert.deepEqual(await handler(migrationTask, new AbortController().signal), {
    message,
    url: "https://git.example.com/",
    credentialsAvailable: false,
  });
});

test("builds and deploys the exact commit from an authenticated production push", async () => {
  const projectId = "6a07c6bf-bb29-4e8f-a41f-8347b04d7601";
  const commitSha = "a".repeat(40);
  const requests = [];
  let status;
  const agent = {
    async stageProjectBuildArchive(id, archive) {
      requests.push({ operation: "stage", id, archive: archive.toString() });
    },
    async requestProjectBuild(id, sha, requestId) {
      requests.push({ operation: "build", id, sha, requestId });
      status = {
        id: requestId,
        operation: "build-project",
        projectId: id,
        commitSha: sha,
        image: `registry.example.com/project:${sha}`,
        state: "succeeded",
      };
    },
    async removeProjectBuildArchive(id) {
      requests.push({ operation: "remove", id });
    },
    async requestProjectDeploy(id, sha, requestId) {
      requests.push({ operation: "deploy", id, sha, requestId });
      status = {
        id: requestId,
        operation: "deploy-project",
        projectId: id,
        commitSha: sha,
        image: `registry.example.com/project:${sha}`,
        serviceId: "service-id",
        state: "succeeded",
      };
    },
    async getStatus() {
      return status;
    },
  };
  const buildSources = [];
  const handler = createProjectPushDeployHandler({
    agent,
    async getBuildSource(source) {
      buildSources.push(source);
      return { commitSha, archive: Buffer.from("source archive") };
    },
    pollIntervalMs: 100,
  });
  const pushTask = {
    id: task.id,
    type: "project.push-deploy",
    attempts: 1,
    payload: {
      projectId,
      projectName: "Website",
      repository: "vpsadmin/project",
      branch: "main",
      commitSha,
    },
  };

  assert.deepEqual(await handler(pushTask, new AbortController().signal), {
    message: `Push a main: Imagen construida para Website (main · ${commitSha.slice(0, 12)}). Servicio global de Website desplegado con el commit ${commitSha.slice(0, 12)}; Swarm programa una tarea por nodo activo y no se publicaron puertos.`,
    image: `registry.example.com/project:${commitSha}`,
    commitSha,
    serviceId: "service-id",
  });
  assert.deepEqual(buildSources, [{
    projectId,
    projectName: "Website",
    repository: "vpsadmin/project",
    branch: "main",
    commitSha,
    sourceType: "github",
  }]);
  assert.deepEqual(requests.map(({ operation }) => operation), ["stage", "build", "remove", "deploy"]);
  assert.equal(requests[1].sha, commitSha);
  assert.equal(requests[3].sha, commitSha);
  assert.notEqual(requests[1].requestId, requests[3].requestId);
});

test("installs PostgreSQL through the fixed host-agent operation without storing credentials", async () => {
  const postgresqlTask = {
    id: task.id,
    type: "application.postgresql.install",
    payload: {},
  };
  const requests = [];
  const handler = createPostgresqlInstallHandler({
    async requestPostgresqlInstall(requestId) {
      requests.push(requestId);
    },
    async getStatus() {
      return {
        id: postgresqlTask.id,
        operation: "install-postgresql",
        state: "succeeded",
        credentialsAvailable: true,
        message: "PostgreSQL listo.",
      };
    },
  });

  assert.deepEqual(await handler(postgresqlTask, new AbortController().signal), {
    message: "PostgreSQL está disponible en la red privada de Swarm como vps-manager-postgresql:5432.",
    credentialsAvailable: true,
  });
  assert.deepEqual(requests, [postgresqlTask.id]);
  await assert.rejects(
    handler({ ...postgresqlTask, payload: { password: "must-not-persist" } }, new AbortController().signal),
    { retryable: false },
  );
});

test("publishes a project image from a bounded source archive without deploying it", async () => {
  const projectTask = {
    id: "d909f79b-e7f9-41e7-9e7a-6ea000000001",
    type: "project.build",
    payload: {
      projectId: "9a7f51bd-13bf-4c7a-9b03-9ba000000002",
      projectName: "project",
      repository: "vpsadmin/project",
      branch: "main",
    },
  };
  const commitSha = "a".repeat(40);
  const archive = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const calls = [];
  let operation;
  const handler = createProjectBuildHandler({
    agent: {
      async stageProjectBuildArchive(id, input) { calls.push(["stage", id, input]); },
      async requestProjectBuild(projectId, sha, id) {
        calls.push(["request", projectId, sha, id]);
        operation = {
          id,
          operation: "build-project",
          state: "succeeded",
          projectId,
          commitSha: sha,
          image: `registry.example.com/vps-manager-project-${projectId.replaceAll("-", "")}:${sha}`,
        };
      },
      async getStatus() { return operation; },
      async removeProjectBuildArchive(id) { calls.push(["remove", id]); },
    },
    async getBuildSource({ repository, branch }) {
      calls.push(["source", repository, branch]);
      return { commitSha, archive };
    },
  });

  assert.deepEqual(await handler(projectTask, new AbortController().signal), {
    message: `Imagen construida para project (main · ${commitSha.slice(0, 12)}).`,
    image: `registry.example.com/vps-manager-project-${projectTask.payload.projectId.replaceAll("-", "")}:${commitSha}`,
    commitSha,
    branch: "main",
  });
  assert.deepEqual(calls, [
    ["source", "vpsadmin/project", "main"],
    ["stage", projectTask.id, archive],
    ["request", projectTask.payload.projectId, commitSha, projectTask.id],
    ["remove", projectTask.id],
  ]);
});

test("deploys the last successful image as a manual Swarm task", async () => {
  const projectId = "9a7f51bd-13bf-4c7a-9b03-9ba000000002";
  const commitSha = "a".repeat(40);
  const deployTask = {
    id: "d909f79b-e7f9-41e7-9e7a-6ea000000001",
    type: "project.deploy",
    payload: { projectId, projectName: "project", commitSha },
  };
  const calls = [];
  const handler = createProjectDeployHandler({
    async requestProjectDeploy(id, sha, taskId) {
      calls.push(["request", id, sha, taskId]);
    },
    async getStatus() {
      return {
        id: deployTask.id,
        operation: "deploy-project",
        state: "succeeded",
        projectId,
        commitSha,
        serviceId: "7p9aac885t16uxz1f5gdftz17",
        image: `registry.example.com/vps-manager-project-${projectId.replaceAll("-", "")}:${commitSha}`,
        message: "Servicio desplegado.",
      };
    },
  }, { pollIntervalMs: 100 });

  assert.deepEqual(await handler(deployTask, new AbortController().signal), {
    message: `Servicio global de project desplegado con el commit ${commitSha.slice(0, 12)}; Swarm programa una tarea por nodo activo y no se publicaron puertos.`,
    image: `registry.example.com/vps-manager-project-${projectId.replaceAll("-", "")}:${commitSha}`,
    commitSha,
    serviceId: "7p9aac885t16uxz1f5gdftz17",
  });
  assert.deepEqual(calls, [["request", projectId, commitSha, deployTask.id]]);
});

test("removes a project's Swarm service through the same fixed host agent", async () => {
  const undeployTask = {
    id: "d909f79b-e7f9-41e7-9e7a-6ea000000001",
    type: "project.undeploy",
    payload: {
      projectId: "9a7f51bd-13bf-4c7a-9b03-9ba000000002",
      projectName: "project",
    },
  };
  let request;
  const handler = createProjectUndeployHandler({
    async requestProjectUndeploy(projectId, id) { request = [projectId, id]; },
    async getStatus() {
      return {
        id: undeployTask.id,
        operation: "remove-project",
        state: "succeeded",
        projectId: undeployTask.payload.projectId,
        message: "Servicio retirado.",
      };
    },
  }, { pollIntervalMs: 100 });

  assert.deepEqual(await handler(undeployTask, new AbortController().signal), {
    message: "Se retiró el servicio Swarm de project.",
  });
  assert.deepEqual(request, [undeployTask.payload.projectId, undeployTask.id]);
});

test("configures a private registry through a fixed host operation without persisting the password in task payload", async () => {
  const task = {
    id: "d909f79b-e7f9-41e7-9e7a-6ea000000001",
    type: "registry.configure",
    payload: { domain: "registry.example.com", username: "registry-user" },
  };
  const calls = [];
  const handler = createRegistryConfigureHandler({
    async requestRegistryConfiguration(domain, username, id) {
      calls.push(["request", domain, username, id]);
    },
    async getStatus() {
      return {
        id: task.id,
        operation: "configure-registry",
        state: "succeeded",
        domain: task.payload.domain,
        username: task.payload.username,
        message: "Registro configurado.",
      };
    },
    async removeRegistryCredentials(id) { calls.push(["remove", id]); },
  });

  assert.deepEqual(await handler(task, new AbortController().signal), {
    message: "Registro configurado.",
    domain: "registry.example.com",
  });
  assert.deepEqual(calls, [
    ["request", "registry.example.com", "registry-user", task.id],
    ["remove", task.id],
  ]);
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

test("enrolls a Swarm node through the host agent and removes the staged SSH key", async () => {
  const nodeTask = {
    id: task.id,
    type: "swarm.node.enroll",
    payload: {
      address: "10.10.0.12",
      sshUser: "vpsadmin",
      sshPort: 22,
      hostFingerprint: `SHA256:${"A".repeat(43)}`,
      privateCidr: "10.10.0.0/24",
      managerAddress: "10.10.0.2",
      role: "worker",
    },
  };
  const calls = [];
  const handler = createSwarmNodeEnrollHandler({
    async requestSwarmNodeEnrollment(node, id) { calls.push(["request", node.address, id]); },
    async getStatus() {
      return {
        id: nodeTask.id,
        operation: "enroll-swarm-node",
        state: "succeeded",
        nodeAddress: nodeTask.payload.address,
        role: nodeTask.payload.role,
        nodeId: "7p9aac885t16uxz1f5gdftz17",
        message: "ready",
      };
    },
    async removeNodeCredentials(id) { calls.push(["remove", id]); },
  }, { pollIntervalMs: 100, maximumDurationMs: 1000 });

  assert.deepEqual(await handler(nodeTask, new AbortController().signal), {
    message: "El nodo 10.10.0.12 se unió al Swarm como worker.",
    nodeId: "7p9aac885t16uxz1f5gdftz17",
    nodeAddress: "10.10.0.12",
  });
  assert.deepEqual(calls, [
    ["request", nodeTask.payload.address, nodeTask.id],
    ["remove", nodeTask.id],
  ]);
});
