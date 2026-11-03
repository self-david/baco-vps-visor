import assert from "node:assert/strict";
import test from "node:test";
import { createServiceTaskStore } from "../service-task-store.mjs";

const taskId = "d909f79b-e7f9-41e7-9e7a-6ea000000001";
const serviceId = "9a7f51bdff120d8d0d48d4ca5";

function createFakePool() {
  const tasks = new Map();
  const auditEvents = [];
  const pool = {
    async connect() {
      let insertedId;
      return {
        async query(sql, values = []) {
          if (sql === "BEGIN" || sql === "COMMIT") return { rowCount: 0 };
          if (sql === "ROLLBACK") {
            if (insertedId) tasks.delete(insertedId);
            return { rowCount: 0 };
          }
          if (sql.includes("INSERT INTO tasks")) {
            insertedId = values[0];
            tasks.set(insertedId, {
              id: insertedId,
              status: "pending",
              payload: JSON.parse(values[1]),
              result: null,
              error: null,
              created_at: new Date("2026-11-03T18:00:00Z"),
              updated_at: new Date("2026-11-03T18:00:00Z"),
              started_at: null,
              completed_at: null,
            });
            return { rowCount: 1 };
          }
          throw new Error(`Unexpected client query: ${sql}`);
        },
        release() {},
      };
    },
    async query(sql, values = []) {
      if (sql.includes("UPDATE tasks")) {
        const [id, status, result, error] = values;
        const task = tasks.get(id);
        if (task && !["completed", "failed"].includes(task.status)) {
          task.status = status;
          if (status === "completed") task.result = JSON.parse(result);
          if (status === "failed") task.error = error;
          if (status === "in_progress") task.started_at ??= new Date("2026-11-03T18:01:00Z");
          if (["completed", "failed"].includes(status)) {
            task.completed_at = new Date("2026-11-03T18:02:00Z");
          }
          task.updated_at = new Date("2026-11-03T18:02:00Z");
        }
        return { rowCount: task ? 1 : 0 };
      }
      if (sql.includes("SELECT id, status, payload")) {
        return {
          rows: [...tasks.values()]
            .sort((left, right) => right.created_at - left.created_at)
            .slice(0, values[0]),
        };
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    },
  };
  const store = createServiceTaskStore({
    pool,
    insertAuditEvent: async (_client, event) => auditEvents.push(event),
  });
  return { pool, store, tasks, auditEvents };
}

test("persists requested service tasks and an audit event in one transaction", async () => {
  const { store, tasks, auditEvents } = createFakePool();
  await store.createRestartTask({ id: taskId, serviceId, serviceName: "vps-manager_manager" });
  assert.equal(tasks.get(taskId).status, "pending");
  assert.deepEqual(tasks.get(taskId).payload, { serviceId, serviceName: "vps-manager_manager" });
  assert.equal(auditEvents[0].action, "service.restart.requested");
  assert.equal(auditEvents[0].details.taskId, taskId);
});

test("records lifecycle timestamps, completion result and durable task history", async () => {
  const { store } = createFakePool();
  await store.createRestartTask({ id: taskId, serviceId, serviceName: "vps-manager_manager" });
  await store.updateRestartTask(taskId, "running", "Reinicio en curso.");
  await store.updateRestartTask(taskId, "succeeded", "Servicio reiniciado correctamente.");

  const [task] = await store.listRecentRestartTasks();
  assert.equal(task.status, "completed");
  assert.equal(task.result.message, "Servicio reiniciado correctamente.");
  assert.equal(task.error, null);
  assert.equal(task.startedAt, "2026-11-03T18:01:00.000Z");
  assert.equal(task.completedAt, "2026-11-03T18:02:00.000Z");
  assert.equal(task.serviceName, "vps-manager_manager");
});

test("persists failed task messages and never overwrites a terminal state", async () => {
  const { store } = createFakePool();
  await store.createRestartTask({ id: taskId, serviceId, serviceName: "vps-manager_manager" });
  await store.updateRestartTask(taskId, "failed", "Docker no pudo reiniciar el servicio.");
  await store.updateRestartTask(taskId, "succeeded", "A later status must not overwrite failure.");

  const [task] = await store.listRecentRestartTasks();
  assert.equal(task.status, "failed");
  assert.equal(task.error, "Docker no pudo reiniciar el servicio.");
  assert.equal(task.completedAt, "2026-11-03T18:02:00.000Z");
});

test("validates task fields and history limits", async () => {
  const { store } = createFakePool();
  await assert.rejects(store.createRestartTask({
    id: taskId,
    serviceId: "invalid",
    serviceName: "manager",
  }), /fields are invalid/);
  await assert.rejects(store.updateRestartTask(taskId, "queued", "invalid transition"), /status is invalid/);
  await assert.rejects(store.listRecentRestartTasks(101), /between 1 and 100/);
});

test("rolls back a task insert if its audit event cannot be written", async () => {
  const { pool, store } = createFakePool();
  const failingStore = createServiceTaskStore({
    pool,
    insertAuditEvent: async () => {
      throw new Error("audit unavailable");
    },
  });

  await assert.rejects(
    failingStore.createRestartTask({ id: taskId, serviceId, serviceName: "manager" }),
    /audit unavailable/,
  );
  assert.equal((await store.listRecentRestartTasks()).length, 0);
});
