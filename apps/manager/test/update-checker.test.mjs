import assert from "node:assert/strict";
import test from "node:test";
import { createUpdateChecker } from "../update-checker.mjs";

function release({
  tag = "v0.2.0",
  digest = `sha256:${"a".repeat(64)}`,
  archiveUrl = "https://github.com/acme/vps-manager/releases/download/v0.2.0/vps-manager-source.tar.gz",
} = {}) {
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    html_url: `https://github.com/acme/vps-manager/releases/tag/${tag}`,
    body: "Release notes",
    assets: [{
      name: "vps-manager-source.tar.gz",
      browser_download_url: archiveUrl,
      digest,
    }],
  };
}

test("reports the current version when no GitHub repository is configured", async () => {
  const checker = createUpdateChecker({
    repository: "",
    currentVersion: "0.1.0",
    fetchImpl: () => assert.fail("GitHub must not be queried when the repository is unset."),
  });
  assert.deepEqual(await checker.check(), {
    configured: false,
    currentVersion: "0.1.0",
    latestVersion: null,
    updateAvailable: false,
    updateReady: false,
    releaseUrl: null,
  });
});

test("reports an update only when a newer stable release has a GitHub SHA-256 digest", async () => {
  let requestedUrl;
  const checker = createUpdateChecker({
    repository: "acme/vps-manager",
    currentVersion: "0.1.0",
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      assert.equal(options.headers.Accept, "application/vnd.github+json");
      return { ok: true, json: async () => release() };
    },
  });

  assert.deepEqual(await checker.check(), {
    configured: true,
    currentVersion: "0.1.0",
    latestVersion: "0.2.0",
    updateAvailable: true,
    updateReady: true,
    releaseUrl: "https://github.com/acme/vps-manager/releases/tag/v0.2.0",
    releaseNotes: "Release notes",
    command: "sudo vps-manager-update",
  });
  assert.equal(requestedUrl, "https://api.github.com/repos/acme/vps-manager/releases/latest");
});

test("does not offer an update for an older or equal version", async () => {
  const checker = createUpdateChecker({
    repository: "acme/vps-manager",
    currentVersion: "1.2.0",
    fetchImpl: async () => ({
      ok: true,
      json: async () => release({ tag: "v1.2.0" }),
    }),
  });
  const result = await checker.check();
  assert.equal(result.updateAvailable, false);
  assert.equal(result.command, null);
});

test("does not offer an update with an unverified archive or non-stable tag", async () => {
  const invalidDigestChecker = createUpdateChecker({
    repository: "acme/vps-manager",
    currentVersion: "0.1.0",
    fetchImpl: async () => ({
      ok: true,
      json: async () => release({ digest: null }),
    }),
  });
  const invalidDigest = await invalidDigestChecker.check();
  assert.equal(invalidDigest.updateAvailable, true);
  assert.equal(invalidDigest.updateReady, false);
  assert.equal(invalidDigest.command, null);

  const prereleaseChecker = createUpdateChecker({
    repository: "acme/vps-manager",
    currentVersion: "0.1.0",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ ...release(), prerelease: true }),
    }),
  });
  await assert.rejects(prereleaseChecker.check(), /stable version tag/);
});

test("rejects malformed repository names and release archive URLs", async () => {
  assert.throws(() => createUpdateChecker({
    repository: "../acme/vps-manager",
    currentVersion: "0.1.0",
  }), /owner\/repository/);
  const checker = createUpdateChecker({
    repository: "acme/vps-manager",
    currentVersion: "0.1.0",
    fetchImpl: async () => ({
      ok: true,
      json: async () => release({ archiveUrl: "https://attacker.example/file" }),
    }),
  });
  const result = await checker.check();
  assert.equal(result.updateAvailable, true);
  assert.equal(result.updateReady, false);
});

test("fails explicitly when GitHub is unavailable", async () => {
  const checker = createUpdateChecker({
    repository: "acme/vps-manager",
    currentVersion: "0.1.0",
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  await assert.rejects(checker.check(), /HTTP 503/);
});

test("reports a public repository without releases without treating it as an update", async () => {
  const checker = createUpdateChecker({
    repository: "self-david/baco-vps-visor",
    currentVersion: "0.1.0",
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });
  assert.deepEqual(await checker.check(), {
    configured: true,
    currentVersion: "0.1.0",
    latestVersion: null,
    updateAvailable: false,
    updateReady: false,
    releaseUrl: null,
    releaseNotes: "",
    releaseUnavailable: true,
  });
});
