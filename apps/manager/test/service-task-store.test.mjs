import assert from "node:assert/strict";
import test from "node:test";
import { createTaskStore } from "../service-task-store.mjs";

const taskId = "d909f79b-e7f9-41e7-9e7a-6ea000000001";
const workerId = "a3f51b09-13bf-4c7a-9b03-9ba000000002";
const serviceId = "9a7f51bdff120d8d0d48d4ca5";

function createFakePool() {
  const tasks = new Map();
  const auditEvents = [];
  const pool = {
    async connect() {
      let snapshot;
      let auditSize;
      return {
        async query(sql, values = []) {
          if (sql === "BEGIN") {
            snapshot = structuredClone(tasks);
            auditSize = auditEvents.length;
            return { rowCount: 0 };
          }
          if (sql === "COMMIT") return { rowCount: 0 };
          if (sql === "ROLLBACK") {
            tasks.clear();
            for (const [id, task] of snapshot ?? []) tasks.set(id, task);
            auditEvents.length = auditSize ?? auditEvents.length;
            return { rowCount: 0 };
          }
          if (sql.includes("INSERT INTO tasks")) {
            const [id, type, payload, maxAttempts] = values;
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
        return {
          rows: [...tasks.values()]
            .sort((left, right) => right.created_at - left.created_at)
            .slice(0, values[0]),
        };
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    },
  };
  const store = createTaskStore({
    pool,
    insertAuditEvent: async (_client, event) => auditEvents.push(event),
  });
  return { pool, store, tasks, auditEvents };
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
