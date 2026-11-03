import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDeploymentAlerts } from "../deployment-alerts.mjs";

const now = Date.parse("2026-11-03T17:00:00.000Z");
const services = [
  {
    ID: "service-api",
    Spec: {
      Name: "shop_api",
      Labels: { "com.docker.stack.namespace": "shop" },
    },
    UpdateStatus: { State: "paused", Message: "update paused: task failed" },
  },
  {
    ID: "service-worker",
    Spec: {
      Name: "shop_worker",
      Labels: { "com.docker.stack.namespace": "shop" },
    },
    UpdateStatus: { State: "completed" },
  },
];

test("alerts on paused updates and recent failed or rejected deployment tasks", () => {
  const alerts = evaluateDeploymentAlerts(services, [
    {
      ServiceID: "service-api",
      Status: {
        State: "failed",
        Err: "image not found",
        Timestamp: new Date(now - 60_000).toISOString(),
      },
    },
    {
      ServiceID: "service-worker",
      Status: {
        State: "rejected",
        Message: "no suitable node",
        Timestamp: new Date(now - 5 * 60_000).toISOString(),
      },
    },
    {
      ServiceID: "service-worker",
      Status: {
        State: "failed",
        Err: "old failure",
        Timestamp: new Date(now - 16 * 60_000).toISOString(),
      },
    },
  ], now);

  assert.deepEqual(alerts.map(({ serviceName }) => serviceName), ["shop_api", "shop_worker"]);
  assert.deepEqual(alerts[0].reasons.map(({ reason }) => reason), ["paused", "task_failed"]);
  assert.equal(alerts[0].reasons[0].message, "update paused: task failed");
  assert.equal(alerts[0].reasons[1].message, "image not found");
  assert.equal(alerts[1].reasons[0].reason, "task_rejected");
});

test("ignores successful, stale, future, and unknown-service tasks", () => {
  const alerts = evaluateDeploymentAlerts(services.slice(1), [
    {
      ServiceID: "service-worker",
      Status: { State: "complete", Timestamp: new Date(now).toISOString() },
    },
    {
      ServiceID: "service-worker",
      Status: { State: "failed", Timestamp: new Date(now - 20 * 60_000).toISOString() },
    },
    {
      ServiceID: "service-worker",
      Status: { State: "failed", Timestamp: new Date(now + 1000).toISOString() },
    },
    {
      ServiceID: "removed-service",
      Status: { State: "failed", Timestamp: new Date(now).toISOString() },
    },
  ], now);

  assert.deepEqual(alerts, []);
});

test("truncates task messages and deduplicates identical failures", () => {
  const longMessage = "x".repeat(300);
  const task = {
    ServiceID: "service-worker",
    Status: { State: "failed", Err: longMessage, Timestamp: new Date(now).toISOString() },
  };
  const alerts = evaluateDeploymentAlerts(services.slice(1), [task, task], now);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].reasons.length, 1);
  assert.equal(alerts[0].reasons[0].message.length, 240);
});
