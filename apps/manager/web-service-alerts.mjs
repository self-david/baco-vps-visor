import { isIP } from "node:net";
import { connect as tlsConnect } from "node:tls";

const dayMilliseconds = 24 * 60 * 60 * 1000;

function getHostnames(rule) {
  const hostnames = new Set();
  for (const match of rule.matchAll(/\bHost\s*\(([^)]*)\)/g)) {
    for (const value of match[1].matchAll(/`([^`]+)`|"([^"]+)"|'([^']+)'/g)) {
      const hostname = value[1] ?? value[2] ?? value[3];
      if (!hostname || hostname.includes("*") || hostname.includes("{")) continue;
      try {
        const parsed = new URL(`http://${hostname}`);
        if (parsed.hostname
          && !parsed.username
          && !parsed.password
          && !parsed.port
          && parsed.pathname === "/"
          && !parsed.search
          && !parsed.hash) {
          hostnames.add(parsed.hostname.toLowerCase().replace(/^\[|\]$/g, ""));
        }
      } catch {
        continue;
      }
    }
  }
  return [...hostnames];
}

export function discoverWebServiceTargets(services) {
  const targets = new Map();
  for (const service of services) {
    const labels = service.Spec?.Labels ?? {};
    for (const [label, rule] of Object.entries(labels)) {
      const match = label.match(/^traefik\.http\.routers\.(.+)\.rule$/);
      if (!match) continue;

      const routerPrefix = `traefik.http.routers.${match[1]}.`;
      const entrypoints = (labels[`${routerPrefix}entrypoints`] ?? "")
        .split(",")
        .map((entrypoint) => entrypoint.trim());
      const tlsEnabled = labels[`${routerPrefix}tls`] === "true"
        || Object.keys(labels).some((key) => key.startsWith(`${routerPrefix}tls.`))
        || entrypoints.includes("websecure");
      const protocol = tlsEnabled ? "https" : "http";
      const group = labels["com.docker.stack.namespace"] ?? "Sin grupo";
      for (const hostname of getHostnames(rule)) {
        const urlHostname = isIP(hostname) === 6 ? `[${hostname}]` : hostname;
        const url = `${protocol}://${urlHostname}/`;
        const key = `${service.Spec?.Name ?? service.ID}:${url}`;
        targets.set(key, {
          serviceName: service.Spec?.Name ?? service.ID ?? "unknown",
          group,
          url,
          hostname,
          protocol,
          checkCertificate: tlsEnabled,
        });
      }
    }
  }
  return [...targets.values()];
}

export async function probeHttpTarget(target, {
  timeoutSeconds = 5,
  fetchImpl = fetch,
} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    const response = await fetchImpl(target.url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: { "User-Agent": "VPS-Manager-Health-Check/1.0" },
    });
    await response.body?.cancel();
    if (response.status >= 200 && response.status < 400) return null;
    return {
      metric: "http",
      serviceName: target.serviceName,
      group: target.group,
      url: target.url,
      statusCode: response.status,
      reason: "http_status",
    };
  } catch (error) {
    return {
      metric: "http",
      serviceName: target.serviceName,
      group: target.group,
      url: target.url,
      reason: error?.name === "AbortError" || error?.name === "TimeoutError" ? "timeout" : "connection",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function inspectTlsCertificate(target, {
  timeoutSeconds = 5,
  connect = tlsConnect,
  now = Date.now(),
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let socket;
    const finish = (alert) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket?.destroy();
      resolve(alert);
    };
    const timeout = setTimeout(() => {
      finish({
        metric: "certificate",
        serviceName: target.serviceName,
        group: target.group,
        hostname: target.hostname,
        reason: "timeout",
      });
    }, timeoutSeconds * 1000);
    try {
      socket = connect({
        host: target.hostname,
        port: 443,
        ...(isIP(target.hostname) ? {} : { servername: target.hostname }),
        rejectUnauthorized: false,
      });
    } catch {
      finish({
        metric: "certificate",
        serviceName: target.serviceName,
        group: target.group,
        hostname: target.hostname,
        reason: "unavailable",
      });
      return;
    }
    socket.once("secureConnect", () => {
      const certificate = socket.getPeerCertificate();
      const expiresAt = Date.parse(certificate.valid_to ?? "");
      if (!Number.isFinite(expiresAt)) {
        finish({
          metric: "certificate",
          serviceName: target.serviceName,
          group: target.group,
          hostname: target.hostname,
          reason: "unavailable",
        });
        return;
      }
      finish({
        metric: "certificate",
        serviceName: target.serviceName,
        group: target.group,
        hostname: target.hostname,
        expiresAt: new Date(expiresAt).toISOString(),
        daysRemaining: expiresAt < now
          ? -Math.ceil((now - expiresAt) / dayMilliseconds)
          : Math.ceil((expiresAt - now) / dayMilliseconds),
      });
    });
    socket.once("error", () => {
      finish({
        metric: "certificate",
        serviceName: target.serviceName,
        group: target.group,
        hostname: target.hostname,
        reason: "unavailable",
      });
    });
  });
}

export async function collectWebServiceAlerts(services, {
  certificateWarningDays = 14,
  timeoutSeconds = 5,
  fetchImpl = fetch,
  connect = tlsConnect,
  now = Date.now(),
} = {}) {
  const targets = discoverWebServiceTargets(services);
  const results = [];
  let nextIndex = 0;

  async function checkNext() {
    while (nextIndex < targets.length) {
      const target = targets[nextIndex];
      nextIndex += 1;
      const checks = [probeHttpTarget(target, { timeoutSeconds, fetchImpl })];
      if (target.checkCertificate) {
        checks.push(inspectTlsCertificate(target, { timeoutSeconds, connect, now }));
      }
      const [httpAlert, certificateAlert] = await Promise.all(checks);
      if (httpAlert) results.push(httpAlert);
      if (certificateAlert
        && (certificateAlert.reason || certificateAlert.daysRemaining <= certificateWarningDays)) {
        results.push(certificateAlert);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(4, targets.length) }, () => checkNext()),
  );
  return results.sort((left, right) =>
    left.metric.localeCompare(right.metric)
    || left.serviceName.localeCompare(right.serviceName)
    || (left.hostname ?? "").localeCompare(right.hostname ?? ""));
}
