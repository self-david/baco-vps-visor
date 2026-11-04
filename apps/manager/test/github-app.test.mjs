import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGithubApp } from "../github-app.mjs";

test("encrypts GitHub App credentials and validates one-time installation state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vps-manager-github-"));
  const operationsDirectory = join(directory, "operations");
  await mkdir(operationsDirectory);
  const keyFile = join(directory, "backup-key");
  await writeFile(keyFile, `${"a".repeat(64)}\n`, { mode: 0o600 });
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const requests = [];
  const app = createGithubApp({
    directory: operationsDirectory,
    keyFile,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      if (String(url).endsWith("/app/installations/42")) {
        return Response.json({
          id: 42,
          account: { login: "example-org", type: "Organization" },
        });
      }
      if (String(url).endsWith("/app/installations/42/access_tokens")) {
        return Response.json({ token: "installation-token" });
      }
      if (String(url).includes("/installation/repositories")) {
        return Response.json({
          repositories: [{ full_name: "example-org/site", private: true }],
        });
      }
      if (String(url).includes("/branches?")) {
        return Response.json([{ name: "main", commit: { sha: "a".repeat(40) } }]);
      }
      throw new Error(`Unexpected GitHub request: ${url}`);
    },
  });

  try {
    await app.saveConfiguration({
      appId: "12345",
      appSlug: "example-deployer",
      privateKey,
      webhookSecret: "webhook-secret-that-is-long-enough",
    });
    const stored = await readFile(join(operationsDirectory, "github-app-config.enc"), "utf8");
    assert.doesNotMatch(stored, /webhook-secret-that-is-long-enough|BEGIN PRIVATE KEY/);
    assert.deepEqual(await app.getStatus(), {
      configured: true,
      appId: "12345",
      appSlug: "example-deployer",
    });

    const installUrl = new URL(await app.createInstallationUrl());
    const state = installUrl.searchParams.get("state");
    assert.equal(installUrl.origin, "https://github.com");
    assert.match(state, /^[a-f0-9]{64}$/);
    assert.deepEqual(await app.completeInstallation({ installationId: 42, state }), {
      installationId: 42,
      accountLogin: "example-org",
      accountType: "Organization",
    });
    await assert.rejects(
      app.completeInstallation({ installationId: 42, state }),
      { code: "GITHUB_INSTALLATION_STATE_INVALID" },
    );

    assert.deepEqual(await app.listRepositories(42), [
      { fullName: "example-org/site", private: true },
    ]);
    assert.deepEqual(await app.listBranches(42, "example-org/site"), [
      { name: "main", commitSha: "a".repeat(40) },
    ]);
    assert.ok(requests.some(({ options }) => options.headers.Authorization === "Bearer installation-token"));
    assert.ok(requests.some(({ options }) => options.headers.Authorization.startsWith("Bearer eyJ")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects unsafe GitHub repository names and invalid application credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vps-manager-github-"));
  const keyFile = join(directory, "backup-key");
  await writeFile(keyFile, `${"b".repeat(64)}\n`);
  const app = createGithubApp({ directory, keyFile, fetchImpl: async () => Response.json({}) });
  try {
    await assert.rejects(app.saveConfiguration({
      appId: "1",
      appSlug: "bad/slug",
      privateKey: "not a key",
      webhookSecret: "long-enough-webhook-secret",
    }), TypeError);
    await assert.rejects(app.listBranches(42, "owner/repo\n"), TypeError);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
