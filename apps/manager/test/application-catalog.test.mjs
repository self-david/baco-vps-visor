import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { applicationCatalog } from "../src/data/application-catalog.mjs";

test("project deployment configuration parser imports its fingerprint dependency", async () => {
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");
  const parser = serviceAgent.match(
    /if ! python3 - "\$\{deployment_config_file\}"[^\n]*<<'PY'\r?\n([\s\S]*?)\r?\nPY/,
  );

  assert.ok(parser);
  assert.match(parser[1], /^import hashlib$/m);
});

test("projects tab exposes GitHub OAuth, imports, and a route-based detail view", async () => {
  const [page, projectsPanel, projectSettingsForm, projectDetailView, projectImport] = await Promise.all([
    readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProjectsPanel.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProjectSettingsForm.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProjectDetailView.astro", import.meta.url), "utf8"),
    readFile(new URL("../public/project-import.js", import.meta.url), "utf8"),
  ]);

  assert.equal(applicationCatalog.some((application) => application.id === "gitea"), false);
  assert.match(page, /<ProjectsPanel \/>/);
  assert.match(projectsPanel, /Conecta GitHub para elegir un repositorio/);
  assert.match(projectsPanel, /Configuración de GitHub OAuth/);
  assert.match(projectsPanel, /id="github-config-form"/);
  assert.match(projectsPanel, /id="github-import-form"/);
  assert.match(projectsPanel, /id="github-deployment-type"/);
  assert.match(projectsPanel, /id="project-dropzone"/);
  assert.match(projectsPanel, /id="project-selection"/);
  assert.match(projectsPanel, /value="build">Build \+ despliegue/);
  assert.match(projectsPanel, /id="project-import-files"/);
  assert.match(projectsPanel, /id="project-zip-input"/);
  assert.match(projectsPanel, /id="project-files-input"/);
  assert.match(projectsPanel, /id="project-selection-tree"/);
  assert.match(projectsPanel, /id="github-connect-status"/);
  assert.match(projectsPanel, /github\.com\/settings\/applications\/new/);
  assert.doesNotMatch(projectsPanel, /id="github-webhook-secret"/);
  assert.match(projectsPanel, /Guardar y continuar/);
  assert.match(page, /<ProjectDetailView \/>/);
  assert.match(projectDetailView, /data-project-tab="deploy">Deploy/);
  assert.match(projectDetailView, /data-project-tab="settings">Configuración/);
  assert.match(projectDetailView, /href="\/#tab-projects"/);
  assert.match(projectDetailView, /project-detail-operation-status/);
  assert.doesNotMatch(projectDetailView, /<dialog/);
  assert.doesNotMatch(projectSettingsForm, /<dialog|data-close-project-dialog/);
  assert.match(page, /src="\/project-import\.js"/);
  assert.match(projectsPanel, /webkitdirectory directory multiple/);
  assert.match(projectImport, /githubConnectButton\.addEventListener\("click"/);
  assert.match(projectImport, /window\.location\.assign\(result\.url\)/);
  assert.match(projectImport, /githubConnectButton\.textContent = !githubConfigured/);
  assert.match(projectImport, /function openGithubSetup\(\)/);
  assert.match(projectImport, /zipInput\.addEventListener\("change"/);
  assert.match(projectImport, /folderInput\.addEventListener\("change"/);
  assert.match(projectImport, /importButton\.addEventListener\("click"/);
  assert.match(projectSettingsForm, /<option value="dockerfile">Dockerfile<\/option>/);
  assert.match(projectSettingsForm, /<option value="railpack">Railpack \(autodetección\)<\/option>/);
  assert.match(projectSettingsForm, /id="project-build-command"/);
  assert.match(projectSettingsForm, /id="project-build-output-directory"/);
  assert.match(projectsPanel, /name="productionBranch"/);
  assert.match(projectSettingsForm, /name="autoDeploy"/);
});

test("project file selection displays a nested filename tree and project cards offer guarded deletion", async () => {
  const [importer, application, projectDetailView, serviceAgent, server] = await Promise.all([
    readFile(new URL("../public/project-import.js", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProjectDetailView.astro", import.meta.url), "utf8"),
    readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8"),
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
  ]);
  const rendererStart = application.indexOf("function renderProjects() {");
  const rendererEnd = application.indexOf("function resetDomainZoneForm()", rendererStart);
  const renderer = application.slice(rendererStart, rendererEnd);

  assert.match(importer, /function renderFileTree\(paths\)/);
  assert.match(importer, /filesInput\.addEventListener\("change"/);
  assert.match(importer, /selectedArchiveInfo\.paths/);
  assert.match(renderer, /manage\.href = `\/projects\/\$\{encodeURIComponent\(project\.id\)\}`/);
  assert.match(renderer, /button-danger/);
  assert.match(renderer, /Primero retira el servicio desplegado y desasigna sus dominios/);
  assert.match(application, /window\.location\.assign\("\/#tab-projects"\)/);
  assert.match(application, /deploymentType: githubDeploymentTypeSelect\.value/);
  assert.match(application, /function updateProjectDeploymentFields\(\)/);
  assert.match(application, /connectDomains\.href = "\/#tab-domains"/);
  assert.match(projectDetailView, /data-project-tab-panel="deploy"/);
  assert.match(projectDetailView, /id="project-detail-file-tree"/);
  assert.match(server, /source.{0,10}files/);
  assert.match(server, /validateProjectArchive\(archive\)/);
  assert.match(server, /projects.{0,30}0-9a-f/);
  assert.match(serviceAgent, /has_root_contents/);
  assert.match(serviceAgent, /FROM nginx:alpine/);
  assert.match(serviceAgent, /build_dockerfile="\$\{build_directory\}\/Dockerfile\.static"/);
  assert.match(serviceAgent, /--file "\$\{build_dockerfile\}"/);
  assert.match(serviceAgent, /deployment_type = request\["deploymentType"\]/);
  assert.match(serviceAgent, /"deploymentType": deployment_type/);
  assert.match(serviceAgent, /build_output_directory/);
  assert.match(serviceAgent, /CMD \["node", "server\.js"\]/);
  assert.match(serviceAgent, /CMD \["python", "main\.py"\]/);
  assert.match(serviceAgent, /C\+\+ requiere un Dockerfile/);
  assert.doesNotMatch(serviceAgent, /archive must contain one root directory/);
});

test("uploaded projects render assigned domains and provide root/subdomain assignment", async () => {
  const [application, domainsPanel] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/components/DomainsPanel.astro", import.meta.url), "utf8"),
  ]);
  const rendererStart = application.indexOf("function renderProjects() {");
  const rendererEnd = application.indexOf("function resetDomainZoneForm()", rendererStart);
  const renderer = rendererStart >= 0 && rendererEnd > rendererStart
    ? application.slice(rendererStart, rendererEnd)
    : "";

  assert.ok(renderer, "project renderer should exist");
  assert.ok(
    renderer.indexOf("const assignedDomains =") < renderer.indexOf("assignedDomains.length"),
    "assigned domains must be loaded before the delete action reads them",
  );
  assert.match(renderer, /https:\/\/\$\{domain\.hostname\}/);
  assert.match(renderer, /currentDeployment\?\.configurationCurrent/);
  assert.match(renderer, /subdomainInput\.placeholder = "www \(o @ para usar el dominio raíz\)"/);
  assert.match(renderer, /subdomain === "@" \? zone : `\$\{subdomain\}\.\$\{zone\}`/);
  assert.match(renderer, /"Ver sitio"/);
  assert.match(domainsPanel, /asignar el dominio raíz o crear subdominios para tus proyectos/);
});

test("login bootstrap is independent from dashboard initialization", async () => {
  const [page, accessHeader, login, application] = await Promise.all([
    readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/AccessHeader.astro", import.meta.url), "utf8"),
    readFile(new URL("../public/login.js", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<AccessHeader \/>/);
  assert.match(accessHeader, /id="login-form"/);
  assert.match(accessHeader, /id="logout"/);
  assert.match(page, /src="\/login\.js"/);
  assert.match(page, /src="\/app\.js"/);
  assert.match(login, /\/api\/auth\/login/);
  assert.match(login, /\/api\/auth\/session/);
  assert.match(login, /\/api\/auth\/logout/);
  assert.doesNotMatch(login, /\/app\.js|project-archive\.mjs/);
  assert.doesNotMatch(application, /\/api\/auth\/login|\/api\/auth\/session|\/api\/auth\/logout/);
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
  assert.match(server, /from "\.\/public\/project-archive\.mjs"/);
  assert.match(dockerfile, /^COPY public\/project-archive\.mjs \.\/public\/project-archive\.mjs$/m);
});

test("browser application script has no duplicate function declarations", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const declarations = [...app.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)]
    .map(([, name]) => name);

  assert.ok(declarations.length > 0);
  assert.equal(new Set(declarations).size, declarations.length);
});

test("all HTML form patterns compile in modern browsers", async () => {
  const [componentNames, applicationCatalogComponent] = await Promise.all([
    readdir(new URL("../src/components/", import.meta.url)),
    readFile(new URL("../src/components/ApplicationCatalog.jsx", import.meta.url), "utf8"),
  ]);
  const componentMarkup = await Promise.all(componentNames
    .filter((name) => name.endsWith(".astro"))
    .map((name) => readFile(new URL(`../src/components/${name}`, import.meta.url), "utf8")));
  const patterns = [...`${componentMarkup.join("\n")}\n${applicationCatalogComponent}`.matchAll(/\bpattern="([^"]+)"/g)]
    .map(([, pattern]) => pattern);

  assert.ok(patterns.length > 0);
  for (const pattern of patterns) {
    assert.doesNotThrow(() => new RegExp(pattern, "v"), `Invalid HTML pattern: ${pattern}`);
  }
});

test("manager serves browser ES modules with a JavaScript content type", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  assert.match(server, /"\.mjs":\s*"text\/javascript; charset=utf-8"/);
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
