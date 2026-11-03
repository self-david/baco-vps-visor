import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBackupManager } from "../backup-manager.mjs";

const payload = Buffer.from("sample PostgreSQL custom-format dump");

async function createFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "vps-manager-backup-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const keyFile = join(directory, "backup-key");
  const databasePasswordFile = join(directory, "postgres-password");
  await writeFile(keyFile, "a".repeat(64));
  await writeFile(databasePasswordFile, "postgres-test-password");
  const calls = [];
  const environment = {
    ...process.env,
    BACKUP_TEST_PAYLOAD: payload.toString("base64"),
    BACKUP_TEST_EXPECTED: payload.toString("base64"),
  };
  const spawnCommand = (command, args, options) => {
    calls.push(command);
    if (command === "pg_dump") {
      return spawn(process.execPath, [
        "-e",
        "process.stdout.write(Buffer.from(process.env.BACKUP_TEST_PAYLOAD, 'base64'))",
      ], options);
    }
    return spawn(process.execPath, [
      "-e",
      "const fs = require('node:fs'); const actual = fs.readFileSync(process.argv.at(-1)); const expected = Buffer.from(process.env.BACKUP_TEST_EXPECTED, 'base64'); if (!actual.equals(expected)) process.exitCode = 4;",
      "--",
      ...args,
    ], options);
  };
  const manager = createBackupManager({
    directory: join(directory, "backups"),
    keyFile,
    databasePasswordFile,
    environment,
    spawnCommand,
    now: () => new Date("2026-02-14T12:00:00.000Z"),
  });
  return { directory, manager, calls };
}

test("creates encrypted backups and restores only authenticated dump data", async (t) => {
  const { directory, manager, calls } = await createFixture(t);
  const backup = await manager.create();
  assert.equal(backup.createdAt, "2026-02-14T12:00:00.000Z");
  assert.ok(backup.sizeBytes > payload.length);
  const listed = await manager.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, backup.id);
  const backupPath = join(directory, "backups", `vps-manager-db-${backup.id}.vpsbackup`);
  const encrypted = await readFile(backupPath);
  assert.equal(encrypted.includes(payload), false);
  assert.deepEqual(await manager.restore(backup.id), {
    id: backup.id,
    restoredAt: "2026-02-14T12:00:00.000Z",
  });
  assert.deepEqual(calls, ["pg_dump", "pg_restore"]);
});

test("rejects tampered encrypted backups without invoking pg_restore", async (t) => {
  const { directory, manager, calls } = await createFixture(t);
  const backup = await manager.create();
  const backupPath = join(directory, "backups", `vps-manager-db-${backup.id}.vpsbackup`);
  const bytes = await readFile(backupPath);
  bytes[bytes.length - 1] ^= 0xff;
  await writeFile(backupPath, bytes);

  await assert.rejects(manager.restore(backup.id));
  assert.deepEqual(calls, ["pg_dump"]);
});

test("removes backups older than the seven-day retention period", async (t) => {
  const { directory, manager } = await createFixture(t);
  const backupDirectory = join(directory, "backups");
  const oldId = `${Date.parse("2026-02-14T12:00:00.000Z") - 8 * 24 * 60 * 60 * 1000}-${"b".repeat(24)}`;
  await mkdir(backupDirectory);
  await writeFile(join(backupDirectory, `vps-manager-db-${oldId}.vpsbackup`), "old");

  await manager.create();

  const files = await readdir(backupDirectory);
  assert.equal(files.some((file) => file.includes(oldId)), false);
  assert.equal(files.length, 1);
});

test("rejects invalid backup identifiers before accessing files", async (t) => {
  const { manager } = await createFixture(t);
  await assert.rejects(manager.restore("../other-file"), /identifier is invalid/);
});
