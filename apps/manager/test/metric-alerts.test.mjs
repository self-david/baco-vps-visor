import assert from "node:assert/strict";
import test from "node:test";
import { evaluateContainerMetricAlerts } from "../metric-alerts.mjs";

const now = new Date();

function sample(containerId, {
  cpuPercent,
  memoryUsageBytes,
  memoryLimitBytes = 100,
  offsetMinutes = 0,
}) {
  return {
    container_id: containerId,
    container_name: containerId,
    group_name: "test-stack",
    sampled_at: new Date(now.getTime() - offsetMinutes * 60_000),
    cpu_percent: cpuPercent,
    memory_usage_bytes: memoryUsageBytes,
    memory_limit_bytes: memoryLimitBytes,
  };
}

test("alerts only after two consecutive samples exceed the configured thresholds", () => {
  const rows = [
    sample("web", { cpuPercent: 120, memoryUsageBytes: 96 }),
    sample("web", { cpuPercent: 110, memoryUsageBytes: 95, offsetMinutes: 15 }),
    sample("recovered", { cpuPercent: 80, memoryUsageBytes: 80 }),
    sample("recovered", { cpuPercent: 110, memoryUsageBytes: 95, offsetMinutes: 15 }),
    sample("new-container", { cpuPercent: 150, memoryUsageBytes: 99 }),
    sample("unlimited-memory", { cpuPercent: 80, memoryUsageBytes: 0, memoryLimitBytes: 0 }),
    sample("unlimited-memory", { cpuPercent: 80, memoryUsageBytes: 0, memoryLimitBytes: 0, offsetMinutes: 15 }),
  ];

  const alerts = evaluateContainerMetricAlerts(rows, { cpuPercent: 90, memoryPercent: 90 });

  assert.deepEqual(alerts.map(({ containerId, metric }) => `${containerId}:${metric}`), [
    "web:cpu",
    "web:memory",
  ]);
  assert.equal(alerts[0].valuePercent, 120);
  assert.equal(alerts[1].valuePercent, 96);
});

test("does not trigger when a sample equals the threshold", () => {
  const alerts = evaluateContainerMetricAlerts([
    sample("web", { cpuPercent: 90, memoryUsageBytes: 90 }),
    sample("web", { cpuPercent: 90, memoryUsageBytes: 90, offsetMinutes: 15 }),
  ], { cpuPercent: 90, memoryPercent: 90 });

  assert.deepEqual(alerts, []);
});
