export function createBackupScheduler({
  intervalHours,
  createBackup,
  onError,
  initialDelayMs = intervalHours * 60 * 60 * 1000,
  scheduleTimeout = setTimeout,
  cancelTimeout = clearTimeout,
}) {
  let currentIntervalHours = intervalHours;
  let timeout;
  let running = false;
  let creating = false;
  let nextDelayMs = initialDelayMs;

  function scheduleNext() {
    if (!running) return;
    timeout = scheduleTimeout(() => {
      timeout = undefined;
      void run();
    }, nextDelayMs);
    nextDelayMs = currentIntervalHours * 60 * 60 * 1000;
  }

  async function run() {
    if (!running || creating) return;
    creating = true;
    try {
      await createBackup();
    } catch (error) {
      onError(error);
    } finally {
      creating = false;
      scheduleNext();
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      scheduleNext();
    },
    setIntervalHours(hours) {
      if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
        throw new RangeError("The backup interval must be between 1 and 168 hours.");
      }
      currentIntervalHours = hours;
      if (running && timeout !== undefined) {
        cancelTimeout(timeout);
        nextDelayMs = currentIntervalHours * 60 * 60 * 1000;
        scheduleNext();
      }
    },
    stop() {
      running = false;
      if (timeout !== undefined) {
        cancelTimeout(timeout);
        timeout = undefined;
      }
    },
  };
}
