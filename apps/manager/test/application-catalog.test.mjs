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

test("the project service agent can reach external registries inside its systemd sandbox", async () => {
  const serviceUnit = await readFile(
    new URL("../../../installer/vps-manager-service-agent.service", import.meta.url),
    "utf8",
  );

  assert.match(serviceUnit, /^RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6$/m);
  assert.doesNotMatch(serviceUnit, /^PrivateNetwork=true$/m);
});

test("pnpm projects automatically refresh and install dependencies before every project build", async () => {
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");
  const buildStart = serviceAgent.indexOf('\nif [[ "${operation}" == "build-project" ]]; then');
  const buildEnd = serviceAgent.indexOf('\nif [[ "${operation}" == "configure-registry" ]]', buildStart);
  const projectBuild = serviceAgent.slice(buildStart, buildEnd);

  assert.match(projectBuild, /pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts/);
  assert.match(projectBuild, /pnpm install --frozen-lockfile --ignore-scripts/);
  assert.match(
    projectBuild,
    /elif \[ -f pnpm-lock\.yaml \]; then corepack enable && pnpm install --frozen-lockfile --ignore-scripts;/,
  );
  assert.match(projectBuild, /pnpm-workspace\.yaml/);
  assert.match(projectBuild, /--volume \/project\/node_modules/);
  assert.doesNotMatch(projectBuild, /if \[\[ "\$\{pnpm_lock_cached\}" != "true" \]\]/);
  assert.ok(
    projectBuild.indexOf("pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts")
      < projectBuild.indexOf("pnpm install --frozen-lockfile --ignore-scripts"),
  );
  assert.match(serviceAgent, /project-pnpm-lock-\$\{project_id\}\.yaml/);
});

test("projects tab exposes GitHub OAuth, imports, and a route-based detail view", async () => {
  const [page, projectsPanel, projectSettingsForm, projectDetailView, projectImport, projectTemplates, application] = await Promise.all([
    readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProjectsPanel.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProjectSettingsForm.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProjectDetailView.astro", import.meta.url), "utf8"),
    readFile(new URL("../public/project-import.js", import.meta.url), "utf8"),
    readFile(new URL("../public/project-templates.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
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
  assert.match(projectsPanel, /<dialog id="project-import-dialog"/);
  assert.match(projectsPanel, /id="project-import-files-step"/);
  assert.match(projectsPanel, /id="project-import-settings-step"/);
  assert.match(projectsPanel, /id="project-import-open-project"/);
  assert.match(projectsPanel, /id="project-import-name"/);
  assert.match(projectsPanel, /id="project-import-create-domain"/);
  assert.match(projectsPanel, /id="project-import-domain-zone"/);
  assert.match(projectsPanel, /id="project-import-domain-subdomain"/);
  assert.match(projectsPanel, /value="build">Build estático \(compilar y servir con Nginx\)/);
  assert.match(projectsPanel, /id="project-import-files"/);
  assert.match(projectsPanel, /id="project-zip-input"/);
  assert.match(projectsPanel, /id="project-files-input"/);
  assert.match(projectsPanel, /id="project-selection-tree"/);
  assert.match(projectsPanel, /data-project-template="html-vanilla"/);
  assert.match(projectsPanel, /data-project-template="node-no-dependencies"/);
  assert.match(projectsPanel, /data-project-template="python-no-dependencies"/);
  assert.match(projectImport, /projectTemplates\.find/);
  assert.match(projectImport, /projectNameInput\.value/);
  assert.match(projectImport, /"X-Project-Name": safeProjectName\(root\)/);
  assert.match(projectImport, /projectDomainLabel/);
  assert.match(projectImport, /request\("\/api\/domains"/);
  assert.match(projectImport, /projectId: result\.project\.id/);
  assert.match(projectImport, /new File\(\[content\]/);
  assert.match(projectTemplates, /name: "server\.js"/);
  assert.match(projectTemplates, /name: "main\.py"/);
  const settingsPanel = await readFile(new URL("../src/components/SettingsPanel.astro", import.meta.url), "utf8");
  assert.match(settingsPanel, /Guía de red: IP pública, privada o local/);
  assert.match(settingsPanel, /split DNS/);
  assert.match(settingsPanel, /Resolve-DnsName registry\.midominio\.com/);
  assert.match(settingsPanel, /no configura HTTPS ni el registro privado/);
  assert.match(settingsPanel, /CGNAT/);
  assert.match(settingsPanel, /CA privada no están soportados/);
  const domainsPanel = await readFile(new URL("../src/components/DomainsPanel.astro", import.meta.url), "utf8");
  const dialogs = await readFile(new URL("../src/components/DashboardDialogs.astro", import.meta.url), "utf8");
  const guideDialog = await readFile(new URL("../src/components/GuideDialog.astro", import.meta.url), "utf8");
  const overviewPanel = await readFile(new URL("../src/components/OverviewPanel.astro", import.meta.url), "utf8");
  assert.match(domainsPanel, /id="domain-zones-list"/);
  assert.match(domainsPanel, /id="assigned-domains-list"/);
  assert.match(domainsPanel, /id="cloudflare-tunnel-status"/);
  assert.match(domainsPanel, /id="cloudflare-tunnel-origin"/);
  assert.match(domainsPanel, /id="cloudflare-tunnel-manager-subdomain"/);
  assert.match(domainsPanel, /id="cloudflare-tunnel-manager-zone"/);
  assert.match(domainsPanel, /Local: HTTP interno de Swarm/);
  assert.match(domainsPanel, /HTTPS al origen/);
  assert.match(domainsPanel, /Elige cómo Cloudflare Tunnel se conecta a Traefik/);
  assert.match(domainsPanel, /Create Custom Token/);
  assert.match(domainsPanel, /<code>Cloudflare Tunnel<\/code> y <code>Edit<\/code>/);
  assert.match(domainsPanel, /Account Resources/);
  assert.match(domainsPanel, /No uses el token del conector/);
  assert.match(domainsPanel, /solo sirve para ejecutar un túnel ya creado/);
  assert.match(domainsPanel, /hostname opcional del panel/);
  assert.match(application, /renderCloudflareTunnelManagerZones/);
  assert.match(domainsPanel, /data-guide-target="#guide-cloudflare-tunnel"/);
  assert.match(domainsPanel, /data-guide-target="#guide-domain-connect"/);
  assert.match(projectsPanel, /data-guide-target="#guide-project-files"/);
  assert.match(projectsPanel, /data-guide-target="#guide-github-oauth"/);
  assert.match(projectDetailView, /data-guide-target="#guide-deployment-types"/);
  assert.match(overviewPanel, /data-guide-target="#guide-node-enrollment"/);
  assert.match(dialogs, /<GuideDialog \/>/);
  assert.match(guideDialog, /<dialog id="guide-dialog"/);
  assert.match(guideDialog, /id="close-guide-dialog"/);
  assert.match(domainsPanel, /pattern="\[A-Fa-f0-9\]\{32\}"/);
  assert.match(projectsPanel, /id="github-connect-status"/);
  assert.match(projectsPanel, /github\.com\/settings\/applications\/new/);
  assert.doesNotMatch(projectsPanel, /id="github-webhook-secret"/);
  assert.match(projectsPanel, /Guardar y continuar/);
  assert.match(page, /<ProjectDetailView \/>/);
  assert.match(projectDetailView, /data-project-tab="deploy">Implementaciones/);
  assert.match(projectDetailView, /data-project-tab="settings">Configuración/);
  assert.match(projectDetailView, /href="\/#tab-projects"/);
  assert.match(projectDetailView, /project-detail-operation-status/);
  assert.match(projectDetailView, /project-release-status/);
  assert.match(projectDetailView, /id="project-detail-build-operation"/);
  assert.match(projectDetailView, /Registro de BuildKit \(últimos 1 MiB\)/);
  assert.match(projectDetailView, /project-detail-build-operation-progress/);
  assert.match(projectDetailView, /id="project-detail-build-operation-copy"/);
  assert.equal((projectDetailView.match(/data-project-tab="/g) ?? []).length, 3);
  assert.match(projectDetailView, /project-header-open/);
  assert.match(projectDetailView, /project-deployment-aside/);
  assert.match(projectDetailView, /<details id="project-settings-source"/);
  assert.match(projectDetailView, /<details id="project-settings-environment"/);
  assert.match(projectDetailView, /id="project-detail-history" class="project-history-panel"/);
  const projectDeploymentFields = application.match(/function updateProjectDeploymentFields\(\) \{([\s\S]*?)\n\}/);
  assert.ok(projectDeploymentFields);
  assert.match(projectDeploymentFields[1], /const isDynamic = projectDeploymentTypeSelect\.value === "dynamic"/);
  assert.match(application, /pollProjectBuildStatus/);
  assert.match(application, /Construir y desplegar/);
  assert.match(application, /projectDeployAfterBuild\.add\(project\.id\)/);
  assert.match(application, /El despliegue comenzará al terminar la compilación/);
  assert.match(application, /Compilación lista; solicitando el despliegue/);
  assert.match(application, /Reintentar deploy/);
  assert.match(application, /deleteProjectAndResources/);
  assert.match(application, /waitForProjectTask/);
  assert.match(application, /Construcción completada/);
  assert.match(application, /Esperando al agente del VPS/);
  assert.match(application, /BuildKit ya inició; todavía no ha emitido líneas de salida/);
  assert.match(application, /writeText\(output\)/);
  assert.match(application, /latestBuildOperation/);
  assert.match(application, /data-project-build/);
  assert.match(projectDetailView, /PRODUCCIÓN/);
  assert.match(projectDetailView, /No necesitas configurar un registro privado para este modo/);
  assert.doesNotMatch(projectDetailView, /<dialog/);
  assert.doesNotMatch(projectSettingsForm, /<dialog|data-close-project-dialog/);
  assert.match(page, /src="\/project-import\.js"/);
  assert.match(projectsPanel, /webkitdirectory directory multiple/);
  assert.match(projectsPanel, /project-detection-profile/);
  assert.match(projectsPanel, /Revisar o editar la configuración detectada/);
  assert.match(projectsPanel, /github-import-build-context/);
  assert.match(projectImport, /githubConnectButton\.addEventListener\("click"/);
  assert.match(projectImport, /detectProjectBuildProfile\(paths, metadataFiles\)/);
  assert.match(projectImport, /isIgnoredProjectFile\(path/);
  assert.match(projectImport, /X-Project-Framework/);
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
  assert.match(projectSettingsForm, /Compilar y desplegar automáticamente al recibir cambios en la rama de producción/);
  assert.match(projectSettingsForm, /Aplicación dinámica \(Node, Python u otro servidor\)/);
  assert.match(projectDetailView, /project-production-overview/);
  assert.match(projectDetailView, /id="project-runtime-summary"/);
  assert.match(projectDetailView, /Cómo se ejecuta/);
  assert.match(application, /function renderProjectRuntimeSummary\(project\)/);
  assert.match(application, /function createProjectEnvironmentEditor\(projectId, environment/);
  assert.match(application, /Configurar como aplicación dinámica/);
  assert.match(application, /projectDeploymentTypeSelect\.dispatchEvent\(new Event\("change"\)\)/);
  assert.match(application, /Guarda la configuración para habilitar las variables de entorno/);
  assert.match(application, /valueInput\.type = "password"/);
  assert.match(application, /Mostrar u ocultar el valor/);
  assert.doesNotMatch(application, /JSON\.stringify\(environment, null, 2\)/);
  assert.match(application, /directory\.append\(summary, nested\)/);
  assert.match(projectSettingsForm, /id="project-port-field"/);
  assert.match(projectSettingsForm, /id="project-build-context-field"/);
  assert.match(projectDetailView, /Dominios personalizados/);
  assert.match(projectDetailView, /project-detail-history/);
  assert.match(application, /Despliegue automático al recibir cambios en \$\{project\.productionBranch\}/);
  assert.match(application, /projectAutoDeployInput\.closest\("label"\)\.hidden = isUpload/);
  assert.match(application, /\/api\/github\/project-profile/);
  assert.match(application, /githubDetectedBuildProfile\?\.framework/);
  assert.match(projectDetailView, /project-framework-summary/);
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

  assert.doesNotMatch(renderer, /setProjectTab\("deploy"\)/);
  assert.match(application, /guideDialog\.showModal\(\)/);
  assert.match(importer, /function renderFileTree\(paths\)/);
  assert.match(importer, /filesInput\.addEventListener\("change"/);
  assert.match(importer, /selectedArchiveInfo\.paths/);
  assert.match(renderer, /manage\.href = `\/projects\/\$\{encodeURIComponent\(project\.id\)\}`/);
  assert.match(renderer, /button-danger/);
  assert.match(renderer, /deleteProjectAndResources/);
  assert.match(renderer, /Los registros DNS de esos dominios se conservarán/);
  assert.match(renderer, /Reintentar deploy/);
  assert.doesNotMatch(renderer, /project-registry-guidance/);
  assert.match(application, /window\.location\.assign\("\/#tab-projects"\)/);
  assert.match(application, /dashboardTabsRoot\.hidden = showingProject/);
  assert.match(application, /function renderAssignedDomains\(domains\)/);
  assert.match(application, /Conectado correctamente\./);
  assert.match(application, /Falló la conexión\. Motivo:/);
  assert.match(server, /defaultTunnelOriginProtocol: testMode \? "http" : "https"/);
  assert.match(server, /\/api\/cloudflare\/tunnel\/origin/);
  assert.match(server, /originProtocol: getCloudflareTunnelOriginProtocol\(settings\)/);
  assert.match(server, /localTunnelOriginAvailable: testMode/);
  assert.match(application, /request\("\/api\/cloudflare\/tunnel\/origin"/);
  assert.match(serviceAgent, /project_http_router="\$\{project_router\}-http"/);
  assert.match(serviceAgent, /application_http_router="\$\{application_router\}-http"/);
  assert.match(serviceAgent, /traefik\.http\.routers\.\$\{project_router\}\.service=\$\{project_router\}/);
  assert.match(serviceAgent, /traefik\.http\.routers\.\$\{project_http_router\}\.service=\$\{project_http_router\}/);
  assert.match(serviceAgent, /traefik\.http\.routers\.\$\{application_router\}\.service=\$\{application_router\}/);
  assert.match(serviceAgent, /traefik\.http\.routers\.\$\{application_http_router\}\.service=\$\{application_http_router\}/);
  assert.match(application, /HTTP \$\{response\.status\}: \$\{responseMessage\}/);
  assert.match(application, /deploymentType: githubDeploymentTypeSelect\.value/);
  assert.match(application, /function updateProjectDeploymentFields\(\)/);
  assert.match(application, /project\.deployment\?\.mode === "replicated"/);
  assert.match(application, /instancia independiente en el VPS principal/);
  assert.match(application, /connectDomains\.href = "\/#tab-domains"/);
  assert.match(projectDetailView, /data-project-tab-panel="deploy"/);
  assert.match(projectDetailView, /id="project-detail-file-tree"/);
  assert.match(server, /source.{0,10}files/);
  assert.match(server, /vps-manager-project-\$\{project\.id\.replaceAll\("-", ""\)\}:\$\{commitSha\}/);
  assert.doesNotMatch(server, /Configura primero el registro privado en Configuración para importar y desplegar repositorios/);
  const projectBuildStart = serviceAgent.indexOf('\nif [[ "${operation}" == "build-project" ]]; then');
  const projectBuildEnd = serviceAgent.indexOf('\nif [[ "${operation}" == "configure-registry" ]]', projectBuildStart);
  const projectBuild = serviceAgent.slice(projectBuildStart, projectBuildEnd);
  assert.match(projectBuild, /--load/);
  assert.doesNotMatch(projectBuild, /--push/);
  assert.match(serviceAgent, /--mode replicated/);
  assert.match(serviceAgent, /--constraint "node\.id==\$\{project_manager_node_id\}"/);
  assert.match(serviceAgent, /--restart-condition any/);
  assert.match(server, /validateProjectArchive\(archive\)/);
  assert.match(server, /projects.{0,30}0-9a-f/);
  assert.match(serviceAgent, /has_root_contents/);
  assert.match(serviceAgent, /FROM nginx:alpine/);
  assert.match(serviceAgent, /build_dockerfile="\$\{build_directory\}\/Dockerfile\.static"/);
  assert.match(serviceAgent, /--file "\$\{build_dockerfile\}"/);
  assert.match(serviceAgent, /deployment_type = request\["deploymentType"\]/);
  assert.match(serviceAgent, /"deploymentType": deployment_type/);
  assert.match(serviceAgent, /build_output_directory/);
  assert.match(serviceAgent, /RUN test -s "\/app\/%s\/index\.html"/);
  assert.match(serviceAgent, /configura una aplicación dinámica/);
  assert.match(serviceAgent, /CMD \["node", "server\.js"\]/);
  assert.match(serviceAgent, /CMD \["python", "main\.py"\]/);
  assert.match(serviceAgent, /C\+\+ requiere un Dockerfile/);
  assert.doesNotMatch(serviceAgent, /archive must contain one root directory/);
});

test("project domains refresh health, offer route repair, and explain internal port usage", async () => {
  const [application, domainsPanel, settingsForm, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/components/DomainsPanel.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProjectSettingsForm.astro", import.meta.url), "utf8"),
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
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
  assert.match(renderer, /currentDeployment\?\.routesCurrent/);
  assert.match(renderer, /subdomainInput\.placeholder = "www \(o @ para usar el dominio raíz\)"/);
  assert.match(renderer, /assignmentRow\.append\(subdomainInput, zoneSelect, addDomain\)/);
  assert.doesNotMatch(renderer, /const domainsDetails = document\.createElement\("details"\)/);
  assert.doesNotMatch(renderer, /const environmentDetails = document\.createElement\("details"\)/);
  assert.match(renderer, /subdomain === "@" \? zone : `\$\{subdomain\}\.\$\{zone\}`/);
  assert.match(renderer, /"Ver sitio"/);
  assert.match(renderer, /waitForProjectRouteHealth/);
  assert.match(renderer, /Reparar ruta automáticamente/);
  assert.match(application, /varios proyectos pueden usar el mismo sin colisionar/);
  assert.match(application, /escuchar en 0\.0\.0\.0/);
  assert.match(settingsForm, /id="project-port-usage"/);
  assert.ok(server.includes(String.raw`\/routes\/reconcile`));
  assert.match(server, /saveProjectDomainAssignments\(projectId, \{ force: true \}\)/);
  assert.match(server, /projectHealthMatch = url\.pathname\.match/);
  assert.match(domainsPanel, /asignar el dominio raíz o crear subdominios para tus proyectos/);
  assert.match(domainsPanel, /id="domains-ingress-ip-form"/);
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

test("manager image includes the root runtime modules imported by the API", async () => {
  const [dockerfile, server] = await Promise.all([
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
  ]);
  const runtimeImports = [...server.matchAll(/from "\.\/([^"]+\.mjs)"/g)]
    .map(([, moduleName]) => moduleName)
    .filter((moduleName) => !moduleName.includes("/"));
  const runtimeCopy = dockerfile.split(/\r?\n/).find((line) => line.startsWith("COPY server.mjs "));

  assert.ok(runtimeImports.length > 0);
  assert.ok(runtimeCopy);
  for (const moduleName of runtimeImports) {
    assert.ok(runtimeCopy.split(/\s+/).includes(moduleName), `${moduleName} must be copied into the runtime image`);
  }
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

test("Cloudflare Tunnel secret is readable only by the cloudflared runtime user", async () => {
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");

  assert.equal((serviceAgent.match(/uid=65532,gid=65532,mode=0400/g) ?? []).length, 2);
});

test("project services and containers use their project name in the resource list", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const application = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(server, /async function getProjectServiceDisplayNames\(services\)/);
  assert.match(server, /displayNames\.set\(service\.ID, `P • \$\{projectName\}`\)/);
  assert.match(server, /service\.Spec\?\.Name \?\? "Servicio sin nombre"/);
  assert.match(server, /displayName: projectServiceDisplayNames\.get\(container\.Labels\?\.\["com\.docker\.swarm\.service\.id"\]\) \?\? null/);
  assert.match(application, /name\.textContent = resource\.displayName \?\? resource\.name/);
});

test("project domain routes are activated automatically without redeploying", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const application = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");

  assert.match(server, /requestProjectRouteUpdate\(projectId, config\.domainsHash\)/);
  assert.match(server, /setInterval\(\(\) => \{\s*void reconcileProjectRoutes\(\);/);
  assert.match(application, /Activando ruta automáticamente/);
  assert.doesNotMatch(application, /Redespliega el proyecto para activar esta ruta/);
  assert.match(serviceAgent, /update-project-routes/);
  assert.match(serviceAgent, /vps-manager\.project-domains-hash=\$\{domains_hash\}/);
  assert.match(serviceAgent, /Rutas del proyecto actualizadas automáticamente sin reiniciar el contenedor/);
});
