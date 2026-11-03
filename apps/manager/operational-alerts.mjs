export function evaluateOperationalAlerts({ disk, services, restarts, thresholds }) {
  const alerts = [];

  if (disk.freePercent <= thresholds.diskFreePercent) {
    alerts.push({
      metric: "disk",
      freePercent: disk.freePercent,
      thresholdPercent: thresholds.diskFreePercent,
      freeBytes: disk.freeBytes,
      totalBytes: disk.totalBytes,
    });
  }

  for (const service of services) {
    if (service.desiredTasks > service.runningTasks) {
      alerts.push({
        metric: "service",
        serviceName: service.name,
        group: service.group,
        runningTasks: service.runningTasks,
        desiredTasks: service.desiredTasks,
      });
    }
  }

  for (const container of restarts) {
    if (container.restartCount >= thresholds.restartCount) {
      alerts.push({
        metric: "restarts",
        containerName: container.name,
        group: container.group,
        restartCount: container.restartCount,
        thresholdCount: thresholds.restartCount,
        windowMinutes: thresholds.restartWindowMinutes,
      });
    }
  }

  return alerts.sort((left, right) =>
    left.metric.localeCompare(right.metric)
    || (left.serviceName ?? left.containerName ?? "").localeCompare(
      right.serviceName ?? right.containerName ?? "",
    ));
}
