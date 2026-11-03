function createCheck(id, title, status, detail) {
  return { id, title, status, detail };
}

export function createDiagnosticsCollector({
  dockerGet,
  getDatabaseStatus,
  listBackups,
  now = () => new Date(),
  onError = (error) => console.error("System diagnostics check failed:", error),
}) {
  async function runCheck(id, title, collect) {
    try {
      return createCheck(id, title, ...(await collect()));
    } catch (error) {
      onError(error);
      return createCheck(id, title, "error", "No se pudo completar esta comprobación.");
    }
  }

  return async function collectDiagnostics() {
    const infoPromise = dockerGet("/info");
    const [
      dockerCheck,
      swarmCheck,
      servicesCheck,
      networksCheck,
      databaseCheck,
      backupsCheck,
    ] = await Promise.all([
      runCheck("docker", "Docker Engine", async () => {
        const info = await infoPromise;
        return [
          "ok",
          `${info.Name ?? "Servidor"} · Docker ${info.ServerVersion ?? "versión desconocida"} · ${info.OperatingSystem ?? "SO desconocido"} · ${info.Architecture ?? "arquitectura desconocida"} · ${info.NCPU ?? "?"} CPU`,
        ];
      }),
      runCheck("swarm", "Docker Swarm", async () => {
        const info = await infoPromise;
        const activeManager = info.Swarm?.LocalNodeState === "active"
          && info.Swarm?.ControlAvailable === true;
        return [
          activeManager ? "ok" : "warning",
          `Estado: ${info.Swarm?.LocalNodeState ?? "desconocido"} · manager: ${info.Swarm?.ControlAvailable ? "sí" : "no"}`,
        ];
      }),
      runCheck("services", "Servicios VPS Manager", async () => {
        const [services, tasks, nodes] = await Promise.all([
          dockerGet("/services"),
          dockerGet("/tasks?desired-state=running"),
          dockerGet("/nodes"),
        ]);
        const managerServices = services.filter((service) =>
          service.Spec?.Labels?.["com.docker.stack.namespace"] === "vps-manager"
          || service.Spec?.Name?.startsWith("vps-manager_"));
        if (managerServices.length === 0) {
          return ["error", "No se encontraron servicios del stack vps-manager."];
        }

        const activeNodes = nodes.filter((node) =>
          node.Status?.State === "ready" && node.Spec?.Availability === "active").length;
        const runningByService = new Map();
        for (const task of tasks) {
          if (task.Status?.State === "running") {
            runningByService.set(task.ServiceID, (runningByService.get(task.ServiceID) ?? 0) + 1);
          }
        }
        const statuses = managerServices.map((service) => {
          const replicated = service.Spec?.Mode?.Replicated;
          const desired = replicated
            ? replicated.Replicas ?? 1
            : Math.max(activeNodes, 1);
          return {
            name: service.Spec?.Name ?? "servicio desconocido",
            desired,
            running: runningByService.get(service.ID) ?? 0,
          };
        });
        const unavailable = statuses.filter(({ desired, running }) => running < desired);
        const detail = statuses
          .map(({ name, running, desired }) => `${name}: ${running}/${desired}`)
          .join(" · ");
        return [
          unavailable.length ? "error" : "ok",
          `${detail} réplicas activas.`,
        ];
      }),
      runCheck("networks", "Redes de VPS Manager", async () => {
        const networks = await dockerGet("/networks");
        const proxy = networks.find((network) => network.Name === "vps-manager-proxy");
        const internal = networks.find((network) => network.Name === "vps-manager-internal");
        const validProxy = proxy?.Driver === "overlay" && proxy.Attachable === true;
        const validInternal = internal?.Driver === "overlay" && internal.Attachable === false;
        const detail = [
          `proxy: ${proxy ? `${proxy.Driver}, attachable=${proxy.Attachable}` : "no encontrada"}`,
          `interna: ${internal ? `${internal.Driver}, attachable=${internal.Attachable}` : "no encontrada"}`,
        ].join(" · ");
        return [validProxy && validInternal ? "ok" : "error", detail];
      }),
      runCheck("database", "Base de datos del panel", async () => {
        const database = await getDatabaseStatus();
        return [
          database.connected ? "ok" : "error",
          database.connected
            ? `${database.name ?? "PostgreSQL"} conectada.`
            : "PostgreSQL no está conectada.",
        ];
      }),
      runCheck("backups", "Respaldos cifrados", async () => {
        const backups = await listBackups();
        if (backups.length === 0) {
          return ["warning", "No hay respaldos cifrados disponibles todavía."];
        }
        return [
          "ok",
          `${backups.length} respaldo(s); el más reciente es del ${backups[0].createdAt}.`,
        ];
      }),
    ]);

    const checks = [dockerCheck, swarmCheck, servicesCheck, networksCheck, databaseCheck, backupsCheck];
    const status = checks.some(({ status: checkStatus }) => checkStatus === "error")
      ? "error"
      : checks.some(({ status: checkStatus }) => checkStatus === "warning")
        ? "warning"
        : "ok";
    return { generatedAt: now().toISOString(), status, checks };
  };
}
