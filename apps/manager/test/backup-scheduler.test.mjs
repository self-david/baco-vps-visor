import assert from "node:assert/strict";
import test from "node:test";
import { createBackupScheduler } from "../backup-scheduler.mjs";

test("schedules backups at the selected interval and reschedules after a change", () => {
  const scheduled = [];
  const cancelled = [];
  const scheduler = createBackupScheduler({
    intervalHours: 24,
    createBackup: async () => {},
    onError: () => {},
    scheduleTimeout: (callback, delay) => {
      const handle = { callback, delay };
      scheduled.push(handle);
      return handle;
    },
    cancelTimeout: (handle) => cancelled.push(handle),
  });

  scheduler.start();
  assert.equal(scheduled[0].delay, 24 * 60 * 60 * 1000);
  scheduler.setIntervalHours(12);
  assert.deepEqual(cancelled, [scheduled[0]]);
  assert.equal(scheduled[1].delay, 12 * 60 * 60 * 1000);
  scheduler.stop();
  assert.deepEqual(cancelled, [scheduled[0], scheduled[1]]);
});

test("rejects out-of-range intervals", () => {
  const scheduler = createBackupScheduler({
    intervalHours: 24,
    createBackup: async () => {},
    onError: () => {},
  });
  assert.throws(() => scheduler.setIntervalHours(0), /between 1 and 168/);
  assert.throws(() => scheduler.setIntervalHours(169), /between 1 and 168/);
});

test("runs a backup when the timer fires and schedules the next run", async () => {
  const scheduled = [];
  let backups = 0;
  const scheduler = createBackupScheduler({
    intervalHours: 1,
    createBackup: async () => { backups += 1; },
    onError: () => {},
    scheduleTimeout: (callback, delay) => {
      const handle = { callback, delay };
      scheduled.push(handle);
      return handle;
    },
    cancelTimeout: () => {},
  });
  scheduler.start();
  scheduled[0].callback();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(backups, 1);
  assert.equal(scheduled.length, 2);
  scheduler.stop();
});

test("accepts a shorter first delay to catch up after a restart", () => {
  const scheduled = [];
  const scheduler = createBackupScheduler({
    intervalHours: 24,
    initialDelayMs: 1000,
    createBackup: async () => {},
    onError: () => {},
    scheduleTimeout: (callback, delay) => {
      const handle = { callback, delay };
      scheduled.push(handle);
      return handle;
    },
  });
  scheduler.start();
  assert.equal(scheduled[0].delay, 1000);
  scheduler.stop();
});
