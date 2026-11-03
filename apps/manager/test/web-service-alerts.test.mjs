import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  collectWebServiceAlerts,
  discoverWebServiceTargets,
  inspectTlsCertificate,
  probeHttpTarget,
} from "../web-service-alerts.mjs";

function service(name, labels) {
  return { ID: name, Spec: { Name: name, Labels: labels } };
}

test("discovers HTTP and HTTPS routes from Traefik host rules only", () => {
  const targets = discoverWebServiceTargets([
    service("web", {
      "com.docker.stack.namespace": "shop",
      "traefik.http.routers.web.rule": "Host(`shop.example.test`) || Host(`www.example.test`)",
      "traefik.http.routers.web.entrypoints": "websecure",
      "traefik.http.routers.web.tls": "true",
    }),
    service("test-panel", {
      "traefik.http.routers.test.rule": "Host(`192.168.100.158`)",
      "traefik.http.routers.test.entrypoints": "web",
    }),
    service("unsafe", {
      "traefik.http.routers.unsafe.rule": "Host(`user@example.test/path`)",
      "traefik.http.routers.unsafe.entrypoints": "websecure",
    }),
    service("path", {
      "traefik.http.routers.path.rule": "Host(`example.test/admin`)",
      "traefik.http.routers.path.entrypoints": "websecure",
    }),
  ]);

  assert.deepEqual(targets.map(({ serviceName, url, checkCertificate }) => ({
    serviceName,
    url,
    checkCertificate,
  })), [
    { serviceName: "web", url: "https://shop.example.test/", checkCertificate: true },
    { serviceName: "web", url: "https://www.example.test/", checkCertificate: true },
    { serviceName: "test-panel", url: "http://192.168.100.158/", checkCertificate: false },
  ]);
});

test("alerts when an HTTP probe gets a status outside 2xx/3xx", async () => {
  const alert = await probeHttpTarget({
    serviceName: "web",
    group: "shop",
    url: "https://shop.example.test/",
  }, {
    fetchImpl: async () => ({
      status: 404,
      body: { cancel: async () => {} },
    }),
  });

  assert.equal(alert.metric, "http");
  assert.equal(alert.statusCode, 404);
  assert.equal(alert.reason, "http_status");
});

test("accepts 3xx responses and reports probe timeouts", async () => {
  const target = { serviceName: "web", group: "shop", url: "https://shop.example.test/" };
  assert.equal(await probeHttpTarget(target, {
    fetchImpl: async () => ({ status: 302, body: { cancel: async () => {} } }),
  }), null);

  const timeoutAlert = await probeHttpTarget(target, {
    timeoutSeconds: 1,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }),
  });
  assert.equal(timeoutAlert.reason, "timeout");
});

test("reads TLS expiry and warns only inside the configured window", async () => {
  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toUTCString();
  const connect = () => {
    const socket = new EventEmitter();
    socket.destroy = () => {};
    socket.getPeerCertificate = () => ({ valid_to: expiresAt });
    queueMicrotask(() => socket.emit("secureConnect"));
    return socket;
  };
  const target = {
    serviceName: "web",
    group: "shop",
    url: "https://shop.example.test/",
    hostname: "shop.example.test",
    checkCertificate: true,
  };
  const alerts = await collectWebServiceAlerts([
    service("web", {
      "com.docker.stack.namespace": "shop",
      "traefik.http.routers.web.rule": "Host(`shop.example.test`)",
      "traefik.http.routers.web.tls": "true",
    }),
  ], {
    certificateWarningDays: 14,
    timeoutSeconds: 5,
    fetchImpl: async () => ({ status: 200, body: { cancel: async () => {} } }),
    connect,
  });
  assert.deepEqual(alerts.map((alert) => alert.metric), ["certificate"]);
  assert.ok(alerts[0].daysRemaining <= 10);

  const certificate = await inspectTlsCertificate(target, { connect });
  assert.equal(certificate.hostname, target.hostname);
});

test("reports an expired TLS certificate as expired", async () => {
  const socketConnect = () => {
    const socket = new EventEmitter();
    socket.destroy = () => {};
    socket.getPeerCertificate = () => ({ valid_to: new Date(Date.now() - 1000).toUTCString() });
    queueMicrotask(() => socket.emit("secureConnect"));
    return socket;
  };
  const certificate = await inspectTlsCertificate({
    serviceName: "web",
    group: "shop",
    hostname: "shop.example.test",
  }, { connect: socketConnect });

  assert.equal(certificate.daysRemaining, -1);
});
