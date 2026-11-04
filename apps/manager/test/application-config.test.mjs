import assert from "node:assert/strict";
import test from "node:test";
import {
  getSupabaseDefaultConfiguration,
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
  assert.deepEqual(configuration.oauthProviders, {
    github: { enabled: true, clientId: "client-id" },
  });
  assert.deepEqual(configuration.resourceLimits.db, { cpus: 2, memoryMb: 4096 });
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
