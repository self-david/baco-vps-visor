import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWebUpdater } from "../web-updater.mjs";

const requestId = "d909f79b-e7f9-41e7-9e7a-6ea000000001";

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "vps-web-update-"));
  return {
    directory,
    updater: createWebUpdater({ directory, createId: () => requestId }),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

test("queues one fixed update request and reports it as queued", async () => {
  const fixture = await createFixture();
  try {
    const result = await fixture.updater.requestUpdate();
    assert.equal(result.id, requestId);
    assert.equal(result.state, "queued");
    assert.equal((await readFile(join(fixture.directory, "request"), "utf8")).trim(), requestId);
    assert.equal((await fixture.updater.getStatus()).state, "queued");
  } finally {
    await fixture.cleanup();
  }
});

test("rejects duplicate requests without replacing the pending request", async () => {
  const fixture = await createFixture();
  try {
    await fixture.updater.requestUpdate();
    await assert.rejects(fixture.updater.requestUpdate(), { code: "UPDATE_IN_PROGRESS" });
    assert.equal((await readFile(join(fixture.directory, "request"), "utf8")).trim(), requestId);
  } finally {
    await fixture.cleanup();
  }
});

test("reports running, successful, and failed host updater states", async () => {
  const fixture = await createFixture();
  try {
    await fixture.updater.requestUpdate();
    const statusPath = join(fixture.directory, "status.json");
    const status = { id: requestId, state: "running", updatedAt: "2026-11-03T18:00:00Z", message: "running" };
    await writeFile(statusPath, JSON.stringify(status));
    assert.deepEqual(await fixture.updater.getStatus(), status);
    await assert.rejects(fixture.updater.requestUpdate(), { code: "UPDATE_IN_PROGRESS" });

    status.state = "succeeded";
    await writeFile(statusPath, JSON.stringify(status));
    assert.deepEqual(await fixture.updater.getStatus(), status);

    status.state = "failed";
    await writeFile(statusPath, JSON.stringify(status));
    assert.deepEqual(await fixture.updater.getStatus(), status);
  } finally {
    await fixture.cleanup();
  }
});

test("reports no status before the host service receives a request", async () => {
  const fixture = await createFixture();
  try {
    assert.equal(await fixture.updater.getStatus(), null);
  } finally {
    await fixture.cleanup();
  }
});

test("rejects malformed or unsupported status and request files", async () => {
  const fixture = await createFixture();
  try {
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      state: "arbitrary",
      updatedAt: "2026-11-03T18:00:00Z",
      message: "invalid",
    }));
    await assert.rejects(fixture.updater.getStatus(), /invalid format/);

    await rm(join(fixture.directory, "status.json"));
    await writeFile(join(fixture.directory, "request"), "not-a-uuid\n");
    await assert.rejects(fixture.updater.getStatus(), /invalid format/);
  } finally {
    await fixture.cleanup();
  }
});

test("only one of two concurrent update requests can be queued", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vps-web-update-race-"));
  try {
    const first = createWebUpdater({ directory, createId: () => requestId });
    const second = createWebUpdater({
      directory,
      createId: () => "a3f51b09-13bf-4c7a-9b03-9ba000000002",
    });
    const results = await Promise.allSettled([first.requestUpdate(), second.requestUpdate()]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
    assert.equal(results.filter(({ status, reason }) =>
      status === "rejected" && reason.code === "UPDATE_IN_PROGRESS").length, 1);
    const queuedId = (await readFile(join(directory, "request"), "utf8")).trim();
    assert.ok([requestId, "a3f51b09-13bf-4c7a-9b03-9ba000000002"].includes(queuedId));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
