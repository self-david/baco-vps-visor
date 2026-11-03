import assert from "node:assert/strict";
import test from "node:test";
import {
  createCloudflareClient,
  isIpv4Address,
  validateDomainConfiguration,
} from "../cloudflare-client.mjs";

const domainInput = {
  provider: "cloudflare",
  zone: "example.com",
  hostname: "app.example.com",
  projectId: "d909f79b-e7f9-41e7-9e7a-6ea000000001",
  port: 3000,
  proxied: false,
};

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
