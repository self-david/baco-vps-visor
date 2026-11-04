import assert from "node:assert/strict";
import test from "node:test";
import { createTaskStore } from "../service-task-store.mjs";

const taskId = "d909f79b-e7f9-41e7-9e7a-6ea000000001";
const workerId = "a3f51b09-13bf-4c7a-9b03-9ba000000002";
const serviceId = "7p9aac885t16uxz1f5gdftz17";

function createFakePool({ projects = [] } = {}) {
  const tasks = new Map();
  const deliveries = new Set();
  const auditEvents = [];
  const pool = {
    async connect() {
      let snapshot;
      let deliverySnapshot;
      let auditSize;
      return {
        async query(sql, values = []) {
          if (sql === "BEGIN") {
            snapshot = structuredClone(tasks);
            deliverySnapshot = new Set(deliveries);
            auditSize = auditEvents.length;
            return { rowCount: 0 };
          }
          if (sql === "COMMIT") return { rowCount: 0 };
          if (sql === "ROLLBACK") {
            tasks.clear();
            for (const [id, task] of snapshot ?? []) tasks.set(id, task);
            deliveries.clear();
            for (const id of deliverySnapshot ?? []) deliveries.add(id);
            auditEvents.length = auditSize ?? auditEvents.length;
            return { rowCount: 0 };
          }
          if (sql.includes("pg_advisory_xact_lock")) return { rowCount: 1 };
          if (sql.includes("INSERT INTO gitea_webhook_deliveries")
            || sql.includes("INSERT INTO github_webhook_deliveries")) {
            if (deliveries.has(values[0])) return { rowCount: 0, rows: [] };
            deliveries.add(values[0]);
            return { rowCount: 1, rows: [{ delivery_id: values[0] }] };
          }
          if (sql.includes("SELECT id, name") && sql.includes("FROM projects")) {
            if (sql.includes("WHERE id = $1")) {
              const provider = values[3];
              const project = projects.find((item) => item.id === values[0]
                && item.repository === values[1] && item.productionBranch === values[2]
                && (provider === "gitea" || (item.sourceType === "github" && item.autoDeploy)));
              return { rowCount: project ? 1 : 0, rows: project ? [{ id: project.id, name: project.name }] : [] };
            }
            const provider = values[2];
            const matches = projects.filter((project) =>
              project.repository === values[0] && project.productionBranch === values[1]
              && (provider === "gitea" || (project.sourceType === "github" && project.autoDeploy)));
            return { rowCount: matches.length, rows: matches.map(({ id, name }) => ({ id, name })) };
          }
          if (sql.includes("FROM projects")) return { rowCount: 1, rows: [{ id: values[0] }] };
          if (sql.includes("SELECT id FROM tasks") && sql.includes("status IN")) {
            const isProjectBuildLock = sql.includes("type IN ('project.build', 'project.push-deploy')");
            const isProjectDeployLock = sql.includes("'project.undeploy', 'project.push-deploy')");
            const active = [...tasks.values()].find((task) => {
              const matchesType = isProjectBuildLock
                ? ["project.build", "project.push-deploy"].includes(task.type)
                : isProjectDeployLock
                  ? ["project.deploy", "project.undeploy", "project.push-deploy"].includes(task.type)
                  : task.type === values[0];
              return matchesType
                && task.payload.projectId === (isProjectBuildLock || isProjectDeployLock ? values[0] : values[1])
                && ["pending", "in_progress"].includes(task.status);
            });
            return { rowCount: active ? 1 : 0, rows: active ? [{ id: active.id }] : [] };
          }
          if (sql.includes("INSERT INTO tasks")) {
            const isPushDeploy = sql.includes("'project.push-deploy'");
            const [id, typeOrPayload, payloadOrMaxAttempts, maxAttemptsValue] = values;
            const type = isPushDeploy ? "project.push-deploy" : typeOrPayload;
            const payload = isPushDeploy ? typeOrPayload : payloadOrMaxAttempts;
            const maxAttempts = isPushDeploy ? payloadOrMaxAttempts : maxAttemptsValue;
            tasks.set(id, {
              id,
              type,
              status: "pending",
              payload: JSON.parse(payload),
              result: null,
              error: null,
              attempts: 0,
              max_attempts: maxAttempts,
              next_attempt_at: new Date(Date.now() - 10_000),
              lease_token: null,
              lease_expires_at: null,
              created_at: new Date("2026-11-03T18:00:00Z"),
              updated_at: new Date("2026-11-03T18:00:00Z"),
              started_at: null,
              completed_at: null,
            });
            return { rowCount: 1 };
          }
          if (sql.includes("UPDATE tasks") && sql.includes("attempts >= max_attempts")) {
            return { rows: [] };
          }
          if (sql.includes("WITH next_task")) {
            const [token, leaseSeconds] = values;
            const task = [...tasks.values()]
              .sort((left, right) => left.created_at - right.created_at)
              .find((candidate) =>
                (candidate.status === "pending"
                  && candidate.next_attempt_at <= new Date()
                  && candidate.attempts < candidate.max_attempts)
                || (candidate.status === "in_progress"
                  && candidate.lease_expires_at <= new Date()
                  && candidate.attempts < candidate.max_attempts));
            if (!task) return { rows: [] };
            task.status = "in_progress";
            task.attempts += 1;
            task.started_at ??= new Date("2026-11-03T18:01:00Z");
            task.updated_at = new Date("2026-11-03T18:01:00Z");
            task.lease_token = token;
            task.lease_expires_at = new Date(Date.now() + leaseSeconds * 1000);
            return { rows: [task] };
          }
          if (sql.includes("SET status = 'completed'")) {
            const [id, token, result] = values;
            const task = tasks.get(id);
            if (!task || task.status !== "in_progress" || task.lease_token !== token) {
              return { rowCount: 0, rows: [] };
            }
            task.status = "completed";
            task.result = JSON.parse(result);
            task.error = null;
            task.completed_at = new Date("2026-11-03T18:02:00Z");
            task.lease_token = null;
            task.lease_expires_at = null;
            return { rowCount: 1, rows: [{ type: task.type }] };
          }
          if (sql.includes("SET status = CASE")) {
            const [id, token, retryable, message] = values;
            const task = tasks.get(id);
            if (!task || task.status !== "in_progress" || task.lease_token !== token) {
              return { rowCount: 0, rows: [] };
            }
            task.error = message;
            task.lease_token = null;
            task.lease_expires_at = null;
            if (retryable && task.attempts < task.max_attempts) {
              task.status = "pending";
              task.next_attempt_at = new Date(Date.now() + 1000);
              task.completed_at = null;
            } else {
              task.status = "failed";
              task.completed_at = new Date("2026-11-03T18:02:00Z");
            }
            return {
              rowCount: 1,
              rows: [{
                type: task.type,
                status: task.status,
                attempts: task.attempts,
                max_attempts: task.max_attempts,
              }],
            };
          }
          throw new Error(`Unexpected client query: ${sql}`);
        },
        release() {},
      };
    },
    async query(sql, values = []) {
      if (sql.includes("SET lease_expires_at")) {
        const [id, token, leaseSeconds] = values;
        const task = tasks.get(id);
        if (!task || task.status !== "in_progress" || task.lease_token !== token) {
          return { rowCount: 0 };
        }
        task.lease_expires_at = new Date(Date.now() + leaseSeconds * 1000);
        return { rowCount: 1 };
      }
      if (sql.includes("SELECT id, type, status, payload")) {
        if (sql.includes("WHERE id = $1")) {
          const task = tasks.get(values[0]);
          return { rows: task ? [task] : [] };
        }
        if (sql.includes("WHERE type = $1")) {
          const task = [...tasks.values()]
            .filter((candidate) => candidate.type === values[0])
            .sort((left, right) => right.created_at - left.created_at || right.id.localeCompare(left.id))[0];
          return { rows: task ? [task] : [] };
        }
        return {
          rows: [...tasks.values()]
            .sort((left, right) => right.created_at - left.created_at)
            .slice(0, values[0]),
        };
      }
      if (sql.includes("SELECT DISTINCT ON (payload->>'projectId', result->>'commitSha')")) {
        const projectIds = values[0];
        return {
          rows: [...tasks.values()]
            .filter((candidate) => ["project.deploy", "project.push-deploy"].includes(candidate.type)
              && candidate.status === "completed"
              && projectIds.includes(candidate.payload.projectId)
              && candidate.result?.image
              && candidate.result?.commitSha),
        };
      }
      if (sql.includes("FROM tasks") && sql.includes("type IN ('project.deploy', 'project.push-deploy')")) {
        const projectIds = values[0];
        return {
          rows: [...tasks.values()]
            .filter((candidate) => ["project.deploy", "project.push-deploy"].includes(candidate.type)
              && projectIds.includes(candidate.payload.projectId))
            .sort((left, right) => right.created_at - left.created_at || right.id.localeCompare(left.id)),
        };
      }
      if (sql.includes("SELECT DISTINCT ON (payload->>'projectId')")) {
        const projectIds = values[0];
        return {
          rows: [...tasks.values()]
            .filter((candidate) => ["project.build", "project.push-deploy"].includes(candidate.type)
              && candidate.status === "completed"
              && projectIds.includes(candidate.payload.projectId)
              && candidate.result?.image
              && candidate.result?.commitSha),
        };
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    },
  };
  const store = createTaskStore({
    pool,
    insertAuditEvent: async (_client, event) => auditEvents.push(event),
  });
  return { pool, store, tasks, deliveries, auditEvents };
}

test("persists service requests and audit events in one transaction", async () => {
  const { store, tasks, auditEvents } = createFakePool();
  await store.createTask({
    id: taskId,
    type: "service.restart",
    payload: { serviceId, serviceName: "vps-manager_manager" },
  });

  assert.equal(tasks.get(taskId).status, "pending");
  assert.deepEqual(tasks.get(taskId).payload, { serviceId, serviceName: "vps-manager_manager" });
  assert.equal(auditEvents[0].action, "service.restart.requested");
  assert.equal(auditEvents[0].resourceId, serviceId);
  assert.deepEqual(auditEvents[0].details, {
    serviceName: "vps-manager_manager",
    taskId,
  });
});

test("records Gitea deliveries and queues only production-branch deployments atomically", async () => {
  const projectId = "6a07c6bf-bb29-4e8f-a41f-8347b04d7601";
  const deliveryId = "e3f2a4d6-1234-4abc-8def-0123456789ab";
  const commitSha = "a".repeat(40);
  const { store, tasks, deliveries, auditEvents } = createFakePool({
    projects: [
      { id: projectId, name: "Website", repository: "vpsadmin/project", productionBranch: "main" },
      { id: "72a6e6cd-5adf-465f-97db-17960a941fb2", name: "Preview", repository: "vpsadmin/project", productionBranch: "preview" },
    ],
  });

  assert.equal(await store.recordGiteaWebhookDelivery({
    deliveryId,
    event: "push",
    repository: "vpsadmin/project",
    ref: "refs/heads/main",
    commitSha,
  }), true);
  assert.equal(deliveries.has(deliveryId), true);
  assert.equal(tasks.size, 1);
  const [task] = tasks.values();
  assert.equal(task.type, "project.push-deploy");
  assert.deepEqual(task.payload, {
    projectId,
    projectName: "Website",
    repository: "vpsadmin/project",
    branch: "main",
    commitSha,
  });
  assert.equal(auditEvents[0].action, "project.push-deploy.requested");
  task.status = "completed";
  task.result = { message: "Deploy completo.", image: `registry.example.com/project:${commitSha}`, commitSha, serviceId };
  assert.equal((await store.getLatestProjectBuilds([projectId]))[0].type, "project.push-deploy");
  assert.equal((await store.getRecentProjectDeployments([projectId]))[0].result.serviceId, serviceId);

  assert.equal(await store.recordGiteaWebhookDelivery({
    deliveryId,
    event: "push",
    repository: "vpsadmin/project",
    ref: "refs/heads/main",
    commitSha,
  }), false);
  assert.equal(await store.recordGiteaWebhookDelivery({
    deliveryId: "e3f2a4d6-1234-4abc-8def-0123456789ac",
    event: "push",
    repository: "vpsadmin/project",
    ref: "refs/heads/feature",
    commitSha,
  }), true);
  assert.equal(await store.recordGiteaWebhookDelivery({
    deliveryId: "e3f2a4d6-1234-4abc-8def-0123456789ad",
    event: "push",
    repository: "vpsadmin/project",
    ref: "refs/tags/v1.0.0",
    commitSha,
  }), true);
  assert.equal(tasks.size, 1);
});

test("records GitHub deliveries and queues only enabled production-branch projects", async () => {
  const projectId = "6a07c6bf-bb29-4e8f-a41f-8347b04d7601";
  const commitSha = "a".repeat(40);
  const { store, tasks } = createFakePool({
    projects: [
      {
        id: projectId,
        name: "Website",
        repository: "example-org/site",
        productionBranch: "main",
        sourceType: "github",
        autoDeploy: true,
      },
      {
        id: "72a6e6cd-5adf-465f-97db-17960a941fb2",
        name: "Preview",
        repository: "example-org/site",
        productionBranch: "main",
        sourceType: "github",
        autoDeploy: false,
      },
    ],
  });
  assert.equal(await store.recordGithubWebhookDelivery({
    deliveryId: "e3f2a4d6-1234-4abc-8def-0123456789ab",
    event: "push",
    repository: "example-org/site",
    ref: "refs/heads/main",
    commitSha,
  }), true);
  assert.equal(tasks.size, 1);
  assert.equal([...tasks.values()][0].payload.projectId, projectId);
  await assert.rejects(store.recordGithubWebhookDelivery({
    deliveryId: "e3f2a4d6-1234-4abc-8def-0123456789ac",
    event: "push",
    repository: "example-org/site",
    ref: "refs/heads/main",
    commitSha: "b".repeat(64),
  }), TypeError);
});

test("stores registered task types while keeping handler payloads out of public history", async () => {
  const { store } = createFakePool();
  await store.createTask({
    id: taskId,
    type: "backup.create",
    payload: { destination: "encrypted-store", credential: "do-not-expose" },
  });

  const claimed = await store.claimNextTask(workerId);
  assert.equal(claimed.type, "backup.create");
  assert.equal(claimed.payload.credential, "do-not-expose");
  const [historyTask] = await store.listRecentTasks();
  assert.equal(Object.hasOwn(historyTask, "payload"), false);
  assert.equal(Object.hasOwn(historyTask, "serviceId"), false);
});

test("persists original and desired replica counts for service scale tasks", async () => {
  const { store } = createFakePool();
  await store.createTask({
    id: taskId,
    type: "service.scale",
    payload: {
      serviceId,
      serviceName: "api",
      originalReplicas: 2,
      desiredReplicas: 4,
    },
  });
  const [historyTask] = await store.listRecentTasks();
  assert.equal(historyTask.originalReplicas, 2);
  assert.equal(historyTask.desiredReplicas, 4);
  assert.equal((await store.listRecentTasks())[0].serviceName, "api");
  await assert.rejects(store.createTask({
    id: "f3a5e0bb-4911-4d38-8846-04bd9c917134",
    type: "service.scale",
    payload: {
      serviceId,
      serviceName: "api",
      originalReplicas: 2,
      desiredReplicas: 101,
    },
  }), /fields are invalid/);
});

test("persists bounded operations for managed containers", async () => {
  const { store, tasks } = createFakePool();
  const payload = {
    serviceId,
    serviceName: "api",
    containerId: "a".repeat(64),
    containerName: "api.1.example",
    action: "stop",
  };
  await store.createTask({
    id: taskId,
    type: "container.operation",
    payload,
  });
  assert.deepEqual(tasks.get(taskId).payload, payload);
  const [historyTask] = await store.listRecentTasks();
  assert.equal(historyTask.containerAction, "stop");
  assert.equal(historyTask.containerName, "api.1.example");
  await assert.rejects(store.createTask({
    id: workerId,
    type: "container.operation",
    payload: { ...payload, action: "delete" },
  }), /fields are invalid/);
});

test("looks up Gitea tasks independently of the truncated task-history list", async () => {
  const { store } = createFakePool();
  const giteaTask = {
    id: taskId,
    type: "application.gitea.install",
    payload: { domain: "git.example.com" },
  };
  await store.createTask(giteaTask);

  assert.equal((await store.getTaskById(taskId)).domain, "git.example.com");
  assert.equal((await store.getLatestTaskByType("application.gitea.install")).id, taskId);
  assert.equal(await store.getTaskById("f3a5e0bb-4911-4d38-8846-04bd9c917134"), null);
  await assert.rejects(store.getTaskById("invalid"), /identifier is invalid/);
});

test("serializes n8n installation tasks without persisting encryption secrets", async () => {
  const { pool, tasks } = createFakePool();
  const store = createTaskStore({ pool, insertAuditEvent: async () => {} });
  const n8nTask = {
    id: taskId,
    type: "application.n8n.install",
    payload: { domain: "automation.example.com" },
    maxAttempts: 1,
  };
  await store.createTask(n8nTask);
  assert.deepEqual(tasks.get(taskId).payload, n8nTask.payload);
  assert.equal((await store.getTaskById(taskId)).domain, n8nTask.payload.domain);
  await assert.rejects(store.createTask({ ...n8nTask, id: workerId }), {
    code: "APPLICATION_TASK_IN_PROGRESS",
  });
  await assert.rejects(store.createTask({
    ...n8nTask,
    id: workerId,
    payload: { ...n8nTask.payload, encryptionKey: "must-not-persist" },
  }), /fields are invalid/);
});

test("serializes PostgreSQL install tasks without passwords in task payloads or results", async () => {
  const { pool, tasks } = createFakePool();
  const store = createTaskStore({ pool, insertAuditEvent: async () => {} });
  const postgresqlTask = {
    id: taskId,
    type: "application.postgresql.install",
    payload: {},
    maxAttempts: 1,
  };
  await store.createTask(postgresqlTask);
  assert.deepEqual(tasks.get(taskId).payload, {});
  await assert.rejects(store.createTask({
    ...postgresqlTask,
    id: workerId,
    payload: { password: "must-not-persist" },
  }), /fields are invalid/);

  const storedTask = tasks.get(taskId);
  storedTask.status = "completed";
  storedTask.result = {
    message: "PostgreSQL instalado.",
    credentialsAvailable: true,
    password: "must-not-leak",
  };
  const listedTask = await store.listRecentTasks();
  assert.deepEqual(listedTask[0].result, {
    message: "PostgreSQL instalado.",
    credentialsAvailable: true,
  });
});

test("returns complete deployment history for selected projects", async () => {
  const { store, tasks } = createFakePool();
  const projectId = "d909f79b-e7f9-41e7-9e7a-6ea000000001";
  await store.createTask({
    id: taskId,
    type: "project.deploy",
    payload: { projectId, projectName: "web", commitSha: "a".repeat(40) },
  });
  const deployed = tasks.get(taskId);
  deployed.status = "completed";
  deployed.result = {
    message: "deployed",
    image: `registry.example/vps-manager-project-${projectId.replaceAll("-", "")}:${"a".repeat(40)}`,
    commitSha: "a".repeat(40),
    serviceId,
  };
  deployed.completed_at = new Date("2026-11-03T18:02:00Z");
  const failedId = "e3f2a4d6-1234-4abc-8def-0123456789ab";
  await store.createTask({
    id: failedId,
    type: "project.deploy",
    payload: { projectId, projectName: "web", commitSha: "b".repeat(40) },
  });
  const failed = tasks.get(failedId);
  failed.status = "failed";
  failed.error = "deployment failed";
  failed.updated_at = new Date("2026-11-03T18:03:00Z");
  const history = await store.getRecentProjectDeployments([projectId]);
  assert.equal(history.length, 2);
  assert.equal(history[0].status, "failed");
  assert.equal(history[1].result.commitSha, "a".repeat(40));
  assert.deepEqual(await store.getRecentProjectDeployments([]), []);
  await assert.rejects(store.getRecentProjectDeployments(["invalid"]), /identifiers are invalid/);
});

test("validates and serializes project image build tasks without allowing duplicate active builds", async () => {
  const { pool, tasks, auditEvents } = createFakePool();
  const store = createTaskStore({ pool, insertAuditEvent: async (_client, event) => auditEvents.push(event) });
  const projectId = "9a7f51bd-13bf-4c7a-9b03-9ba000000002";
  const task = {
    id: taskId,
    type: "project.build",
    payload: {
      projectId,
      projectName: "project",
      repository: "vpsadmin/project",
      branch: "release/1.0",
    },
  };
  await store.createTask(task);
  assert.deepEqual(tasks.get(taskId).payload, task.payload);
  await assert.rejects(store.createTask({
    ...task,
    id: workerId,
  }), { code: "PROJECT_BUILD_IN_PROGRESS" });
  assert.equal((await store.claimNextTask(workerId, 60)).projectName, "project");
});

test("serializes project deploy and removal tasks and lists the latest successful image", async () => {
  const { pool, tasks } = createFakePool();
  const store = createTaskStore({ pool, insertAuditEvent: async () => {} });
  const projectId = "9a7f51bd-13bf-4c7a-9b03-9ba000000002";
  const deployTask = {
    id: taskId,
    type: "project.deploy",
    payload: { projectId, projectName: "project", commitSha: "a".repeat(40) },
  };
  await store.createTask(deployTask);
  await assert.rejects(store.createTask({
    id: workerId,
    type: "project.undeploy",
    payload: { projectId, projectName: "project" },
  }), { code: "PROJECT_DEPLOYMENT_IN_PROGRESS" });
  assert.deepEqual(tasks.get(taskId).payload, deployTask.payload);
  await store.claimNextTask(workerId, 60);
  await store.completeTask(taskId, workerId, { message: "Servicio desplegado." });

  const buildId = "f3a5e0bb-4911-4d38-8846-04bd9c917134";
  await store.createTask({
    id: buildId,
    type: "project.build",
    payload: {
      projectId,
      projectName: "project",
      repository: "vpsadmin/project",
      branch: "main",
    },
  });
  await store.claimNextTask(workerId, 60);
  await store.completeTask(buildId, workerId, {
    message: "Imagen publicada.",
    image: `registry.example.com/vps-manager-project-${projectId.replaceAll("-", "")}:${"b".repeat(40)}`,
    commitSha: "b".repeat(40),
    branch: "main",
  });
  const [latestBuild] = await store.getLatestProjectBuilds([projectId]);
  assert.equal(latestBuild.projectId, projectId);
  assert.equal(latestBuild.result.commitSha, "b".repeat(40));
  assert.deepEqual(await store.getLatestProjectBuilds([]), []);
  await assert.rejects(store.getLatestProjectBuilds(["invalid"]), /identifiers are invalid/);
});

test("persists reusable registry configuration metadata without accepting credentials", async () => {
  const { pool, tasks } = createFakePool();
  const store = createTaskStore({ pool, insertAuditEvent: async () => {} });
  const registryTask = {
    id: taskId,
    type: "registry.configure",
    payload: { domain: "registry.example.com", username: "registry-user" },
  };
  await store.createTask(registryTask);
  assert.deepEqual(tasks.get(taskId).payload, registryTask.payload);
  assert.equal(Object.hasOwn(tasks.get(taskId).payload, "password"), false);
  await assert.rejects(store.createTask({
    ...registryTask,
    id: workerId,
  }), { code: "REGISTRY_CONFIGURATION_IN_PROGRESS" });
  await assert.rejects(store.createTask({
    id: workerId,
    type: "registry.configure",
    payload: { domain: "registry.example.com", username: "registry-user", password: "must-not-persist" },
  }), /fields are invalid/);
});

test("records Swarm node enrollment metadata without storing SSH private keys", async () => {
  const { pool, tasks, auditEvents } = createFakePool();
  const store = createTaskStore({ pool, insertAuditEvent: async (_client, event) => auditEvents.push(event) });
  const nodeTask = {
    id: taskId,
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
    maxAttempts: 1,
  };
  await store.createTask(nodeTask);
  assert.deepEqual(tasks.get(taskId).payload, nodeTask.payload);
  assert.equal(Object.hasOwn(tasks.get(taskId).payload, "privateKey"), false);
  assert.equal((await store.getTaskById(taskId)).nodeAddress, nodeTask.payload.address);
  assert.equal(auditEvents[0].details.address, nodeTask.payload.address);
  await assert.rejects(store.createTask({ ...nodeTask, id: workerId }), {
    code: "SWARM_NODE_ENROLLMENT_IN_PROGRESS",
  });
  await assert.rejects(store.createTask({
    ...nodeTask,
    id: workerId,
    payload: { ...nodeTask.payload, privateKey: "not-persisted" },
  }), /fields are invalid/);
});

test("claims tasks with a lease, records attempts and recovers expired work", async () => {
  const { store, tasks } = createFakePool();
  await store.createTask({
    id: taskId,
    type: "service.restart",
    payload: { serviceId, serviceName: "manager" },
  });

  const claimed = await store.claimNextTask(workerId, 60);
  assert.equal(claimed.status, "in_progress");
  assert.equal(claimed.attempts, 1);
  assert.equal(await store.claimNextTask(workerId, 60), null);
  assert.equal(await store.renewTaskLease(taskId, workerId, 60), true);
  assert.equal(await store.renewTaskLease(taskId, "f3a5e0bb-4911-4d38-8846-04bd9c917134", 60), false);

  tasks.get(taskId).lease_expires_at = new Date(Date.now() - 1000);
  const recovered = await store.claimNextTask(workerId, 60);
  assert.equal(recovered.id, taskId);
  assert.equal(recovered.attempts, 2);
});

test("records completion and only accepts updates from the current lease owner", async () => {
  const { store } = createFakePool();
  await store.createTask({
    id: taskId,
    type: "service.restart",
    payload: { serviceId, serviceName: "manager" },
  });
  await store.claimNextTask(workerId);

  assert.equal(await store.completeTask(taskId, "f3a5e0bb-4911-4d38-8846-04bd9c917134", {}), false);
  assert.equal(await store.completeTask(taskId, workerId, { message: "Servicio reiniciado." }), true);
  const [task] = await store.listRecentTasks();
  assert.equal(task.status, "completed");
  assert.deepEqual(task.result, { message: "Servicio reiniciado." });
  assert.equal(task.startedAt, "2026-11-03T18:01:00.000Z");
  assert.equal(task.completedAt, "2026-11-03T18:02:00.000Z");
});

test("retries recoverable failures and makes terminal failures auditable", async () => {
  const { store, tasks, auditEvents } = createFakePool();
  await store.createTask({
    id: taskId,
    type: "service.restart",
    payload: { serviceId, serviceName: "manager" },
    maxAttempts: 2,
  });
  await store.claimNextTask(workerId);
  const retry = await store.failTask(taskId, workerId, "El agente todavía no respondió.", true);
  assert.equal(retry.status, "pending");
  assert.equal(tasks.get(taskId).error, "El agente todavía no respondió.");

  tasks.get(taskId).next_attempt_at = new Date(Date.now() - 1000);
  await store.claimNextTask(workerId);
  const terminal = await store.failTask(taskId, workerId, "Docker rechazó el reinicio.", false);
  assert.equal(terminal.status, "failed");
  assert.equal(auditEvents.at(-1).action, "service.restart.failed");
  assert.equal(auditEvents.at(-1).details.attempts, 2);
  assert.equal((await store.listRecentTasks())[0].completedAt, "2026-11-03T18:02:00.000Z");
});

test("validates task fields, attempt bounds, lease parameters and history limits", async () => {
  const { store } = createFakePool();
  await assert.rejects(store.createTask({
    id: taskId,
    type: "service.restart",
    payload: { serviceId: "invalid", serviceName: "manager" },
  }), /fields are invalid/);
  await assert.rejects(store.createTask({
    id: taskId,
    type: "unknown type",
    payload: {},
  }), /fields are invalid/);
  await assert.rejects(store.createTask({
    id: taskId,
    type: "service.restart",
    payload: { serviceId, serviceName: "manager" },
    maxAttempts: 11,
  }), /fields are invalid/);
  await assert.rejects(store.claimNextTask("invalid"), /lease fields are invalid/);
  await assert.rejects(store.listRecentTasks(101), /between 1 and 100/);
});

test("rolls back task creation if its audit event cannot be written", async () => {
  const { pool, tasks } = createFakePool();
  const store = createTaskStore({
    pool,
    insertAuditEvent: async () => {
      throw new Error("audit unavailable");
    },
  });
  await assert.rejects(store.createTask({
    id: taskId,
    type: "service.restart",
    payload: { serviceId, serviceName: "manager" },
  }), /audit unavailable/);
  assert.equal(tasks.size, 0);
});
