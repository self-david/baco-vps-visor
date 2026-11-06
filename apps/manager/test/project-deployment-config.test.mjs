import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deleteCloudflareToken,
  deleteProjectConfig,
  getCloudflareToken,
  getProjectDeploymentConfig,
  getProjectEnvironment,
  hasCloudflareToken,
  saveCloudflareToken,
  saveProjectDeploymentConfig,
  saveProjectDeploymentType,
  saveProjectEnvironment,
  validateProjectEnvironment,
} from "../project-deployment-config.mjs";

const projectId = "d909f79b-e7f9-41e7-9e7a-6ea000000001";
const domainId = "a3f51b09-13bf-4c7a-9b03-9ba000000002";

test("validates project environment variable names, values, and size", () => {
  assert.deepEqual({ ...validateProjectEnvironment({ PORT: "3000", EMPTY: "" }) }, {
    PORT: "3000",
    EMPTY: "",
  });
  assert.throws(() => validateProjectEnvironment({ "BAD-NAME": "value" }), /nombre válido/);
  assert.throws(() => validateProjectEnvironment({ PORT: 3000 }), /valor de texto/);
  assert.throws(() => validateProjectEnvironment({ PORT: "bad\0value" }), /valor de texto/);
  assert.throws(() => validateProjectEnvironment(Object.fromEntries(
    Array.from({ length: 101 }, (_, index) => [`VALUE_${index}`, "x"]),
  )), /100 variables/);
});

test("persists project variables and domains in private host-side files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vps-project-config-"));
  try {
    await saveProjectEnvironment(directory, projectId, { API_URL: "https://api.example.com", MULTILINE: "one\ntwo" });
    await saveProjectDeploymentConfig(directory, projectId, [
      { hostname: "app.example.com", port: 3000 },
      { hostname: "admin.example.com", port: 8080 },
    ]);
    assert.deepEqual({ ...(await getProjectEnvironment(directory, projectId)) }, {
      API_URL: "https://api.example.com",
      MULTILINE: "one\ntwo",
    });
    const deploymentConfig = await getProjectDeploymentConfig(directory, projectId);
    assert.deepEqual({ ...deploymentConfig, environment: { ...deploymentConfig.environment } }, {
      environment: { API_URL: "https://api.example.com", MULTILINE: "one\ntwo" },
      deploymentType: "dynamic",
      domains: [
        { hostname: "app.example.com", port: 3000 },
        { hostname: "admin.example.com", port: 8080 },
      ],
      configHash: "ca7f199ea0c7f56052544b6b8ebd5b762bb692ad9a88c71b9e19037d2a74e872",
      environmentHash: createHash("sha256").update(JSON.stringify({
        deploymentType: "dynamic",
        environment: { API_URL: "https://api.example.com", MULTILINE: "one\ntwo" },
      })).digest("hex"),
      domainsHash: createHash("sha256").update(JSON.stringify([
        { hostname: "admin.example.com", port: 8080 },
        { hostname: "app.example.com", port: 3000 },
      ])).digest("hex"),
    });
    const metadata = await stat(join(directory, `project-config-${projectId}.json`));
    if (process.platform !== "win32") assert.equal(metadata.mode & 0o077, 0);
    const savedConfig = await readFile(join(directory, `project-config-${projectId}.json`), "utf8");
    assert.match(savedConfig, /API_URL/);
    await saveProjectDeploymentType(directory, projectId, "static");
    const staticDeploymentConfig = await getProjectDeploymentConfig(directory, projectId);
    assert.equal(staticDeploymentConfig.deploymentType, "static");
    assert.notEqual(staticDeploymentConfig.configHash, deploymentConfig.configHash);
    assert.notEqual(staticDeploymentConfig.environmentHash, deploymentConfig.environmentHash);
    assert.equal(staticDeploymentConfig.domainsHash, deploymentConfig.domainsHash);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("stores Cloudflare tokens privately without exposing them in project configuration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vps-cloudflare-token-"));
  try {
    const token = "test-cloudflare-api-key-value-123456789";
    assert.equal(await hasCloudflareToken(directory, domainId), false);
    await saveCloudflareToken(directory, domainId, token);
    assert.equal(await getCloudflareToken(directory, domainId), token);
    if (process.platform !== "win32") {
      assert.equal((await stat(join(directory, `cloudflare-token-${domainId}.json`))).mode & 0o077, 0);
    }
    await deleteCloudflareToken(directory, domainId);
    assert.equal(await hasCloudflareToken(directory, domainId), false);
  } finally {
    await deleteProjectConfig(directory, projectId);
    await rm(directory, { recursive: true, force: true });
  }
});
