import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { applicationCatalog } from "../src/data/application-catalog.mjs";

test("project deployment configuration parser imports its fingerprint dependency", async () => {
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");
  const parser = serviceAgent.match(
    /if ! python3 - "\$\{deployment_config_file\}"[^\n]*<<'PY'\r?\n([\s\S]*?)\r?\nPY/,
  );

  assert.ok(parser);
  assert.match(parser[1], /^import hashlib$/m);
});

test("projects tab exposes GitHub OAuth and drag-and-drop imports", async () => {
  const page = await readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8");

  assert.equal(applicationCatalog.some((application) => application.id === "gitea"), false);
  assert.match(page, /Conecta GitHub para elegir un repositorio/);
  assert.match(page, /Configuración de GitHub OAuth/);
  assert.match(page, /id="github-config-form"/);
  assert.match(page, /id="github-import-form"/);
  assert.match(page, /id="project-dropzone"/);
  assert.match(page, /id="project-zip-input"/);
  assert.match(page, /webkitdirectory directory multiple/);
  assert.match(page, /<option value="dockerfile">Dockerfile<\/option>/);
  assert.match(page, /<option value="railpack">Railpack \(autodetección\)<\/option>/);
  assert.match(page, /name="productionBranch"/);
  assert.match(page, /name="autoDeploy"/);
});

test("manager image includes the GitHub and project-archive modules imported by the API", async () => {
  const [dockerfile, server] = await Promise.all([
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
  ]);
  const githubImports = [...server.matchAll(/from "\.\/(github-[^"]+\.mjs)"/g)]
    .map(([, moduleName]) => moduleName);
  const runtimeCopy = dockerfile.split(/\r?\n/).find((line) => line.startsWith("COPY server.mjs "));

  assert.ok(githubImports.length > 0);
  assert.ok(runtimeCopy);
  for (const moduleName of githubImports) {
    assert.ok(runtimeCopy.split(/\s+/).includes(moduleName), `${moduleName} must be copied into the runtime image`);
  }
  assert.ok(runtimeCopy.split(/\s+/).includes("project-archive-validation.mjs"));
});

test("browser application script has no duplicate function declarations", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const declarations = [...app.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)]
    .map(([, name]) => name);

  assert.ok(declarations.length > 0);
  assert.equal(new Set(declarations).size, declarations.length);
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
