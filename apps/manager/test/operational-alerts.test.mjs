import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOperationalAlerts } from "../operational-alerts.mjs";

const thresholds = {
  diskFreePercent: 10,
  restartCount: 3,
  restartWindowMinutes: 60,
};

test("alerts on low disk, missing service tasks, and repeated container restarts", () => {
  const alerts = evaluateOperationalAlerts({
    disk: { freePercent: 8, freeBytes: 800, totalBytes: 10_000 },
    services: [
      { name: "api", group: "shop", runningTasks: 1, desiredTasks: 2 },
      { name: "db", group: "shop", runningTasks: 1, desiredTasks: 1 },
    ],
    restarts: [
      { name: "worker", group: "shop", restartCount: 3 },
      { name: "proxy", group: "shop", restartCount: 2 },
    ],
    thresholds,
  });

  assert.deepEqual(alerts.map((alert) => alert.metric), ["disk", "restarts", "service"]);
  assert.equal(alerts[0].freePercent, 8);
  assert.equal(alerts[1].restartCount, 3);
  assert.equal(alerts[1].windowMinutes, 60);
  assert.equal(alerts[2].runningTasks, 1);
  assert.equal(alerts[2].desiredTasks, 2);
});

test("does not alert at healthy values", () => {
  const alerts = evaluateOperationalAlerts({
    disk: { freePercent: 11, freeBytes: 1_100, totalBytes: 10_000 },
    services: [{ name: "api", group: "shop", runningTasks: 2, desiredTasks: 2 }],
    restarts: [{ name: "worker", group: "shop", restartCount: 2 }],
    thresholds,
  });

  assert.deepEqual(alerts, []);
});

test("alerts when disk space or restart count reaches its threshold", () => {
  const alerts = evaluateOperationalAlerts({
    disk: { freePercent: 10, freeBytes: 1_000, totalBytes: 10_000 },
    services: [],
    restarts: [{ name: "worker", group: "shop", restartCount: 3 }],
    thresholds,
  });

  assert.deepEqual(alerts.map((alert) => alert.metric), ["disk", "restarts"]);
});
