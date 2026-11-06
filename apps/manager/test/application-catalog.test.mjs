import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { applicationCatalog } from "../src/data/application-catalog.mjs";

test("project deployment configuration parser imports its fingerprint dependency", async () => {
  const projectDeploymentAgent = await readFile(
    new URL("../../../installer/project-deployment-agent.sh", import.meta.url),
    "utf8",
  );
  const parser = projectDeploymentAgent.match(
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

test("builder cache cleanup is available to test-mode VPS installations", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const routeStart = server.indexOf('if (url.pathname === "/api/system/builder-cache-prune") {');
  const routeEnd = server.indexOf(
    'if (request.method === "GET" && url.pathname === "/api/system/tasks") {',
    routeStart,
  );
  const route = server.slice(routeStart, routeEnd);

  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  assert.doesNotMatch(route, /if \(testMode\)/);
  assert.match(route, /serviceOperationAgent\.requestBuilderCachePrune\(\)/);
});

test("Supabase Compose service memory limits use one consistent value", async () => {
  const agent = await readFile(new URL("../../../installer/supabase-deployment-agent.sh", import.meta.url), "utf8");

  assert.match(
    agent,
    /memory_limit = f"\{limits\['memoryMb'\]\}M"\s+resource_limits\["cpus"\] = str\(limits\["cpus"\]\)\s+resource_limits\["memory"\] = memory_limit\s+service\["mem_limit"\] = memory_limit/,
  );
  assert.match(agent, /compose_error="\$\("\$\{compose_command\[@\]\}" config -q 2>&1\)"/);
  assert.match(agent, /Compose rechazó la configuración generada para Supabase\. Detalle:/);
});

test("Supabase source files are readable in containers despite the service agent umask", async () => {
  const agent = await readFile(new URL("../../../installer/supabase-deployment-agent.sh", import.meta.url), "utf8");

  assert.match(agent, /if ! \(\s*umask 022[\s\S]*git init[\s\S]*git -C "\$\{clone_directory\}" checkout/);
  assert.match(agent, /chmod -R a\+rX -- "\$\{source_directory\}\/docker"/);
  assert.match(agent, /compose_error="\$\("\$\{compose_command\[@\]\}" up --detach --remove-orphans 2>&1\)"/);
  assert.match(agent, /Docker Compose no pudo iniciar el stack self-hosted de Supabase\. Detalle:/);
});

test("Ubuntu 24.04 compatibility checks warn and continue in both installation flows", async () => {
  const [installer, nodeEnrollment] = await Promise.all([
    readFile(new URL("../../../install.sh", import.meta.url), "utf8"),
    readFile(new URL("../../../installer/swarm-node-enroll.sh", import.meta.url), "utf8"),
  ]);

  assert.match(installer, /if \[\[ "\$\{ID:-\}" != "ubuntu" \|\| "\$\{VERSION_ID:-\}" != "24\.04" \]\]; then\s+log "ADVERTENCIA:/);
  assert.doesNotMatch(installer, /\[\[ "\$\{ID:-\}" == "ubuntu" && "\$\{VERSION_ID:-\}" == "24\.04" \]\] \|\| fail/);
  assert.match(nodeEnrollment, /if \[\[ "\\\$\{ID:-\}" != "ubuntu" \|\| "\\\$\{VERSION_ID:-\}" != "24\.04" \]\]; then\s+printf 'ADVERTENCIA:/);
  assert.doesNotMatch(nodeEnrollment, /\\\[\[ "\\\$\{ID:-\}" == "ubuntu" && "\\\$\{VERSION_ID:-\}" == "24\.04" \]\] \\\s+\|\| fail/);
  assert.match(nodeEnrollment, /if \[\[ "\\\$\{codename\}" != "noble" \]\]; then\s+printf 'ADVERTENCIA:/);
});

test("the project deployment agent is installed and loaded separately from general service operations", async () => {
  const [serviceAgent, installer] = await Promise.all([
    readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8"),
    readFile(new URL("../../../install.sh", import.meta.url), "utf8"),
  ]);

  assert.match(serviceAgent, /source \/usr\/local\/libexec\/vps-manager-project-deployment-agent\.sh/);
  assert.doesNotMatch(serviceAgent, /^if \[\[ "\$\{operation\}" == "build-project" \]\]; then$/m);
  assert.match(installer, /installer\/project-deployment-agent\.sh/);
  assert.match(installer, /vps-manager-project-deployment-agent\.sh/);
});

test("pnpm projects automatically refresh and install dependencies before every project build", async () => {
  const projectBuild = await readFile(
    new URL("../../../installer/project-deployment-agent.sh", import.meta.url),
    "utf8",
  );

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
  assert.match(projectBuild, /project-pnpm-lock-\$\{project_id\}\.yaml/);
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
  assert.match(projectsPanel, /class="project-import project-create-card"/);
  assert.ok(projectsPanel.indexOf('class="project-create-card"') < projectsPanel.indexOf('id="projects-list"'));
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
  assert.ok(page.indexOf("</section>\n      <ProjectDetailView />") > page.indexOf('id="dashboard-view"'));
  assert.match(application, /dashboardView\.classList\.toggle\("hidden", showingProject \|\| showingApplicationDetail \|\| showingApplicationCreate\)/);
  const login = await readFile(new URL("../public/login.js", import.meta.url), "utf8");
  assert.match(login, /projectDetailView\.classList\.toggle\("hidden", !authenticated \|\| !isProjectRoute\)/);
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
  assert.match(application, /function renderMetricsProjectUrls\(\)/);
  assert.match(application, /data-metrics-view/);
  assert.match(application, /metricsView === "containers"/);
  assert.match(application, /metricsView === "services"/);
  const monitoringPanel = await readFile(new URL("../src/components/MonitoringPanel.astro", import.meta.url), "utf8");
  assert.match(monitoringPanel, /id="metrics-project-urls"/);
  assert.match(monitoringPanel, /data-metrics-view="services"/);
  assert.match(monitoringPanel, /data-metrics-view="containers"/);
  assert.match(monitoringPanel, /data-metrics-view="both"/);
  assert.match(monitoringPanel, /id="metrics-total" class="metrics-total"/);
  assert.doesNotMatch(monitoringPanel, /id="metrics-total" class="metrics-total hidden"/);
  assert.match(application, /Suma total de recursos/);
  assert.match(application, /RAM usada por contenedores/);
  assert.match(application, /Suma parcial: faltan métricas/);
  assert.match(application, /No se pudo calcular la suma:/);
  assert.match(application, /\/api\/github\/project-profile/);
  assert.match(application, /githubDetectedBuildProfile\?\.framework/);
  assert.match(projectDetailView, /project-framework-summary/);
});

test("project file selection displays a nested filename tree and project cards offer guarded deletion", async () => {
  const [importer, application, projectDetailView, serviceAgent, projectDeploymentAgent, server] = await Promise.all([
    readFile(new URL("../public/project-import.js", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProjectDetailView.astro", import.meta.url), "utf8"),
    readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8"),
    readFile(new URL("../../../installer/project-deployment-agent.sh", import.meta.url), "utf8"),
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
  assert.match(renderer, /se eliminarán sus registros DNS administrados en Cloudflare/);
  assert.match(renderer, /Quitar y borrar DNS/);
  assert.match(renderer, /Reintentar deploy/);
  assert.doesNotMatch(renderer, /project-registry-guidance/);
  assert.match(application, /window\.location\.assign\("\/#tab-projects"\)/);
  assert.match(application, /dashboardView\.classList\.toggle\("hidden", showingProject \|\| showingApplicationDetail \|\| showingApplicationCreate\)/);
  assert.match(application, /function renderAssignedDomains\(domains\)/);
  assert.match(application, /Conectado correctamente\./);
  assert.match(application, /Falló la conexión\. Motivo:/);
  assert.match(server, /defaultTunnelOriginProtocol: testMode \? "http" : "https"/);
  assert.match(server, /\/api\/cloudflare\/tunnel\/origin/);
  assert.match(server, /originProtocol: getCloudflareTunnelOriginProtocol\(settings\)/);
  assert.match(server, /localTunnelOriginAvailable: testMode/);
  assert.match(application, /request\("\/api\/cloudflare\/tunnel\/origin"/);
  assert.match(projectDeploymentAgent, /project_http_router="\$\{project_router\}-http"/);
  assert.match(serviceAgent, /application_http_router="\$\{application_router\}-http"/);
  assert.match(projectDeploymentAgent, /traefik\.http\.routers\.\$\{project_router\}\.service=\$\{project_router\}/);
  assert.match(projectDeploymentAgent, /traefik\.http\.routers\.\$\{project_http_router\}\.service=\$\{project_http_router\}/);
  assert.match(serviceAgent, /traefik\.http\.routers\.\$\{application_router\}\.service=\$\{application_router\}/);
  assert.match(serviceAgent, /traefik\.http\.routers\.\$\{application_http_router\}\.service=\$\{application_http_router\}/);
  assert.match(application, /HTTP \$\{response\.status\}: \$\{responseMessage\}/);
  assert.match(application, /deploymentType: githubDeploymentTypeSelect\.value/);
  assert.match(application, /function updateProjectDeploymentFields\(\)/);
  assert.doesNotMatch(application, /function renderLegacyProjects\(\)/);
  assert.doesNotMatch(application, /projectEnvironmentJson/);
  assert.match(application, /connectDomains\.href = "\/#tab-domains"/);
  assert.match(projectDetailView, /data-project-tab-panel="deploy"/);
  assert.match(projectDetailView, /id="project-detail-file-tree"/);
  assert.match(server, /source.{0,10}files/);
  assert.match(server, /vps-manager-project-\$\{project\.id\.replaceAll\("-", ""\)\}:\$\{commitSha\}/);
  assert.doesNotMatch(server, /Configura primero el registro privado en Configuración para importar y desplegar repositorios/);
  assert.match(projectDeploymentAgent, /--load/);
  assert.doesNotMatch(projectDeploymentAgent, /--push/);
  assert.match(projectDeploymentAgent, /--mode replicated/);
  assert.match(projectDeploymentAgent, /--constraint "node\.id==\$\{project_manager_node_id\}"/);
  assert.match(projectDeploymentAgent, /--restart-condition any/);
  assert.match(server, /validateProjectArchive\(archive\)/);
  assert.match(server, /projects.{0,30}0-9a-f/);
  assert.match(projectDeploymentAgent, /has_root_contents/);
  assert.match(projectDeploymentAgent, /FROM nginx:alpine/);
  assert.match(projectDeploymentAgent, /build_dockerfile="\$\{build_directory\}\/Dockerfile\.static"/);
  assert.match(projectDeploymentAgent, /--file "\$\{build_dockerfile\}"/);
  assert.match(serviceAgent, /deployment_type = request\["deploymentType"\]/);
  assert.match(serviceAgent, /"deploymentType": deployment_type/);
  assert.match(projectDeploymentAgent, /build_output_directory/);
  assert.match(projectDeploymentAgent, /RUN test -s "\/app\/%s\/index\.html"/);
  assert.match(projectDeploymentAgent, /configura una aplicación dinámica/);
  assert.match(projectDeploymentAgent, /CMD \["node", "server\.js"\]/);
  assert.match(projectDeploymentAgent, /CMD \["python", "main\.py"\]/);
  assert.match(projectDeploymentAgent, /C\+\+ requiere un Dockerfile/);
  assert.doesNotMatch(projectDeploymentAgent, /archive must contain one root directory/);
  assert.match(serviceAgent, /source \/usr\/local\/libexec\/vps-manager-project-deployment-agent\.sh/);
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
  assert.match(server, /cloudflareClient\.deleteARecord\(token/);
  assert.match(server, /cloudflareClient\.deleteTunnelCname\(token/);
  assert.match(server, /await deleteProjectDomain\(domainId\)/);
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

test("release extraction preserves runtime readability under the updater's restrictive umask", async () => {
  const [dockerfile, updater] = await Promise.all([
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../../../installer/update.sh", import.meta.url), "utf8"),
  ]);
  const permissionNormalization = dockerfile.indexOf("RUN chmod -R a+rX /app");
  const runtimeUser = dockerfile.indexOf("USER node");

  assert.match(updater, /\(\s*umask 022\s+tar -xzf/);
  assert.ok(permissionNormalization >= 0 && permissionNormalization < runtimeUser);
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

test("application catalog loading is independent of project deployment health", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const routeStart = server.indexOf('if (url.pathname === "/api/applications") {');
  const routeEnd = server.indexOf(
    'if (url.pathname === "/api/applications/supabase/instances") {',
    routeStart,
  );
  const route = server.slice(routeStart, routeEnd);

  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  assert.match(route, /getApplicationCatalog\(\)/);
  assert.match(route, /getApplicationInstances\(\)/);
  assert.match(route, /dockerGet\("\/nodes"\)/);
  assert.doesNotMatch(route, /getProjectDeploymentState|getProjects\(\)/);
});

test("Supabase domain conflict checks bind exactly the parameters referenced by SQL", async () => {
  const database = await readFile(new URL("../db.mjs", import.meta.url), "utf8");
  const queryStart = database.indexOf("SELECT id FROM application_instances");
  const queryEnd = database.indexOf("if (conflictingDomain.rowCount > 0)", queryStart);
  const conflictCheck = database.slice(queryStart, queryEnd);

  assert.ok(queryStart >= 0 && queryEnd > queryStart);
  assert.match(conflictCheck, /ANY\(\$1::text\[\]\)/);
  assert.match(conflictCheck, /\$2::uuid IS NULL OR id <> \$2::uuid/);
  assert.doesNotMatch(conflictCheck, /\$3/);
  assert.match(conflictCheck, /\[\s*\[instance\.configuration\.apiDomain, instance\.configuration\.studioDomain\][\s\S]*instance\.id \?\? null/);
});

test("application removal confirms VPS cleanup before deleting Cloudflare records", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const routeStart = server.indexOf('const applicationInstanceMatch = url.pathname.match(');
  const routeEnd = server.indexOf('if (url.pathname === "/api/applications") {', routeStart);
  const route = server.slice(routeStart, routeEnd);
  const removal = route.indexOf("requestApplicationRemoval(");
  const dnsDeletion = route.indexOf("cloudflareClient.deleteTunnelCname(");
  const tunnelUpdate = route.indexOf("cloudflareClient.updateTunnelConfiguration(");
  const instanceDeletion = route.indexOf("deleteManagedApplicationInstance(instanceId)");

  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  assert.ok(removal >= 0 && removal < dnsDeletion);
  assert.ok(dnsDeletion < tunnelUpdate);
  assert.ok(tunnelUpdate < instanceDeletion);
  assert.match(route, /No se pudo completar la eliminación durante \$\{deletionStage\}: \$\{detail\}/);
});

test("application creation has isolated JSON templates for n8n and Supabase", async () => {
  const [server, database, serviceOperations, component, catalogComponent, supabaseForm, detailComponent, applicationScript, loginScript, serviceAgent, supabaseAgent, migration020, migration023, templateJson, styles] = await Promise.all([
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../db.mjs", import.meta.url), "utf8"),
    readFile(new URL("../service-operations.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ApplicationCreateView.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ApplicationCatalog.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/SupabaseConfigurationForm.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ApplicationDetailView.astro", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/login.js", import.meta.url), "utf8"),
    readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8"),
    readFile(new URL("../../../installer/supabase-deployment-agent.sh", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/020_multiple_application_instances.sql", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/023_multiple_supabase_instances_per_node.sql", import.meta.url), "utf8"),
    readFile(new URL("../public/application-templates.json", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);
  const templates = JSON.parse(templateJson).templates;
  const n8nTemplate = templates.find((template) => template.id === "n8n");
  const supabaseTemplate = templates.find((template) => template.id === "supabase");

  assert.match(server, /decodedPath === "\/applications\/new"/);
  assert.match(server, /\\\/applications\\\/\[0-9a-f\]/);
  assert.match(detailComponent, /id="application-detail-view"/);
  assert.match(detailComponent, /Set up owner account/);
  assert.match(detailComponent, /no necesitas iniciar sesión ni tener credenciales previas/);
  assert.match(detailComponent, /No hay correo ni contraseña predeterminados/);
  assert.match(detailComponent, /id="application-detail-delete"/);
  assert.match(catalogComponent, /id="supabase-instances"/);
  assert.match(catalogComponent, /className="card application-library"/);
  assert.match(catalogComponent, /aria-labelledby="installed-applications-title"/);
  assert.match(styles, /grid-template-areas: "installed library"/);
  assert.match(styles, /grid-template-areas: "library" "installed"/);
  assert.doesNotMatch(catalogComponent, /id="supabase-services"|supabase-settings-summary/);
  assert.match(detailComponent, /id="application-detail-supabase"/);
  assert.match(detailComponent, /id="application-detail-supabase-services"/);
  assert.match(detailComponent, /id="application-detail-supabase-configuration"/);
  assert.match(detailComponent, /id="application-detail-supabase-credentials"/);
  assert.match(detailComponent, /application-detail-login-guide/);
  assert.match(detailComponent, /application-detail-users-guide/);
  assert.match(detailComponent, /Settings<\/strong> y luego a <strong>Users/);
  assert.match(detailComponent, /Invite user/);
  assert.match(detailComponent, /Sin SMTP/);
  assert.match(applicationScript, /usersGuide\.hidden = instance\.applicationId !== "n8n-instance" \|\| instance\.status !== "installed"/);
  assert.match(applicationScript, /renderApplicationDetail\(result\.instances\)/);
  assert.match(applicationScript, /application-detail-supabase-credentials/);
  assert.match(applicationScript, /application-detail-supabase-limits/);
  assert.match(applicationScript, /details\.textContent = "Detalles"/);
  assert.match(applicationScript, /supabaseStatus\.dataset\.state = "error"/);
  assert.match(applicationScript, /message\.textContent = `No se pudieron cargar \$\{applicationName\}\. Usa “Actualizar estado” para reintentar\.`/);
  assert.match(applicationScript, /summary\.dataset\.state = enabledServices\.length > 0/);
  assert.ok(server.includes("supabase-credentials$/i"));
  assert.match(serviceOperations, /readSupabaseInstanceCredentials/);
  assert.match(loginScript, /isApplicationDetailRoute/);
  assert.match(component, /id="manual-application-form"/);
  assert.match(component, /value="n8n"/);
  assert.match(component, /name="cpus"/);
  assert.match(component, /name="memoryMb"/);
  assert.match(component, /name="zoneId"/);
  assert.match(component, /name="subdomain"/);
  assert.match(component, /name="webhookZoneId"/);
  assert.match(component, /name="webhookSubdomain"/);
  assert.match(component, /id="manual-app-metadata-fields"/);
  assert.match(component, /id="manual-app-advanced-fields"/);
  assert.match(component, /class="application-domain-row"/);
  assert.ok(component.indexOf('name="subdomain"') < component.indexOf('name="zoneId"'));
  assert.ok(component.indexOf('name="webhookSubdomain"') < component.indexOf('name="webhookZoneId"'));
  assert.match(component, /id="manual-app-deployment-logs"/);
  assert.match(applicationScript, /manual-app-metadata-fields"\)\.hidden = isN8n/);
  assert.match(applicationScript, /manualApplicationForm\.elements\.version\.value = getApplicationVersionFromImage/);
  assert.match(applicationScript, /appendManualApplicationLog\(operation\.message\)/);
  assert.match(applicationScript, /request\("\/api\/system\/service-operations"\)/);
  assert.doesNotMatch(component, /name="domain"|manual-app-server/);
  assert.match(applicationScript, /window\.location\.pathname === "\/applications\/new"/);
  assert.match(applicationScript, /fetch\("\/application-templates\.json"/);
  assert.match(applicationScript, /applicationTemplateDefinitions\.has\(requestedTemplate\)/);
  assert.match(applicationScript, /definition\?\.kind === "supabase"/);
  assert.match(applicationScript, /definition\?\.kind === "n8n"/);
  assert.match(supabaseForm, /id="supabase-create-form"/);
  assert.match(component, /value="supabase"/);
  assert.match(applicationScript, /supabaseCreateForm\.classList\.toggle\("hidden", !isSupabase\)/);
  assert.equal(n8nTemplate.defaults.image, "n8nio/n8n:latest");
  assert.equal(n8nTemplate.defaults.timezone, "UTC");
  assert.deepEqual(supabaseTemplate.defaults.enabledServices, [
    "db", "studio", "api-gw", "auth", "rest", "realtime", "storage",
    "imgproxy", "meta", "functions", "supavisor", "analytics", "vector",
  ]);
  assert.equal(Object.keys(supabaseTemplate.defaults.resourceLimits).length, 13);
  assert.deepEqual(supabaseTemplate.defaults.resourceLimits.db, { cpus: 2, memoryMb: 2048 });
  assert.equal(supabaseTemplate.defaults.name, "Supabase - {{hostname}}");
  assert.notEqual(n8nTemplate.defaults, supabaseTemplate.defaults);
  assert.match(applicationScript, /application\.id !== "n8n-instance"/);
  assert.match(applicationScript, /renderManualApplicationZones\(domainData\.zones\)/);
  assert.match(applicationScript, /renderN8nInstances/);
  assert.match(applicationScript, /function renderSupabaseInstances\(instances\)/);
  assert.match(applicationScript, /domain\.textContent = `\$\{label\}: \$\{hostname\}`/);
  assert.match(applicationScript, /createApplicationUrlLink\(instance\.configuration\.studioDomain, "Abrir Studio"\)/);
  assert.match(applicationScript, /domain\.rel = "noopener noreferrer"/);
  assert.match(applicationScript, /if \(instance\.configuration\.domain\) \{/);
  assert.match(applicationScript, /textContent = "Dominio pendiente"/);
  assert.match(applicationScript, /createApplicationUrlLink\(hostname, "Abrir n8n"\)/);
  assert.match(applicationScript, /detailsLink\.href = `\/applications\/\$\{encodeURIComponent\(instance\.id\)\}`/);
  assert.match(applicationScript, /application\.host\}:\$\{application\.port\} · \$\{application\.database\} · usuario \$\{application\.username\}/);
  assert.match(catalogComponent, /id="n8n-legacy-actions"/);
  assert.match(catalogComponent, /id="postgresql-connection"/);
  assert.match(catalogComponent, /No ofrece una página web/);
  assert.match(styles, /\.application-instance \{[^}]*border-top: 1px solid/);
  assert.match(applicationScript, /details\.textContent = "Detalles"/);
  assert.match(applicationScript, /remove\.textContent = "Eliminar"/);
  assert.match(applicationScript, /deleteApplicationInstance\(\{/);
  assert.match(applicationScript, /deleteButton\.hidden = !\["n8n-instance", "supabase"\]/);
  assert.match(applicationScript, /renderApplicationDetail\(result\.instances\)/);
  assert.match(applicationScript, /\/applications\/\$\{encodeURIComponent\(instance\.id\)\}/);
  assert.match(applicationScript, /query\.set\("instanceId", instance\.id\)/);
  assert.match(applicationScript, /pollManualApplicationDeployment\(taskId, applicationName, instanceId\)/);
  assert.match(applicationScript, /¿Eliminar la instancia \$\{instance\.name\}\?/);
  assert.match(applicationScript, /volumen con workflows, credenciales e historial/);
  assert.match(applicationScript, /method: "DELETE"/);
  assert.match(server, /applicationInstanceMatch = url\.pathname\.match/);
  assert.match(server, /upsertTunnelCname\(target\.token/);
  assert.match(server, /upsertARecord\(target\.token/);
  assert.match(server, /port: target\.hostname === configuration\.apiDomain \? 8000 : 3000/);
  assert.match(server, /Supabase · \$\{supabaseInstanceName\}/);
  assert.match(server, /serviceOperationAgent\.hasSupabaseInstanceCredentials\(instance\.id\)/);
  assert.doesNotMatch(
    server.slice(server.indexOf("const supabaseInstanceCredentialsMatch"), server.indexOf("const giteaCredentialsMatch")),
    /instance\.status !== "installed"/,
  );
  assert.match(database, /ON CONFLICT \(application_instance_id, hostname\) DO UPDATE/);
  assert.match(applicationScript, /supabaseRevealButton\.disabled = !instance\.credentialsAvailable/);
  assert.match(supabaseAgent, /install -o root -g 1000 -m 0640 "\$\{credentials_temp_path\}" "\$\{persistent_credentials_path\}"/);
  assert.match(server, /requestApplicationRemoval\(/);
  assert.match(server, /updateTunnelConfiguration\(/);
  assert.match(server, /deleteManagedApplicationInstance\(instanceId\)/);
  assert.match(serviceOperations, /async function requestApplicationRemoval\(/);
  assert.match(serviceOperations, /operation: "remove-application"/);
  assert.match(serviceAgent, /request\.get\("operation"\) == "remove-application"/);
  assert.match(serviceAgent, /docker service rm "\$\{application_service\}"/);
  assert.match(serviceAgent, /docker secret rm "\$\{secret_name\}"/);
  assert.match(serviceAgent, /docker volume rm "\$\{application_volume\}"/);
  assert.match(database, /DELETE FROM application_instances[\s\S]*application_id IN \('n8n-instance', 'supabase'\)[\s\S]*status <> 'installing'/);
  assert.match(serviceOperations, /\["n8n-instance", "supabase"\]\.includes\(applicationId\)/);
  assert.match(serviceAgent, /Only managed n8n and Supabase instances can be removed/);
  assert.match(serviceAgent, /vps_manager_remove_supabase "\$\{application_instance_id\}"/);
  assert.match(supabaseAgent, /down --volumes --remove-orphans/);
  assert.match(server, /requestBody\.zoneId/);
  assert.match(server, /delete applicationBody\.webhookZoneId/);
  assert.match(server, /delete applicationBody\.webhookSubdomain/);
  assert.match(server, /WEBHOOK_URL: `https:\/\/\$\{webhookHostname\}\/`/);
  assert.match(server, /getApplicationInstanceDomains\(\)/);
  assert.match(server, /serverNodeId: managerNode\.ID/);
  assert.match(server, /task: \{ id: taskId \}/);
  assert.match(serviceAgent, /service_create_error_file/);
  assert.match(serviceAgent, /json\.dump\(status, status_file, ensure_ascii=True\)/);
  assert.match(serviceAgent, /write_status "running" "Creando el servicio Swarm/);
  const applicationCreateArgs = serviceAgent.slice(
    serviceAgent.indexOf("application_router_args=("),
    serviceAgent.indexOf('service_create_error_file="${temporary_directory}/service-create-error.log"'),
  );
  const applicationEnvironmentArgs = serviceAgent.slice(
    serviceAgent.indexOf("application_environment_args=()"),
    serviceAgent.indexOf("application_service=\"vps-manager-app-"),
  );
  assert.match(applicationCreateArgs, /--label traefik\.enable=true/);
  assert.doesNotMatch(applicationCreateArgs, /--label-add/);
  assert.match(applicationEnvironmentArgs, /application_environment_args\+=\(--env "\$\{environment_entry\}"\)/);
  assert.doesNotMatch(applicationEnvironmentArgs, /--env-add/);
  assert.match(migration020, /DROP CONSTRAINT application_instances_server_key/);
  assert.match(migration023, /DROP INDEX IF EXISTS application_instances_supabase_server_key/);
  assert.match(database, /if \(instance\.applicationId === "supabase" && instance\.id\)/);
  assert.match(server, /currentInstance = body\.instanceId[\s\S]*instance\.id\.toLowerCase\(\) === body\.instanceId\.toLowerCase\(\)/);
  assert.match(server, /application_instances_server_key/);
  assert.match(server, /application_instance_domains_hostname_lower_key/);
});

test("Swarm application secret names remain below Docker's name limit", async () => {
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");

  assert.ok(serviceAgent.includes('secret_name_hash="${secret_name_hash%% *}"'));
  assert.ok(serviceAgent.includes('secret_name="vpm_${application_instance_id//-/}_${secret_name_hash:0:16}"'));
  assert.match(serviceAgent, /No se pudo guardar un secreto Swarm de la aplicación: \$\{secret_error/);
});

test("n8n uses a validated versioned image and declares managed persistence and HTTPS", async () => {
  const n8n = applicationCatalog.find((application) => application.id === "n8n");
  const serviceAgent = await readFile(new URL("../../../installer/service-agent.sh", import.meta.url), "utf8");

  assert.ok(n8n);
  assert.equal(n8n.installation.status, "optional");
  assert.equal(n8n.installation.enabled, true);
  assert.match(n8n.image, /^n8nio\/n8n:\d+\.\d+\.\d+$/);
  assert.ok(serviceAgent.includes('readonly N8N_IMAGE="n8nio/n8n:${n8n_version}"'));
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
  const projectDeploymentAgent = await readFile(
    new URL("../../../installer/project-deployment-agent.sh", import.meta.url),
    "utf8",
  );

  assert.match(server, /requestProjectRouteUpdate\(projectId, config\.domainsHash\)/);
  assert.match(server, /setInterval\(\(\) => \{\s*void reconcileProjectRoutes\(\);/);
  assert.match(application, /Activando ruta automáticamente/);
  assert.doesNotMatch(application, /Redespliega el proyecto para activar esta ruta/);
  assert.match(projectDeploymentAgent, /update-project-routes/);
  assert.match(projectDeploymentAgent, /vps-manager\.project-domains-hash=\$\{domains_hash\}/);
  assert.match(projectDeploymentAgent, /Rutas del proyecto actualizadas automáticamente sin reiniciar el contenedor/);
});

test("Supabase exposes the complete selectable service set with required core services", async () => {
  const [migration, form, application] = await Promise.all([
    readFile(new URL("../database/migrations/022_supabase_service_selection.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/components/SupabaseConfigurationForm.astro", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  ]);

  for (const service of [
    "db", "studio", "api-gw", "auth", "rest", "realtime", "storage",
    "imgproxy", "meta", "functions", "supavisor", "analytics", "vector",
  ]) {
    assert.match(migration, new RegExp(`"${service}"`));
  }
  assert.match(migration, /"required":\["db","studio","api-gw","auth","rest","meta"\]/);
  assert.match(migration, /"dependencies":\{"vector":\["analytics"\]\}/);
  assert.match(form, /id="supabase-service-selection"/);
  assert.match(form, /name="exposeDatabasePorts"/);
  assert.match(form, /id="supabase-service-filter"/);
  assert.match(form, /name="action" value="deploy"/);
  assert.doesNotMatch(form, /<dialog/);
  assert.match(application, /name = "enabledServices"/);
  assert.match(application, /requiredDependencies\.some/);
  assert.match(application, /applySupabaseServiceFilter/);
  assert.match(application, /template=supabase&serverNodeId=/);
});
