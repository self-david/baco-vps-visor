import assert from "node:assert/strict";
import test from "node:test";
import { createCloudflareTunnelReconciler } from "../cloudflare-tunnel-reconciler.mjs";

const taskId = "d909f79b-e7f9-41e7-9e7a-6ea000000001";
const tunnel = {
  accountId: "a".repeat(32),
  tunnelId: "11111111-1111-4111-8111-111111111111",
  name: "home-vps",
  originProtocol: "http",
};
const domain = {
  id: "a3f51b09-13bf-4c7a-9b03-9ba000000002",
  zone: "example.com",
  zoneId: "b".repeat(32),
  hostname: "app.example.com",
  dnsRecordId: "old-record",
};
const zone = {
  id: "7b153e99-3d37-4ce5-9bf9-f42d756cd745",
  zone: "example.com",
  zoneId: "b".repeat(32),
  credentialId: "c2d35be6-3645-4600-8999-f5b9c5e1ca81",
  connectionStatus: "connected",
};

function createFixture(overrides = {}) {
  const calls = [];
  const options = {
    getSettings: async () => tunnel,
    hasApiToken: async () => true,
    getApiToken: async () => "cloudflare-api-token",
    getDomains: async () => [domain],
    getDomainZones: async () => [zone],
    hasZoneToken: async () => true,
    getZoneToken: async () => "cloudflare-zone-token",
    saveDomain: async (value) => calls.push(["saveDomain", value]),
    saveSettings: async (value) => calls.push(["saveSettings", value]),
    getServices: async () => [],
    getServiceTasks: async () => [],
    getLatestTask: async () => null,
    cloudflareClient: {
      async upsertTunnelCname(token, input) {
        calls.push(["upsertTunnelCname", token, input]);
        return { id: "new-record" };
      },
      async updateTunnelConfiguration(...args) {
        calls.push(["updateTunnelConfiguration", ...args]);
      },
      async getTunnelToken(...args) {
        calls.push(["getTunnelToken", ...args]);
        return "connector-token";
      },
    },
    async stageCredentials(...args) {
      calls.push(["stageCredentials", ...args]);
    },
    async removeCredentials(...args) {
      calls.push(["removeCredentials", ...args]);
    },
    async createConfigureTask(...args) {
      calls.push(["createConfigureTask", ...args]);
    },
    createId: () => taskId,
    ...overrides,
  };
  return {
    calls,
    reconcile: createCloudflareTunnelReconciler(options),
  };
}

test("does nothing before a Cloudflare Tunnel is configured", async () => {
  const fixture = createFixture({ getSettings: async () => null });

  assert.deepEqual(await fixture.reconcile(), { state: "not-configured" });
  assert.deepEqual(fixture.calls, []);
});

test("leaves a present Cloudflare connector to Swarm's restart policy", async () => {
  const fixture = createFixture({
    getServices: async () => [{
      ID: "service-id",
      Spec: {
        Name: "vps-manager_cloudflared",
        Labels: { "vps-manager.managed": "true", "vps-manager.component": "cloudflare-tunnel" },
      },
    }],
    getServiceTasks: async () => [{
      DesiredState: "running",
      Status: { State: "running" },
    }],
  });

  assert.deepEqual(await fixture.reconcile(), { state: "service-present" });
  assert.deepEqual(fixture.calls, []);
});

test("repairs a managed connector service with no running task", async () => {
  const fixture = createFixture({
    getServices: async () => [{
      ID: "service-id",
      Spec: {
        Name: "vps-manager_cloudflared",
        Labels: { "vps-manager.managed": "true", "vps-manager.component": "cloudflare-tunnel" },
      },
    }],
    getServiceTasks: async () => [{
      DesiredState: "running",
      Status: { State: "failed" },
    }],
  });

  assert.deepEqual(await fixture.reconcile(), {
    state: "configuration-queued",
    taskId,
  });
  assert.equal(fixture.calls[0][0], "upsertTunnelCname");
});

test("does not modify an unrelated service that uses the connector name", async () => {
  const fixture = createFixture({
    getServices: async () => [{
      ID: "service-id",
      Spec: { Name: "vps-manager_cloudflared", Labels: {} },
    }],
  });

  await assert.rejects(fixture.reconcile(), /servicio no administrado/);
  assert.deepEqual(fixture.calls, []);
});

test("does not duplicate an active connector configuration task", async () => {
  const fixture = createFixture({
    getLatestTask: async () => ({ id: taskId, status: "in_progress" }),
  });

  assert.deepEqual(await fixture.reconcile(), {
    state: "configuration-in-progress",
    taskId,
  });
  assert.deepEqual(fixture.calls, []);
});

test("backs off after a recent failed connector task", async () => {
  const fixture = createFixture({
    getLatestTask: async () => ({
      id: taskId,
      status: "failed",
      completedAt: new Date(Date.now() - 1000).toISOString(),
    }),
  });

  assert.deepEqual(await fixture.reconcile(), {
    state: "recent-failure",
    taskId,
  });
  assert.deepEqual(fixture.calls, []);
});

test("restores Cloudflare DNS, ingress and the connector after installation or update", async () => {
  const fixture = createFixture();

  assert.deepEqual(await fixture.reconcile(), {
    state: "configuration-queued",
    taskId,
  });
  assert.deepEqual(fixture.calls.map(([name]) => name), [
    "upsertTunnelCname",
    "saveDomain",
    "updateTunnelConfiguration",
    "getTunnelToken",
    "stageCredentials",
    "createConfigureTask",
  ]);
  assert.deepEqual(fixture.calls[0], ["upsertTunnelCname", "cloudflare-zone-token", {
    zoneId: domain.zoneId,
    hostname: domain.hostname,
    tunnelId: tunnel.tunnelId,
    existingRecordId: domain.dnsRecordId,
  }]);
  assert.deepEqual(fixture.calls[2], ["updateTunnelConfiguration",
    "cloudflare-api-token",
    tunnel.accountId,
    tunnel.tunnelId,
    [domain.hostname],
    { originProtocol: "http", managerHostname: null },
  ]);
  assert.deepEqual(fixture.calls[5], ["createConfigureTask", {
    id: taskId,
    tunnelId: tunnel.tunnelId,
    tunnelName: tunnel.name,
  }]);
});

test("removes staged connector credentials if the recovery task cannot be queued", async () => {
  const failure = new Error("Task queue unavailable.");
  const fixture = createFixture({
    createConfigureTask: async () => {
      throw failure;
    },
  });

  await assert.rejects(fixture.reconcile(), failure);
  assert.deepEqual(fixture.calls.slice(-2), [
    ["stageCredentials", taskId, "connector-token"],
    ["removeCredentials", taskId],
  ]);
});

test("does not queue a connector without its saved Cloudflare API token", async () => {
  const fixture = createFixture({ hasApiToken: async () => false });

  await assert.rejects(fixture.reconcile(), /Falta el API Token protegido de Cloudflare/);
  assert.deepEqual(fixture.calls, []);
});

test("repairs a configured panel hostname before restoring its connector", async () => {
  const fixture = createFixture({
    getSettings: async () => ({
      ...tunnel,
      managerHostname: "panel.example.com",
      managerZoneId: zone.id,
      managerDnsRecordId: null,
    }),
    getDomains: async () => [],
  });

  assert.deepEqual(await fixture.reconcile(), {
    state: "configuration-queued",
    taskId,
  });
  assert.deepEqual(fixture.calls[0], ["upsertTunnelCname", "cloudflare-zone-token", {
    zoneId: zone.zoneId,
    hostname: "panel.example.com",
    tunnelId: tunnel.tunnelId,
    existingRecordId: undefined,
  }]);
  assert.deepEqual(fixture.calls[1], ["saveSettings", {
    ...tunnel,
    managerHostname: "panel.example.com",
    managerZoneId: zone.id,
    managerDnsRecordId: "new-record",
  }]);
  assert.deepEqual(fixture.calls[2], ["updateTunnelConfiguration",
    "cloudflare-api-token",
    tunnel.accountId,
    tunnel.tunnelId,
    [],
    { originProtocol: "http", managerHostname: "panel.example.com" },
  ]);
});
