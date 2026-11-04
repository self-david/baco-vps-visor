import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGithubOAuth } from "../github-oauth.mjs";

test("encrypts OAuth credentials, authorizes a GitHub account, and configures push webhooks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vps-manager-github-oauth-"));
  const operationsDirectory = join(directory, "operations");
  await mkdir(operationsDirectory);
  const keyFile = join(directory, "backup-key");
  await writeFile(keyFile, `${"c".repeat(64)}\n`, { mode: 0o600 });
  let now = Date.parse("2026-11-04T18:00:00Z");
  const requests = [];
  const accessToken = "oauth-access-token-long-enough";
  const oauth = createGithubOAuth({
    directory: operationsDirectory,
    keyFile,
    now: () => now,
    fetchImpl: async (url, options) => {
      const target = String(url);
      requests.push({ url: target, options });
      if (target === "https://github.com/login/oauth/access_token") {
        return Response.json({ access_token: accessToken, scope: "repo,admin:repo_hook" });
      }
      if (target === "https://api.github.com/user") {
        return Response.json({ id: 12345, login: "example-user" });
      }
      if (target.includes("/user/repos?")) {
        return Response.json([{ full_name: "example-user/site", private: true }]);
      }
      if (target.includes("/branches?")) {
        return Response.json([{ name: "main", commit: { sha: "a".repeat(40) } }]);
      }
      if (target.endsWith("/commits/main")) return Response.json({ sha: "a".repeat(40) });
      if (target.endsWith(`/zipball/${"a".repeat(40)}`)) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://codeload.github.com/example-user/site/legacy.zip/main" },
        });
      }
      if (target.startsWith("https://codeload.github.com/")) {
        return new Response(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      }
      if (target.endsWith("/hooks?per_page=100")) return Response.json([]);
      if (target.endsWith("/hooks")) return Response.json({ id: 8 }, { status: 201 });
      throw new Error(`Unexpected GitHub request: ${target}`);
    },
  });

  try {
    await oauth.saveConfiguration({
      clientId: "Iv1.exampleclientid",
      clientSecret: "client-secret-with-sufficient-length",
      webhookSecret: "webhook-secret-with-sufficient-length",
    });
    const storedBeforeAuthorization = await readFile(join(operationsDirectory, "github-oauth-config.enc"), "utf8");
    assert.doesNotMatch(storedBeforeAuthorization, /client-secret-with-sufficient-length|webhook-secret-with-sufficient-length/);
    assert.deepEqual(await oauth.getStatus(), { configured: true, clientId: "Iv1.exampleclientid" });

    const authorization = new URL(await oauth.createAuthorizationUrl("https://panel.example.com/api/github/callback"));
    const state = authorization.searchParams.get("state");
    assert.equal(authorization.origin, "https://github.com");
    assert.equal(authorization.pathname, "/login/oauth/authorize");
    assert.equal(authorization.searchParams.get("scope"), "repo admin:repo_hook");
    assert.equal(authorization.searchParams.get("redirect_uri"), "https://panel.example.com/api/github/callback");
    assert.match(state, /^[a-f0-9]{64}$/);

    assert.deepEqual(await oauth.completeAuthorization({ code: "authorization-code", state }), {
      installationId: 12345,
      accountLogin: "example-user",
      accountType: "User",
    });
    await assert.rejects(oauth.completeAuthorization({ code: "authorization-code", state }), {
      code: "GITHUB_OAUTH_STATE_INVALID",
    });
    assert.deepEqual(await oauth.listRepositories(12345), [
      { fullName: "example-user/site", private: true },
    ]);
    assert.deepEqual(await oauth.listBranches(12345, "example-user/site"), [
      { name: "main", commitSha: "a".repeat(40) },
    ]);
    assert.equal(await oauth.getCommit(12345, "example-user/site", "main"), "a".repeat(40));
    assert.deepEqual(
      [...await oauth.downloadArchive(12345, "example-user/site", "a".repeat(40))],
      [0x50, 0x4b, 0x03, 0x04],
    );
    assert.deepEqual(await oauth.configurePushWebhook(
      12345,
      "example-user/site",
      "https://panel.example.com/api/webhooks/github",
    ), { configured: true, updated: false });
    const storedAfterAuthorization = await readFile(join(operationsDirectory, "github-oauth-config.enc"), "utf8");
    assert.doesNotMatch(storedAfterAuthorization, new RegExp(accessToken));
    assert.ok(requests.some(({ options }) => options.headers.Authorization === `Bearer ${accessToken}`));
    assert.ok(requests.some(({ url, options }) =>
      url.endsWith("/hooks") && options.method === "POST"
      && JSON.parse(options.body).events.includes("push")
      && JSON.parse(options.body).config.secret === "webhook-secret-with-sufficient-length"));
    now += 11 * 60 * 1000;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects unsafe OAuth callback URLs and missing repository-hook scopes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vps-manager-github-oauth-"));
  const keyFile = join(directory, "backup-key");
  await writeFile(keyFile, `${"d".repeat(64)}\n`);
  const oauth = createGithubOAuth({
    directory,
    keyFile,
    fetchImpl: async (url) => {
      if (String(url) === "https://github.com/login/oauth/access_token") {
        return Response.json({ access_token: "oauth-access-token-long-enough", scope: "repo" });
      }
      throw new Error(`Unexpected GitHub request: ${url}`);
    },
  });
  try {
    await oauth.saveConfiguration({
      clientId: "Iv1.exampleclientid",
      clientSecret: "client-secret-with-sufficient-length",
      webhookSecret: "webhook-secret-with-sufficient-length",
    });
    await assert.rejects(oauth.createAuthorizationUrl("https://panel.example.com/elsewhere"), TypeError);
    const authorization = new URL(await oauth.createAuthorizationUrl("https://panel.example.com/api/github/callback"));
    await assert.rejects(oauth.completeAuthorization({
      code: "authorization-code",
      state: authorization.searchParams.get("state"),
    }), { code: "GITHUB_OAUTH_SCOPE_MISSING" });
    await assert.rejects(oauth.listBranches(12345, "owner/repo\n"), TypeError);
    await assert.rejects(oauth.configurePushWebhook(
      12345,
      "owner/repo",
      "http://panel.example.com/api/webhooks/github",
    ), TypeError);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
