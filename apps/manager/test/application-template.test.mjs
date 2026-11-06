import assert from "node:assert/strict";
import test from "node:test";
import {
  validateApplicationTemplate,
  validateManualApplicationInput,
} from "../application-template.mjs";

const template = {
  id: "sample-web",
  version: "1.0.0",
  name: "Sample web application",
  description: "A single-container application.",
  category: "Web",
  image: "ghcr.io/example/sample-web:1.0.0",
  environment: [
    {
      name: "APP_MODE",
      label: "Application mode",
      description: "Runtime mode for the application.",
      required: true,
      secret: false,
      defaultValue: "production",
    },
    {
      name: "APP_KEY",
      label: "Application key",
      description: "Private key used by the application.",
      required: true,
      secret: true,
    },
  ],
};

test("validates and copies a versioned image-and-environment application template", () => {
  const validated = validateApplicationTemplate(template);

  assert.deepEqual(validated, template);
  assert.notEqual(validated, template);
  assert.notEqual(validated.environment, template.environment);
  assert.notEqual(validated.environment[0], template.environment[0]);
});

test("accepts image digests and an empty environment declaration list", () => {
  const digestTemplate = {
    ...template,
    image: `ghcr.io/example/sample-web@sha256:${"a".repeat(64)}`,
    environment: [],
  };

  assert.deepEqual(validateApplicationTemplate(digestTemplate), digestTemplate);
});

test("rejects unversioned images and template fields outside the supported scope", () => {
  assert.throws(() => validateApplicationTemplate({ ...template, image: "nginx" }), /tag or sha256 digest/);
  assert.throws(() => validateApplicationTemplate({ ...template, ports: [8080] }), /fields are invalid/);
  assert.throws(() => validateApplicationTemplate({ ...template, volumes: ["/data"] }), /fields are invalid/);
});

test("rejects unsupported variable defaults, names, duplicates and types", () => {
  assert.throws(() => validateApplicationTemplate({
    ...template,
    environment: [template.environment[1], {
      ...template.environment[1],
      name: "APP_KEY",
    }],
  }), /unique valid identifiers/);
  assert.throws(() => validateApplicationTemplate({
    ...template,
    environment: [{ ...template.environment[0], name: "app-mode" }],
  }), /unique valid identifiers/);
  assert.throws(() => validateApplicationTemplate({
    ...template,
    environment: [{ ...template.environment[1], defaultValue: "secret-default" }],
  }), /defaults are invalid/);
  assert.throws(() => validateApplicationTemplate({
    ...template,
    environment: [{ ...template.environment[0], required: "true" }],
  }), /flags must be boolean/);
});

test("requires valid template identifiers, semantic versions and environment metadata", () => {
  assert.throws(() => validateApplicationTemplate({ ...template, id: "Sample Web" }), /id is invalid/);
  assert.throws(() => validateApplicationTemplate({ ...template, version: "1.0" }), /semantic versioning/);
  assert.throws(() => validateApplicationTemplate({
    ...template,
    environment: [{ ...template.environment[0], description: "" }],
  }), /description is invalid/);
});

test("validates manual application resource limits and defaults omitted limits", () => {
  const input = {
    id: "sample-web",
    version: "1.0.0",
    name: "Sample web",
    description: "An application.",
    category: "Web",
    image: "ghcr.io/example/sample-web:1.0.0",
    port: 8080,
    domain: "sample.example.com",
    serverNodeId: "a".repeat(25),
    environmentValues: {},
    secretValues: {},
  };

  const validated = validateManualApplicationInput(input);
  assert.equal(validated.cpus, 1);
  assert.equal(validated.memoryMb, 1024);
  assert.throws(() => validateManualApplicationInput({ ...input, cpus: 0.1 }), /CPU limit/);
  assert.throws(() => validateManualApplicationInput({ ...input, memoryMb: 255 }), /memory limit/);
});

test("allows the n8n latest image tag without weakening other application versions", () => {
  assert.equal(validateApplicationTemplate({
    ...template,
    id: "n8n-instance",
    version: "latest",
    image: "n8nio/n8n:latest",
  }).version, "latest");
  assert.throws(() => validateApplicationTemplate({
    ...template,
    version: "latest",
  }), /semantic versioning/);
});
