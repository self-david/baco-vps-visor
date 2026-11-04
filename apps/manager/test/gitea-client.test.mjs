import assert from "node:assert/strict";
import test from "node:test";
import {
  createGiteaClient,
  validateRepositoryInput,
  validateRepositoryReference,
} from "../gitea-client.mjs";

const domain = "git.example.com";
const token = "gta_0123456789abcdef0123456789abcdef01234567";

test("validates private repository names and descriptions", () => {
  assert.deepEqual(validateRepositoryInput({
    name: "my-project_1",
    description: "  Project description  ",
  }), {
    name: "my-project_1",
    description: "Project description",
  });
  for (const name of ["", "../repo", ".hidden", "a..b", "bad name", "bad/name", "repo."]) {
    assert.throws(() => validateRepositoryInput({ name }), { code: "INVALID_REPOSITORY" });
  }
  assert.throws(() => validateRepositoryInput({ name: "repo", extra: true }), { code: "INVALID_REPOSITORY" });
  assert.deepEqual(validateRepositoryReference("vpsadmin/project"), {
    owner: "vpsadmin",
    name: "project",
    fullName: "vpsadmin/project",
  });
  assert.throws(() => validateRepositoryReference("../project"), { code: "INVALID_REPOSITORY" });
});

test("verifies API credentials without returning or storing the token", async () => {
  const calls = [];
  const client = createGiteaClient({
    domain,
    async fetchImpl(url, options) {
      calls.push({ url, options });
      return Response.json({ login: "vpsadmin" });
    },
  });

  assert.deepEqual(await client.verifyToken(token), { login: "vpsadmin" });
  assert.equal(calls[0].url, `https://${domain}/api/v1/user`);
  assert.equal(calls[0].options.headers.Authorization, `token ${token}`);
});

test("supports the fixed private Swarm URL for local-mode Gitea API calls", async () => {
  const calls = [];
  const client = createGiteaClient({
    baseUrl: "http://vps-manager-gitea:3000",
    async fetchImpl(url, options) {
      calls.push({ url, options });
      return Response.json({ login: "vpsadmin" });
    },
  });

  assert.deepEqual(await client.verifyToken(token), { login: "vpsadmin" });
  assert.equal(calls[0].url, "http://vps-manager-gitea:3000/api/v1/user");
  assert.equal(calls[0].options.headers.Authorization, `token ${token}`);
  assert.throws(() => createGiteaClient({ baseUrl: "http://example.com" }), /configuration is invalid/);
  assert.throws(() => createGiteaClient({ domain: "localhost" }), /configuration is invalid/);
});

test("creates private repositories with automatic initialization and safe clone URLs", async () => {
  const calls = [];
  const client = createGiteaClient({
    domain,
    async fetchImpl(url, options) {
      calls.push({ url, options });
      return Response.json({
        full_name: "vpsadmin/project",
        html_url: `https://${domain}/vpsadmin/project`,
        clone_url: `https://${domain}/vpsadmin/project.git`,
        ssh_url: `ssh://git@${domain}:2222/vpsadmin/project.git`,
      });
    },
  });

  assert.deepEqual(await client.createRepository(token, {
    name: "project",
    description: "A private project",
  }), {
    name: "project",
    fullName: "vpsadmin/project",
    url: `https://${domain}/vpsadmin/project`,
    cloneUrl: `https://${domain}/vpsadmin/project.git`,
    sshUrl: `ssh://git@${domain}:2222/vpsadmin/project.git`,
  });
  assert.equal(calls[0].url, `https://${domain}/api/v1/user/repos`);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    name: "project",
    description: "A private project",
    private: true,
    auto_init: true,
  });
  assert.equal(calls[0].options.headers.Authorization, `token ${token}`);
});

test("accepts local-mode repository links only at the SSH-tunneled Gitea URL", async () => {
  const client = createGiteaClient({
    baseUrl: "http://vps-manager-gitea:3000",
    async fetchImpl() {
      return Response.json({
        full_name: "vpsadmin/project",
        html_url: "http://localhost:3001/gitea/vpsadmin/project",
        clone_url: "http://localhost:3001/gitea/vpsadmin/project.git",
        ssh_url: "ssh://git@localhost:22/vpsadmin/project.git",
      });
    },
  });

  assert.deepEqual(await client.createRepository(token, { name: "project" }), {
    name: "project",
    fullName: "vpsadmin/project",
    url: "http://localhost:3001/gitea/vpsadmin/project",
    cloneUrl: "http://localhost:3001/gitea/vpsadmin/project.git",
    sshUrl: "ssh://git@localhost:22/vpsadmin/project.git",
  });
});

test("returns non-sensitive errors for invalid tokens, duplicate repositories, and outages", async () => {
  const client = createGiteaClient({
    domain,
    async fetchImpl(_url, { method }) {
      return new Response(null, { status: method === "POST" ? 409 : 401 });
    },
  });
  await assert.rejects(client.verifyToken(token), { code: "GITEA_TOKEN_INVALID" });
  await assert.rejects(client.createRepository(token, { name: "existing" }), { code: "GITEA_REPOSITORY_EXISTS" });
  await assert.rejects(client.verifyToken("short"), { code: "GITEA_TOKEN_INVALID" });

  const unavailable = createGiteaClient({
    domain,
    async fetchImpl() {
      throw new Error("transport details");
    },
  });
  await assert.rejects(unavailable.verifyToken(token), {
    code: "GITEA_UNAVAILABLE",
    message: "No se pudo conectar con la API de Gitea.",
  });
});

test("rejects unsafe repository URLs returned by the Gitea API", async () => {
  const client = createGiteaClient({
    domain,
    async fetchImpl() {
      return Response.json({
        full_name: "user/repo",
        html_url: "javascript:alert(1)",
        clone_url: `https://${domain}/user/repo.git`,
        ssh_url: `ssh://git@${domain}:2222/user/repo.git`,
      });
    },
  });
  await assert.rejects(client.createRepository(token, { name: "repo" }), {
    code: "GITEA_INVALID_RESPONSE",
  });
});

test("lists the connected account's repositories and all branch pages", async () => {
  const calls = [];
  const client = createGiteaClient({
    domain,
    async fetchImpl(url) {
      calls.push(url);
      const requestUrl = new URL(url);
      if (requestUrl.pathname.endsWith("/branches")) {
        return Response.json(requestUrl.searchParams.get("page") === "1"
          ? [{ name: "main" }, { name: "release/1.0" }]
          : []);
      }
      if (requestUrl.searchParams.get("page") === "1") {
        return Response.json(Array.from({ length: 50 }, (_, index) => ({
          name: `repo-${index}`,
          full_name: `vpsadmin/repo-${index}`,
          default_branch: "main",
          permissions: { admin: true },
        })));
      }
      return Response.json([{
        name: "final",
        full_name: "vpsadmin/final",
        default_branch: "trunk",
        permissions: { admin: false },
      }]);
    },
  });

  const repositories = await client.listRepositories(token);
  assert.equal(repositories.length, 51);
  assert.deepEqual(repositories[50], {
    name: "final",
    fullName: "vpsadmin/final",
    defaultBranch: "trunk",
    canAdmin: false,
  });
  assert.match(calls[0], /limit=50&page=1/);
  assert.match(calls[1], /limit=50&page=2/);
  assert.deepEqual(await client.listBranches(token, "vpsadmin/project"), [
    { name: "main" },
    { name: "release/1.0" },
  ]);
  assert.match(calls[2], /\/repos\/vpsadmin\/project\/branches\?limit=50&page=1$/);
});

test("changes a repository's default branch only to an existing branch", async () => {
  const calls = [];
  const client = createGiteaClient({
    domain,
    async fetchImpl(url, options = {}) {
      calls.push({ url, options });
      if (options.method === "PATCH") {
        return Response.json({ default_branch: "release/1.0" });
      }
      return Response.json([{ name: "main" }, { name: "release/1.0" }]);
    },
  });

  assert.deepEqual(await client.setDefaultBranch(token, "vpsadmin/project", "release/1.0"), {
    repository: "vpsadmin/project",
    defaultBranch: "release/1.0",
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].url, `https://${domain}/api/v1/repos/vpsadmin/project`);
  assert.deepEqual(JSON.parse(calls[1].options.body), { default_branch: "release/1.0" });

  calls.length = 0;
  await assert.rejects(client.setDefaultBranch(token, "vpsadmin/project", "missing"), {
    code: "GITEA_BRANCH_NOT_FOUND",
  });
  assert.equal(calls.length, 1);
});

test("creates a push webhook and updates it instead of creating duplicates", async () => {
  const endpoint = "https://manager.example.com/api/webhooks/gitea";
  const secret = "a".repeat(64);
  const calls = [];
  const client = createGiteaClient({
    domain,
    async fetchImpl(url, options = {}) {
      calls.push({ url, options });
      if (options.method === "POST") {
        return Response.json({
          id: 17,
          active: true,
          config: { url: endpoint },
          events: ["push"],
        }, { status: 201 });
      }
      if (options.method === "PATCH") {
        return Response.json({
          id: 17,
          active: true,
          config: { url: endpoint },
          events: ["push"],
        });
      }
      return Response.json([]);
    },
  });

  assert.deepEqual(await client.configurePushWebhook(token, "vpsadmin/project", endpoint, secret), {
    id: 17,
    url: endpoint,
    active: true,
    events: ["push"],
    updated: false,
  });
  assert.equal(calls[0].url, `https://${domain}/api/v1/repos/vpsadmin/project/hooks?limit=50&page=1`);
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    type: "gitea",
    config: { url: endpoint, content_type: "json", secret, insecure_ssl: "0" },
    events: ["push"],
    active: true,
  });

  calls.length = 0;
  const updatingClient = createGiteaClient({
    domain,
    async fetchImpl(url, options = {}) {
      calls.push({ url, options });
      if (options.method === "PATCH") {
        return Response.json({
          id: 17,
          active: true,
          config: { url: endpoint },
          events: ["push"],
        });
      }
      return Response.json([{ id: 17, config: { url: endpoint } }]);
    },
  });
  const updated = await updatingClient.configurePushWebhook(token, "vpsadmin/project", endpoint, secret);
  assert.equal(updated.updated, true);
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].url, `https://${domain}/api/v1/repos/vpsadmin/project/hooks/17`);
});

test("resolves a branch to a commit and downloads only a bounded same-domain archive", async () => {
  const calls = [];
  const archive = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]);
  const client = createGiteaClient({
    domain,
    async fetchImpl(url, options) {
      calls.push({ url, options });
      if (url.endsWith("/commits/release%2F1.0")) {
        return Response.json({ sha: "A".repeat(40) });
      }
      const response = new Response(archive, {
        headers: { "Content-Type": "application/zip", "Content-Length": String(archive.length) },
      });
      Object.defineProperty(response, "url", { value: url });
      return response;
    },
  });

  const commit = await client.getCommit(token, "vpsadmin/project", "release/1.0");
  assert.equal(commit, "a".repeat(40));
  assert.deepEqual(await client.downloadArchive(token, "vpsadmin/project", commit), archive);
  assert.equal(calls[0].url, `https://${domain}/api/v1/repos/vpsadmin/project/commits/release%2F1.0`);
  assert.equal(calls[1].url, `https://${domain}/api/v1/repos/vpsadmin/project/archive/${commit}.zip`);
  assert.equal(calls[1].options.headers.Authorization, `token ${token}`);

  const unsafeRedirect = createGiteaClient({
    domain,
    async fetchImpl(url) {
      const response = new Response(archive);
      Object.defineProperty(response, "url", { value: "https://other.example/archive.zip" });
      return response;
    },
  });
  await assert.rejects(unsafeRedirect.downloadArchive(token, "vpsadmin/project", commit), {
    code: "GITEA_INVALID_RESPONSE",
  });
});

test("paginates through repositories with more than fifty branches", async () => {
  const calls = [];
  const client = createGiteaClient({
    domain,
    async fetchImpl(url) {
      calls.push(url);
      const page = new URL(url).searchParams.get("page");
      return Response.json(page === "1"
        ? Array.from({ length: 50 }, (_, index) => ({ name: `branch-${index}` }))
        : [{ name: "release/final" }]);
    },
  });

  const branches = await client.listBranches(token, "vpsadmin/project");
  assert.equal(branches.length, 51);
  assert.equal(branches.at(-1).name, "release/final");
  assert.match(calls[0], /limit=50&page=1$/);
  assert.match(calls[1], /limit=50&page=2$/);
});
