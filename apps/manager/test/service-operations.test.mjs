import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServiceOperationAgent, findManagedService } from "../service-operations.mjs";

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
