import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDomainHostname,
  createCloudflareClient,
  isIpv4Address,
  validateDomainConfiguration,
  validateDomainZoneConfiguration,
} from "../cloudflare-client.mjs";

const domainInput = {
  provider: "cloudflare",
  zone: "example.com",
  hostname: "app.example.com",
  projectId: "d909f79b-e7f9-41e7-9e7a-6ea000000001",
  port: 3000,
  proxied: false,
};

test("validates reusable Cloudflare zones and builds hostnames from subdomains", () => {
  const zoneInput = {
    zone: "Example.com",
    token: "test-cloudflare-api-key-value-123456789",
    proxied: true,
  };
  assert.deepEqual(validateDomainZoneConfiguration(zoneInput), {
    ...zoneInput,
    zone: "example.com",
  });
  assert.throws(() => validateDomainZoneConfiguration({ ...zoneInput, zone: "not a domain" }), /formato/);
  assert.throws(() => validateDomainZoneConfiguration({ ...zoneInput, token: "short" }), /token/);
  assert.equal(buildDomainHostname("example.com", "automation"), "automation.example.com");
  assert.equal(buildDomainHostname("example.com", "@"), "example.com");
  assert.equal(buildDomainHostname("example.com", ""), "example.com");
  assert.throws(() => buildDomainHostname("example.com", "bad..name"), /subdominio/);
  assert.throws(() => buildDomainHostname("example.com", "bad name"), /formato/);
});

test("validates Cloudflare domain-to-project configuration", () => {
  assert.deepEqual(validateDomainConfiguration(domainInput), domainInput);
  assert.throws(() => validateDomainConfiguration({ ...domainInput, hostname: "elsewhere.test" }), /pertenecer/);
  assert.throws(() => validateDomainConfiguration({ ...domainInput, port: 65536 }), /puerto/);
  assert.throws(() => validateDomainConfiguration({ ...domainInput, provider: "unknown" }), /zona/);
  assert.equal(isIpv4Address("203.0.113.8"), false);
  assert.equal(isIpv4Address("8.8.8.8"), true);
  assert.equal(isIpv4Address("192.168.1.10"), false);
  assert.equal(isIpv4Address("not-an-ip"), false);
});

test("validates a centrally managed n8n domain on its fixed internal port", () => {
  const applicationDomain = {
    provider: "cloudflare",
    zone: "example.com",
    hostname: "automation.example.com",
    applicationId: "n8n",
    port: 5678,
    proxied: true,
  };
  assert.deepEqual(validateDomainConfiguration(applicationDomain), applicationDomain);
  assert.throws(() => validateDomainConfiguration({ ...applicationDomain, port: 3000 }), /destino y puerto/);
  assert.throws(() => validateDomainConfiguration({
    ...applicationDomain,
    projectId: domainInput.projectId,
  }), /destino/);
});

test("creates Cloudflare A records and does not overwrite unrelated records", async () => {
  const calls = [];
  const client = createCloudflareClient({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("/zones?")) {
        return Response.json({ success: true, result: [{ id: "zone-id", name: "example.com", status: "active" }] });
      }
      if (String(url).includes("/dns_records?")) {
        return Response.json({ success: true, result: [] });
      }
      return Response.json({ success: true, result: { id: "record-id", type: "A" } });
    },
  });
  const token = "test-cloudflare-api-key-value-123456789";
  const zone = await client.verifyZone(token, "example.com");
  assert.deepEqual(zone, { id: "zone-id", name: "example.com" });
  const record = await client.upsertARecord(token, {
    zoneId: zone.id,
    hostname: domainInput.hostname,
    address: "8.8.8.8",
    proxied: true,
  });
  assert.deepEqual(record, { id: "record-id" });
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(calls[1].options.method, undefined);
  assert.equal(calls[2].options.method, "POST");
  assert.match(calls[2].options.body, /"content":"8\.8\.8\.8"/);
});

test("updates only the stored record and rejects an untracked DNS record", async () => {
  let method;
  const client = createCloudflareClient({
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes("/dns_records?")) {
        return Response.json({
          success: true,
          result: [{ id: "record-id", type: "A", name: domainInput.hostname }],
        });
      }
      method = options.method;
      return Response.json({ success: true, result: { id: "record-id", type: "A" } });
    },
  });
  const token = "test-cloudflare-api-key-value-123456789";
  await client.upsertARecord(token, {
    zoneId: "zone-id",
    hostname: domainInput.hostname,
    address: "8.8.4.4",
    proxied: false,
    existingRecordId: "record-id",
  });
  assert.equal(method, "PUT");
  await assert.rejects(client.upsertARecord(token, {
    zoneId: "zone-id",
    hostname: domainInput.hostname,
    address: "8.8.4.4",
    proxied: false,
  }), { code: "CLOUDFLARE_RECORD_EXISTS" });
});

test("deletes only the tracked Cloudflare A record and refuses modified records", async () => {
  const calls = [];
  let proxied = false;
  const client = createCloudflareClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("/dns_records?")) {
        return Response.json({
          success: true,
          result: [{
            id: "managed-record",
            type: "A",
            name: domainInput.hostname,
            content: "203.0.113.10",
            proxied,
          }],
        });
      }
      return Response.json({ success: true, result: { id: "managed-record" } });
    },
  });
  const token = "test-cloudflare-api-key-value-123456789";
  assert.deepEqual(await client.deleteARecord(token, {
    zoneId: "b".repeat(32),
    hostname: domainInput.hostname,
    proxied: false,
    recordId: "managed-record",
  }), { deleted: true });
  assert.equal(calls[1].options.method, "DELETE");

  proxied = true;
  await assert.rejects(client.deleteARecord(token, {
    zoneId: "b".repeat(32),
    hostname: domainInput.hostname,
    proxied: false,
    recordId: "managed-record",
  }), { code: "CLOUDFLARE_RECORD_EXISTS" });
});

test("explains the DNS permission required when Cloudflare rejects record deletion", async () => {
  const client = createCloudflareClient({
    fetchImpl: async (url) => String(url).includes("/dns_records?")
      ? Response.json({
        success: true,
        result: [{
          id: "managed-record",
          type: "A",
          name: domainInput.hostname,
          content: "203.0.113.10",
          proxied: false,
        }],
      })
      : Response.json({
        success: false,
        errors: [{ code: 10000, message: "Permission denied." }],
      }, { status: 403 }),
  });
  await assert.rejects(client.deleteARecord("test-cloudflare-api-key-value-123456789", {
    zoneId: "b".repeat(32),
    hostname: domainInput.hostname,
    proxied: false,
    recordId: "managed-record",
  }), /Zone → DNS → Edit/);
});

test("creates Cloudflare Tunnels, retrieves connector tokens, and configures ingress", async () => {
  const calls = [];
  const accountId = "a".repeat(32);
  const tunnelId = "11111111-1111-4111-8111-111111111111";
  const tunnelToken = "eyJhIjoiY2xvdWRmbGFyZS10dW5uZWwtdG9rZW4tdGVzdCJ9";
  const client = createCloudflareClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/cfd_tunnel")) {
        return Response.json({ success: true, result: { id: tunnelId, name: "home-vps" } });
      }
      if (String(url).endsWith(`/cfd_tunnel/${tunnelId}/token`)) {
        return Response.json({ success: true, result: tunnelToken });
      }
      return Response.json({ success: true, result: { config: {} } });
    },
  });
  const token = "test-cloudflare-api-key-value-123456789";
  const tunnel = await client.createTunnel(token, accountId, "home-vps", Buffer.alloc(32, 1).toString("base64"));
  assert.deepEqual(tunnel, { id: tunnelId, name: "home-vps", token: tunnelToken });
  await client.updateTunnelConfiguration(token, accountId, tunnelId, ["app.example.com"]);
  assert.equal(calls[0].options.method, "POST");
  assert.match(calls[0].options.body, /"config_src":"cloudflare"/);
  assert.equal(calls[2].options.method, "PUT");
  assert.match(calls[2].options.body, /"hostname":"app\.example\.com"/);
  assert.match(calls[2].options.body, /"service":"https:\/\/vps-manager_traefik:443"/);
  assert.match(calls[2].options.body, /"noTLSVerify":true/);
});

test("configures local-mode Tunnel ingress over the private Swarm HTTP network", async () => {
  let configuration;
  const client = createCloudflareClient({
    fetchImpl: async (url, options = {}) => {
      configuration = JSON.parse(options.body);
      return Response.json({ success: true, result: { config: {} } });
    },
  });

  await client.updateTunnelConfiguration(
    "test-cloudflare-api-key-value-123456789",
    "a".repeat(32),
    "11111111-1111-4111-8111-111111111111",
    ["app.example.com"],
    { originProtocol: "http", managerHostname: "panel.example.com" },
  );

  assert.deepEqual(configuration.config.ingress, [
    {
      hostname: "panel.example.com",
      service: "http://vps-manager_manager:3000",
      originRequest: { httpHostHeader: "panel.example.com" },
    },
    {
      hostname: "app.example.com",
      service: "http://vps-manager_traefik:80",
      originRequest: { httpHostHeader: "app.example.com" },
    },
    { service: "http_status:404" },
  ]);
  await assert.rejects(client.updateTunnelConfiguration(
    "test-cloudflare-api-key-value-123456789",
    "a".repeat(32),
    "11111111-1111-4111-8111-111111111111",
    ["panel.example.com"],
    { managerHostname: "panel.example.com" },
  ), /hostnames/);
});

test("converts only a tracked A record to a proxied tunnel CNAME", async () => {
  const calls = [];
  const zoneId = "b".repeat(32);
  const tunnelId = "11111111-1111-4111-8111-111111111111";
  const client = createCloudflareClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("/dns_records?")) {
        return Response.json({
          success: true,
          result: [{ id: "managed-a-record", type: "A", name: domainInput.hostname }],
        });
      }
      if (options.method === "DELETE") {
        return Response.json({ success: true, result: { id: "managed-a-record" } });
      }
      return Response.json({ success: true, result: { id: "managed-cname", type: "CNAME" } });
    },
  });
  const record = await client.upsertTunnelCname("test-cloudflare-api-key-value-123456789", {
    zoneId,
    hostname: domainInput.hostname,
    tunnelId,
    existingRecordId: "managed-a-record",
  });
  assert.deepEqual(record, { id: "managed-cname" });
  assert.equal(calls[1].options.method, "DELETE");
  assert.equal(calls[2].options.method, "POST");
  assert.match(calls[2].options.body, new RegExp(`${tunnelId}\\.cfargotunnel\\.com`));
  assert.match(calls[2].options.body, /"proxied":true/);
});

test("deletes only the tracked panel CNAME pointing at its configured tunnel", async () => {
  const calls = [];
  const tunnelId = "11111111-1111-4111-8111-111111111111";
  const client = createCloudflareClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("/dns_records?")) {
        return Response.json({
          success: true,
          result: [{
            id: "panel-record",
            type: "CNAME",
            name: "panel.example.com",
            content: `${tunnelId}.cfargotunnel.com`,
            proxied: true,
          }],
        });
      }
      return Response.json({ success: true, result: { id: "panel-record" } });
    },
  });
  const result = await client.deleteTunnelCname("test-cloudflare-api-key-value-123456789", {
    zoneId: "b".repeat(32),
    hostname: "panel.example.com",
    tunnelId,
    recordId: "panel-record",
  });
  assert.deepEqual(result, { deleted: true });
  assert.equal(calls[1].options.method, "DELETE");
  await assert.rejects(client.deleteTunnelCname("test-cloudflare-api-key-value-123456789", {
    zoneId: "b".repeat(32),
    hostname: "panel.example.com",
    tunnelId,
    recordId: "other-record",
  }), { code: "CLOUDFLARE_RECORD_EXISTS" });
});

test("includes Cloudflare's API reason when a Tunnel operation is rejected", async () => {
  const client = createCloudflareClient({
    fetchImpl: async () => Response.json({
      success: false,
      errors: [{ code: 10000, message: "Authentication error: invalid API token." }],
    }, { status: 403 }),
  });

  await assert.rejects(
    client.getTunnelToken("test-cloudflare-api-key-value-123456789", "a".repeat(32), "11111111-1111-4111-8111-111111111111"),
    (error) => error.code === "CLOUDFLARE_TOKEN_INVALID"
      && error.message.includes("permiso Account")
      && error.message.includes("invalid API token"),
  );
});
