import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { applicationCatalog } from "../src/data/application-catalog.mjs";

test("Gitea is represented as an optional catalog application with subdomain access", () => {
  const gitea = applicationCatalog.find((application) => application.id === "gitea");

  assert.ok(gitea);
  assert.equal(gitea.installation.status, "optional");
  assert.equal(gitea.installation.enabled, true);
  assert.match(gitea.features.join(" "), /git\.<dominio>/);
  assert.match(gitea.features.join(" "), /2222/);
});

test("Gitea administrator setup runs its CLI as the non-root git user", async () => {
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");

  assert.ok(serviceAgent.includes('docker exec --user git "${container_id}" gitea admin user list --admin'));
  assert.ok(serviceAgent.includes('docker exec --user git "${container_id}" gitea admin user create'));
});

test("project deployment configuration parser imports its fingerprint dependency", async () => {
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");
  const parser = serviceAgent.match(
    /if ! python3 - "\$\{deployment_config_file\}"[^\n]*<<'PY'\r?\n([\s\S]*?)\r?\nPY/,
  );

  assert.ok(parser);
  assert.match(parser[1], /^import hashlib$/m);
});

test("Gitea repository name pattern is valid in modern browsers", async () => {
  const applicationCatalogComponent = await readFile(
    new URL("../src/components/ApplicationCatalog.jsx", import.meta.url),
    "utf8",
  );
  const patternSource = String.raw`^[A-Za-z0-9][A-Za-z0-9._\x2d]{0,99}$`;
  const pattern = new RegExp(patternSource, "v");

  assert.ok(applicationCatalogComponent.includes(
    String.raw`pattern="[A-Za-z0-9][A-Za-z0-9._\x2d]{0,99}"`,
  ));
  assert.equal(pattern.test("node-api-ui-test"), true);
  assert.equal(pattern.test("node api"), false);
});

test("all HTML form patterns compile in modern browsers", async () => {
  const [page, applicationCatalogComponent] = await Promise.all([
    readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ApplicationCatalog.jsx", import.meta.url), "utf8"),
  ]);
  const patterns = [...`${page}\n${applicationCatalogComponent}`.matchAll(/\bpattern="([^"]+)"/g)]
    .map(([, pattern]) => pattern);

  assert.ok(patterns.length > 0);
  for (const pattern of patterns) {
    assert.doesNotThrow(() => new RegExp(pattern, "v"), `Invalid HTML pattern: ${pattern}`);
  }
});

test("n8n is pinned to a versioned image and declares managed persistence and HTTPS", async () => {
  const n8n = applicationCatalog.find((application) => application.id === "n8n");
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");

  assert.ok(n8n);
  assert.equal(n8n.installation.status, "optional");
  assert.equal(n8n.installation.enabled, true);
  assert.match(n8n.image, /^n8nio\/n8n:\d+\.\d+\.\d+$/);
  assert.ok(serviceAgent.includes(`readonly N8N_IMAGE="${n8n.image}"`));
  assert.match(n8n.features.join(" "), /volumen persistente administrado/);
  assert.match(n8n.features.join(" "), /HTTPS/);
  assert.match(n8n.features.join(" "), /secreto Swarm/);
});

test("PostgreSQL is pinned to the managed private service image and persistence model", async () => {
  const postgresql = applicationCatalog.find((application) => application.id === "postgresql");
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");

  assert.ok(postgresql);
  assert.equal(postgresql.installation.status, "optional");
  assert.equal(postgresql.installation.enabled, true);
  assert.match(postgresql.image, /^postgres:\d+\.\d+-alpine\d+\.\d+$/);
  assert.ok(serviceAgent.includes(`readonly POSTGRESQL_IMAGE="${postgresql.image}"`));
  assert.match(postgresql.features.join(" "), /volumen persistente administrado/);
  assert.match(postgresql.features.join(" "), /vps-manager-postgresql:5432/);
  assert.match(postgresql.features.join(" "), /secreto Swarm/);
  assert.match(postgresql.features.join(" "), /Sin puertos publicados/);
});
