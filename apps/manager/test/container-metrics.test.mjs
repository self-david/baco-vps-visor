import assert from "node:assert/strict";
import test from "node:test";
import { collectContainerMetrics } from "../container-metrics.mjs";

const stats = {
  cpu_stats: {
    cpu_usage: { total_usage: 200 },
    system_cpu_usage: 1000,
    online_cpus: 2,
  },
  precpu_stats: {
    cpu_usage: { total_usage: 100 },
    system_cpu_usage: 500,
  },
  memory_stats: {
    usage: 150,
    limit: 1000,
    stats: { inactive_file: 50 },
  },
};

test("collects per-container metrics and honors project grouping", async () => {
  const containers = [
    {
      Id: "a".repeat(64),
      Names: ["/liteimage.1"],
      group: "Proyecto · LiteImage",
    },
    {
      Id: "b".repeat(64),
      Names: ["/vps-manager-manager.1"],
      Labels: { "com.docker.stack.namespace": "vps-manager" },
    },
  ];

  const result = await collectContainerMetrics(containers, async () => stats);

  assert.deepEqual(result.errors, []);
  assert.equal(result.metrics.length, 2);
  assert.deepEqual(result.metrics.map(({ name, group, cpuPercent, memoryUsageBytes }) => ({
    name,
    group,
    cpuPercent,
    memoryUsageBytes,
  })), [
    {
      name: "liteimage.1",
      group: "Proyecto · LiteImage",
      cpuPercent: 40,
      memoryUsageBytes: 100,
    },
    {
      name: "vps-manager-manager.1",
      group: "vps-manager",
      cpuPercent: 40,
      memoryUsageBytes: 100,
    },
  ]);
});

test("reports containers whose live stats cannot be read", async () => {
  const result = await collectContainerMetrics([
    {
      Id: "c".repeat(64),
      Names: ["/unavailable.1"],
      group: "Proyecto · Demo",
    },
  ], async () => {
    throw new Error("Docker stats unavailable");
  });

  assert.deepEqual(result.metrics, []);
  assert.deepEqual(result.errors, [{
    id: "c".repeat(12),
    name: "unavailable.1",
    group: "Proyecto · Demo",
    message: "Docker stats unavailable",
  }]);
});
