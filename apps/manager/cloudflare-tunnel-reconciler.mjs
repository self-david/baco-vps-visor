import { randomUUID } from "node:crypto";

const serviceName = "vps-manager_cloudflared";

export function createCloudflareTunnelReconciler({
  getSettings,
  hasApiToken,
  getApiToken,
  getDomains,
  getDomainZones,
  hasZoneToken,
  getZoneToken,
  saveDomain,
  saveSettings,
  getServices,
  getServiceTasks,
  getLatestTask,
  cloudflareClient,
  stageCredentials,
  removeCredentials,
  createConfigureTask,
  createId = randomUUID,
  now = Date.now,
  retryDelayMs = 5 * 60 * 1000,
} = {}) {
  if ([getSettings, hasApiToken, getApiToken, getDomains, getDomainZones, hasZoneToken, getZoneToken,
    saveDomain, saveSettings, getServices, getServiceTasks, getLatestTask, stageCredentials,
    removeCredentials, createConfigureTask]
    .some((dependency) => typeof dependency !== "function")
    || !cloudflareClient || typeof cloudflareClient.getTunnelToken !== "function"
    || typeof cloudflareClient.upsertTunnelCname !== "function"
    || typeof cloudflareClient.updateTunnelConfiguration !== "function"
    || typeof createId !== "function"
    || typeof now !== "function"
    || !Number.isInteger(retryDelayMs) || retryDelayMs < 1000) {
    throw new TypeError("La configuración de recuperación de Cloudflare Tunnel no es válida.");
  }

  return async function reconcileCloudflareTunnel() {
    const tunnel = await getSettings();
    if (!tunnel) return { state: "not-configured" };

    const services = await getServices();
    if (!Array.isArray(services)) throw new Error("Docker devolvió una lista de servicios inválida.");
    const connectorService = services.find((service) => service.Spec?.Name === serviceName);
    if (connectorService) {
      if (connectorService.Spec?.Labels?.["vps-manager.managed"] !== "true"
        || connectorService.Spec?.Labels?.["vps-manager.component"] !== "cloudflare-tunnel") {
        throw new Error("El nombre vps-manager_cloudflared pertenece a un servicio no administrado; no se modificará.");
      }
      if (typeof connectorService.ID !== "string" || !connectorService.ID) {
        throw new Error("Docker devolvió un identificador inválido para el servicio Cloudflare Tunnel.");
      }
      const tasks = await getServiceTasks(connectorService.ID);
      if (!Array.isArray(tasks)) throw new Error("Docker devolvió las tareas del túnel en un formato inválido.");
      if (tasks.some((task) => task.DesiredState === "running" && task.Status?.State === "running")) {
        return { state: "service-present" };
      }
    }

    const latestTask = await getLatestTask();
    if (latestTask && ["pending", "in_progress"].includes(latestTask.status)) {
      return { state: "configuration-in-progress", taskId: latestTask.id };
    }
    if (latestTask?.status === "failed") {
      const failedAt = Date.parse(latestTask.completedAt ?? latestTask.updatedAt ?? "");
      if (Number.isFinite(failedAt) && now() - failedAt < retryDelayMs) {
        return { state: "recent-failure", taskId: latestTask.id };
      }
    }
    if (!await hasApiToken()) {
      throw new Error("Falta el API Token protegido de Cloudflare para recuperar el conector del túnel.");
    }

    const apiToken = await getApiToken();
    const [domains, domainZones] = await Promise.all([getDomains(), getDomainZones()]);
    for (const domain of domains) {
      const domainZone = domainZones.find((candidate) =>
        candidate.zone.toLowerCase() === domain.zone.toLowerCase());
      if (!domainZone || domainZone.connectionStatus !== "connected") {
        throw new Error(`La zona Cloudflare de ${domain.hostname} no está conectada.`);
      }
      if (!await hasZoneToken(domainZone.credentialId)) {
        throw new Error(`Falta el API Token protegido de la zona ${domainZone.zone}.`);
      }
      const zoneToken = await getZoneToken(domainZone.credentialId);
      const dnsRecord = await cloudflareClient.upsertTunnelCname(zoneToken, {
        zoneId: domain.zoneId,
        hostname: domain.hostname,
        tunnelId: tunnel.tunnelId,
        existingRecordId: domain.dnsRecordId,
      });
      await saveDomain({ ...domain, proxied: true, dnsRecordId: dnsRecord.id });
    }

    let managerHostname = tunnel.managerHostname ?? null;
    if (managerHostname) {
      const managerZone = domainZones.find((candidate) => candidate.id === tunnel.managerZoneId);
      if (!managerZone || managerZone.connectionStatus !== "connected") {
        throw new Error("La zona Cloudflare del hostname del panel no está conectada.");
      }
      if (!await hasZoneToken(managerZone.credentialId)) {
        throw new Error(`Falta el API Token protegido de la zona ${managerZone.zone}.`);
      }
      const managerZoneToken = await getZoneToken(managerZone.credentialId);
      const managerDnsRecord = await cloudflareClient.upsertTunnelCname(managerZoneToken, {
        zoneId: managerZone.zoneId,
        hostname: managerHostname,
        tunnelId: tunnel.tunnelId,
        existingRecordId: tunnel.managerDnsRecordId ?? undefined,
      });
      if (managerDnsRecord.id !== tunnel.managerDnsRecordId) {
        await saveSettings({ ...tunnel, managerDnsRecordId: managerDnsRecord.id });
      }
    }

    await cloudflareClient.updateTunnelConfiguration(
      apiToken,
      tunnel.accountId,
      tunnel.tunnelId,
      domains.map((domain) => domain.hostname),
      {
        originProtocol: tunnel.originProtocol,
        managerHostname,
      },
    );

    const connectorToken = await cloudflareClient.getTunnelToken(
      apiToken,
      tunnel.accountId,
      tunnel.tunnelId,
    );
    const taskId = createId();
    await stageCredentials(taskId, connectorToken);
    try {
      await createConfigureTask({
        id: taskId,
        tunnelId: tunnel.tunnelId,
        tunnelName: tunnel.name,
      });
    } catch (error) {
      await removeCredentials(taskId);
      throw error;
    }
    return { state: "configuration-queued", taskId };
  };
}
