import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createServiceOperationAgent,
  findManagedService,
  isPublicHostname,
  validateServiceScale,
} from "../service-operations.mjs";

const requestId = "d909f79b-e7f9-41e7-9e7a-6ea000000001";
const secondRequestId = "a3f51b09-13bf-4c7a-9b03-9ba000000002";
const serviceId = "9a7f51bdff120d8d0d48d4ca5";
const managedService = { ID: serviceId, Spec: { Labels: { "vps-manager.managed": "true" } } };

test("resolves only one Swarm service explicitly managed by VPS Manager", () => {
  assert.equal(findManagedService([managedService], serviceId.slice(0, 12)), managedService);
  assert.throws(() => findManagedService([], serviceId), { code: "SERVICE_NOT_FOUND" });
  assert.throws(() => findManagedService([
    managedService,
    { ...managedService, ID: "9a7f51bdff120d8d0d48d4cb0" },
  ], serviceId.slice(0, 12)), { code: "SERVICE_ID_AMBIGUOUS" });
  assert.throws(() => findManagedService([
    { ID: serviceId, Spec: { Labels: {} } },
  ], serviceId), { code: "SERVICE_NOT_MANAGED" });
});

test("validates scale targets for replicated services without allowing panel downtime", () => {
  const service = {
    ID: serviceId,
    Spec: {
      Labels: { "vps-manager.managed": "true" },
      Mode: { Replicated: { Replicas: 3 } },
    },
  };
  assert.equal(validateServiceScale(service, 4), 3);
  assert.throws(() => validateServiceScale(service, 0), { code: "INVALID_REPLICA_COUNT" });
  assert.throws(() => validateServiceScale(service, 101), { code: "INVALID_REPLICA_COUNT" });
  assert.throws(() => validateServiceScale({
    ...service,
    Spec: { ...service.Spec, Mode: { Global: {} } },
  }, 4), { code: "SERVICE_NOT_REPLICATED" });
  assert.throws(() => validateServiceScale({
    ...service,
    Spec: { ...service.Spec, Labels: { "vps-manager.component": "api" } },
  }, 2), { code: "PANEL_REPLICA_COUNT" });
  assert.equal(validateServiceScale({
    ...service,
    Spec: { ...service.Spec, Labels: { "vps-manager.component": "api" } },
  }, 1), 3);
  assert.throws(() => validateServiceScale({
    ...service,
    Spec: {
      ...service.Spec,
      Labels: { "vps-manager.managed": "true", "vps-manager.component": "gitea" },
    },
  }, 2), { code: "APPLICATION_REPLICA_COUNT" });
});

test("accepts only public DNS hostnames for application subdomains", () => {
  assert.equal(isPublicHostname("git.example.com"), true);
  assert.equal(isPublicHostname("192.168.100.156"), false);
  assert.equal(isPublicHostname("git.example.com;id"), false);
  assert.equal(isPublicHostname("git.local"), false);
});

async function createFixture(createId = () => requestId) {
  const directory = await mkdtemp(join(tmpdir(), "vps-service-operations-"));
  return {
    directory,
    agent: createServiceOperationAgent({ directory, createId }),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

test("queues a fixed service restart request without accepting command input", async () => {
  const fixture = await createFixture();
  try {
    const result = await fixture.agent.requestRestart(serviceId);
    assert.equal(result.id, requestId);
    assert.equal(result.state, "queued");
    assert.equal(result.serviceId, serviceId);
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "restart-service",
      serviceId,
    });
    assert.equal((await fixture.agent.getStatus()).state, "queued");
  } finally {
    await fixture.cleanup();
  }
});

test("queues a validated scale request through the fixed service-operation channel", async () => {
  const fixture = await createFixture();
  try {
    const result = await fixture.agent.requestScale(serviceId, 4);
    assert.equal(result.operation, "scale-service");
    assert.equal(result.replicas, 4);
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "scale-service",
      serviceId,
      replicas: 4,
    });
    assert.equal((await fixture.agent.getStatus()).replicas, 4);
    assert.equal((await fixture.agent.requestScale(serviceId, 4)).replicas, 4);
    await assert.rejects(fixture.agent.requestScale(serviceId, 5), /different service operation/);
    await assert.rejects(fixture.agent.requestScale(serviceId, 0), /between 1 and 100/);
  } finally {
    await fixture.cleanup();
  }
});

test("queues a Gitea install request without credentials and reveals generated credentials only once", async () => {
  const fixture = await createFixture();
  try {
    const result = await fixture.agent.requestGiteaInstall("git.example.com");
    assert.equal(result.state, "queued");
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "install-gitea",
      domain: "git.example.com",
    });
    assert.equal((await fixture.agent.getStatus()).domain, "git.example.com");
    await assert.rejects(fixture.agent.requestGiteaInstall("git.example.com;id"), /hostname público válido/);

    const credentialsPath = join(fixture.directory, `gitea-credentials-${requestId}.json`);
    await writeFile(credentialsPath, JSON.stringify({
      taskId: requestId,
      username: "vpsadmin",
      password: "a".repeat(64),
      domain: "git.example.com",
    }), { mode: 0o640 });
    assert.equal(await fixture.agent.hasGiteaCredentials(requestId), true);
    assert.deepEqual(await fixture.agent.consumeGiteaCredentials(requestId), {
      username: "vpsadmin",
      password: "a".repeat(64),
      url: "https://git.example.com/",
      sshCommand: "ssh -p 2222 git@git.example.com",
    });
    assert.equal(await fixture.agent.hasGiteaCredentials(requestId), false);
    await assert.rejects(fixture.agent.consumeGiteaCredentials(requestId), { code: "CREDENTIALS_UNAVAILABLE" });
  } finally {
    await fixture.cleanup();
  }
});

test("rejects malformed service IDs before creating a request", async () => {
  const fixture = await createFixture();
  try {
    await assert.rejects(fixture.agent.requestRestart("$(touch /tmp/unexpected)"), /identifier/);
    assert.equal(await fixture.agent.getStatus(), null);
  } finally {
    await fixture.cleanup();
  }
});

test("returns the existing task for duplicate IDs and rejects different active requests", async () => {
  const fixture = await createFixture();
  try {
    await fixture.agent.requestRestart(serviceId);
    assert.equal((await fixture.agent.requestRestart(serviceId)).id, requestId);
    await rm(join(fixture.directory, "request.json"));
    await writeFile(join(fixture.directory, "request.json"), JSON.stringify({
      id: requestId,
      operation: "scale-service",
      serviceId,
      replicas: 101,
    }));
    await assert.rejects(fixture.agent.getStatus(), /invalid format/);
    await rm(join(fixture.directory, "request.json"));
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      state: "running",
      serviceId,
      updatedAt: "2026-11-03T18:00:00Z",
      message: "running",
    }));
    assert.equal((await fixture.agent.requestRestart(serviceId)).state, "running");
    await assert.rejects(
      fixture.agent.requestRestart(serviceId, secondRequestId),
      { code: "OPERATION_IN_PROGRESS" },
    );
  } finally {
    await fixture.cleanup();
  }
});

test("does not requeue an operation whose matching ID is already terminal", async () => {
  const fixture = await createFixture();
  try {
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      state: "succeeded",
      serviceId,
      updatedAt: "2026-11-03T18:00:00Z",
      message: "Servicio reiniciado.",
    }));

    assert.equal((await fixture.agent.requestRestart(serviceId, requestId)).state, "succeeded");
    await assert.rejects(readFile(join(fixture.directory, "request.json")), { code: "ENOENT" });
  } finally {
    await fixture.cleanup();
  }
});

test("reports terminal host operation states and accepts a subsequent restart", async () => {
  const fixture = await createFixture(() => secondRequestId);
  try {
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      state: "succeeded",
      serviceId,
      updatedAt: "2026-11-03T18:00:00Z",
      message: "Servicio reiniciado.",
    }));
    assert.equal((await fixture.agent.getStatus()).state, "succeeded");
    assert.equal((await fixture.agent.requestRestart(serviceId)).id, secondRequestId);
  } finally {
    await fixture.cleanup();
  }
});

test("rejects malformed requests, invalid state files, and unsupported operations", async () => {
  const fixture = await createFixture();
  try {
    await writeFile(join(fixture.directory, "request.json"), JSON.stringify({
      id: requestId,
      operation: "run-command",
      serviceId,
      command: "docker service rm something",
    }));
    await assert.rejects(fixture.agent.getStatus(), /invalid format/);

    await rm(join(fixture.directory, "request.json"));
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      state: "unknown",
      serviceId,
      updatedAt: "2026-11-03T18:00:00Z",
      message: "invalid",
    }));
    await assert.rejects(fixture.agent.getStatus(), /invalid format/);
  } finally {
    await fixture.cleanup();
  }
});

test("rejects non-regular request and status paths", async () => {
  const fixture = await createFixture();
  try {
    await mkdir(join(fixture.directory, "request.json"));
    await assert.rejects(fixture.agent.getStatus(), /regular file/);
    await rm(join(fixture.directory, "request.json"), { recursive: true });
    await mkdir(join(fixture.directory, "status.json"));
    await assert.rejects(fixture.agent.getStatus(), /regular file/);
  } finally {
    await fixture.cleanup();
  }
});

test("only one concurrent request can win the atomic queue", async () => {
  const fixture = await createFixture(() => requestId);
  const otherAgent = createServiceOperationAgent({
    directory: fixture.directory,
    createId: () => secondRequestId,
  });
  try {
    const results = await Promise.allSettled([
      fixture.agent.requestRestart(serviceId),
      otherAgent.requestRestart("a8a39c99ff120d8d0d48d4000"),
    ]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
    assert.equal(results.filter(({ status, reason }) =>
      status === "rejected" && reason.code === "OPERATION_IN_PROGRESS").length, 1);
  } finally {
    await fixture.cleanup();
  }
});
