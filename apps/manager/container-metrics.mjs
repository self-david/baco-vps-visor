export function calculateContainerMetrics(stats) {
  const cpuUsage = stats.cpu_stats?.cpu_usage?.total_usage;
  const previousCpuUsage = stats.precpu_stats?.cpu_usage?.total_usage;
  const systemUsage = stats.cpu_stats?.system_cpu_usage;
  const previousSystemUsage = stats.precpu_stats?.system_cpu_usage;
  const onlineCpus = stats.cpu_stats?.online_cpus
    ?? stats.cpu_stats?.cpu_usage?.percpu_usage?.length
    ?? 1;
  const memoryStats = stats.memory_stats?.stats ?? {};
  const memoryCache = memoryStats.total_inactive_file
    ?? memoryStats.inactive_file
    ?? memoryStats.cache
    ?? 0;
  const memoryUsage = Math.max(0, (stats.memory_stats?.usage ?? Number.NaN) - memoryCache);
  const memoryLimit = stats.memory_stats?.limit;

  if (![cpuUsage, previousCpuUsage, systemUsage, previousSystemUsage, onlineCpus, memoryUsage, memoryLimit]
    .every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error("Docker returned incomplete container metrics.");
  }

  const cpuDelta = cpuUsage - previousCpuUsage;
  const systemDelta = systemUsage - previousSystemUsage;
  const cpuPercent = systemDelta > 0
    ? (cpuDelta / systemDelta) * onlineCpus * 100
    : 0;

  return {
    cpuPercent: Math.max(0, cpuPercent),
    memoryUsageBytes: memoryUsage,
    memoryLimitBytes: memoryLimit,
  };
}

export async function collectContainerMetrics(containers, getStats, concurrency = 4) {
  const metrics = [];
  const errors = [];
  let nextIndex = 0;

  async function collectNext() {
    while (nextIndex < containers.length) {
      const container = containers[nextIndex];
      nextIndex += 1;
      try {
        const stats = await getStats(container);
        metrics.push({
          id: container.Id.slice(0, 12),
          name: (container.Names?.[0] ?? "").replace(/^\//, ""),
          group: container.group
            ?? container.Labels?.["com.docker.stack.namespace"]
            ?? container.Labels?.["com.docker.compose.project"]
            ?? "Sin grupo",
          ...calculateContainerMetrics(stats),
        });
      } catch (error) {
        errors.push({
          id: container.Id.slice(0, 12),
          name: (container.Names?.[0] ?? "").replace(/^\//, ""),
          group: container.group
            ?? container.Labels?.["com.docker.stack.namespace"]
            ?? container.Labels?.["com.docker.compose.project"]
            ?? "Sin grupo",
          message: error instanceof Error ? error.message : "Unknown Docker error.",
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, containers.length) }, () => collectNext()),
  );
  return { metrics, errors };
}
