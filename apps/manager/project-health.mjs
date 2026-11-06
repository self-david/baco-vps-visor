const defaultTimeoutMs = 5_000;
const defaultConcurrency = 8;

async function checkProjectUrl(hostname, fetchImpl, timeoutMs) {
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(`https://${hostname}/`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel();
    const error = response.status >= 500
        ? `HTTP ${response.status}: el servidor no pudo completar la solicitud. Revisa los logs y el puerto interno de la aplicación.`
          : null;
    return {
      hostname,
      state: response.status >= 200 && response.status < 500 ? "online" : "unavailable",
      httpStatus: response.status,
      responseTimeMs: Date.now() - startedAt,
      ...(error ? { error } : {}),
    };
  } catch (error) {
    return {
      hostname,
      state: "unavailable",
      httpStatus: null,
      responseTimeMs: Date.now() - startedAt,
      error: error?.name === "TimeoutError" || error?.name === "AbortError"
        ? "Tiempo de espera agotado: revisa DNS, TLS y que el servicio responda en su puerto interno."
        : "No se pudo conectar: revisa DNS/TLS, la ruta de Cloudflare y que la aplicación escuche en 0.0.0.0 en el puerto interno configurado.",
    };
  }
}

export async function checkProjectHealth(
  projects,
  projectDomains,
  { fetchImpl = globalThis.fetch, timeoutMs = defaultTimeoutMs, concurrency = defaultConcurrency } = {},
) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new RangeError("timeoutMs must be a positive integer.");
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError("concurrency must be a positive integer.");

  const checkedAt = new Date().toISOString();
  const domainsByProject = new Map();
  for (const domain of projectDomains) {
    const domains = domainsByProject.get(domain.projectId) ?? [];
    domains.push(domain);
    domainsByProject.set(domain.projectId, domains);
  }

  const resultsByProject = new Map(projects.map((project) => [project.id, {
    checkedAt,
    serviceStatus: !project.deployment
      ? "not-deployed"
      : project.deployment.runningReplicas > 0 ? "running" : "stopped",
    urlStatus: "no-domains",
    urls: [],
  }]));
  const checks = [];
  for (const project of projects) {
    const health = resultsByProject.get(project.id);
    const domains = domainsByProject.get(project.id) ?? [];
    if (domains.length === 0) continue;
    if (health.serviceStatus !== "running") {
      health.urlStatus = "unavailable";
      health.urls = domains.map(({ hostname }) => ({
        hostname,
        state: "unavailable",
        httpStatus: null,
        responseTimeMs: null,
        error: health.serviceStatus === "not-deployed"
          ? "El proyecto todavía no tiene un servicio desplegado."
          : "El servicio del proyecto no está ejecutándose.",
      }));
      continue;
    }
    health.urlStatus = "online";
    for (const domain of domains) {
      checks.push({ projectId: project.id, hostname: domain.hostname });
    }
  }

  let nextCheck = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, checks.length) }, async () => {
    while (nextCheck < checks.length) {
      const check = checks[nextCheck];
      nextCheck += 1;
      const result = await checkProjectUrl(check.hostname, fetchImpl, timeoutMs);
      const health = resultsByProject.get(check.projectId);
      health.urls.push(result);
      if (result.state !== "online") health.urlStatus = "degraded";
    }
  }));

  for (const health of resultsByProject.values()) {
    health.urls.sort((left, right) => left.hostname.localeCompare(right.hostname));
  }
  return resultsByProject;
}
