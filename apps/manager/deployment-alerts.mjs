const failedUpdateStates = new Set([
  "paused",
  "rollback_started",
  "rollback_paused",
  "rollback_completed",
]);
const failedTaskStates = new Set(["failed", "rejected"]);
const alertWindowMinutes = 15;
const maximumMessageLength = 240;

function shortMessage(message) {
  if (typeof message !== "string") return "";
  return message.replace(/\s+/g, " ").trim().slice(0, maximumMessageLength);
}

export function evaluateDeploymentAlerts(services, tasks, now = Date.now()) {
  const serviceById = new Map(services.map((service) => [service.ID, service]));
  const reasonsByService = new Map();

  function addReason(serviceId, reason, message, timestamp) {
    const service = serviceById.get(serviceId);
    if (!service) return;
    const name = service.Spec?.Name ?? service.ID;
    const group = service.Spec?.Labels?.["com.docker.stack.namespace"] ?? "Sin grupo";
    const reasons = reasonsByService.get(serviceId) ?? {
      metric: "deployment",
      serviceName: name,
      group,
      reasons: [],
    };
    const detail = shortMessage(message);
    if (!reasons.reasons.some((item) => item.reason === reason && item.message === detail)) {
      reasons.reasons.push({
        reason,
        ...(detail ? { message: detail } : {}),
        ...(timestamp ? { timestamp } : {}),
      });
    }
    reasonsByService.set(serviceId, reasons);
  }

  for (const service of services) {
    const updateStatus = service.UpdateStatus;
    if (failedUpdateStates.has(updateStatus?.State)) {
      addReason(service.ID, updateStatus.State, updateStatus.Message);
    }
  }

  const oldestRecentTimestamp = now - alertWindowMinutes * 60_000;
  for (const task of tasks) {
    const state = task.Status?.State;
    if (!failedTaskStates.has(state)) continue;
    const taskTimestamp = Date.parse(task.Status?.Timestamp ?? task.CreatedAt ?? "");
    if (!Number.isFinite(taskTimestamp) || taskTimestamp < oldestRecentTimestamp || taskTimestamp > now) {
      continue;
    }
    addReason(
      task.ServiceID,
      `task_${state}`,
      task.Status?.Err || task.Status?.Message,
      new Date(taskTimestamp).toISOString(),
    );
  }

  return [...reasonsByService.values()]
    .map((alert) => ({
      ...alert,
      reasons: alert.reasons.sort((left, right) => left.reason.localeCompare(right.reason)),
    }))
    .sort((left, right) => left.serviceName.localeCompare(right.serviceName));
}
