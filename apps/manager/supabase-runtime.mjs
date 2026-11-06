export const supabaseServiceIds = [
  "db",
  "studio",
  "api-gw",
  "auth",
  "rest",
  "realtime",
  "storage",
  "imgproxy",
  "meta",
  "functions",
  "supavisor",
  "analytics",
  "vector",
];

export function getSupabaseRuntimeServices(instance, containers) {
  const enabledServices = new Set(
    instance.configuration.enabledServices ?? supabaseServiceIds,
  );
  const ownedContainers = containers.filter((container) =>
    container.Labels?.["vps-manager.application"] === "supabase"
      && container.Labels?.["vps-manager.instance-id"] === instance.id);

  return supabaseServiceIds.map((id) => {
    const serviceContainers = ownedContainers.filter((container) =>
      container.Labels?.["vps-manager.component"] === `supabase-${id}`);
    const runningCount = serviceContainers.filter((container) => container.State === "running").length;
    return {
      id,
      enabled: enabledServices.has(id),
      installed: serviceContainers.length > 0,
      running: runningCount > 0,
      containers: serviceContainers.length,
      runningContainers: runningCount,
      status: serviceContainers.map((container) => container.Status).filter(Boolean).join("; "),
    };
  });
}
