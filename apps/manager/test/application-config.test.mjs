import assert from "node:assert/strict";
import test from "node:test";
import {
  getN8nDefaultConfiguration,
  getSupabaseDefaultConfiguration,
  validateN8nInstanceConfiguration,
  validateSupabaseInstanceConfiguration,
} from "../application-config.mjs";

function validConfiguration(overrides = {}) {
  return {
    ...getSupabaseDefaultConfiguration(),
    apiDomain: "api.example.net",
    studioDomain: "studio.example.net",
    siteUrl: "https://app.example.net",
    ...overrides,
  };
}

test("validates n8n version, timezone, and resource limits with safe defaults", () => {
  assert.deepEqual(validateN8nInstanceConfiguration({}), getN8nDefaultConfiguration());
  assert.deepEqual(validateN8nInstanceConfiguration({
    version: "2.50.1",
    timezone: "America/Mexico_City",
    cpus: 2,
    memoryMb: 3072,
  }), {
    version: "2.50.1",
    timezone: "America/Mexico_City",
    cpus: 2,
    memoryMb: 3072,
  });
});

test("accepts the default latest tag and rejects invalid timezones and unsafe n8n resource limits", () => {
  assert.equal(validateN8nInstanceConfiguration({ version: "latest" }).version, "latest");
  assert.throws(() => validateN8nInstanceConfiguration({ version: "not-a-tag" }), /latest o una versión estable/);
  assert.throws(() => validateN8nInstanceConfiguration({ timezone: "Mars/Olympus" }), /zona horaria IANA/);
  assert.throws(() => validateN8nInstanceConfiguration({ cpus: 0 }), /límite de CPU/);
  assert.throws(() => validateN8nInstanceConfiguration({ memoryMb: 128 }), /memoria de n8n/);
  assert.throws(() => validateN8nInstanceConfiguration({ encryptionKey: "not-allowed" }), /campos no permitidos/);
});

test("validates and normalizes a complete Supabase instance configuration", () => {
  const configuration = validateSupabaseInstanceConfiguration(validConfiguration({
    apiDomain: " API.Example.Net ",
    additionalRedirectUrls: ["https://app.example.net/auth/callback"],
    smtp: {
      host: " smtp.example.net ",
      port: 587,
      adminEmail: "admin@example.net",
      senderName: " Supabase ",
      username: "mailer",
    },
    oauthProviders: {
      github: { enabled: true, clientId: "client-id" },
    },
  }));

  assert.equal(configuration.apiDomain, "api.example.net");
  assert.deepEqual(configuration.additionalRedirectUrls, ["https://app.example.net/auth/callback"]);
  assert.equal(configuration.smtp.host, "smtp.example.net");
  assert.equal(configuration.smtp.senderName, "Supabase");
  assert.deepEqual(configuration.enabledServices, getSupabaseDefaultConfiguration().enabledServices);
  assert.equal(configuration.exposeDatabasePorts, true);
  assert.deepEqual(configuration.oauthProviders, {
    github: { enabled: true, clientId: "client-id" },
  });
  assert.deepEqual(configuration.resourceLimits.db, { cpus: 2, memoryMb: 4096 });
  assert.deepEqual(configuration.resourceLimits.analytics, { cpus: 1, memoryMb: 1024 });
});

test("validates the selected Supabase services and their required dependencies", () => {
  const defaults = getSupabaseDefaultConfiguration();
  assert.deepEqual(defaults.enabledServices, [
    "db", "studio", "api-gw", "auth", "rest", "realtime", "storage",
    "imgproxy", "meta", "functions", "supavisor", "analytics", "vector",
  ]);
  assert.deepEqual(validateSupabaseInstanceConfiguration(validConfiguration({
    enabledServices: defaults.enabledServices.filter((service) => service !== "vector"),
    exposeDatabasePorts: false,
  })).enabledServices, defaults.enabledServices.filter((service) => service !== "vector"));
  assert.throws(() => validateSupabaseInstanceConfiguration(validConfiguration({
    enabledServices: defaults.enabledServices.filter((service) => service !== "db"),
  })), /servicios base son obligatorios/);
  assert.throws(() => validateSupabaseInstanceConfiguration(validConfiguration({
    enabledServices: defaults.enabledServices.filter((service) => service !== "analytics"),
  })), /Vector requiere Analytics/);
  assert.throws(() => validateSupabaseInstanceConfiguration(validConfiguration({
    enabledServices: ["db", "db", "studio", "api-gw", "auth", "rest", "meta"],
  })), /servicios Supabase válidos/);
  assert.throws(() => validateSupabaseInstanceConfiguration(validConfiguration({
    exposeDatabasePorts: "true",
  })), /debe ser booleano/);
});

test("rejects invalid public domains, redirects, and resource ranges", () => {
  assert.throws(() => validateSupabaseInstanceConfiguration(validConfiguration({
    apiDomain: "localhost",
  })), /dominios públicos/);
  assert.throws(() => validateSupabaseInstanceConfiguration(validConfiguration({
    studioDomain: "api.example.net",
  })), /dominios públicos/);
  assert.throws(() => validateSupabaseInstanceConfiguration(validConfiguration({
    additionalRedirectUrls: ["http://app.example.net"],
  })), /URLs de redirección/);
  assert.throws(() => validateSupabaseInstanceConfiguration(validConfiguration({
    resourceLimits: {
      ...getSupabaseDefaultConfiguration().resourceLimits,
      db: { cpus: 0, memoryMb: 4096 },
    },
  })), /recursos asignados a db/);
});

test("rejects SMTP and OAuth secrets so they cannot be persisted in configuration", () => {
  assert.throws(() => validateSupabaseInstanceConfiguration(validConfiguration({
    smtp: {
      host: "smtp.example.net",
      port: 587,
      adminEmail: "admin@example.net",
      senderName: "Supabase",
      username: "mailer",
      password: "must-not-be-persisted",
    },
  })), /no incluyas contraseñas/);
  assert.throws(() => validateSupabaseInstanceConfiguration(validConfiguration({
    oauthProviders: {
      github: { enabled: true, clientId: "client-id", clientSecret: "must-not-be-persisted" },
    },
  })), /no incluyas secretos de cliente/);
});
