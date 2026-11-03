export function evaluateContainerMetricAlerts(rows, thresholds, requiredSamples = 2) {
  const samplesByContainer = new Map();
  for (const row of rows) {
    const samples = samplesByContainer.get(row.container_id) ?? [];
    if (samples.length < requiredSamples) {
      samples.push(row);
      samplesByContainer.set(row.container_id, samples);
    }
  }

  const alerts = [];
  for (const [containerId, samples] of samplesByContainer) {
    if (samples.length < requiredSamples) continue;

    const latest = samples[0];
    const base = {
      containerId,
      containerName: latest.container_name,
      group: latest.group_name,
      sampledAt: latest.sampled_at.toISOString(),
    };
    const cpuPercent = Number(latest.cpu_percent);
    if (samples.every((sample) => Number(sample.cpu_percent) > thresholds.cpuPercent)) {
      alerts.push({
        ...base,
        metric: "cpu",
        valuePercent: cpuPercent,
        thresholdPercent: thresholds.cpuPercent,
      });
    }

    const memoryLimitBytes = Number(latest.memory_limit_bytes);
    if (memoryLimitBytes > 0) {
      const memoryPercent = (Number(latest.memory_usage_bytes) / memoryLimitBytes) * 100;
      const memoryAboveThreshold = samples.every((sample) => {
        const limit = Number(sample.memory_limit_bytes);
        return limit > 0
          && (Number(sample.memory_usage_bytes) / limit) * 100 > thresholds.memoryPercent;
      });
      if (memoryAboveThreshold) {
        alerts.push({
          ...base,
          metric: "memory",
          valuePercent: memoryPercent,
          thresholdPercent: thresholds.memoryPercent,
        });
      }
    }
  }

  return alerts.sort((left, right) =>
    left.metric.localeCompare(right.metric) || left.containerName.localeCompare(right.containerName));
}
