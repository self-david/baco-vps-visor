import assert from "node:assert/strict";
import test from "node:test";
import { createDiagnosticsCollector } from "../diagnostics.mjs";

const healthyInfo = {
  Name: "baco",
  ServerVersion: "29.9.2",
  OperatingSystem: "Ubuntu 24.04.4 LTS",
  Architecture: "x86_64",
  NCPU: 4,
  Swarm: { LocalNodeState: "active", ControlAvailable: true },
};

const healthyServices = [
  { ID: "manager", Spec: { Name: "vps-manager_manager", Labels: { "com.docker.stack.namespace": "vps-manager" }, Mode: { Replicated: { Replicas: 1 } } } },
  { ID: "postgres", Spec: { Name: "vps-manager_postgres", Labels: { "com.docker.stack.namespace": "vps-manager" }, Mode: { Replicated: { Replicas: 1 } } } },
];

async function healthyDockerGet(path) {
  if (path === "/info") return healthyInfo;
  if (path === "/services") return healthyServices;
  if (path === "/tasks?desired-state=running") {
    return healthyServices.map((service) => ({
      ServiceID: service.ID,
      Status: { State: "running" },
    }));
  }
  if (path === "/nodes") {
    return [{ Status: { State: "ready" }, Spec: { Availability: "active" } }];
  }
  if (path === "/networks") {
    return [
      { Name: "vps-manager-proxy", Driver: "overlay", Attachable: true },
      { Name: "vps-manager-internal", Driver: "overlay", Attachable: false },
    ];
  }
  throw new Error(`Unexpected Docker API path: ${path}`);
}

function createCollector(overrides = {}) {
  return createDiagnosticsCollector({
    dockerGet: overrides.dockerGet ?? healthyDockerGet,
    getDatabaseStatus: overrides.getDatabaseStatus ?? (async () => ({ connected: true, name: "vps_manager" })),
    listBackups: overrides.listBackups ?? (async () => [{ createdAt: "2026-11-03T10:00:00.000Z" }]),
    now: () => new Date("2026-11-03T11:00:00.000Z"),
    onError: overrides.onError ?? (() => {}),
  });
}

test("reports healthy Docker, Swarm, VPS Manager services, networks, database, and backups", async () => {
  const diagnostics = await createCollector()();
  assert.equal(diagnostics.status, "ok");
  assert.equal(diagnostics.generatedAt, "2026-11-03T11:00:00.000Z");
  assert.deepEqual(diagnostics.checks.map(({ status }) => status), [
    "ok", "ok", "ok", "ok", "ok", "ok",
  ]);
});

test("reports unavailable manager replicas and disconnected PostgreSQL", async () => {
  const diagnostics = await createCollector({
    dockerGet: async (path) => {
      if (path === "/tasks?desired-state=running") return [];
      return healthyDockerGet(path);
    },
    getDatabaseStatus: async () => ({ connected: false }),
  })();
  assert.equal(diagnostics.status, "error");
  assert.equal(diagnostics.checks.find(({ id }) => id === "services").status, "error");
  assert.equal(diagnostics.checks.find(({ id }) => id === "database").status, "error");
});

test("reports missing backups and non-manager Swarm state as warnings", async () => {
  const diagnostics = await createCollector({
    dockerGet: async (path) => {
      if (path === "/info") {
        return { ...healthyInfo, Swarm: { LocalNodeState: "inactive", ControlAvailable: false } };
      }
      if (path === "/services") return healthyServices;
      if (path === "/tasks?desired-state=running") {
        return healthyServices.map((service) => ({ ServiceID: service.ID, Status: { State: "running" } }));
      }
      if (path === "/nodes") return [{ Status: { State: "ready" }, Spec: { Availability: "active" } }];
      if (path === "/networks") {
        return [
          { Name: "vps-manager-proxy", Driver: "overlay", Attachable: true },
          { Name: "vps-manager-internal", Driver: "overlay", Attachable: false },
        ];
      }
      throw new Error(`Unexpected Docker API path: ${path}`);
    },
    listBackups: async () => [],
  })();
  assert.equal(diagnostics.status, "warning");
  assert.equal(diagnostics.checks.find(({ id }) => id === "swarm").status, "warning");
  assert.equal(diagnostics.checks.find(({ id }) => id === "backups").status, "warning");
});

test("keeps other checks available when Docker, network, or backup inspection fails", async () => {
  const errors = [];
  const diagnostics = await createCollector({
    dockerGet: async (path) => {
      if (path === "/info" || path === "/networks") throw new Error("unavailable");
      if (path === "/services") return healthyServices;
      if (path === "/tasks?desired-state=running") {
        return healthyServices.map((service) => ({ ServiceID: service.ID, Status: { State: "running" } }));
      }
      if (path === "/nodes") return [{ Status: { State: "ready" }, Spec: { Availability: "active" } }];
      throw new Error(`Unexpected Docker API path: ${path}`);
    },
    listBackups: async () => { throw new Error("unavailable"); },
    onError: (error) => errors.push(error),
  })();
  assert.equal(diagnostics.status, "error");
  assert.equal(diagnostics.checks.find(({ id }) => id === "docker").status, "error");
  assert.equal(diagnostics.checks.find(({ id }) => id === "networks").status, "error");
  assert.equal(diagnostics.checks.find(({ id }) => id === "database").status, "ok");
  assert.equal(diagnostics.checks.find(({ id }) => id === "backups").status, "error");
  assert.equal(errors.length, 4);
});
