export function createMetricsSampler({
  intervalMinutes,
  collect,
  onError,
  scheduleTimeout = setTimeout,
  cancelTimeout = clearTimeout,
}) {
  let currentIntervalMinutes = intervalMinutes;
  let timeout;
  let running = false;
  let collecting = false;

  function scheduleNext() {
    if (!running) return;
    timeout = scheduleTimeout(() => {
      timeout = undefined;
      void sample();
    }, currentIntervalMinutes * 60_000);
  }

  async function sample() {
    if (!running || collecting) return;
    collecting = true;
    try {
      await collect();
    } catch (error) {
      onError(error);
    } finally {
      collecting = false;
      scheduleNext();
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      void sample();
    },
    setIntervalMinutes(minutes) {
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
        throw new RangeError("The sampling interval must be between 1 and 1440 minutes.");
      }
      currentIntervalMinutes = minutes;
      if (running && timeout !== undefined) {
        cancelTimeout(timeout);
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
