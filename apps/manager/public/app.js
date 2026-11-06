const dashboardView = document.querySelector("#dashboard-view");
const applicationDetailView = document.querySelector("#application-detail-view");
const applicationCreateView = document.querySelector("#application-create-view");
const refreshButton = document.querySelector("#refresh");
const refreshMetricsButton = document.querySelector("#refresh-metrics");
const pruneBuilderCacheButton = document.querySelector("#prune-builder-cache");
const builderCacheStatus = document.querySelector("#builder-cache-status");
const statusMessage = document.querySelector("#status-message");
const metricsStatus = document.querySelector("#metrics-status");
const metricsTotal = document.querySelector("#metrics-total");
const metricsGroups = document.querySelector("#metrics-groups");
const metricsContainers = document.querySelector("#metrics-containers");
const metricsIndividual = document.querySelector(".metrics-individual");
const metricsProjectUrls = document.querySelector("#metrics-project-urls");
const metricsProjectUrlsEmpty = document.querySelector("#metrics-project-urls-empty");
const metricsEmpty = document.querySelector("#metrics-empty");
const metricsSettingsForm = document.querySelector("#metrics-settings-form");
const metricsIntervalInput = document.querySelector("#metrics-interval");
const metricsCpuThresholdInput = document.querySelector("#metrics-cpu-threshold");
const metricsMemoryThresholdInput = document.querySelector("#metrics-memory-threshold");
const metricsDiskThresholdInput = document.querySelector("#metrics-disk-threshold");
const metricsRestartCountInput = document.querySelector("#metrics-restart-count");
const metricsRestartWindowInput = document.querySelector("#metrics-restart-window");
const metricsHttpTimeoutInput = document.querySelector("#metrics-http-timeout");
const metricsCertificateDaysInput = document.querySelector("#metrics-certificate-days");
const metricsSettingsStatus = document.querySelector("#metrics-settings-status");
const historyStatus = document.querySelector("#history-status");
const historyEmpty = document.querySelector("#history-empty");
const historyLegend = document.querySelector("#history-legend");
const historyCharts = document.querySelector("#history-charts");
const metricAlertsStatus = document.querySelector("#metric-alerts-status");
const metricAlertsList = document.querySelector("#metric-alerts");
const historyColors = ["#8eafff", "#9fe2b5", "#ffcb75", "#f28bba", "#b8a0ff", "#72d3d8", "#ff927e", "#c4cede"];
const logsDialog = document.querySelector("#logs-dialog");
const logsTitle = document.querySelector("#logs-title");
const logsStatus = document.querySelector("#logs-status");
const logsContent = document.querySelector("#logs-content");
const backupsList = document.querySelector("#backups-list");
const backupsStatus = document.querySelector("#backups-status");
const backupSettingsForm = document.querySelector("#backup-settings-form");
const backupIntervalInput = document.querySelector("#backup-interval");
const backupSettingsStatus = document.querySelector("#backup-settings-status");
const createBackupButton = document.querySelector("#create-backup");
const restoreDialog = document.querySelector("#restore-dialog");
const restoreForm = document.querySelector("#restore-form");
const restoreConfirmationInput = document.querySelector("#restore-confirmation");
const restoreStatus = document.querySelector("#restore-status");
const auditList = document.querySelector("#audit-list");
const auditStatus = document.querySelector("#audit-status");
const updatesStatus = document.querySelector("#updates-status");
const updatesReleaseNotes = document.querySelector("#updates-release-notes");
const updatesAction = document.querySelector("#updates-action");
const updateCommand = document.querySelector("#update-command");
const webUpdateButton = document.querySelector("#start-web-update");
const webUpdateStatus = document.querySelector("#web-update-status");
const diagnosticsStatus = document.querySelector("#diagnostics-status");
const diagnosticsList = document.querySelector("#diagnostics-list");
const refreshDiagnosticsButton = document.querySelector("#refresh-diagnostics");
const serviceOperationStatus = document.querySelector("#service-operation-status");
const swarmNodesList = document.querySelector("#swarm-nodes-list");
const nodesStatus = document.querySelector("#nodes-status");
const nodeEnrollForm = document.querySelector("#node-enroll-form");
const nodeEnrollStatus = document.querySelector("#node-enroll-status");
const nodeEnrollSubmit = document.querySelector("#node-enroll-submit");
const nodePrivateKey = document.querySelector("#node-private-key");
const refreshNodesButton = document.querySelector("#refresh-nodes");
const tasksList = document.querySelector("#tasks-list");
const tasksStatus = document.querySelector("#tasks-status");
const giteaStatus = document.querySelector("#gitea-status");
const giteaContainerStatus = document.querySelector("#gitea-container-status");
const giteaUrl = document.querySelector("#gitea-url");
const giteaSsh = document.querySelector("#gitea-ssh");
const installGiteaButton = document.querySelector("#install-gitea");
const restartGiteaButton = document.querySelector("#restart-gitea");
const n8nStatus = document.querySelector("#n8n-status");
const n8nInstancesList = document.querySelector("#n8n-instances");
const postgresqlStatus = document.querySelector("#postgresql-status");
const installPostgresqlButton = document.querySelector("#install-postgresql");
const revealPostgresqlCredentialsButton = document.querySelector("#reveal-postgresql-credentials");
const postgresqlCredentialsDialog = document.querySelector("#postgresql-credentials-dialog");
const supabaseStatus = document.querySelector("#supabase-status");
const supabaseInstancesList = document.querySelector("#supabase-instances");
const configureSupabaseButton = document.querySelector("#configure-supabase");
const refreshSupabaseStateButton = document.querySelector("#refresh-supabase-state");
const supabaseConfigurationForm = document.querySelector("#supabase-configuration-form");
const supabaseConfigurationStatus = document.querySelector("#supabase-configuration-status");
const supabaseServerNodeSelect = document.querySelector("#supabase-server-node");
const saveSupabaseConfigurationButton = document.querySelector("#save-supabase-configuration");
const deploySupabaseConfigurationButton = document.querySelector("#deploy-supabase-configuration");
const supabaseServiceFilter = document.querySelector("#supabase-service-filter");
const manualApplicationForm = document.querySelector("#manual-application-form");
const manualApplicationTemplate = document.querySelector("#manual-app-template");
const applicationCreateDescription = document.querySelector("#application-create-description");
const manualApplicationCard = document.querySelector("#manual-application-card");
const supabaseCreateForm = document.querySelector("#supabase-create-form");
const manualApplicationStatus = document.querySelector("#manual-app-status");
const manualApplicationLogs = document.querySelector("#manual-app-deployment-logs");
const manualApplicationSubmit = document.querySelector("#manual-app-submit");
const manualApplicationsList = document.querySelector("#manual-applications-list");
const manualApplicationsStatus = document.querySelector("#manual-applications-status");
const manualApplicationZoneSelect = document.querySelector("#manual-app-zone");
const manualApplicationSubdomainInput = document.querySelector("#manual-app-subdomain");
const manualApplicationHostnamePreview = document.querySelector("#manual-app-hostname-preview");
const manualApplicationWebhookFields = document.querySelector("#manual-app-webhook-domain-fields");
const manualApplicationWebhookZoneSelect = document.querySelector("#manual-app-webhook-zone");
const manualApplicationWebhookSubdomainInput = document.querySelector("#manual-app-webhook-subdomain");
const manualApplicationWebhookHostnamePreview = document.querySelector("#manual-app-webhook-hostname-preview");
const revealGiteaCredentialsButton = document.querySelector("#reveal-gitea-credentials");
const giteaTokenForm = document.querySelector("#gitea-token-form");
const giteaApiTokenStatus = document.querySelector("#gitea-api-token-status");
const giteaRepositoryForm = document.querySelector("#gitea-repository-form");
const giteaBranchManagement = document.querySelector("#gitea-branch-management");
const giteaBranchRepository = document.querySelector("#gitea-branch-repository");
const giteaBranchRefresh = document.querySelector("#gitea-branch-refresh");
const giteaWebhookConfigure = document.querySelector("#gitea-webhook-configure");
const giteaWebhookStatus = document.querySelector("#gitea-webhook-status");
const giteaDefaultBranchSelect = document.querySelector("#gitea-default-branch");
const giteaDefaultBranchSubmit = document.querySelector("#gitea-default-branch-submit");
const giteaBranchStatus = document.querySelector("#gitea-branch-status");
const projectForm = document.querySelector("#project-form");
const projectFormStatus = document.querySelector("#project-form-status");
const projectIdInput = document.querySelector("#project-id");
const projectNameInput = document.querySelector("#project-name");
const projectDescriptionInput = document.querySelector("#project-description");
const projectRepositorySelect = document.querySelector("#project-repository");
const projectProductionBranchSelect = document.querySelector("#project-production-branch");
const projectSaveButton = document.querySelector("#project-save");
const projectInstallationSelect = document.querySelector("#project-installation");
const projectDeploymentTypeSelect = document.querySelector("#project-deployment-type");
const projectAutoDeployInput = document.querySelector("#project-auto-deploy");
const projectDeploymentTypeHelp = document.querySelector("#project-deployment-type-help");
const projectDynamicBuildFields = document.querySelector("#project-dynamic-build-fields");
const projectBuildStrategySelect = document.querySelector("#project-build-strategy");
const projectDockerfileField = document.querySelector("#project-dockerfile-field");
const githubConfigForm = document.querySelector("#github-config-form");
const githubStatus = document.querySelector("#github-status");
const githubClientIdInput = document.querySelector("#github-client-id");
const githubClientSecretInput = document.querySelector("#github-client-secret");
const githubCallbackUrl = document.querySelector("#github-callback-url");
const githubImportForm = document.querySelector("#github-import-form");
const githubImportButton = document.querySelector("#github-import-project");
const githubImportStatus = document.querySelector("#github-import-status");
const githubDeploymentTypeSelect = document.querySelector("#github-deployment-type");
const githubDetectionProfile = document.querySelector("#github-detection-profile");
const githubBuildStrategySelect = document.querySelector("#github-import-build-strategy");
const githubBuildContextInput = document.querySelector("#github-import-build-context");
const githubDockerfileInput = document.querySelector("#github-import-dockerfile");
const githubInternalPortInput = document.querySelector("#github-import-port");
const githubBuildCommandInput = document.querySelector("#github-import-build-command");
const githubOutputDirectoryInput = document.querySelector("#github-import-output-directory");
const projectsStatus = document.querySelector("#projects-status");
const projectsList = document.querySelector("#projects-list");
const refreshProjectsButton = document.querySelector("#refresh-projects");
const projectDetailView = document.querySelector("#project-detail-view");
const guideDialog = document.querySelector("#guide-dialog");
const guideDialogTitle = document.querySelector("#guide-dialog-title");
const guideDialogContent = document.querySelector("#guide-dialog-content");
const domainZoneForm = document.querySelector("#domain-zone-form");
const domainZoneIdInput = document.querySelector("#domain-zone-id");
const domainZoneNameInput = document.querySelector("#domain-zone-name");
const domainZoneTokenInput = document.querySelector("#domain-zone-token");
const domainZoneFormStatus = document.querySelector("#domain-zone-form-status");
const domainZoneSaveButton = document.querySelector("#domain-zone-save");
const domainZoneDialog = document.querySelector("#domain-zone-dialog");
const domainZoneDialogTitle = document.querySelector("#domain-zone-dialog-title");
const openDomainZoneDialogButton = document.querySelector("#open-domain-zone-dialog");
const closeDomainZoneDialogButton = document.querySelector("#close-domain-zone-dialog");
const domainZonesStatus = document.querySelector("#domain-zones-status");
const domainZonesList = document.querySelector("#domain-zones-list");
const assignedDomainsStatus = document.querySelector("#assigned-domains-status");
const assignedDomainsList = document.querySelector("#assigned-domains-list");
const refreshDomainsButton = document.querySelector("#refresh-domains");
const ingressIpForm = document.querySelector("#domains-ingress-ip-form");
const ingressIpInput = document.querySelector("#domains-ingress-ip");
const ingressIpSaveButton = document.querySelector("#domains-ingress-ip-save");
const ingressIpStatus = document.querySelector("#domains-ingress-ip-status");
const ingressIpCard = document.querySelector("#domains-ingress-ip-card");
const cloudflareTunnelForm = document.querySelector("#cloudflare-tunnel-form");
const cloudflareTunnelAccountInput = document.querySelector("#cloudflare-tunnel-account");
const cloudflareTunnelNameInput = document.querySelector("#cloudflare-tunnel-name");
const cloudflareTunnelManagerSubdomainInput = document.querySelector("#cloudflare-tunnel-manager-subdomain");
const cloudflareTunnelManagerZoneSelect = document.querySelector("#cloudflare-tunnel-manager-zone");
const cloudflareTunnelTokenInput = document.querySelector("#cloudflare-tunnel-token");
const cloudflareTunnelSaveButton = document.querySelector("#cloudflare-tunnel-save");
const cloudflareTunnelStatus = document.querySelector("#cloudflare-tunnel-status");
const cloudflareTunnelOriginSelect = document.querySelector("#cloudflare-tunnel-origin");
const cloudflareTunnelOriginStatus = document.querySelector("#cloudflare-tunnel-origin-status");
const registryForm = document.querySelector("#registry-configure-form");
const registryDomainInput = document.querySelector("#registry-domain");
const registryUsernameInput = document.querySelector("#registry-username");
const registryPasswordInput = document.querySelector("#registry-password");
const registryState = document.querySelector("#registry-state");
const registryStatus = document.querySelector("#registry-status");
const registryFormStatus = document.querySelector("#registry-form-status");
const registrySaveButton = document.querySelector("#registry-save");
let domainZoneProxied = false;
let cloudflareTunnelPollTimer;
let giteaStatusPollTimer;
let postgresqlStatusPollTimer;
let giteaTokenConfigurationPending = false;
let giteaRepositoriesLoaded = false;
let giteaRepositoriesLoading = false;
let giteaRepositories = new Map();
let giteaCurrentDefaultBranch = "";
let giteaBranchRequestId = 0;
let projectBranchRequestId = 0;
let projectBuildPollTimer;
let projects = [];
const projectDeployAfterBuild = new Set();
let domainData = { zones: [], domains: [] };
let manualApplicationServers = [];
let applicationTemplateDefinitions = new Map();
let giteaCanManageProjects = false;
const resourceData = { containers: [], services: [], stacks: [] };
const containerMetrics = new Map();
let containerMetricsHost = null;
let containerMetricsUnavailable = [];
let metricsView = "both";
let runningContainerCount = 0;
let metricsLoaded = false;
let metricsLoadError = "";
let metricsLoading = false;
let metricAlertsRefreshTimer;
let metricAlertsSignature = "";
let selectedBackupId;
let webUpdatePollTimer;
let webUpdatePending = false;
let lastWebUpdateState;
let serviceOperationPollTimer;
let serviceOperationPending = false;
let builderCachePrunePollTimer;
let builderCachePrunePending = false;
let builderCachePruneOperationId;
let registryConfigurationPollTimer;
let nodeEnrollmentPollTimer;
let supabaseApplicationData;
let revealedSupabaseCredentials = null;
let giteaLocalOnly = false;
let giteaNeedsLocalUpgrade = false;
let giteaNeedsDomainMigration = false;

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `No se pudo conectar con VPS Manager en ${window.location.origin}. ` +
      "El panel o Traefik puede estar reiniciándose o no tener tareas activas; " +
      "espera a que termine la instalación y comprueba el estado de los servicios Swarm.",
    );
  }
  const responseText = await response.text();
  let result;
  try {
    const payload = responseText ? JSON.parse(responseText) : {};
    result = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  } catch {
    result = {};
  }
  if (!response.ok) {
    const responseMessage = typeof result.error === "string"
      ? result.error
      : typeof result.message === "string"
        ? result.message
        : typeof result.detail === "string"
          ? result.detail
          : !/^\s*</.test(responseText)
            ? responseText.trim().slice(0, 1000)
            : "";
    throw new Error(
      responseMessage
        ? `HTTP ${response.status}: ${responseMessage}`
        : `HTTP ${response.status}: el servidor no devolvió detalles legibles.`,
    );
  }
  if (!responseText || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("El servidor devolvió una respuesta inválida.");
  }
  return result;
}

function handleAuthenticationChange(authenticated) {
  if (authenticated && metricAlertsRefreshTimer === undefined) {
    metricAlertsRefreshTimer = setInterval(() => void loadMetricAlerts(), 60_000);
  } else if (!authenticated && metricAlertsRefreshTimer !== undefined) {
    clearInterval(metricAlertsRefreshTimer);
    metricAlertsRefreshTimer = undefined;
  }
  if (!authenticated) {
    if (webUpdatePollTimer !== undefined) clearTimeout(webUpdatePollTimer);
    webUpdatePollTimer = undefined;
    if (registryConfigurationPollTimer !== undefined) clearTimeout(registryConfigurationPollTimer);
    registryConfigurationPollTimer = undefined;
    registrySaveButton.disabled = false;
    webUpdatePending = false;
    lastWebUpdateState = undefined;
    if (serviceOperationPollTimer !== undefined) clearTimeout(serviceOperationPollTimer);
    serviceOperationPollTimer = undefined;
    serviceOperationPending = false;
    if (builderCachePrunePollTimer !== undefined) clearTimeout(builderCachePrunePollTimer);
    builderCachePrunePollTimer = undefined;
    builderCachePrunePending = false;
    pruneBuilderCacheButton.disabled = false;
  }
}

function renderResources(target, resources, getDetail, getState, onAction, emptyMessage, getSecondaryAction) {
  target.replaceChildren();
  if (resources.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = emptyMessage;
    target.append(empty);
    return;
  }

  for (const resource of resources) {
    const row = document.createElement("div");
    row.className = "resource";
    const main = document.createElement("div");
    main.className = "resource-main";
    const name = document.createElement("div");
    name.className = "resource-name";
    name.textContent = resource.displayName ?? resource.name;
    const detail = document.createElement("div");
    detail.className = "resource-detail";
    detail.textContent = getDetail(resource);
    const state = document.createElement("span");
    state.className = "resource-state";
    state.textContent = getState(resource);
    main.append(name, detail);
    row.append(main, state);
    if (onAction || getSecondaryAction) {
      const actions = document.createElement("div");
      actions.className = "resource-actions";
      if (onAction) {
        const action = document.createElement("button");
        action.className = "button secondary resource-action";
        action.type = "button";
        action.textContent = "Ver logs";
        action.addEventListener("click", () => onAction(resource));
        actions.append(action);
      }
      const secondaryActions = getSecondaryAction?.(resource);
      for (const secondaryAction of Array.isArray(secondaryActions)
        ? secondaryActions
        : secondaryActions ? [secondaryActions] : []) {
        const action = document.createElement("button");
        action.className = "button resource-action";
        action.type = "button";
        action.textContent = secondaryAction.label;
        action.setAttribute("aria-label", `${secondaryAction.label} ${resource.name}`);
        action.disabled = serviceOperationPending;
        action.addEventListener("click", () => secondaryAction.onClick(resource));
        actions.append(action);
      }
      row.append(actions);
    }
    target.append(row);
  }
}

async function showResourceLogs(resource, resourceType) {
  const resourceLabel = resourceType === "containers" ? "Contenedor" : "Servicio";
  logsTitle.textContent = `Logs · ${resource.name}`;
  logsStatus.textContent = "Cargando las últimas 100 líneas…";
  logsContent.textContent = "";
  logsDialog.showModal();

  try {
    const response = await fetch(`/api/docker/${resourceType}/${encodeURIComponent(resource.id)}/logs`);
    const content = await response.text();
    if (!response.ok) {
      let message = `Error HTTP ${response.status}`;
      try {
        message = JSON.parse(content).error ?? message;
      } catch {
        if (content) message = content;
      }
      throw new Error(message);
    }
    logsContent.textContent = content || `${resourceLabel} no tiene logs disponibles.`;
    logsStatus.textContent = `Últimas 100 líneas. Salida estándar y de error del ${resourceLabel.toLowerCase()}.`;
  } catch (error) {
    logsStatus.textContent = error.message;
  }
}

function renderServerInfo(server, database) {
  const details = [
    ["Nombre", server.name],
    ["Sistema operativo", `${server.operatingSystem} · ${server.architecture}`],
    ["Docker Engine", server.serverVersion],
    ["CPU", `${server.cpuCount} núcleos`],
    ["Memoria", `${(server.memoryBytes / 1024 ** 3).toFixed(1)} GiB`],
    ["Contenedores", `${server.containers.running} activos · ${server.containers.stopped} detenidos · ${server.containers.total} total`],
    ["PostgreSQL", database?.connected ? `${database.name} · conectada` : "desconectada"],
  ];
  const target = document.querySelector("#server-info");
  target.replaceChildren();

  for (const [label, value] of details) {
    const item = document.createElement("div");
    item.className = "server-detail";
    const title = document.createElement("span");
    title.className = "server-detail-label";
    title.textContent = label;
    const content = document.createElement("span");
    content.className = "server-detail-value";
    content.textContent = value;
    item.append(title, content);
    target.append(item);
  }
  document.querySelector("#swarm-state").textContent = `Swarm: ${server.swarmState}`;
}

function renderSwarmNodes(nodes) {
  swarmNodesList.replaceChildren();
  if (nodes.length === 0) {
    nodesStatus.textContent = "Este Swarm todavía no tiene nodos visibles.";
    return;
  }
  nodesStatus.textContent = `${nodes.length} nodo${nodes.length === 1 ? "" : "s"} en el Swarm.`;
  for (const node of nodes) {
    const row = document.createElement("div");
    row.className = "resource";
    const main = document.createElement("div");
    main.className = "resource-main";
    const name = document.createElement("div");
    name.className = "resource-name";
    name.textContent = `${node.hostname} · ${node.state} · ${node.role}`;
    const details = document.createElement("div");
    details.className = "resource-detail";
    details.textContent = [
      node.address ? `IP ${node.address}` : "",
      `Disponibilidad ${node.availability}`,
      node.managerReachability ? `Manager ${node.managerReachability}${node.leader ? " (líder)" : ""}` : "",
      node.engineVersion ? `Docker ${node.engineVersion}` : "",
      node.architecture ?? "",
    ].filter(Boolean).join(" · ");
    main.append(name, details);
    row.append(main);
    swarmNodesList.append(row);
  }
}

async function loadSwarmNodes() {
  nodesStatus.textContent = "Consultando nodos del Swarm…";
  try {
    const result = await request("/api/nodes");
    renderSwarmNodes(result.nodes);
  } catch (error) {
    swarmNodesList.replaceChildren();
    nodesStatus.textContent = error.message;
  }
}

function renderStacks(stacks, emptyMessage) {
  const target = document.querySelector("#stacks");
  target.replaceChildren();

  if (stacks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = emptyMessage;
    target.append(empty);
    return;
  }

  for (const stack of stacks) {
    const row = document.createElement("div");
    row.className = "resource";
    const main = document.createElement("div");
    main.className = "resource-main";
    const name = document.createElement("div");
    name.className = "resource-name";
    name.textContent = stack.name;
    const services = document.createElement("div");
    services.className = "stack-services";
    for (const service of stack.services) {
      const serviceRow = document.createElement("div");
      serviceRow.className = "stack-service";
      const serviceName = document.createElement("span");
      serviceName.className = "stack-service-name";
      serviceName.textContent = service.name;
      const serviceInfo = document.createElement("span");
      serviceInfo.className = "stack-service-info";
      serviceInfo.textContent = `${service.image} · ${service.mode} · ${service.replicas}`;
      serviceRow.append(serviceName, serviceInfo);
      services.append(serviceRow);
    }
    const count = document.createElement("span");
    count.className = "resource-state";
    count.textContent = `${stack.serviceCount} servicios`;
    main.append(name, services);
    row.append(main, count);
    target.append(row);
  }
}

function matchesSearch(values, query) {
  if (!query) return true;
  return values.some((value) => String(value ?? "").toLocaleLowerCase("es-MX").includes(query));
}

function updateResourceCount(selector, visible, total) {
  const badge = document.querySelector(selector);
  badge.textContent = visible === total ? String(total) : `${visible} / ${total}`;
  badge.setAttribute("aria-label", `${visible} visibles de ${total}`);
}

function renderMetricsGroups() {
  const groups = new Map();
  let totalCpuPercent = 0;
  let totalMemoryBytes = 0;
  for (const metrics of containerMetrics.values()) {
    const group = groups.get(metrics.group) ?? { cpuPercent: 0, memoryUsageBytes: 0, containerCount: 0 };
    group.cpuPercent += metrics.cpuPercent;
    group.memoryUsageBytes += metrics.memoryUsageBytes;
    group.containerCount += 1;
    totalCpuPercent += metrics.cpuPercent;
    totalMemoryBytes += metrics.memoryUsageBytes;
    groups.set(metrics.group, group);
  }

  metricsTotal.replaceChildren();
  const totalHeading = document.createElement("h4");
  totalHeading.textContent = "Suma total de recursos";
  metricsTotal.append(totalHeading);
  if (!metricsLoaded) {
    const message = document.createElement("p");
    message.className = `metrics-total-message${metricsLoadError ? " is-error" : ""}`;
    message.textContent = metricsLoadError
      ? `No se pudo calcular la suma: ${metricsLoadError}`
      : "Actualiza CPU/RAM para consultar el consumo sumado de todos los contenedores activos.";
    metricsTotal.append(message);
  } else {
    const values = document.createElement("div");
    values.className = "metrics-total-values";
    const cpu = document.createElement("div");
    cpu.className = "metrics-total-value";
    const cpuLabel = document.createElement("span");
    cpuLabel.textContent = `CPU agregada · ${containerMetricsHost?.cpuCount ?? "?"} CPU(s)`;
    const cpuValue = document.createElement("strong");
    cpuValue.textContent = `${totalCpuPercent.toFixed(1)}%`;
    cpu.append(cpuLabel, cpuValue);
    const memory = document.createElement("div");
    memory.className = "metrics-total-value";
    const memoryLabel = document.createElement("span");
    memoryLabel.textContent = "RAM usada por contenedores";
    const memoryValue = document.createElement("strong");
    const hostMemory = containerMetricsHost?.memoryBytes;
    memoryValue.textContent = Number.isFinite(hostMemory) && hostMemory > 0
      ? `${formatBytes(totalMemoryBytes)} / ${formatBytes(hostMemory)}`
      : formatBytes(totalMemoryBytes);
    memory.append(memoryLabel, memoryValue);
    values.append(cpu, memory);
    const count = document.createElement("span");
    count.className = "metrics-total-note";
    count.textContent = `${runningContainerCount} contenedor(es) activos`;
    metricsTotal.append(values, count);
    if (containerMetricsUnavailable.length > 0) {
      const warning = document.createElement("span");
      warning.className = "metrics-total-message is-warning";
      warning.textContent = `Suma parcial: faltan métricas de ${containerMetricsUnavailable.length} contenedor(es).`;
      metricsTotal.append(warning);
    }
    const note = document.createElement("span");
    note.className = "metrics-total-note";
    note.textContent = "CPU sumada entre contenedores; puede superar 100%. La vista elegida abajo no cambia este total.";
    metricsTotal.append(note);
  }

  metricsGroups.replaceChildren();
  metricsGroups.classList.toggle("hidden", groups.size === 0 || metricsView === "containers");
  for (const [name, group] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const item = document.createElement("div");
    item.className = "metrics-group";
    const title = document.createElement("span");
    title.className = "metrics-group-name";
    title.textContent = name;
    const value = document.createElement("span");
    value.className = "metrics-group-value";
    value.textContent = `${group.cpuPercent.toFixed(1)}% CPU · ${formatBytes(group.memoryUsageBytes)} RAM · ${group.containerCount} contenedor(es)`;
    item.append(title, value);
    metricsGroups.append(item);
  }

  metricsIndividual.classList.toggle("hidden", metricsView === "services");
  document.querySelector("#metrics-individual-title").textContent = metricsView === "both"
    ? "Consumo por contenedor"
    : "Detalle por contenedor";
  metricsContainers.replaceChildren();
  for (const metrics of [...containerMetrics.values()].sort((left, right) =>
    right.cpuPercent - left.cpuPercent || right.memoryUsageBytes - left.memoryUsageBytes)) {
    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = metrics.name || metrics.id;
    const group = document.createElement("td");
    group.textContent = metrics.group;
    const cpu = document.createElement("td");
    cpu.textContent = `${metrics.cpuPercent.toFixed(1)}%`;
    const memory = document.createElement("td");
    memory.textContent = Number.isFinite(metrics.memoryLimitBytes) && metrics.memoryLimitBytes > 0
      ? `${formatBytes(metrics.memoryUsageBytes)} / ${formatBytes(metrics.memoryLimitBytes)}`
      : formatBytes(metrics.memoryUsageBytes);
    row.append(name, group, cpu, memory);
    metricsContainers.append(row);
  }
  for (const unavailable of containerMetricsUnavailable) {
    const row = document.createElement("tr");
    row.className = "metrics-unavailable";
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = unavailable.name || unavailable.id;
    const group = document.createElement("td");
    group.textContent = unavailable.group;
    const cpu = document.createElement("td");
    cpu.textContent = "No disponible";
    const memory = document.createElement("td");
    memory.textContent = "No disponible";
    row.append(name, group, cpu, memory);
    metricsContainers.append(row);
  }
  metricsEmpty.classList.toggle("hidden", metricsLoaded && metricsContainers.childElementCount > 0);
  if (metricsLoaded && metricsContainers.childElementCount === 0) {
    metricsEmpty.textContent = "No hay contenedores activos en este host Docker.";
  } else {
    metricsEmpty.textContent = "Actualiza CPU/RAM para consultar los contenedores activos.";
  }
}

function renderMetricsProjectUrls() {
  metricsProjectUrls.replaceChildren();
  const projectUrls = projects.flatMap((project) =>
    domainData.domains
      .filter((domain) => domain.projectId === project.id)
      .map((domain) => ({ project, domain })),
  );
  metricsProjectUrlsEmpty.classList.toggle("hidden", projectUrls.length > 0);
  for (const { project, domain } of projectUrls) {
    const row = document.createElement("div");
    row.className = "metrics-project-url";
    const main = document.createElement("div");
    const projectName = document.createElement("strong");
    projectName.textContent = project.name;
    const link = document.createElement("a");
    link.href = `https://${domain.hostname}/`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = domain.hostname;
    const urlHealth = project.health?.urls?.find((url) => url.hostname === domain.hostname);
    const status = document.createElement("span");
    status.className = "muted project-health-status";
    status.dataset.state = urlHealth?.state ?? "unknown";
    status.textContent = projectUrlHealthLabel(urlHealth);
    main.append(projectName, link);
    row.append(main, status);
    metricsProjectUrls.append(row);
  }
}

function renderFilteredResources() {
  const containerQuery = document.querySelector("#container-search").value.trim().toLocaleLowerCase("es-MX");
  const containerFilter = document.querySelector("#container-filter").value;
  const containers = resourceData.containers.filter((container) => {
    const matchesState = containerFilter === "all"
      || (containerFilter === "running" ? container.state === "running" : container.state !== "running");
    const ports = container.ports.map((port) => `${port.public ?? ""} ${port.private}/${port.type}`);
    return matchesState && matchesSearch(
      [container.displayName, container.name, container.image, container.id, container.status, ...ports],
      containerQuery,
    );
  });
  const containerHasFilters = Boolean(containerQuery) || containerFilter !== "all";
  renderResources(
    document.querySelector("#containers"),
    containers,
    (item) => {
      const ports = item.ports.map((port) => port.public
        ? `${port.public} → ${port.private}/${port.type}`
        : `${port.private}/${port.type}`);
      const details = [item.image, item.id, item.status, ...ports].filter(Boolean);
      if (metricsLoaded) {
        const metrics = containerMetrics.get(item.id);
        if (metrics) {
          details.push(`${metrics.cpuPercent.toFixed(1)}% CPU · ${formatBytes(metrics.memoryUsageBytes)} / ${formatBytes(metrics.memoryLimitBytes)} RAM`);
        } else {
          details.push(item.state === "running" ? "CPU/RAM no disponibles" : "Detenido");
        }
      }
      return details.join(" · ");
    },
    (item) => item.state,
    (container) => showResourceLogs(container, "containers"),
    containers.length === 0 && containerHasFilters ? "No hay contenedores que coincidan con los filtros." : "No hay contenedores.",
    (container) => {
      const service = resourceData.services.find((item) =>
        item.managed && container.serviceId?.startsWith(item.id));
      if (!service || container.state !== "running") return undefined;
      return [
        ...(service.component === "api"
          ? []
          : [{ label: "Detener servicio", onClick: requestContainerStop }]),
        { label: "Reiniciar", onClick: requestContainerRestart },
      ];
    },
  );
  updateResourceCount("#container-count", containers.length, resourceData.containers.length);

  const serviceQuery = document.querySelector("#service-search").value.trim().toLocaleLowerCase("es-MX");
  const serviceFilter = document.querySelector("#service-filter").value;
  const services = resourceData.services.filter((service) => (
    (serviceFilter === "all" || service.mode === serviceFilter)
      && matchesSearch(
        [service.displayName, service.name, service.image, service.id, service.mode, service.replicas],
        serviceQuery,
      )
  ));
  const serviceHasFilters = Boolean(serviceQuery) || serviceFilter !== "all";
  renderResources(
    document.querySelector("#services"),
    services,
    (item) => `${item.image} · ${item.mode}`,
    (item) => item.replicas,
    (service) => showResourceLogs(service, "services"),
    services.length === 0 && serviceHasFilters ? "No hay servicios que coincidan con los filtros." : "No hay servicios Swarm.",
    (service) => service.managed
      ? [
        { label: "Reiniciar", onClick: requestServiceRestart },
        ...(service.mode === "replicado" && service.component !== "api" && service.component !== "gitea"
          ? [{ label: "Escalar", onClick: requestServiceScale }]
          : []),
      ]
      : undefined,
  );
  updateResourceCount("#service-count", services.length, resourceData.services.length);

  const stackQuery = document.querySelector("#stack-search").value.trim().toLocaleLowerCase("es-MX");
  const stackFilter = document.querySelector("#stack-filter").value;
  const stacks = resourceData.stacks.filter((stack) => {
    const matchesSize = stackFilter === "all"
      || (stackFilter === "single" ? stack.serviceCount === 1 : stack.serviceCount > 1);
    const serviceValues = stack.services.flatMap((service) => [service.name, service.image, service.mode]);
    return matchesSize && matchesSearch([stack.name, ...serviceValues], stackQuery);
  });
  const stackHasFilters = Boolean(stackQuery) || stackFilter !== "all";
  renderStacks(stacks, stacks.length === 0 && stackHasFilters ? "No hay stacks que coincidan con los filtros." : "No hay stacks desplegados.");
  updateResourceCount("#stack-count", stacks.length, resourceData.stacks.length);
}

function scheduleServiceOperationPoll() {
  if (serviceOperationPollTimer !== undefined
    || !serviceOperationPending
    || dashboardView.classList.contains("hidden")) return;
  serviceOperationPollTimer = setTimeout(() => {
    serviceOperationPollTimer = undefined;
    void loadServiceOperationStatus();
  }, 3000);
}

async function loadServiceOperationStatus() {
  try {
    const { operation } = await request("/api/system/service-operations");
    const previousPending = serviceOperationPending;
    serviceOperationPending = operation?.state === "queued" || operation?.state === "running";
    if (operation) {
      serviceOperationStatus.textContent = operation.message;
    } else {
      serviceOperationStatus.textContent = "Los controles solo operan servicios administrados; Swarm repone automáticamente las tareas detenidas.";
    }
    if (serviceOperationPending) {
      scheduleServiceOperationPoll();
    } else if (serviceOperationPollTimer !== undefined) {
      clearTimeout(serviceOperationPollTimer);
      serviceOperationPollTimer = undefined;
    }
    if (previousPending && !serviceOperationPending) {
      const [containersResult, servicesResult] = await Promise.all([
        request("/api/docker/containers"),
        request("/api/docker/services"),
      ]);
      resourceData.containers = containersResult.containers;
      resourceData.services = servicesResult.services;
      renderFilteredResources();
      await loadTaskHistory();
    }
  } catch (error) {
    serviceOperationStatus.textContent = error.message;
    if (serviceOperationPending) scheduleServiceOperationPoll();
  }
}

async function loadTaskHistory() {
  const refreshTasksButton = document.querySelector("#refresh-tasks");
  refreshTasksButton.disabled = true;
  tasksStatus.textContent = "Consultando tareas guardadas…";
  try {
    const result = await request("/api/system/tasks");
    tasksList.replaceChildren();
    const statusLabels = {
      pending: "En cola",
      in_progress: "En curso",
      completed: "Completada",
      failed: "Fallida",
    };
    for (const task of result.tasks) {
      const row = document.createElement("div");
      row.className = "resource task-row";
      const main = document.createElement("div");
      main.className = "resource-main";
      const title = document.createElement("div");
      title.className = "resource-name";
      title.textContent = task.type === "application.gitea.install"
        ? "Instalación de Gitea"
        : task.type === "application.custom.deploy"
          ? `Despliegue de ${task.applicationName}`
        : task.type === "application.n8n.install"
          ? "Instalación de n8n"
          : task.type === "application.postgresql.install"
            ? "Instalación de PostgreSQL"
        : task.type === "swarm.node.enroll"
          ? `Alta del nodo ${task.nodeAddress} · ${task.nodeRole}`
        : task.type === "registry.configure"
          ? `Configuración del registro · ${task.domain}`
        : task.type === "project.build"
          ? `Construcción de ${task.projectName} · ${task.branch}`
        : task.type === "project.deploy"
          ? `Despliegue de ${task.projectName} · ${task.commitSha?.slice(0, 12) ?? ""}`
          : task.type === "project.push-deploy"
            ? `Despliegue automático de ${task.projectName} · ${task.commitSha?.slice(0, 12) ?? ""}`
          : task.type === "project.undeploy"
            ? `Retiro del servicio de ${task.projectName}`
        : task.type === "service.restart"
        ? `Reinicio de ${task.serviceName}`
        : task.type === "service.scale"
          ? `Escalado de ${task.serviceName}`
        : `Tarea: ${task.type}`;
      const details = document.createElement("div");
      details.className = "resource-detail task-detail";
      const createdAt = new Date(task.createdAt).toLocaleString("es-MX");
      const finishedAt = task.completedAt
        ? ` · finalizada ${new Date(task.completedAt).toLocaleString("es-MX")}`
        : "";
      const currentStatus = task.status === "pending" && task.attempts > 0
        ? "Reintentando"
        : statusLabels[task.status] ?? "Estado desconocido";
      const attempts = task.attempts > 0 ? ` · intento ${task.attempts}/${task.maxAttempts}` : "";
      const scaleChange = task.type === "service.scale"
        ? ` · ${task.originalReplicas} → ${task.desiredReplicas} réplicas`
        : "";
      details.textContent = `${currentStatus} · ${createdAt}${scaleChange}${attempts}${finishedAt}`;
      main.append(title, details);
      row.append(main);
      if (task.error || task.result?.message) {
        const message = document.createElement("div");
        message.className = `task-result${task.status === "failed" ? " status-error" : ""}`;
        message.textContent = task.error
          ?? `${task.result.message}${task.result.image ? ` · ${task.result.image}` : ""}`;
        row.append(message);
      }
      tasksList.append(row);
    }
    tasksStatus.textContent = `${result.tasks.length} tarea(s) recientes · el historial se conserva en PostgreSQL.`;
  } catch (error) {
    tasksList.replaceChildren();
    tasksStatus.textContent = error.message;
  } finally {
    refreshTasksButton.disabled = false;
  }
}

async function requestServiceRestart(service) {
  if (!window.confirm(`¿Reiniciar el servicio ${service.name}? Se interrumpirán brevemente sus tareas activas. Solo se permiten servicios administrados por VPS Manager.`)) {
    return;
  }
  serviceOperationPending = true;
  serviceOperationStatus.textContent = `Solicitando el reinicio de ${service.name}…`;
  renderFilteredResources();
  try {
    const result = await request(`/api/docker/services/${encodeURIComponent(service.id)}/restart`, {
      method: "POST",
    });
    serviceOperationStatus.textContent = `${result.serviceName}: reinicio en cola.`;
    await loadTaskHistory();
    scheduleServiceOperationPoll();
  } catch (error) {
    serviceOperationPending = false;
    serviceOperationStatus.textContent = error.message;
    renderFilteredResources();
    await loadServiceOperationStatus();
  }
}

async function requestContainerOperation(container, action) {
  const actionLabel = action === "stop" ? "detener" : "reiniciar";
  const confirmation = action === "stop"
    ? `¿Detener temporalmente ${container.name}? Swarm creará automáticamente una tarea de reemplazo.`
    : `¿Reiniciar ${container.name}? Swarm mantendrá el servicio en su estado deseado.`;
  if (!window.confirm(confirmation)) return;

  serviceOperationPending = true;
  serviceOperationStatus.textContent = `Solicitando ${actionLabel} ${container.name}…`;
  renderFilteredResources();
  try {
    const result = await request(`/api/docker/containers/${encodeURIComponent(container.id)}/${action}`, {
      method: "POST",
    });
    serviceOperationStatus.textContent = result.operation.message;
    await loadTaskHistory();
    scheduleServiceOperationPoll();
  } catch (error) {
    serviceOperationPending = false;
    serviceOperationStatus.textContent = error.message;
    renderFilteredResources();
    await loadServiceOperationStatus();
  }
}

function requestContainerStop(container) {
  return requestContainerOperation(container, "stop");
}

function requestContainerRestart(container) {
  return requestContainerOperation(container, "restart");
}

async function requestServiceScale(service) {
  const requestedReplicas = window.prompt(
    `Réplicas deseadas para ${service.name} (1-100). Actualmente: ${service.desiredReplicas}. Swarm puede dejar tareas pendientes si no hay recursos suficientes.`,
    String(service.desiredReplicas),
  );
  if (requestedReplicas === null) return;
  const replicas = Number(requestedReplicas);
  if (!Number.isInteger(replicas) || replicas < 1 || replicas > 100) {
    serviceOperationStatus.textContent = "Indica un número entero de réplicas entre 1 y 100.";
    return;
  }
  if (replicas === service.desiredReplicas) {
    serviceOperationStatus.textContent = "El servicio ya tiene ese número de réplicas deseadas.";
    return;
  }
  if (!window.confirm(`¿Cambiar ${service.name} de ${service.desiredReplicas} a ${replicas} réplicas? Swarm programará las tareas según los recursos disponibles.`)) {
    return;
  }
  serviceOperationPending = true;
  serviceOperationStatus.textContent = `Solicitando escalar ${service.name} a ${replicas} réplicas…`;
  renderFilteredResources();
  try {
    const result = await request(`/api/docker/services/${encodeURIComponent(service.id)}/scale`, {
      method: "POST",
      body: JSON.stringify({ replicas }),
    });
    serviceOperationStatus.textContent = result.operation.message;
    await loadTaskHistory();
    scheduleServiceOperationPoll();
  } catch (error) {
    serviceOperationPending = false;
    serviceOperationStatus.textContent = error.message;
    renderFilteredResources();
    await loadServiceOperationStatus();
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MiB`;
}

function addSvgElement(svg, name, attributes, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  svg.append(element);
  return element;
}

function renderHistoryChart(svg, samples, metric, maximum) {
  const width = 640;
  const left = 44;
  const right = 628;
  const top = 12;
  const bottom = 158;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const timestamps = samples.map((sample) => Date.parse(sample.sampledAt));
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const groups = new Map();
  for (const sample of samples) {
    const points = groups.get(sample.group) ?? [];
    points.push(sample);
    groups.set(sample.group, points);
  }

  svg.replaceChildren();
  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = top + ratio * plotHeight;
    addSvgElement(svg, "line", {
      x1: left, y1: y, x2: right, y2: y, class: "history-grid-line",
    });
    const value = maximum * (1 - ratio);
    addSvgElement(svg, "text", {
      x: left - 6, y: y + 3, "text-anchor": "end", class: "history-axis-label",
    }, metric === "cpuPercent" ? `${value.toFixed(0)}%` : `${value.toFixed(2)}`);
  }

  const formatTime = (time) => new Date(time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  addSvgElement(svg, "text", {
    x: left, y: 180, "text-anchor": "start", class: "history-axis-label",
  }, formatTime(minTime));
  addSvgElement(svg, "text", {
    x: right, y: 180, "text-anchor": "end", class: "history-axis-label",
  }, formatTime(maxTime));

  [...groups.entries()].sort(([leftGroup], [rightGroup]) => leftGroup.localeCompare(rightGroup))
    .forEach(([group, points], groupIndex) => {
      const color = historyColors[groupIndex % historyColors.length];
      const coordinates = points.map((point) => {
        const time = Date.parse(point.sampledAt);
        const x = maxTime === minTime ? left + plotWidth / 2 : left + ((time - minTime) / (maxTime - minTime)) * plotWidth;
        const value = metric === "memoryUsageBytes" ? point[metric] / 1024 ** 3 : point[metric];
        const y = bottom - (Math.min(value, maximum) / maximum) * plotHeight;
        return { x, y };
      });
      if (coordinates.length === 1) {
        addSvgElement(svg, "circle", {
          cx: coordinates[0].x,
          cy: coordinates[0].y,
          r: 4,
          fill: color,
          class: "history-point",
        });
      } else {
        const series = addSvgElement(svg, "polyline", {
          points: coordinates.map(({ x, y }) => `${x},${y}`).join(" "),
          stroke: color,
          class: "history-series",
        });
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = group;
        series.append(title);
      }
    });
}

function renderMetricsHistory(samples) {
  historyLegend.replaceChildren();
  if (samples.length === 0) {
    historyCharts.classList.add("hidden");
    historyEmpty.classList.remove("hidden");
    return;
  }

  historyEmpty.classList.add("hidden");
  historyCharts.classList.remove("hidden");
  const groups = [...new Set(samples.map((sample) => sample.group))].sort((left, right) => left.localeCompare(right));
  groups.forEach((group, index) => {
    const item = document.createElement("span");
    item.className = "history-legend-item";
    const swatch = document.createElement("span");
    swatch.className = "history-legend-swatch";
    swatch.style.backgroundColor = historyColors[index % historyColors.length];
    const label = document.createElement("span");
    label.textContent = group;
    item.append(swatch, label);
    historyLegend.append(item);
  });

  const cpuMaximum = Math.max(100, Math.ceil(Math.max(...samples.map((sample) => sample.cpuPercent)) / 100) * 100);
  const maxMemoryGiB = Math.max(...samples.map((sample) => sample.memoryUsageBytes / 1024 ** 3));
  const memoryMaximum = Math.max(0.25, Math.ceil(maxMemoryGiB * 4) / 4);
  renderHistoryChart(document.querySelector("#cpu-history-chart"), samples, "cpuPercent", cpuMaximum);
  renderHistoryChart(document.querySelector("#memory-history-chart"), samples, "memoryUsageBytes", memoryMaximum);
}

async function loadMetricsSettings() {
  try {
    const settings = await request("/api/system/metrics-settings");
    metricsIntervalInput.value = String(settings.intervalMinutes);
    metricsCpuThresholdInput.value = String(settings.cpuPercent);
    metricsMemoryThresholdInput.value = String(settings.memoryPercent);
    metricsDiskThresholdInput.value = String(settings.diskFreePercent);
    metricsRestartCountInput.value = String(settings.restartCount);
    metricsRestartWindowInput.value = String(settings.restartWindowMinutes);
    metricsHttpTimeoutInput.value = String(settings.httpTimeoutSeconds);
    metricsCertificateDaysInput.value = String(settings.certificateWarningDays);
    metricsSettingsStatus.textContent = `Retención: ${settings.retentionDays} días. CPU/RAM: ${settings.consecutiveSamples} muestras consecutivas.`;
  } catch (error) {
    metricsSettingsStatus.textContent = error.message;
  }
}

function renderBackups(backups) {
  backupsList.replaceChildren();
  if (backups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Aún no hay respaldos.";
    backupsList.append(empty);
    return;
  }
  for (const backup of backups) {
    const row = document.createElement("div");
    row.className = "resource";
    const main = document.createElement("div");
    main.className = "resource-main";
    const name = document.createElement("div");
    name.className = "resource-name";
    name.textContent = new Date(backup.createdAt).toLocaleString("es-MX");
    const detail = document.createElement("div");
    detail.className = "resource-detail";
    detail.textContent = `${backup.id} · ${formatBytes(backup.sizeBytes)} · cifrado`;
    main.append(name, detail);
    const restoreButton = document.createElement("button");
    restoreButton.className = "button secondary resource-action";
    restoreButton.type = "button";
    restoreButton.textContent = "Restaurar";
    restoreButton.addEventListener("click", () => {
      selectedBackupId = backup.id;
      restoreConfirmationInput.value = "";
      restoreStatus.textContent = "";
      restoreDialog.showModal();
      restoreConfirmationInput.focus();
    });
    row.append(main, restoreButton);
    backupsList.append(row);
  }
}

async function loadBackups() {
  try {
    const [result, settings] = await Promise.all([
      request("/api/system/backups"),
      request("/api/system/backup-settings"),
    ]);
    renderBackups(result.backups);
    backupIntervalInput.value = String(settings.intervalHours);
    backupSettingsStatus.textContent = `Ejecución automática · retención: ${result.retentionDays} días.`;
    backupsStatus.textContent = `${result.backups.length} respaldo(s) cifrado(s).`;
  } catch (error) {
    backupsList.replaceChildren();
    backupsStatus.textContent = error.message;
  }
}

async function loadAuditLog() {
  try {
    const result = await request("/api/system/audit-log");
    auditList.replaceChildren();
    if (result.events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Aún no hay operaciones registradas.";
      auditList.append(empty);
    } else {
      const actionLabels = {
        "backup.created": "Respaldo creado",
        "backup.restored": "Respaldo restaurado",
        "backup.schedule.updated": "Intervalo de respaldos actualizado",
        "metrics.sampling_interval.updated": "Intervalo de muestreo actualizado",
        "metrics.alert_thresholds.updated": "Umbrales de alertas actualizados",
      };
      for (const event of result.events) {
        const row = document.createElement("div");
        row.className = "resource";
        const main = document.createElement("div");
        main.className = "resource-main";
        const name = document.createElement("div");
        name.className = "resource-name";
        name.textContent = actionLabels[event.action] ?? event.action;
        const detail = document.createElement("div");
        detail.className = "resource-detail";
        const timestamp = new Date(event.createdAt).toLocaleString("es-MX");
        const metadata = Object.entries(event.details ?? {})
          .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
          .join(" · ");
        detail.textContent = [
          timestamp,
          event.actor,
          event.resourceId,
          metadata,
        ].filter(Boolean).join(" · ");
        main.append(name, detail);
        row.append(main);
        auditList.append(row);
      }
    }
    auditStatus.textContent = `${result.events.length} evento(s) · se muestran como máximo 100.`;
  } catch (error) {
    auditList.replaceChildren();
    auditStatus.textContent = error.message;
  }
}

async function checkForUpdates() {
  const checkButton = document.querySelector("#check-updates");
  checkButton.disabled = true;
  updatesAction.classList.add("hidden");
  updatesReleaseNotes.textContent = "";
  updatesStatus.textContent = "Consultando releases de GitHub…";
  try {
    const result = await request("/api/system/updates");
    if (!result.configured) {
      updatesStatus.textContent = `Versión instalada: ${result.currentVersion}. Configura VPS_MANAGER_GITHUB_REPOSITORY=owner/repo para consultar releases.`;
      return;
    }
    if (result.releaseUnavailable) {
      updatesStatus.textContent = `Versión instalada: ${result.currentVersion}. El repositorio configurado aún no tiene releases publicadas.`;
      return;
    }
    if (!result.updateAvailable) {
      updatesStatus.textContent = `VPS Manager está actualizado · versión ${result.currentVersion}.`;
      return;
    }
    updatesStatus.textContent = result.updateReady
      ? `Nueva versión disponible: ${result.latestVersion} (instalada: ${result.currentVersion}).`
      : `La versión ${result.latestVersion} está publicada, pero no tiene un archivo de actualización con digest SHA-256 válido.`;
    if (result.releaseUrl) {
      const releaseLink = document.createElement("a");
      releaseLink.href = result.releaseUrl;
      releaseLink.target = "_blank";
      releaseLink.rel = "noopener noreferrer";
      releaseLink.textContent = "Ver release en GitHub";
      releaseLink.className = "update-release-link";
      updatesStatus.append(" ", releaseLink);
    }
    updatesReleaseNotes.textContent = result.releaseNotes;
    if (result.updateReady && result.command) {
      updateCommand.textContent = result.command;
      updatesAction.classList.remove("hidden");
    }
  } catch (error) {
    updatesStatus.textContent = error.message;
  } finally {
    checkButton.disabled = false;
    await loadWebUpdateStatus();
  }
}

function scheduleWebUpdatePoll() {
  if (webUpdatePollTimer !== undefined || !webUpdatePending || dashboardView.classList.contains("hidden")) return;
  webUpdatePollTimer = setTimeout(() => {
    webUpdatePollTimer = undefined;
    void loadWebUpdateStatus();
  }, 4000);
}

async function loadWebUpdateStatus() {
  try {
    const { update } = await request("/api/system/web-update");
    const previousState = lastWebUpdateState;
    lastWebUpdateState = update?.state;
    webUpdatePending = update?.state === "queued" || update?.state === "running";
    webUpdateButton.disabled = webUpdatePending;
    if (!update) {
      webUpdateStatus.textContent = "No hay una actualización web en curso.";
    } else {
      webUpdateStatus.textContent = update.message;
    }
    if (webUpdatePending) {
      scheduleWebUpdatePoll();
    } else if (webUpdatePollTimer !== undefined) {
      clearTimeout(webUpdatePollTimer);
      webUpdatePollTimer = undefined;
    }
    if (update?.state === "succeeded" && previousState !== "succeeded") {
      updatesStatus.textContent = "Actualización completada; verificando la versión instalada…";
      void checkForUpdates();
    }
  } catch (error) {
    webUpdateStatus.textContent = error.message;
    if (webUpdatePending) scheduleWebUpdatePoll();
    else webUpdateButton.disabled = false;
  }
}

async function startWebUpdate() {
  if (!window.confirm("Se descargará e instalará la release estable verificada más reciente. El panel puede reiniciarse durante la actualización. ¿Continuar?")) {
    return;
  }
  webUpdateButton.disabled = true;
  webUpdateStatus.textContent = "Validando la release y enviando la solicitud al servicio host…";
  try {
    const result = await request("/api/system/web-update", { method: "POST" });
    webUpdatePending = true;
    lastWebUpdateState = result.update.state;
    webUpdateStatus.textContent = `${result.update.message} Versión objetivo: ${result.latestVersion}.`;
    scheduleWebUpdatePoll();
  } catch (error) {
    webUpdateStatus.textContent = error.message;
    webUpdateButton.disabled = false;
    await loadWebUpdateStatus();
  }
}

async function loadMetricAlerts() {
  try {
    const result = await request("/api/system/metric-alerts");
    const signature = JSON.stringify(result.alerts);
    if (signature !== metricAlertsSignature) {
      metricAlertsSignature = signature;
      metricAlertsList.replaceChildren();
      for (const alert of result.alerts) {
        const item = document.createElement("li");
        if (alert.metric === "cpu" || alert.metric === "memory") {
          const metricLabel = alert.metric === "cpu" ? "CPU" : "RAM";
          const sampledAt = new Date(alert.sampledAt).toLocaleString("es-MX");
          item.textContent = `${metricLabel} · ${alert.containerName} · ${alert.group}: ${alert.valuePercent.toFixed(1)}% (umbral ${alert.thresholdPercent}%) · ${sampledAt}`;
        } else if (alert.metric === "disk") {
          item.textContent = `Disco · ${alert.freePercent.toFixed(1)}% libre (umbral ≤ ${alert.thresholdPercent}%)`;
        } else if (alert.metric === "service") {
          item.textContent = `Servicio · ${alert.serviceName} · ${alert.group}: ${alert.runningTasks}/${alert.desiredTasks} tareas activas`;
        } else if (alert.metric === "restarts") {
          item.textContent = `Reinicios · ${alert.containerName} · ${alert.group}: ${alert.restartCount} en ${alert.windowMinutes} min (umbral ${alert.thresholdCount})`;
        } else if (alert.metric === "http") {
          const detail = alert.statusCode
            ? `HTTP ${alert.statusCode}`
            : alert.reason === "timeout" ? "timeout" : "sin conexión";
          item.textContent = `HTTP · ${alert.serviceName} · ${alert.url}: ${detail}`;
        } else if (alert.metric === "deployment") {
          const details = alert.reasons
            .map(({ reason, message }) => `${reason}${message ? `: ${message}` : ""}`)
            .join(" · ");
          item.textContent = `Despliegue · ${alert.serviceName} · ${alert.group}: ${details}`;
        } else {
          const detail = alert.daysRemaining === undefined
            ? alert.reason === "timeout" ? "timeout consultando certificado" : "certificado no disponible"
            : alert.daysRemaining < 0
              ? `vencido hace ${Math.abs(alert.daysRemaining)} días`
              : `vence en ${alert.daysRemaining} días`;
          item.textContent = `TLS · ${alert.serviceName} · ${alert.hostname}: ${detail}`;
        }
        metricAlertsList.append(item);
      }
    }
    metricAlertsStatus.textContent = result.alerts.length
      ? `${result.alerts.length} alerta(s) activa(s) · CPU/RAM requieren ${result.consecutiveSamples} muestras consecutivas`
      : `Sin alertas activas · CPU/RAM requieren ${result.consecutiveSamples} muestras consecutivas`;
  } catch (error) {
    metricAlertsSignature = "";
    metricAlertsList.replaceChildren();
    metricAlertsStatus.textContent = error.message;
  }
}

async function loadMetricsHistory() {
  historyStatus.textContent = "Cargando histórico…";
  try {
    const result = await request("/api/system/metrics-history");
    renderMetricsHistory(result.samples);
    historyStatus.textContent = result.samples.length
      ? `${result.samples.length} puntos agrupados · últimas ${result.hours} horas · retención ${result.retentionDays} días`
      : `Sin muestras todavía · retención ${result.retentionDays} días`;
  } catch (error) {
    historyCharts.classList.add("hidden");
    historyLegend.replaceChildren();
    historyEmpty.classList.add("hidden");
    historyStatus.textContent = error.message;
  }
}

async function loadContainerMetrics() {
  if (metricsLoading) return;
  metricsLoading = true;
  refreshMetricsButton.disabled = true;
  metricsStatus.textContent = "Consultando CPU y memoria…";
  try {
    const result = await request("/api/docker/container-metrics");
    containerMetrics.clear();
    for (const metrics of result.metrics) {
      containerMetrics.set(metrics.id, metrics);
    }
    containerMetricsHost = result.host;
    containerMetricsUnavailable = result.unavailable;
    runningContainerCount = result.runningContainerCount;
    metricsLoaded = true;
    metricsLoadError = "";
    renderMetricsGroups();
    renderFilteredResources();
    const unavailableCount = result.unavailable.length;
    const updatedAt = new Date().toLocaleTimeString("es-MX");
    metricsStatus.textContent = unavailableCount
      ? `Muestra puntual · CPU agregada (puede superar 100%) · ${unavailableCount} sin métricas · ${updatedAt}`
      : `Muestra puntual actualizada · CPU agregada (puede superar 100%) · ${updatedAt}`;
    await Promise.all([loadMetricsHistory(), loadMetricAlerts()]);
  } catch (error) {
    metricsLoadError = error.message;
    metricsLoaded = false;
    containerMetrics.clear();
    containerMetricsHost = null;
    containerMetricsUnavailable = [];
    runningContainerCount = 0;
    renderMetricsGroups();
    metricsStatus.textContent = error.message;
  } finally {
    metricsLoading = false;
    refreshMetricsButton.disabled = false;
  }
}

function scheduleBuilderCachePrunePoll() {
  if (builderCachePrunePollTimer !== undefined
    || !builderCachePrunePending
    || dashboardView.classList.contains("hidden")) return;
  builderCachePrunePollTimer = setTimeout(() => {
    builderCachePrunePollTimer = undefined;
    void loadBuilderCachePruneStatus(builderCachePruneOperationId);
  }, 2000);
}

async function loadBuilderCachePruneStatus(operationId) {
  try {
    const query = operationId ? `?id=${encodeURIComponent(operationId)}` : "";
    const { operation } = await request(`/api/system/builder-cache-prune${query}`);
    if (!operation) {
      if (builderCachePrunePending) {
        builderCacheStatus.dataset.state = "queued";
        builderCacheStatus.textContent = "Solicitud recibida; esperando al agente del VPS…";
        scheduleBuilderCachePrunePoll();
      } else {
        delete builderCacheStatus.dataset.state;
        builderCacheStatus.textContent = "Aún no se ha solicitado una limpieza.";
      }
      return;
    }

    builderCachePruneOperationId = operation.id;
    builderCacheStatus.dataset.state = operation.state;
    builderCacheStatus.textContent = operation.message;
    builderCachePrunePending = operation.state === "queued" || operation.state === "running";
    pruneBuilderCacheButton.disabled = builderCachePrunePending;
    if (builderCachePrunePending) {
      scheduleBuilderCachePrunePoll();
    } else if (builderCachePrunePollTimer !== undefined) {
      clearTimeout(builderCachePrunePollTimer);
      builderCachePrunePollTimer = undefined;
    }
  } catch (error) {
    builderCacheStatus.dataset.state = "failed";
    builderCacheStatus.textContent = error.message;
    if (builderCachePrunePending) scheduleBuilderCachePrunePoll();
    else pruneBuilderCacheButton.disabled = false;
  }
}

async function startBuilderCachePrune() {
  if (builderCachePrunePending) return;
  pruneBuilderCacheButton.disabled = true;
  builderCacheStatus.dataset.state = "queued";
  builderCacheStatus.textContent = "Enviando la solicitud de limpieza…";
  try {
    const { operation } = await request("/api/system/builder-cache-prune", { method: "POST" });
    builderCachePruneOperationId = operation.id;
    builderCachePrunePending = true;
    builderCacheStatus.dataset.state = operation.state;
    builderCacheStatus.textContent = operation.message;
    scheduleBuilderCachePrunePoll();
  } catch (error) {
    builderCachePrunePending = false;
    builderCacheStatus.dataset.state = "failed";
    builderCacheStatus.textContent = error.message;
    pruneBuilderCacheButton.disabled = false;
  }
}

async function loadDiagnostics() {
  refreshDiagnosticsButton.disabled = true;
  diagnosticsStatus.textContent = "Ejecutando comprobaciones…";
  try {
    const result = await request("/api/system/diagnostics");
    diagnosticsList.replaceChildren();
    const statusLabels = {
      ok: "Correcto",
      warning: "Atención",
      error: "Error",
    };
    for (const check of result.checks) {
      const item = document.createElement("div");
      item.className = "diagnostic-check";
      const title = document.createElement("span");
      title.className = "diagnostic-check-title";
      title.textContent = check.title;
      const state = document.createElement("span");
      state.className = `diagnostic-check-state status-${check.status}`;
      state.textContent = statusLabels[check.status] ?? "Desconocido";
      const detail = document.createElement("span");
      detail.className = "diagnostic-check-detail";
      detail.textContent = check.detail;
      item.append(title, state, detail);
      diagnosticsList.append(item);
    }
    const overallLabels = {
      ok: "Sin problemas detectados",
      warning: "Revisa las comprobaciones con advertencias",
      error: "Se detectaron problemas que requieren atención",
    };
    const generatedAt = new Date(result.generatedAt).toLocaleString("es-MX");
    diagnosticsStatus.textContent = `${overallLabels[result.status] ?? "Resultado desconocido"} · ${generatedAt}`;
  } catch (error) {
    diagnosticsList.replaceChildren();
    diagnosticsStatus.textContent = error.message;
  } finally {
    refreshDiagnosticsButton.disabled = false;
  }
}

function scheduleGiteaStatusPoll() {
  if (giteaStatusPollTimer !== undefined || dashboardView.classList.contains("hidden")) return;
  giteaStatusPollTimer = setTimeout(() => {
    giteaStatusPollTimer = undefined;
    void loadGiteaApplication();
  }, 3000);
}

async function loadGiteaApplication() {
  try {
    const { application } = await request("/api/system/applications/gitea");
    giteaLocalOnly = application.localOnly;
    giteaNeedsLocalUpgrade = application.needsLocalUpgrade;
    giteaNeedsDomainMigration = application.needsDomainMigration;
    installGiteaButton.classList.toggle("hidden", !application.available);
    installGiteaButton.textContent = application.needsLocalUpgrade
      ? "Actualizar acceso local de Gitea"
      : application.needsDomainMigration
        ? "Migrar Gitea a HTTPS"
        : "Instalar Gitea";
    installGiteaButton.disabled = application.installing;
    restartGiteaButton.classList.toggle("hidden", !application.installed);
    restartGiteaButton.disabled = serviceOperationPending;
    revealGiteaCredentialsButton.classList.toggle("hidden", !application.credentialsAvailable);
    giteaTokenForm.classList.toggle("hidden", !application.installed || !application.privateApiReady);
    giteaApiTokenStatus.classList.toggle("hidden", !application.installed || !application.privateApiReady);
    const canUseGiteaApi = application.installed && application.privateApiReady && application.apiTokenConfigured;
    giteaRepositoryForm.classList.toggle("hidden", !canUseGiteaApi);
    giteaBranchManagement.classList.toggle("hidden", !canUseGiteaApi);
    giteaContainerStatus.textContent = application.installed
      ? `Servicio Swarm ${application.serviceState ?? "activo"} · ${application.replicas ?? 1} réplica${application.replicas === 1 ? "" : "s"} · ${application.needsLocalUpgrade ? "actualización local pendiente" : application.needsDomainMigration ? "migración HTTPS pendiente" : application.localOnly ? "API privada y acceso web por túnel SSH" : "acceso HTTPS"}`
      : "";
    if (application.apiTokenConfigured && !giteaRepositoriesLoaded && !giteaRepositoriesLoading) {
      void loadGiteaRepositories();
    }
    if (application.apiTokenConfigured) {
      giteaApiTokenStatus.textContent = "Token de Gitea configurado como secreto Swarm.";
      giteaTokenConfigurationPending = false;
    } else {
      giteaApiTokenStatus.textContent = application.tokenOperation?.message
        ?? (giteaTokenConfigurationPending ? "Esperando que el agente del VPS actualice el secreto…" : "");
      if (application.tokenOperation?.state === "failed") giteaTokenConfigurationPending = false;
    }
    giteaStatus.textContent = application.needsLocalUpgrade
      ? "Actualiza el servicio Gitea existente para habilitar la API privada y la administración de proyectos. Se conservarán repositorios, usuarios y credenciales."
      : application.needsDomainMigration
        ? application.installing
          ? "Migración de Gitea a HTTPS en curso. El volumen persistente y las credenciales existentes se conservarán."
          : application.latestTask?.status === "failed"
            ? application.latestTask.message
            : `Migra Gitea a https://${application.domain}/. Se conservarán el volumen, los repositorios, los usuarios y sus credenciales. Configura el DNS de ${application.domain} hacia este VPS antes de continuar.`
        : application.latestTask?.message
          ?? (application.installed
            ? application.localOnly
              ? "Gitea se sirve en http://localhost:3001/gitea/. Desde tu equipo, abre el túnel SSH indicado abajo y visita esa dirección."
              : "Gitea está instalado."
            : application.nameConflict
              ? "El nombre del servicio de Gitea está ocupado por un servicio ajeno a VPS Manager."
              : application.domain
                ? `Listo para instalar en ${application.domain}. Confirma que el DNS apunte al VPS y que TCP 80/443 estén disponibles.`
                : application.localOnly
                  ? "Modo local: instala Gitea sin dominio. La interfaz solo acepta conexiones loopback; el panel se conecta a su API por la red privada de Swarm."
                  : "Conecta un dominio público con HTTPS para instalar Gitea.");
    if (application.url && application.installed) {
      giteaUrl.href = application.url;
      giteaUrl.classList.remove("hidden");
      giteaSsh.textContent = application.localOnly
        ? "Acceso por túnel: ssh -L 3001:127.0.0.1:80 usuario@IP_DEL_VPS"
        : `Git SSH: puerto ${application.sshPort}`;
      giteaSsh.classList.remove("hidden");
    } else {
      giteaUrl.classList.add("hidden");
      giteaSsh.classList.add("hidden");
    }
    if (application.installing
      || (giteaTokenConfigurationPending && !application.apiTokenConfigured
        && application.tokenOperation?.state !== "failed")) scheduleGiteaStatusPoll();
    else if (giteaStatusPollTimer !== undefined) {
      clearTimeout(giteaStatusPollTimer);
      giteaStatusPollTimer = undefined;
    }
  } catch (error) {
    giteaStatus.textContent = error.message;
    if (giteaTokenConfigurationPending) {
      giteaApiTokenStatus.textContent = "El panel puede estar reiniciándose para montar el secreto. Se volverá a consultar automáticamente.";
      scheduleGiteaStatusPoll();
    } else if (giteaStatusPollTimer !== undefined) {
      clearTimeout(giteaStatusPollTimer);
      giteaStatusPollTimer = undefined;
    }
  }
}

function updateGiteaDefaultBranchAction() {
  const repository = giteaRepositories.get(giteaBranchRepository.value);
  giteaDefaultBranchSubmit.disabled = !repository?.canAdmin
    || !giteaDefaultBranchSelect.value
    || giteaDefaultBranchSelect.value === giteaCurrentDefaultBranch;
  giteaWebhookConfigure.disabled = !repository?.canAdmin;
  if (!repository?.canAdmin) {
    giteaWebhookStatus.textContent = repository
      ? "El token no puede administrar webhooks de este repositorio."
      : "";
  }
}

async function loadGiteaRepositories(force = false, preferredRepository = giteaBranchRepository.value) {
  if ((!force && giteaRepositoriesLoaded) || giteaRepositoriesLoading) return;
  giteaRepositoriesLoading = true;
  giteaBranchRefresh.disabled = true;
  giteaBranchStatus.textContent = "Consultando repositorios de Gitea…";
  try {
    const { repositories } = await request("/api/system/applications/gitea/repositories");
    giteaRepositories = new Map(repositories.map((repository) => [repository.fullName, repository]));
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = repositories.length ? "Selecciona un repositorio" : "No hay repositorios disponibles";
    giteaBranchRepository.replaceChildren(placeholder);
    for (const repository of repositories) {
      const option = document.createElement("option");
      option.value = repository.fullName;
      const defaultLabel = repository.defaultBranch || "sin rama predeterminada";
      option.textContent = `${repository.fullName} · ${defaultLabel}${repository.canAdmin ? "" : " · solo lectura"}`;
      giteaBranchRepository.append(option);
    }
    const projectRepository = projectRepositorySelect.value;
    projectRepositorySelect.replaceChildren(new Option(
      repositories.length ? "Selecciona un repositorio" : "No hay repositorios disponibles",
      "",
    ));
    for (const repository of repositories) {
      projectRepositorySelect.add(new Option(repository.fullName, repository.fullName));
    }
    projectRepositorySelect.value = giteaRepositories.has(projectRepository) ? projectRepository : "";
    const selected = giteaRepositories.has(preferredRepository) ? preferredRepository : "";
    giteaBranchRepository.value = selected;
    giteaRepositoriesLoaded = true;
    if (selected) await loadGiteaBranches();
    else {
      giteaDefaultBranchSelect.replaceChildren(new Option("Selecciona un repositorio", ""));
      giteaDefaultBranchSelect.disabled = true;
      giteaBranchStatus.textContent = repositories.length
        ? "Selecciona un repositorio para consultar sus ramas."
        : "La cuenta conectada todavía no tiene repositorios.";
      updateGiteaDefaultBranchAction();
    }
  } catch (error) {
    giteaBranchStatus.textContent = error.message;
    giteaRepositoriesLoaded = false;
  } finally {
    giteaRepositoriesLoading = false;
    giteaBranchRefresh.disabled = false;
  }
}

async function loadGiteaBranches() {
  const repository = giteaRepositories.get(giteaBranchRepository.value);
  const requestId = ++giteaBranchRequestId;
  giteaCurrentDefaultBranch = "";
  giteaDefaultBranchSelect.replaceChildren(new Option("Consultando ramas…", ""));
  giteaDefaultBranchSelect.disabled = true;
  giteaDefaultBranchSubmit.disabled = true;
  updateGiteaDefaultBranchAction();
  giteaWebhookStatus.textContent = "";
  if (!repository) {
    giteaBranchStatus.textContent = "Selecciona un repositorio válido.";
    return;
  }
  giteaBranchStatus.textContent = "Consultando ramas…";
  try {
    const query = new URLSearchParams({ repository: repository.fullName });
    const result = await request(`/api/system/applications/gitea/branches?${query}`);
    if (requestId !== giteaBranchRequestId || giteaBranchRepository.value !== repository.fullName) return;
    giteaCurrentDefaultBranch = result.repository.defaultBranch;
    giteaDefaultBranchSelect.replaceChildren();
    for (const branch of result.branches) {
      const option = document.createElement("option");
      option.value = branch.name;
      option.textContent = branch.name === giteaCurrentDefaultBranch
        ? `${branch.name} · actual`
        : branch.name;
      giteaDefaultBranchSelect.append(option);
    }
    giteaDefaultBranchSelect.value = giteaCurrentDefaultBranch
      && result.branches.some((branch) => branch.name === giteaCurrentDefaultBranch)
      ? giteaCurrentDefaultBranch
      : result.branches[0]?.name ?? "";
    giteaDefaultBranchSelect.disabled = result.branches.length === 0;
    giteaBranchStatus.textContent = result.branches.length
      ? `Ramas: ${result.branches.length}. Predeterminada: ${giteaCurrentDefaultBranch || "sin establecer"}.${repository.canAdmin ? "" : " El token no puede cambiar la configuración de este repositorio."}`
      : "El repositorio no tiene ramas para seleccionar.";
    updateGiteaDefaultBranchAction();
  } catch (error) {
    if (requestId !== giteaBranchRequestId || giteaBranchRepository.value !== repository.fullName) return;
    giteaDefaultBranchSelect.replaceChildren(new Option("No se pudieron consultar ramas", ""));
    giteaBranchStatus.textContent = error.message;
  }
}

async function loadProjects({ quiet = false } = {}) {
  if (!quiet) projectsStatus.textContent = "Consultando proyectos…";
  try {
    const result = await request("/api/projects");
    projects = result.projects;
    renderProjects();
  } catch (error) {
    if (quiet) {
      projectsStatus.textContent = error.message;
      return;
    }
    projects = [];
    projectsList.replaceChildren();
    projectsStatus.textContent = error.message;
  }
}

let githubInstallations = [];
let currentProjectEdit = null;
let githubDetectedBuildProfile = null;
let previousDynamicProjectPort = "3000";

async function loadGithubStatus() {
  githubCallbackUrl.textContent = new URL("/api/github/callback", window.location.href).href;
  try {
    const result = await request("/api/github/status");
    githubInstallations = result.accounts ?? [];
    githubStatus.textContent = result.configured
      ? `GitHub OAuth configurado · ${githubInstallations.length} cuenta${githubInstallations.length === 1 ? "" : "s"} conectada${githubInstallations.length === 1 ? "" : "s"}.`
      : "Guarda las credenciales de una GitHub OAuth App para conectar tu cuenta.";
    populateProjectInstallations();
    const query = new URLSearchParams(window.location.search);
    const callbackState = query.get("github");
    if (callbackState) {
      if (callbackState === "connected") {
        githubStatus.textContent = "Cuenta de GitHub conectada. Selecciona la cuenta, repositorio y rama para importar.";
      } else if (callbackState === "denied") {
        githubStatus.textContent = "Se canceló la autorización de GitHub.";
      } else {
        githubStatus.textContent = query.get("message") || "No se pudo completar la conexión con GitHub.";
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
    return result;
  } catch (error) {
    githubStatus.textContent = error.message;
    githubInstallations = [];
    populateProjectInstallations();
    return null;
  }
}

function populateProjectInstallations(selectedId = "") {
  projectInstallationSelect.replaceChildren(new Option("Selecciona una cuenta conectada", ""));
  for (const installation of githubInstallations) {
    projectInstallationSelect.add(new Option(
      installation.accountLogin,
      String(installation.installationId),
    ));
  }
  projectInstallationSelect.value = String(selectedId || "");
  projectInstallationSelect.disabled = githubInstallations.length === 0;
  githubImportButton.disabled = true;
}

async function loadProjectRepositories(preferredRepository = "") {
  const installationId = Number(projectInstallationSelect.value);
  projectRepositorySelect.replaceChildren(new Option("Consultando repositorios…", ""));
  projectProductionBranchSelect.replaceChildren(new Option("Selecciona un repositorio", ""));
  projectProductionBranchSelect.disabled = true;
  githubImportButton.disabled = true;
  if (!Number.isSafeInteger(installationId) || installationId < 1) {
    projectRepositorySelect.replaceChildren(new Option("Selecciona una cuenta conectada", ""));
    return;
  }
  try {
    const query = new URLSearchParams({ accountId: String(installationId) });
    const result = await request(`/api/github/repositories?${query}`);
    projectRepositorySelect.replaceChildren(new Option("Selecciona un repositorio", ""));
    for (const repository of result.repositories) {
      projectRepositorySelect.add(new Option(repository.fullName, repository.fullName));
    }
    if (result.repositories.some((repository) => repository.fullName === preferredRepository)) {
      projectRepositorySelect.value = preferredRepository;
      await loadProjectBranches(currentProjectEdit?.productionBranch ?? "main");
    } else {
      githubImportStatus.textContent = result.repositories.length
        ? "Selecciona un repositorio."
        : "La instalación no tiene repositorios autorizados.";
    }
  } catch (error) {
    projectRepositorySelect.replaceChildren(new Option("No se pudieron consultar repositorios", ""));
    githubImportStatus.textContent = error.message;
  }
}

async function loadProjectBranches(preferredBranch = "main") {
  const installationId = Number(projectInstallationSelect.value);
  const repository = projectRepositorySelect.value;
  projectProductionBranchSelect.replaceChildren(new Option("Consultando ramas…", ""));
  projectProductionBranchSelect.disabled = true;
  if (!Number.isSafeInteger(installationId) || installationId < 1 || !repository) return;
  try {
    const query = new URLSearchParams({ accountId: String(installationId), repository });
    const result = await request(`/api/github/branches?${query}`);
    projectProductionBranchSelect.replaceChildren();
    for (const branch of result.branches) {
      projectProductionBranchSelect.add(new Option(branch.name, branch.name));
    }
    projectProductionBranchSelect.value = result.branches.some((branch) => branch.name === preferredBranch)
      ? preferredBranch
      : result.branches.some((branch) => branch.name === "main")
        ? "main"
        : result.branches[0]?.name ?? "";
    projectProductionBranchSelect.disabled = result.branches.length === 0;
    githubImportButton.disabled = result.branches.length === 0;
    githubImportStatus.textContent = result.branches.length
      ? `${result.branches.length} ramas disponibles.`
      : "El repositorio no tiene ramas disponibles.";
    if (result.branches.length) await loadGithubProjectProfile();
  } catch (error) {
    projectProductionBranchSelect.replaceChildren(new Option("No se pudieron consultar ramas", ""));
    githubImportButton.disabled = true;
    githubImportStatus.textContent = error.message;
  }
}

function updateGithubProfileSummary() {
  if (!githubDetectedBuildProfile) return;
  const deploymentType = githubDeploymentTypeSelect.value;
  const deployment = {
    static: "Estático con Nginx",
    dynamic: "Aplicación dinámica",
    build: "Build estático con Nginx",
  }[deploymentType];
  const strategy = deploymentType === "dynamic"
    ? githubBuildStrategySelect.value === "railpack" ? "Railpack" : "Dockerfile personalizado"
    : deploymentType === "static" ? "Nginx sin build" : "BuildKit + Nginx";
  const warning = githubDetectedBuildProfile.warning ? ` Aviso: ${githubDetectedBuildProfile.warning}` : "";
  githubDetectionProfile.textContent = `Detectado: ${githubDetectedBuildProfile.framework} · ${deployment} · ${strategy} · puerto ${deploymentType === "dynamic" ? githubInternalPortInput.value : 80}. ${githubDetectedBuildProfile.reason} Confianza ${githubDetectedBuildProfile.confidence}.${warning}`;
  githubBuildStrategySelect.disabled = deploymentType !== "dynamic";
  githubInternalPortInput.disabled = deploymentType !== "dynamic";
  githubBuildCommandInput.disabled = deploymentType === "static";
  githubOutputDirectoryInput.disabled = deploymentType !== "build";
}

async function loadGithubProjectProfile() {
  const installationId = Number(projectInstallationSelect.value);
  const repository = projectRepositorySelect.value;
  const branch = projectProductionBranchSelect.value;
  if (!Number.isSafeInteger(installationId) || installationId < 1 || !repository || !branch) return;
  githubImportButton.disabled = true;
  githubDetectionProfile.textContent = "Analizando manifiestos y archivos del repositorio…";
  try {
    const query = new URLSearchParams({
      accountId: String(installationId),
      repository,
      branch,
    });
    const result = await request(`/api/github/project-profile?${query}`);
    githubDetectedBuildProfile = result.profile;
    githubDeploymentTypeSelect.value = result.profile.recommendedDeploymentType;
    githubBuildStrategySelect.value = result.profile.buildStrategy;
    githubBuildContextInput.value = result.profile.buildContext;
    githubDockerfileInput.value = result.profile.dockerfilePath;
    githubInternalPortInput.value = String(result.profile.internalPort);
    githubBuildCommandInput.value = result.profile.buildCommand;
    githubOutputDirectoryInput.value = result.profile.buildOutputDirectory;
    updateGithubProfileSummary();
    githubImportStatus.textContent = "Configuración detectada. Puedes revisarla antes de importar.";
    githubImportButton.disabled = false;
  } catch (error) {
    githubDetectedBuildProfile = null;
    githubDetectionProfile.textContent = `No se pudo detectar el repositorio: ${error.message}`;
    githubImportStatus.textContent = "Puedes seleccionar la configuración manualmente y volver a intentar.";
    githubImportButton.disabled = false;
  }
}

function setProjectTab(tabName) {
  for (const button of projectDetailView.querySelectorAll("[data-project-tab]")) {
    const selected = button.dataset.projectTab === tabName;
    button.setAttribute("aria-selected", String(selected));
  }
  for (const panel of projectDetailView.querySelectorAll("[data-project-tab-panel]")) {
    panel.hidden = panel.dataset.projectTabPanel !== tabName;
  }
}

document.addEventListener("click", (event) => {
  const trigger = event.target instanceof Element ? event.target.closest("[data-guide-target]") : null;
  if (!trigger) return;
  const template = document.querySelector(trigger.dataset.guideTarget);
  if (!(template instanceof HTMLTemplateElement)) {
    throw new Error(`No se encontró la guía ${trigger.dataset.guideTarget}.`);
  }
  guideDialogTitle.textContent = trigger.dataset.guideTitle;
  guideDialogContent.replaceChildren(template.content.cloneNode(true));
  guideDialog.showModal();
});

document.querySelector("#close-guide-dialog").addEventListener("click", () => guideDialog.close());

function renderProjectFileTree(paths, list) {
  const root = { children: new Map() };
  for (const path of paths) {
    let node = root;
    for (const part of path.split("/")) {
      if (!node.children.has(part)) node.children.set(part, { children: new Map() });
      node = node.children.get(part);
    }
  }
  const appendNodes = (parent, children) => {
    for (const [name, node] of [...children].sort(([left], [right]) => left.localeCompare(right, "es"))) {
      const item = document.createElement("li");
      if (node.children.size) {
        item.classList.add("project-file-directory");
        const nested = document.createElement("ul");
        appendNodes(nested, node.children);
        const directory = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = name;
        directory.append(summary, nested);
        item.append(directory);
      } else {
        item.textContent = name;
      }
      parent.append(item);
    }
  };
  list.replaceChildren();
  appendNodes(list, root.children);
}

function updateProjectDeploymentFields() {
  const isStatic = projectDeploymentTypeSelect.value === "static";
  const isBuild = projectDeploymentTypeSelect.value === "build";
  const isDynamic = projectDeploymentTypeSelect.value === "dynamic";
  const isUpload = currentProjectEdit?.sourceType === "upload";
  if (isUpload) projectAutoDeployInput.checked = false;
  projectDynamicBuildFields.classList.toggle("hidden", isStatic);
  for (const field of projectDynamicBuildFields.querySelectorAll("input, select")) {
    field.disabled = isStatic;
  }
  if (isStatic) document.querySelector("#project-port").value = "80";
  if (isBuild) {
    projectBuildStrategySelect.value = "dockerfile";
    document.querySelector("#project-port").value = "80";
  }
  projectBuildStrategySelect.disabled = !isDynamic;
  document.querySelector("#project-port").disabled = isStatic || isBuild;
  document.querySelector("#project-port-field").hidden = !isDynamic;
  document.querySelector("#project-port-usage").hidden = !isDynamic;
  projectAutoDeployInput.closest("label").hidden = isUpload;
  projectAutoDeployInput.disabled = isUpload;
  document.querySelector("#project-auto-deploy-help").hidden = isUpload;
  document.querySelector("#project-build-strategy-field").hidden = !isDynamic;
  document.querySelector("#project-build-context-field").hidden = isStatic;
  const buildOutputFields = document.querySelector("#project-build-output-fields");
  buildOutputFields.hidden = !isBuild;
  for (const field of buildOutputFields.querySelectorAll("input")) field.disabled = !isBuild;
  projectDeploymentTypeHelp.textContent = isStatic
    ? "Publica archivos HTML/CSS/JS como contenido estático servido por Nginx. No ejecuta un servidor de aplicación."
    : isBuild
      ? "Instala dependencias, ejecuta el comando de build y publica su carpeta de salida con Nginx."
      : "Construye una imagen y ejecuta Node, Python u otro servidor HTTP. Indica el puerto en el que escucha la aplicación.";
  updateProjectBuildFields();
}

function updateProjectBuildFields() {
  const isDynamic = projectDeploymentTypeSelect.value === "dynamic";
  const isDockerfile = isDynamic && projectBuildStrategySelect.value === "dockerfile";
  projectDockerfileField.classList.toggle("hidden", !isDockerfile);
  document.querySelector("#project-dockerfile").disabled =
    !isDockerfile;
}

function returnToProjectsRoute() {
  window.location.assign("/#tab-projects");
}

function renderProjectRoute() {
  const routeMatch = window.location.pathname.match(/^\/projects\/([0-9a-f-]{36})$/i);
  const projectId = routeMatch?.[1].toLowerCase() ?? null;
  const project = projectId ? projects.find((item) => item.id.toLowerCase() === projectId) : null;
  const showingProject = Boolean(routeMatch);
  const showingApplicationDetail = /^\/applications\/[0-9a-f-]{36}$/i.test(window.location.pathname);
  const showingApplicationCreate = window.location.pathname === "/applications/new";
  dashboardView.classList.toggle("hidden", showingProject || showingApplicationDetail || showingApplicationCreate);
  projectDetailView.classList.toggle("hidden", !showingProject);
  projectDetailView.hidden = !showingProject;
  applicationDetailView.classList.toggle("hidden", !showingApplicationDetail);
  applicationDetailView.hidden = !showingApplicationDetail;
  applicationCreateView.classList.toggle("hidden", !showingApplicationCreate);
  applicationCreateView.hidden = !showingApplicationCreate;
  if (!showingApplicationDetail) clearSupabaseCredentialDisplay();

  if (!showingProject) {
    currentProjectEdit = null;
    projectsList.parentElement.insertBefore(projectsStatus, projectsList);
    return null;
  }
  document.querySelector("#project-detail-operation-status").append(projectsStatus);
  if (!project) {
    document.querySelector("#project-detail-title").textContent = "Proyecto no encontrado";
    document.querySelector("#project-detail-summary").textContent = "No se encontró el proyecto solicitado.";
    return null;
  }

  currentProjectEdit = project;
  projectForm.reset();
  projectIdInput.value = project.id;
  projectNameInput.value = project.name;
  projectDescriptionInput.value = project.description ?? "";
  projectDeploymentTypeSelect.value = project.deploymentType ?? "dynamic";
  projectBuildStrategySelect.value = project.buildStrategy ?? "dockerfile";
  document.querySelector("#project-build-context").value = project.buildContext ?? ".";
  document.querySelector("#project-dockerfile").value = project.dockerfilePath ?? "Dockerfile";
  document.querySelector("#project-build-command").value = project.buildCommand ?? "npm run build";
  document.querySelector("#project-build-output-directory").value = project.buildOutputDirectory ?? "dist";
  document.querySelector("#project-port").value = String(project.internalPort ?? 3000);
  const portUsage = document.querySelector("#project-port-usage");
  const otherDynamicProjects = projects.filter((candidate) =>
    candidate.id !== project.id && candidate.deploymentType === "dynamic");
  portUsage.replaceChildren();
  const portExplanation = document.createElement("p");
  portExplanation.className = "muted";
  portExplanation.textContent = "Es un puerto interno del contenedor: varios proyectos pueden usar el mismo sin colisionar. La app debe escuchar en 0.0.0.0 en este puerto.";
  portUsage.append(portExplanation);
  if (otherDynamicProjects.length > 0) {
    const portListLabel = document.createElement("strong");
    portListLabel.textContent = "Puertos configurados en otros proyectos";
    const portList = document.createElement("ul");
    for (const candidate of otherDynamicProjects) {
      const item = document.createElement("li");
      const deployment = candidate.deployment;
      const replicas = deployment
        ? ` · ${deployment.runningReplicas}/${deployment.desiredReplicas} réplicas`
        : " · sin servicio desplegado";
      item.textContent = `${candidate.name} · puerto ${candidate.internalPort ?? 3000}${replicas}`;
      portList.append(item);
    }
    portUsage.append(portListLabel, portList);
  } else {
    const emptyPortList = document.createElement("p");
    emptyPortList.className = "muted";
    emptyPortList.textContent = "No hay otros proyectos dinámicos configurados.";
    portUsage.append(emptyPortList);
  }
  previousDynamicProjectPort = project.deploymentType === "static" || project.deploymentType === "build"
    ? "3000"
    : String(project.internalPort ?? 3000);
  document.querySelector("#project-auto-deploy").checked = project.autoDeploy ?? true;
  document.querySelector("#project-detail-title").textContent = project.name;
  document.querySelector("#project-detail-state").textContent = project.deployment
    ? `${project.deployment.runningReplicas}/${project.deployment.desiredReplicas} réplicas`
    : project.latestBuild ? "Build listo" : "Sin despliegue";
  document.querySelector("#project-detail-summary").textContent = project.sourceType === "upload"
    ? "Proyecto subido desde ZIP o archivos."
    : `GitHub · ${project.repository} · rama ${project.productionBranch}`;
  document.querySelector("#project-framework-summary").textContent =
    `Framework detectado: ${project.framework ?? "Desconocido"} · ${project.deploymentType === "dynamic"
      ? project.buildStrategy === "railpack" ? "Railpack" : "Dockerfile"
      : project.deploymentType === "build" ? "BuildKit + Nginx" : "Nginx sin build"}. Puedes editar el método, puerto y comandos en esta configuración.`;
  projectSaveButton.textContent = "Guardar cambios";
  projectFormStatus.textContent = "";
  updateProjectDeploymentFields();
  updateProjectBuildFields();
  return project;
}

function renderProjectBuildOperation(projectId, operation) {
  if (currentProjectEdit?.id !== projectId) return;
  const panel = document.querySelector("#project-detail-build-operation");
  const title = document.querySelector("#project-detail-build-operation-title");
  const message = document.querySelector("#project-detail-build-operation-message");
  const diagnostic = document.querySelector("#project-detail-build-operation-diagnostic");
  const updated = document.querySelector("#project-detail-build-operation-updated");
  const logs = document.querySelector("#project-detail-build-operation-logs");
  const progress = document.querySelector("#project-detail-build-operation-progress");
  const buildButton = document.querySelector("#project-detail-actions [data-project-build]");
  const publishButton = document.querySelector("#project-detail-actions [data-project-publish]");
  const project = projects.find((candidate) => candidate.id === projectId);
  const buildUnavailable = project?.sourceType === "upload" && !project.latestSource;
  const isActive = ["pending", "in_progress"].includes(operation?.status);
  const isComplete = operation?.status === "completed";
  panel.hidden = !operation;
  if (!operation) {
    diagnostic.hidden = true;
    diagnostic.textContent = "";
    progress.hidden = true;
    if (buildButton) {
      buildButton.disabled = buildUnavailable;
      buildButton.textContent = "Construir";
    }
    if (publishButton) {
      publishButton.disabled = buildUnavailable;
      publishButton.textContent = "Construir y desplegar";
    }
    return;
  }
  title.textContent = ({
    queued: "Construcción en cola",
    "waiting-agent": "Esperando al agente del VPS",
    "preparing-source": "Preparando el proyecto",
    buildkit: "BuildKit construyendo",
    completed: "Construcción completada",
    failed: "Falló la construcción",
  })[operation.phase] ?? (isActive ? "Construcción en curso" : "Estado de construcción");
  message.textContent = operation.error && operation.error !== operation.message
    ? `${operation.message} ${operation.error}`
    : operation.message;
  diagnostic.hidden = !operation.diagnostic;
  diagnostic.textContent = operation.diagnostic ?? "";
  progress.hidden = !isActive;
  const startedAt = Date.parse(operation.startedAt ?? operation.updatedAt ?? "");
  const elapsedSeconds = Number.isFinite(startedAt)
    ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    : null;
  const elapsedLabel = elapsedSeconds === null
    ? ""
    : ` · transcurrido ${Math.floor(elapsedSeconds / 60)} min ${String(elapsedSeconds % 60).padStart(2, "0")} s`;
  const activityLabel = ({
    queued: "En cola",
    "waiting-agent": "Esperando al agente",
    "preparing-source": "Preparando fuente",
    buildkit: "BuildKit en ejecución",
    completed: "Finalizada",
    failed: "Fallida",
  })[operation.phase] ?? (isActive ? "En ejecución" : isComplete ? "Finalizada" : "Actualizada");
  updated.textContent = operation.updatedAt
    ? `${activityLabel}${elapsedLabel} · última actualización ${new Date(operation.updatedAt).toLocaleTimeString("es-MX")}`
    : `${activityLabel}${elapsedLabel}`;
  const followLatestLogs = logs.scrollTop + logs.clientHeight >= logs.scrollHeight - 20;
  logs.textContent = operation.logs
    || (operation.phase === "queued"
      ? "La tarea está en cola; BuildKit todavía no ha comenzado."
      : operation.phase === "waiting-agent"
        ? "Otra operación está usando el agente del VPS. Esta construcción espera su turno; BuildKit todavía no ha comenzado."
        : operation.phase === "preparing-source"
          ? "Descargando y preparando el código fuente y el contexto de construcción. BuildKit aún no ha comenzado."
          : operation.phase === "buildkit"
            ? "BuildKit ya inició; todavía no ha emitido líneas de salida."
            : operation.status === "failed"
              ? `La tarea terminó sin registros de BuildKit.${operation.error ? ` Error: ${operation.error}` : ""}`
              : "La construcción terminó, pero el agente no entregó registros de BuildKit.");
  if (followLatestLogs) logs.scrollTop = logs.scrollHeight;
  if (buildButton) {
    buildButton.disabled = isActive || buildUnavailable;
    buildButton.textContent = isActive ? "Construcción en curso…" : "Construir";
  }
  if (publishButton) {
    publishButton.disabled = isActive || buildUnavailable;
    publishButton.textContent = isActive ? "Construcción en curso…" : "Construir y desplegar";
  }
}

function updateProjectLatestBuild(projectId, latestBuild) {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project || !latestBuild) return;
  project.latestBuild = latestBuild;
  const buildValue = document.querySelector("#project-detail-build-info .project-release-label span");
  if (buildValue) {
    buildValue.textContent = `${latestBuild.commitSha.slice(0, 12)}${latestBuild.branch ? ` · ${latestBuild.branch}` : ""}`;
  }
  const currentDeployment = project.deployment;
  const deploymentCurrent = Boolean(currentDeployment
    && latestBuild.commitSha === currentDeployment.commitSha
    && currentDeployment.runningReplicas === currentDeployment.desiredReplicas
    && currentDeployment.configurationCurrent);
  const deployButton = document.querySelector("#project-detail-actions [data-project-deploy]");
  if (deployButton) {
    deployButton.disabled = deploymentCurrent;
    deployButton.textContent = currentDeployment ? "Re-desplegar" : "Desplegar";
  }
  if (!currentDeployment) {
    document.querySelector("#project-detail-state").textContent = "Build listo";
  }
}

function scheduleProjectBuildPoll(projectId) {
  if (projectBuildPollTimer !== undefined) clearTimeout(projectBuildPollTimer);
  projectBuildPollTimer = setTimeout(() => {
    projectBuildPollTimer = undefined;
    void pollProjectBuildStatus(projectId);
  }, 2000);
}

async function pollProjectBuildStatus(projectId) {
  if (currentProjectEdit?.id !== projectId) return null;
  try {
    const { operation, latestBuild } = await request(`/api/projects/${encodeURIComponent(projectId)}/build-status`);
    renderProjectBuildOperation(projectId, operation);
    updateProjectLatestBuild(projectId, latestBuild);
    if (["pending", "in_progress"].includes(operation?.status)) {
      scheduleProjectBuildPoll(projectId);
    } else if (operation?.status === "failed") {
      projectDeployAfterBuild.delete(projectId);
      projectsStatus.textContent = operation.error ?? operation.message;
    } else if (operation?.status === "completed") {
      if (projectDeployAfterBuild.delete(projectId)) {
        projectsStatus.textContent = "Compilación lista; solicitando el despliegue…";
        try {
          const project = projects.find((candidate) => candidate.id === projectId);
          if (!project) throw new Error("No se encontró el proyecto para iniciar el despliegue.");
          await requestProjectDeployment(project, (message) => {
            projectsStatus.textContent = message;
          });
        } catch (error) {
          projectsStatus.textContent = `La compilación terminó, pero el despliegue no se completó: ${error.message}`;
        }
      } else {
        projectsStatus.textContent = "Construcción finalizada correctamente; ya puedes desplegar la imagen.";
      }
    }
    return operation;
  } catch (error) {
    document.querySelector("#project-detail-build-operation").hidden = false;
    document.querySelector("#project-detail-build-operation-title").textContent = "Consultando construcción";
    document.querySelector("#project-detail-build-operation-diagnostic").hidden = true;
    const message = document.querySelector("#project-detail-build-operation-message");
    message.textContent = `No se pudo actualizar el estado de la construcción: ${error.message}`;
    scheduleProjectBuildPoll(projectId);
    return null;
  }
}

function projectHealthSummary(health) {
  if (!health) return "Estado del servicio y las URLs todavía no consultado.";
  const serviceLabel = {
    running: "en ejecución",
    stopped: "detenido",
    "not-deployed": "sin despliegue",
  }[health.serviceStatus] ?? "desconocido";
  const urlLabel = health.urls.length === 0
    ? "sin dominios asignados"
    : `${health.urls.filter((url) => url.state === "online").length}/${health.urls.length} URLs respondiendo`;
  const checkedAt = new Date(health.checkedAt);
  const checkedLabel = Number.isNaN(checkedAt.getTime())
    ? ""
    : ` · comprobado ${checkedAt.toLocaleTimeString("es-MX")}`;
  return `Servicio ${serviceLabel} · ${urlLabel}${checkedLabel}`;
}

async function waitForProjectTask(taskId, onProgress) {
  const deadline = Date.now() + 18 * 60 * 1000;
  while (Date.now() < deadline) {
    const { tasks } = await request("/api/system/tasks");
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new Error("No se encontró la tarea en el historial; actualiza para comprobar su estado.");
    if (task.status === "completed") return task;
    if (task.status === "failed") throw new Error(task.error ?? "La operación falló sin proporcionar detalles.");
    onProgress(task.status === "pending" ? "En cola; esperando al agente del VPS…" : "Operación en curso en el VPS…");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("La operación sigue activa, pero superó el tiempo de espera del panel. Actualiza para consultar su estado.");
}

async function requestProjectDeployment(project, onProgress) {
  try {
    const result = await request(`/api/projects/${encodeURIComponent(project.id)}/deploy`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!result.task?.id) throw new Error("El servidor aceptó el despliegue, pero no devolvió el identificador de tarea.");
    onProgress(result.message ?? `Desplegando ${project.name}…`);
    const task = await waitForProjectTask(result.task.id, onProgress);
    onProgress(task.result?.message ?? `El despliegue de ${project.name} terminó correctamente.`);
    await Promise.all([loadProjects(), loadTaskHistory()]);
    return task;
  } catch (error) {
    await Promise.all([loadProjects({ quiet: true }), loadTaskHistory()]);
    throw error;
  }
}

async function deleteProjectAndResources(project, assignedDomains, onProgress) {
  if (project.deployment) {
    onProgress("Retirando el servicio del VPS…");
    const result = await request(`/api/projects/${encodeURIComponent(project.id)}/deployment`, {
      method: "DELETE",
    });
    if (!result.task?.id) throw new Error("Se solicitó el retiro, pero el servidor no devolvió el identificador de tarea.");
    await waitForProjectTask(result.task.id, onProgress);
  }
  for (const [index, domain] of assignedDomains.entries()) {
    onProgress(`Quitando el dominio ${domain.hostname} (${index + 1}/${assignedDomains.length})…`);
    await request(`/api/domains/${encodeURIComponent(domain.id)}`, { method: "DELETE" });
  }
  onProgress("Eliminando el proyecto y su configuración…");
  await request(`/api/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" });
}

function projectUrlHealthLabel(urlHealth) {
  if (!urlHealth) return "Estado de URL no consultado.";
  if (urlHealth.state === "online") return `Disponible · HTTP ${urlHealth.httpStatus} · ${urlHealth.responseTimeMs} ms`;
  if (urlHealth.error) return urlHealth.error;
  if (urlHealth.httpStatus !== null) return `Error HTTP ${urlHealth.httpStatus} · ${urlHealth.responseTimeMs} ms`;
  return "URL no disponible.";
}

function updateProjectUrlHealthRow(hostname, urlHealth, deployment, routeUpdatePending = false) {
  const row = [...document.querySelectorAll("#project-detail-domains .project-domain-row")]
    .find((item) => item.dataset.hostname === hostname);
  if (!row) return;
  const status = row.querySelector("[data-project-url-health]");
  if (status) {
    status.dataset.state = urlHealth?.state ?? "unknown";
    status.textContent = projectUrlHealthLabel(urlHealth);
  }
  const repairButton = row.querySelector("[data-project-route-repair]");
  if (repairButton) repairButton.hidden = !urlHealth || urlHealth.state === "online";
  const routeIsReady = Boolean(
    deployment?.routesCurrent && deployment.runningReplicas > 0 && !routeUpdatePending,
  );
  const openSite = row.querySelector("[data-project-open-site]");
  if (openSite) openSite.hidden = !routeIsReady;
  const routeStatus = row.querySelector("[data-project-route-status]");
  if (routeStatus) {
    routeStatus.hidden = routeIsReady;
    if (routeIsReady) routeStatus.textContent = "";
  }
}

async function waitForProjectRouteHealth(projectId, hostname, onUpdate = () => {}) {
  const deadline = Date.now() + 120_000;
  let delayMs = 2000;
  let readyChecks = 0;
  let latestHealth = null;
  let latestDeployment = null;
  let routesCurrent = false;
  while (Date.now() < deadline) {
    const result = await request(`/api/projects/${encodeURIComponent(projectId)}/health`);
    latestDeployment = result.deployment;
    routesCurrent = Boolean(
      result.deployment?.routesCurrent
      && result.deployment.runningReplicas > 0
      && !result.routeUpdatePending,
    );
    latestHealth = result.health?.urls?.find((item) => item.hostname === hostname) ?? null;
    updateProjectUrlHealthRow(hostname, latestHealth, result.deployment, result.routeUpdatePending);
    if (routesCurrent) {
      readyChecks += 1;
      if (latestHealth?.state === "online" || readyChecks >= 3) break;
    }
    if (!result.deployment) break;
    onUpdate(routesCurrent
      ? "Ruta activa; comprobando la URL…"
      : "Esperando a que el VPS active la ruta automáticamente…");
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(10_000, Math.round(delayMs * 1.5));
  }
  return { deployment: latestDeployment, health: latestHealth, routesCurrent };
}

async function repairProjectRoute(projectId, hostname, statusElement, button) {
  button.disabled = true;
  statusElement.textContent = "Solicitando reparación de la ruta…";
  try {
    const result = await request(`/api/projects/${encodeURIComponent(projectId)}/routes/reconcile`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    statusElement.textContent = result.message;
    const verification = await waitForProjectRouteHealth(
      projectId,
      hostname,
      (message) => { statusElement.textContent = message; },
    );
    if (!verification.routesCurrent) {
      statusElement.textContent = "La ruta sigue pendiente; revisa el estado del VPS y vuelve a intentar.";
    } else if (verification.health?.state === "online") {
      statusElement.textContent = "Ruta reparada y URL disponible.";
    } else if (verification.health?.httpStatus === 404) {
      statusElement.textContent = "La ruta está activa; el 404 viene de la ruta raíz de la aplicación o de la configuración de su puerto.";
    } else {
      statusElement.textContent = verification.health?.error
        ?? "La ruta está activa, pero la URL todavía no responde correctamente.";
    }
  } catch (error) {
    statusElement.textContent = `No se pudo reparar la ruta: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

function projectProductionStatus(health) {
  if (!health) return { label: "Estado no consultado", state: "unknown" };
  if (health.serviceStatus === "not-deployed") return { label: "Sin publicar", state: "unavailable" };
  if (health.serviceStatus === "stopped") return { label: "Servicio detenido", state: "unavailable" };
  if (health.urlStatus === "degraded" || health.urlStatus === "unavailable") {
    return { label: "Revisar disponibilidad", state: "degraded" };
  }
  return {
    label: health.urlStatus === "online" ? "Disponible" : "Servicio activo",
    state: "online",
  };
}

function addProjectRuntimeField(list, label, value) {
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  list.append(term, description);
}

function renderProjectRuntimeSummary(project) {
  const summary = document.querySelector("#project-runtime-summary");
  summary.replaceChildren();
  const deploymentTypes = {
    static: "Sitio estático servido por Nginx",
    dynamic: "Aplicación dinámica en contenedor",
    build: "Build estático servido por Nginx",
  };
  addProjectRuntimeField(summary, "Tipo", deploymentTypes[project.deploymentType] ?? "No especificado");
  addProjectRuntimeField(summary, "Framework detectado", project.framework || "No detectado");

  if (project.deploymentType === "static") {
    addProjectRuntimeField(summary, "Ejecución", "Nginx sirve los archivos del proyecto tal como se cargaron · puerto 80.");
  } else if (project.deploymentType === "build") {
    addProjectRuntimeField(summary, "Directorio de contexto", project.buildContext || ".");
    addProjectRuntimeField(summary, "Comando de compilación", project.buildCommand || "npm run build");
    addProjectRuntimeField(summary, "Directorio publicado", project.buildOutputDirectory || "dist");
    addProjectRuntimeField(summary, "Ejecución", "Nginx sirve la carpeta compilada · puerto 80. Las variables de entorno no se inyectan durante el build.");
  } else {
    const strategy = project.buildStrategy === "railpack" ? "Railpack" : "Dockerfile";
    addProjectRuntimeField(summary, "Método de imagen", strategy);
    addProjectRuntimeField(summary, "Directorio de contexto", project.buildContext || ".");
    if (project.buildStrategy === "railpack") {
      addProjectRuntimeField(summary, "Arranque", "Railpack detecta el comando de inicio del proyecto.");
    } else {
      addProjectRuntimeField(summary, "Dockerfile", project.dockerfilePath || "Dockerfile");
      addProjectRuntimeField(summary, "Arranque", "El contenedor ejecuta el CMD o ENTRYPOINT definido en el Dockerfile.");
    }
    addProjectRuntimeField(summary, "Puerto interno", String(project.internalPort || 3000));
    addProjectRuntimeField(summary, "Variables de entorno", "Se inyectan al contenedor en el siguiente despliegue.");
  }

  const deployment = project.deployment;
  addProjectRuntimeField(summary, "Servicio Swarm", deployment
    ? `${deployment.serviceName} · ${deployment.runningReplicas}/${deployment.desiredReplicas} réplicas`
    : "Aún no desplegado");
  if (deployment?.image) addProjectRuntimeField(summary, "Imagen en ejecución", deployment.image);
}

function createProjectEnvironmentEditor(projectId, environment, { readOnly = false } = {}) {
  const form = document.createElement("form");
  form.className = "project-environment-form";
  const rows = document.createElement("div");
  rows.className = "project-environment-list";
  const status = document.createElement("p");
  status.className = "muted";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const enableEnvironment = document.createElement("button");
  enableEnvironment.className = "button secondary";
  enableEnvironment.type = "button";
  enableEnvironment.textContent = "Configurar como aplicación dinámica";
  enableEnvironment.hidden = !readOnly;
  enableEnvironment.addEventListener("click", () => {
    setProjectTab("settings");
    projectDeploymentTypeSelect.value = "dynamic";
    projectDeploymentTypeSelect.dispatchEvent(new Event("change"));
    projectFormStatus.textContent = "Se seleccionó Aplicación dinámica. Guarda la configuración para habilitar las variables de entorno.";
    projectForm.scrollIntoView({ behavior: "smooth", block: "start" });
    projectSaveButton.focus({ preventScroll: true });
  });
  const addVariable = document.createElement("button");
  addVariable.className = "button secondary";
  addVariable.type = "button";
  addVariable.textContent = "Añadir variable";
  addVariable.disabled = readOnly;
  const save = document.createElement("button");
  save.className = "button";
  save.type = "submit";
  save.textContent = "Guardar variables";
  save.disabled = readOnly;

  const addRow = (name = "", value = "") => {
    const row = document.createElement("div");
    row.className = "project-environment-row";
    const nameField = document.createElement("label");
    nameField.className = "project-environment-name";
    const nameLabel = document.createElement("span");
    nameLabel.textContent = "Nombre";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = name;
    nameInput.maxLength = 128;
    nameInput.autocomplete = "off";
    nameInput.spellcheck = false;
    nameInput.placeholder = "API_KEY";
    nameInput.setAttribute("aria-label", "Nombre de la variable");
    nameInput.disabled = readOnly;
    nameField.append(nameLabel, nameInput);

    const valueField = document.createElement("label");
    valueField.className = "project-environment-value";
    const valueLabel = document.createElement("span");
    valueLabel.textContent = "Valor";
    const valueInput = document.createElement("input");
    valueInput.type = "password";
    valueInput.value = value;
    valueInput.maxLength = 8192;
    valueInput.autocomplete = "new-password";
    valueInput.spellcheck = false;
    valueInput.placeholder = "Valor secreto o de configuración";
    valueInput.setAttribute("aria-label", `Valor de ${name || "la variable"}`);
    valueInput.disabled = readOnly;
    valueField.append(valueLabel, valueInput);

    const actions = document.createElement("div");
    actions.className = "project-environment-row-actions";
    const reveal = document.createElement("button");
    reveal.className = "button secondary resource-action";
    reveal.type = "button";
    reveal.textContent = "Mostrar";
    reveal.setAttribute("aria-label", `Mostrar u ocultar el valor de ${name || "la variable"}`);
    reveal.disabled = readOnly;
    reveal.addEventListener("click", () => {
      const visible = valueInput.type === "password";
      valueInput.type = visible ? "text" : "password";
      reveal.textContent = visible ? "Ocultar" : "Mostrar";
    });
    const remove = document.createElement("button");
    remove.className = "button secondary resource-action";
    remove.type = "button";
    remove.textContent = "Quitar";
    remove.disabled = readOnly;
    remove.addEventListener("click", () => row.remove());
    actions.append(reveal, remove);
    row.append(nameField, valueField, actions);
    rows.append(row);
  };

  for (const [name, value] of Object.entries(environment)) addRow(name, value);
  if (Object.keys(environment).length === 0) {
    status.textContent = readOnly
      ? "Este proyecto está configurado para servir archivos estáticos. Para usar variables de entorno, cámbialo a una aplicación dinámica y guarda la configuración."
      : "Todavía no hay variables. Añade las que necesite la aplicación.";
  }
  addVariable.addEventListener("click", () => {
    addRow();
    rows.lastElementChild?.querySelector("input")?.focus();
    status.textContent = "";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nextEnvironment = Object.create(null);
    for (const row of rows.querySelectorAll(".project-environment-row")) {
      const [nameInput, valueInput] = row.querySelectorAll("input");
      const name = nameInput.value.trim();
      const value = valueInput.value;
      if (!name && !value) continue;
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name)) {
        status.textContent = "Usa nombres de variable válidos, por ejemplo API_KEY o DATABASE_URL.";
        nameInput.focus();
        return;
      }
      if (Object.hasOwn(nextEnvironment, name)) {
        status.textContent = `La variable ${name} está repetida.`;
        nameInput.focus();
        return;
      }
      nextEnvironment[name] = value;
    }
    save.disabled = true;
    addVariable.disabled = true;
    try {
      const result = await request(`/api/projects/${encodeURIComponent(projectId)}/environment`, {
        method: "PUT",
        body: JSON.stringify({ environment: nextEnvironment }),
      });
      status.textContent = result.message;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      save.disabled = false;
      addVariable.disabled = false;
    }
  });
  form.append(rows, enableEnvironment, addVariable, save, status);
  return form;
}

function renderProjects() {
  projectsList.replaceChildren();
  for (const id of [
    "project-detail-build-info",
    "project-detail-deployment-info",
    "project-detail-actions",
    "project-detail-source-info",
    "project-detail-file-tree",
    "project-detail-upload",
    "project-detail-environment",
    "project-detail-domains",
  ]) document.querySelector(`#${id}`).replaceChildren();
  const projectHistory = document.querySelector("#project-detail-history");
  projectHistory.querySelectorAll("ul").forEach((list) => list.remove());
  const selectedProjectId = window.location.pathname.match(/^\/projects\/([0-9a-f-]{36})$/i)?.[1].toLowerCase();
  if (projects.length === 0) {
    projectsStatus.textContent = "Todavía no hay proyectos. Crea uno para empezar.";
    renderMetricsProjectUrls();
    renderProjectRoute();
    return;
  }
  projectsStatus.textContent = `${projects.length} proyecto${projects.length === 1 ? "" : "s"} · Los pushes a la rama configurada se despliegan automáticamente cuando GitHub OAuth y el webhook público están disponibles. El estado de servicios y URLs se comprueba al cargar esta vista, sin sondeo periódico.`;
  for (const project of projects) {
    const assignedDomains = domainData.domains.filter((domain) => domain.projectId === project.id);
    const card = document.createElement("article");
    card.className = "project-item";
    const buildInfo = document.createElement("div");
    buildInfo.className = "project-release-label";
    const buildLabel = document.createElement("strong");
    buildLabel.textContent = "Última construcción";
    const buildValue = document.createElement("span");
    buildValue.textContent = project.latestBuild
      ? `${project.latestBuild.commitSha.slice(0, 12)}${project.latestBuild.branch ? ` · ${project.latestBuild.branch}` : ""}`
      : project.sourceType === "upload" && project.latestSource
        ? `Código listo · ${project.latestSource.sourceDigest.slice(0, 12)}`
        : "Todavía no construida";
    buildInfo.replaceChildren(buildLabel, buildValue);
    const deploymentInfo = document.createElement("div");
    deploymentInfo.className = "project-release-label";
    const deploymentLabel = document.createElement("strong");
    deploymentLabel.textContent = "Versión publicada";
    const deploymentValue = document.createElement("span");
    deploymentValue.textContent = project.deployment
      ? `${project.deployment.runningReplicas}/${project.deployment.desiredReplicas} instancias activas`
      : "Todavía no desplegada";
    deploymentInfo.replaceChildren(deploymentLabel, deploymentValue);
    const heading = document.createElement("div");
    heading.className = "card-heading";
    const title = document.createElement("h4");
    title.textContent = project.name;
    const state = document.createElement("span");
    state.className = "badge";
    state.textContent = project.deployment
      ? `${project.deployment.runningReplicas}/${project.deployment.desiredReplicas} réplicas`
      : project.latestBuild ? "Build listo" : "Sin despliegue";
    heading.append(title, state);
    const details = document.createElement("p");
    details.className = "muted";
    details.textContent = project.sourceType === "upload"
      ? "Subido desde ZIP o archivos"
      : `GitHub · ${project.repository} · ${project.productionBranch}`;
    const healthSummary = document.createElement("p");
    healthSummary.className = "muted project-health-status";
    healthSummary.dataset.state = project.health?.urlStatus ?? "unknown";
    healthSummary.textContent = projectHealthSummary(project.health);
    const urlList = document.createElement("div");
    urlList.className = "project-url-list";
    if (assignedDomains.length === 0) {
      const noUrls = document.createElement("span");
      noUrls.className = "muted";
      noUrls.textContent = "Sin URLs asignadas";
      urlList.append(noUrls);
    } else {
      for (const domain of assignedDomains) {
        const urlRow = document.createElement("div");
        urlRow.className = "project-url-row";
        const link = document.createElement("a");
        link.href = `https://${domain.hostname}/`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = domain.hostname;
        const urlHealth = project.health?.urls?.find((url) => url.hostname === domain.hostname);
        const urlState = document.createElement("span");
        urlState.className = "muted project-health-status";
        urlState.dataset.state = urlHealth?.state ?? "unknown";
        urlState.textContent = projectUrlHealthLabel(urlHealth);
        urlRow.append(link, urlState);
        urlList.append(urlRow);
      }
    }
    card.append(heading, details, buildInfo, deploymentInfo, healthSummary, urlList);

    const actions = document.createElement("div");
    actions.className = "project-actions";
    const makeButton = (text, handler, disabled = false) => {
      const button = document.createElement("button");
      button.className = "button secondary";
      button.type = "button";
      button.textContent = text;
      button.disabled = disabled;
      button.addEventListener("click", handler);
      return button;
    };
    const manage = document.createElement("a");
    manage.className = "button secondary";
    manage.href = `/projects/${encodeURIComponent(project.id)}`;
    manage.textContent = "Administrar";
    const deploymentNeedsRetry = !project.deployment
      || project.deployment.runningReplicas < project.deployment.desiredReplicas
      || project.deployment.configurationCurrent === false;
    if (project.latestBuild && deploymentNeedsRetry) {
      const retryDeploy = document.createElement("button");
      retryDeploy.className = "button project-publish-button";
      retryDeploy.type = "button";
      retryDeploy.textContent = "Reintentar deploy";
      retryDeploy.addEventListener("click", async () => {
        retryDeploy.disabled = true;
        try {
          projectsStatus.textContent = `Reintentando el deploy de ${project.name}…`;
          await requestProjectDeployment(project, (message) => {
            projectsStatus.textContent = message;
            retryDeploy.textContent = message.includes("En cola") || message.includes("en curso")
              ? "Deploy en curso…"
              : "Reintentar deploy";
          });
        } catch (error) {
          projectsStatus.textContent = `No se pudo desplegar ${project.name}: ${error.message}`;
        } finally {
          await loadProjects();
          retryDeploy.disabled = false;
          retryDeploy.textContent = "Reintentar deploy";
        }
      });
      actions.append(retryDeploy);
    }
    const removeProject = makeButton("Eliminar", async () => {
      const cleanupDescription = [
        project.deployment ? "se retirará su servicio del VPS" : "",
        assignedDomains.length ? `se quitarán ${assignedDomains.length} dominio(s) asignado(s)` : "",
      ].filter(Boolean).join(" y ");
      const consequences = cleanupDescription
        ? ` También ${cleanupDescription}; se eliminarán sus registros DNS administrados en Cloudflare.`
        : "";
      if (!confirm(`¿Eliminar el proyecto ${project.name}? No se puede deshacer.${consequences}`)) return;
      removeProject.disabled = true;
      removeProject.textContent = "Eliminando…";
      try {
        await deleteProjectAndResources(project, assignedDomains, (message) => {
          projectsStatus.textContent = message;
          removeProject.textContent = message.includes("Retirando") ? "Retirando…" : "Eliminando…";
        });
        projectsStatus.textContent = `Se eliminó ${project.name} y sus dominios asignados con sus registros DNS administrados.`;
        if (selectedProjectId === project.id.toLowerCase()) returnToProjectsRoute();
        await Promise.all([loadProjects(), loadDomains()]);
      } catch (error) {
        projectsStatus.textContent = `No se pudo completar la eliminación de ${project.name}: ${error.message}`;
      } finally {
        removeProject.disabled = false;
        removeProject.textContent = "Eliminar";
      }
    });
    removeProject.classList.add("button-danger");
    actions.append(manage, removeProject);
    card.append(actions);
    projectsList.append(card);
    if (selectedProjectId !== project.id.toLowerCase()) continue;

    const primaryDomain = assignedDomains[0];
    const productionDomainLink = document.querySelector("#project-production-domain");
    const productionDomainEmpty = document.querySelector("#project-production-domain-empty");
    productionDomainLink.hidden = !primaryDomain;
    productionDomainEmpty.hidden = Boolean(primaryDomain);
    if (primaryDomain) {
      productionDomainLink.href = `https://${primaryDomain.hostname}/`;
      productionDomainLink.textContent = `https://${primaryDomain.hostname}`;
    }
    const headerOpenLink = document.querySelector("#project-header-open");
    headerOpenLink.hidden = !primaryDomain || !project.deployment;
    if (primaryDomain) headerOpenLink.href = productionDomainLink.href;
    document.querySelector("#project-production-source").textContent = project.sourceType === "upload"
      ? "Código fuente cargado manualmente"
      : `${project.repository} · rama de producción: ${project.productionBranch}`;
    const productionStatus = projectProductionStatus(project.health);
    const productionStatusBadge = document.querySelector("#project-production-status");
    productionStatusBadge.textContent = productionStatus.label;
    productionStatusBadge.dataset.state = productionStatus.state;
    document.querySelector("#project-production-trigger").textContent = project.sourceType === "github"
      ? project.autoDeploy
        ? `Despliegue automático al recibir cambios en ${project.productionBranch}`
        : `Despliegue manual · rama ${project.productionBranch}`
      : "Origen ZIP · compilación y despliegue manuales";
    renderProjectRuntimeSummary(project);

    document.querySelector("#project-detail-build-info").append(buildInfo);
    document.querySelector("#project-detail-deployment-info").append(deploymentInfo);

    if (project.sourceType === "upload") {
      document.querySelector("#project-detail-source-info").textContent = project.latestSource
        ? `ZIP cargado · ${project.latestSource.sourceDigest.slice(0, 12)} · ${Math.ceil(project.latestSource.sizeBytes / 1024)} KiB`
        : "Aún no se han cargado archivos.";
      const projectFileTree = document.querySelector("#project-detail-file-tree");
      if (project.latestSource) {
        projectFileTree.replaceChildren(Object.assign(document.createElement("li"), {
          textContent: "Consultando archivos…",
        }));
        void request(`/api/projects/${encodeURIComponent(project.id)}/source/files`)
          .then(({ files }) => {
            if (currentProjectEdit?.id === project.id) renderProjectFileTree(files, projectFileTree);
          })
          .catch((error) => {
            if (currentProjectEdit?.id !== project.id) return;
            projectFileTree.replaceChildren(Object.assign(document.createElement("li"), {
              textContent: `No se pudieron consultar los archivos: ${error.message}`,
            }));
          });
      } else {
        projectFileTree.replaceChildren();
      }
      const uploadForm = document.createElement("form");
      uploadForm.className = "project-upload-form";
      const uploadLabel = document.createElement("label");
      const file = document.createElement("input");
      file.id = `project-archive-${project.id}`;
      uploadLabel.textContent = "Reemplazar archivos ZIP";
      uploadLabel.htmlFor = file.id;
      file.type = "file";
      file.accept = ".zip,application/zip";
      file.required = true;
      file.setAttribute("aria-label", `Archivo ZIP del proyecto ${project.name}`);
      const upload = document.createElement("button");
      upload.className = "button secondary";
      upload.type = "submit";
      upload.textContent = "Subir ZIP";
      uploadForm.append(uploadLabel, file, upload);
      uploadForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const archive = file.files?.[0];
        if (!archive || archive.size > 32 * 1024 * 1024) {
          projectsStatus.textContent = "Selecciona un ZIP de hasta 32 MiB.";
          return;
        }
        upload.disabled = true;
        projectsStatus.textContent = `Guardando el código de ${project.name}…`;
        try {
          const result = await request(`/api/projects/${encodeURIComponent(project.id)}/source`, {
            method: "PUT",
            headers: { "Content-Type": "application/zip" },
            body: archive,
          });
          projectsStatus.textContent = `ZIP guardado (${result.source.sourceDigest.slice(0, 12)}).`;
          await loadProjects();
        } catch (error) {
          projectsStatus.textContent = error.message;
        } finally {
          upload.disabled = false;
        }
      });
      document.querySelector("#project-detail-upload").append(uploadForm);
    } else {
      document.querySelector("#project-detail-source-info").textContent =
        `Repositorio ${project.repository} · rama ${project.productionBranch}`;
    }

    const buildOperation = project.latestBuildOperation;
    const buildInProgress = ["pending", "in_progress"].includes(buildOperation?.status);
    const publishButton = makeButton(
      buildInProgress ? "Construcción en curso…" : "Construir y desplegar",
      async () => {
        publishButton.disabled = true;
        publishButton.textContent = "Solicitando compilación…";
        projectsStatus.textContent = `Construyendo ${project.name}; se desplegará automáticamente al finalizar.`;
        try {
          const result = await request(`/api/projects/${encodeURIComponent(project.id)}/build`, {
            method: "POST",
            body: JSON.stringify({}),
          });
          projectDeployAfterBuild.add(project.id);
          projectsStatus.textContent = `${result.message} El despliegue comenzará al terminar la compilación.`;
          await pollProjectBuildStatus(project.id);
        } catch (error) {
          projectDeployAfterBuild.delete(project.id);
          const operation = await pollProjectBuildStatus(project.id);
          projectsStatus.textContent = ["pending", "in_progress"].includes(operation?.status)
            ? "Ya hay una construcción activa. Puedes consultar su salida en esta página."
            : error.message;
          if (!["pending", "in_progress"].includes(operation?.status)) {
            publishButton.disabled = project.sourceType === "upload" && !project.latestSource;
            publishButton.textContent = "Construir y desplegar";
          }
        }
      },
      (project.sourceType === "upload" && !project.latestSource) || buildInProgress,
    );
    publishButton.classList.add("project-publish-button");
    publishButton.dataset.projectPublish = project.id;
    actions.append(publishButton);
    const advancedActions = document.createElement("details");
    advancedActions.className = "project-advanced-actions";
    const advancedSummary = document.createElement("summary");
    advancedSummary.textContent = "Acciones avanzadas";
    advancedActions.append(advancedSummary);
    const buildButton = makeButton(buildInProgress ? "Construcción en curso…" : "Construir", async () => {
      buildButton.disabled = true;
      buildButton.textContent = "Solicitando construcción…";
      projectsStatus.textContent = `Construyendo ${project.name}…`;
      try {
        const result = await request(`/api/projects/${encodeURIComponent(project.id)}/build`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        projectsStatus.textContent = result.message;
        await pollProjectBuildStatus(project.id);
      } catch (error) {
        const operation = await pollProjectBuildStatus(project.id);
        projectsStatus.textContent = ["pending", "in_progress"].includes(operation?.status)
          ? "Ya hay una construcción activa para este proyecto. Se muestra su progreso y BuildKit en los registros de abajo."
          : error.message;
      }
    }, (project.sourceType === "upload" && !project.latestSource) || buildInProgress);
    buildButton.dataset.projectBuild = project.id;
    buildButton.textContent = "Construir sin desplegar";
    advancedActions.append(buildButton);

    const currentBuild = project.latestBuild;
    const currentDeployment = project.deployment;
    const deploymentCurrent = Boolean(currentBuild && currentDeployment
      && currentBuild.commitSha === currentDeployment.commitSha
      && currentDeployment.runningReplicas === currentDeployment.desiredReplicas
      && currentDeployment.configurationCurrent);
    const deployButton = makeButton(
      currentDeployment ? "Re-desplegar versión lista" : "Reintentar deploy",
      async () => {
        deployButton.disabled = true;
        deployButton.textContent = "Deploy en curso…";
        try {
          await requestProjectDeployment(project, (message) => {
            projectsStatus.textContent = message;
          });
        } catch (error) {
          projectsStatus.textContent = `No se pudo desplegar ${project.name}: ${error.message}`;
        } finally {
          deployButton.disabled = false;
          deployButton.textContent = currentDeployment ? "Re-desplegar versión lista" : "Reintentar deploy";
        }
      },
      !currentBuild || deploymentCurrent,
    );
    deployButton.dataset.projectDeploy = project.id;
    advancedActions.append(deployButton);

    const rollbackTarget = project.deploymentHistory?.find((item) =>
      item.status === "completed" && item.image && item.commitSha
      && item.commitSha !== currentDeployment?.commitSha);
    if (rollbackTarget) {
      advancedActions.append(makeButton(`Revertir a ${rollbackTarget.commitSha.slice(0, 12)}`, async () => {
        if (!confirm(`¿Volver ${project.name} al despliegue ${rollbackTarget.commitSha.slice(0, 12)}? Se conservará la configuración actual.`)) return;
        try {
          const result = await request(`/api/projects/${encodeURIComponent(project.id)}/rollback`, {
            method: "POST",
            body: JSON.stringify({ commitSha: rollbackTarget.commitSha }),
          });
          projectsStatus.textContent = result.message;
          await Promise.all([loadProjects(), loadTaskHistory()]);
        } catch (error) {
          projectsStatus.textContent = error.message;
        }
      }));
    }
    if (currentDeployment) {
      advancedActions.append(makeButton("Retirar servicio", async () => {
        if (!confirm(`¿Retirar el servicio de ${project.name}?`)) return;
        try {
          const result = await request(`/api/projects/${encodeURIComponent(project.id)}/deployment`, {
            method: "DELETE",
          });
          projectsStatus.textContent = result.message;
          await loadProjects();
        } catch (error) {
          projectsStatus.textContent = error.message;
        }
      }));
    }
    if (advancedActions.children.length > 1) actions.append(advancedActions);
    document.querySelector("#project-detail-actions").append(actions);
    renderProjectBuildOperation(project.id, buildOperation);
    if (buildInProgress) scheduleProjectBuildPoll(project.id);

    const history = document.querySelector("#project-detail-history");
    history.querySelector("summary").textContent =
      `Historial de implementaciones (${project.deploymentHistory?.length ?? 0})`;
    if (project.deploymentHistory?.length) {
      const list = document.createElement("ul");
      list.className = "project-history";
      for (const item of project.deploymentHistory.slice(0, 10)) {
        const entry = document.createElement("li");
        const status = {
          completed: "completada",
          failed: "fallida",
          pending: "en cola",
          in_progress: "en curso",
        }[item.status] ?? item.status;
        entry.textContent = `${item.commitSha?.slice(0, 12) ?? "sin commit"} · ${status} · ${new Date(item.completedAt).toLocaleString("es-MX")}${item.image ? ` · ${item.image}` : item.error ? ` · ${item.error}` : ""}`;
        list.append(entry);
      }
      history.append(list);
    }

    const assignedDomainsHeading = document.createElement("h4");
    assignedDomainsHeading.textContent = `Dominios asignados (${assignedDomains.length})`;
    document.querySelector("#project-detail-domains").append(assignedDomainsHeading);
    const routeIsReady = Boolean(currentDeployment?.routesCurrent && currentDeployment.runningReplicas > 0);
    for (const domain of assignedDomains) {
      const domainRow = document.createElement("div");
      domainRow.className = "project-actions project-domain-row";
      domainRow.dataset.hostname = domain.hostname;
      const hostname = document.createElement("a");
      hostname.href = `https://${domain.hostname}/`;
      hostname.target = "_blank";
      hostname.rel = "noopener noreferrer";
      hostname.textContent = `https://${domain.hostname}/`;
      const urlHealth = project.health?.urls?.find((item) => item.hostname === domain.hostname);
      const healthStatus = document.createElement("span");
      healthStatus.className = "muted project-health-status";
      healthStatus.dataset.state = urlHealth?.state ?? "unknown";
      healthStatus.dataset.projectUrlHealth = "";
      healthStatus.textContent = projectUrlHealthLabel(urlHealth);
      domainRow.append(hostname, healthStatus);
      if (currentDeployment?.runningReplicas > 0 && urlHealth?.state !== "online") {
        const repairStatus = document.createElement("span");
        repairStatus.className = "muted";
        repairStatus.setAttribute("role", "status");
        const repairRoute = document.createElement("button");
        repairRoute.className = "button secondary";
        repairRoute.type = "button";
        repairRoute.dataset.projectRouteRepair = "";
        repairRoute.textContent = "Reparar ruta automáticamente";
        repairRoute.addEventListener("click", () =>
          repairProjectRoute(project.id, domain.hostname, repairStatus, repairRoute));
        domainRow.append(repairRoute, repairStatus);
      }
      const removeDomain = document.createElement("button");
      removeDomain.className = "button secondary";
      removeDomain.type = "button";
      removeDomain.textContent = "Quitar y borrar DNS";
      removeDomain.addEventListener("click", async () => {
        if (!confirm(`¿Quitar ${domain.hostname} del proyecto y borrar su registro DNS administrado en Cloudflare?`)) return;
        try {
          await request(`/api/domains/${encodeURIComponent(domain.id)}`, { method: "DELETE" });
          await Promise.all([loadDomains(), loadProjects()]);
        } catch (error) {
          projectsStatus.textContent = error.message;
        }
      });
      const openSite = document.createElement("a");
      openSite.className = "button secondary";
      openSite.href = hostname.href;
      openSite.target = "_blank";
      openSite.rel = "noopener noreferrer";
      openSite.dataset.projectOpenSite = "";
      openSite.textContent = "Ver sitio";
      openSite.hidden = !routeIsReady;
      domainRow.append(openSite);
      if (!routeIsReady) {
        const routeStatus = document.createElement("span");
        routeStatus.className = "muted";
        routeStatus.dataset.projectRouteStatus = "";
        routeStatus.textContent = currentDeployment
          ? "Activando ruta automáticamente…"
          : "La ruta se activará automáticamente al desplegar el proyecto.";
        domainRow.append(routeStatus);
      }
      domainRow.append(removeDomain);
      document.querySelector("#project-detail-domains").append(domainRow);
    }
    const availableZones = domainData.zones.filter((zone) =>
      zone.connectionStatus === "connected" && zone.tokenConfigured);
    const domainForm = document.createElement("form");
    domainForm.className = "form-stack project-domain-form";
    const zoneSelect = document.createElement("select");
    zoneSelect.setAttribute("aria-label", `Zona de dominio para ${project.name}`);
    zoneSelect.required = true;
    zoneSelect.add(new Option("Selecciona dominio conectado", ""));
    for (const zone of availableZones) zoneSelect.add(new Option(zone.zone, zone.zone));
    const subdomainInput = document.createElement("input");
    subdomainInput.type = "text";
    subdomainInput.placeholder = "www (o @ para usar el dominio raíz)";
    subdomainInput.autocomplete = "off";
    subdomainInput.required = true;
    subdomainInput.setAttribute("aria-label", `Subdominio del proyecto ${project.name}`);
    const domainStatus = document.createElement("span");
    domainStatus.className = "muted";
    domainStatus.setAttribute("role", "status");
    domainStatus.textContent = availableZones.length
      ? "Elige una zona conectada y el subdominio que quieres asignar."
      : "No hay dominios conectados y verificados. Conecta primero una zona en Dominios.";
    if (availableZones.length === 0) {
      const connectDomains = document.createElement("a");
      connectDomains.href = "/#tab-domains";
      connectDomains.textContent = "Ir a conectar dominio";
      domainForm.append(connectDomains);
    }
    const addDomain = document.createElement("button");
    addDomain.className = "button secondary";
    addDomain.type = "submit";
    addDomain.textContent = "Asignar dominio";
    addDomain.disabled = availableZones.length === 0;
    const assignmentRow = document.createElement("div");
    assignmentRow.className = "project-domain-assignment";
    assignmentRow.append(subdomainInput, zoneSelect, addDomain);
    domainForm.append(assignmentRow, domainStatus);
    domainForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const zone = zoneSelect.value;
      const subdomain = subdomainInput.value.trim();
      if (!zone || !subdomain) {
        domainStatus.textContent = "Selecciona un dominio conectado e indica un subdominio o @ para el dominio raíz.";
        return;
      }
      const hostname = subdomain === "@" ? zone : `${subdomain}.${zone}`;
      addDomain.disabled = true;
      let domainWasSaved = false;
      try {
        const result = await request("/api/domains", {
          method: "POST",
          body: JSON.stringify({
            zone,
            hostname,
            projectId: project.id,
            port: project.internalPort,
            proxied: availableZones.find((candidate) => candidate.zone === zone)?.proxied ?? false,
          }),
        });
        domainWasSaved = true;
        await Promise.all([loadDomains(), loadProjects()]);
        const refreshedStatus = document.querySelector("#project-detail-domains form [role='status']");
        if (refreshedStatus) refreshedStatus.textContent = result.message;
        const verification = await waitForProjectRouteHealth(
          project.id,
          hostname,
          (message) => {
            const status = document.querySelector("#project-detail-domains form [role='status']");
            if (status) status.textContent = message;
          },
        );
        const status = document.querySelector("#project-detail-domains form [role='status']");
        if (status) {
          if (!verification.routesCurrent) {
            status.textContent = !verification.deployment
              ? "Dominio guardado. La ruta se activará automáticamente cuando despliegues el proyecto."
              : "Dominio guardado. La ruta aún no está activa; espera la operación del VPS o usa Reparar ruta automáticamente.";
          } else if (verification.health?.state === "online") {
            status.textContent = "Dominio activo y URL disponible.";
          } else if (verification.health?.httpStatus === 404) {
            status.textContent = "La ruta está activa, pero la aplicación devuelve 404 en /. Revisa su ruta raíz; si el 404 dice “404 page not found”, usa Reparar ruta automáticamente.";
          } else {
            status.textContent = verification.health?.error
              ?? "La ruta se activó, pero la URL todavía no responde correctamente.";
          }
        }
      } catch (error) {
        const status = document.querySelector("#project-detail-domains form [role='status']") ?? domainStatus;
        status.textContent = domainWasSaved
          ? `Dominio guardado, pero no se pudo verificar el estado de la ruta: ${error.message}`
          : `No se pudo asignar el dominio: ${error.message}`;
      } finally {
        addDomain.disabled = availableZones.length === 0;
      }
    });
    document.querySelector("#project-detail-domains").append(domainForm);

    const environmentPanel = document.querySelector("#project-detail-environment");
    const environmentStatus = document.createElement("p");
    environmentStatus.className = "muted";
    environmentStatus.setAttribute("role", "status");
    environmentStatus.setAttribute("aria-live", "polite");
    environmentStatus.textContent = "Cargando variables…";
    environmentPanel.append(environmentStatus);
    void request(`/api/projects/${encodeURIComponent(project.id)}/environment`)
      .then(({ environment }) => {
        environmentStatus.remove();
        environmentPanel.append(createProjectEnvironmentEditor(project.id, environment, {
          readOnly: project.deploymentType !== "dynamic",
        }));
      })
      .catch((error) => {
        environmentStatus.textContent = `No se pudieron cargar las variables: ${error.message}`;
      });
  }
  renderMetricsProjectUrls();
  renderProjectRoute();
}

function resetDomainZoneForm() {
  domainZoneForm.reset();
  domainZoneProxied = false;
  domainZoneIdInput.value = "";
  domainZoneNameInput.disabled = false;
  domainZoneDialogTitle.textContent = "Conectar dominio raíz";
  domainZoneSaveButton.textContent = "Conectar dominio";
  domainZoneTokenInput.required = true;
  domainZoneTokenInput.placeholder = "Token de Cloudflare";
  domainZoneFormStatus.textContent = "";
}

function renderDomainZones(zones) {
  domainZonesList.replaceChildren();
  if (zones.length === 0) {
    domainZonesStatus.textContent = "Todavía no hay dominios raíz conectados.";
    return;
  }
  const connectedCount = zones.filter((zone) =>
    zone.tokenConfigured && zone.connectionStatus === "connected").length;
  const connectingCount = zones.filter((zone) =>
    zone.connectionStatus === "connecting").length;
  const failedCount = zones.length - connectedCount - connectingCount;
  domainZonesStatus.textContent = [
    `${connectedCount} conectado${connectedCount === 1 ? "" : "s"}`,
    ...(connectingCount ? [`${connectingCount} conectando`] : []),
    ...(failedCount ? [`${failedCount} con error`] : []),
  ].join(" · ");
  for (const zone of zones) {
    const connectionStatus = zone.tokenConfigured
      ? zone.connectionStatus
      : "failed";
    const row = document.createElement("div");
    row.className = "resource";
    const main = document.createElement("div");
    main.className = "resource-main";
    const name = document.createElement("div");
    name.className = "resource-name";
    name.textContent = zone.zone;
    const status = document.createElement("span");
    status.className = `domain-zone-status domain-zone-status-${connectionStatus}`;
    status.setAttribute("role", "status");
    status.textContent = {
      connected: "Conectado",
      connecting: "Conectando…",
      failed: "Falló la conexión",
    }[connectionStatus] ?? "Estado desconocido";
    const details = document.createElement("div");
    details.className = "resource-detail domain-zone-detail";
    details.textContent = `Cloudflare · token ${zone.tokenConfigured ? "guardado" : "faltante"} · proxy ${zone.proxied ? "activo" : "inactivo"} por defecto`;
    main.append(name, status, details);
    if (zone.connectionError) {
      const error = document.createElement("div");
      error.className = "domain-zone-error";
      error.textContent = zone.connectionError;
      main.append(error);
    }
    if (zone.lastCheckedAt) {
      const checkedAt = document.createElement("div");
      checkedAt.className = "resource-detail domain-zone-detail";
      checkedAt.textContent = `Última verificación: ${new Date(zone.lastCheckedAt).toLocaleString("es-MX")}`;
      main.append(checkedAt);
    }

    const actions = document.createElement("div");
    actions.className = "resource-actions";
    const edit = document.createElement("button");
    edit.className = "button secondary resource-action";
    edit.type = "button";
    edit.textContent = connectionStatus === "connected" ? "Editar" : "Reconectar";
    edit.addEventListener("click", () => {
      domainZoneIdInput.value = zone.id;
      domainZoneNameInput.value = zone.zone;
      domainZoneNameInput.disabled = true;
      domainZoneProxied = zone.proxied;
      domainZoneTokenInput.value = "";
      domainZoneTokenInput.required = !zone.tokenConfigured;
      domainZoneTokenInput.placeholder = zone.tokenConfigured
        ? "Deja vacío para conservar el token actual"
        : "Token de Cloudflare";
      domainZoneDialogTitle.textContent = connectionStatus === "connected"
        ? `Editar ${zone.zone}`
        : `Reconectar ${zone.zone}`;
      domainZoneSaveButton.textContent = connectionStatus === "connected"
        ? "Guardar cambios"
        : "Reintentar conexión";
      domainZoneFormStatus.textContent = "";
      domainZoneDialog.showModal();
      domainZoneTokenInput.focus();
    });

    const verify = document.createElement("button");
    verify.className = "button secondary resource-action";
    verify.type = "button";
    verify.textContent = "Verificar";
    verify.disabled = connectionStatus === "connecting" || !zone.tokenConfigured;
    verify.addEventListener("click", async () => {
      verify.disabled = true;
      verify.textContent = "Verificando…";
      status.className = "domain-zone-status domain-zone-status-connecting";
      status.textContent = "Verificando…";
      domainZonesStatus.textContent = `Comprobando la conexión de ${zone.zone} en Cloudflare…`;
      try {
        const result = await request(
          `/api/domain-zones/${encodeURIComponent(zone.id)}/verify`,
          { method: "POST" },
        );
        await Promise.all([loadDomains(), loadN8nApplication()]);
        domainZonesStatus.textContent = result.message;
      } catch (error) {
        await loadDomains();
        domainZonesStatus.textContent = error.message;
      }
    });

    const remove = document.createElement("button");
    remove.className = "button secondary resource-action";
    remove.type = "button";
    remove.textContent = "Desconectar";
    remove.addEventListener("click", async () => {
      if (!confirm(`¿Desconectar ${zone.zone}? No se eliminarán registros DNS de Cloudflare.`)) return;
      remove.disabled = true;
      try {
        const result = await request(`/api/domain-zones/${encodeURIComponent(zone.id)}`, { method: "DELETE" });
        domainZonesStatus.textContent = result.message;
        await Promise.all([loadDomains(), loadN8nApplication()]);
      } catch (error) {
        domainZonesStatus.textContent = error.message;
        remove.disabled = false;
      }
    });
    actions.append(edit, verify, remove);
    row.append(main, actions);
    domainZonesList.append(row);
  }
}

function renderAssignedDomains(domains) {
  assignedDomainsList.replaceChildren();
  if (domains.length === 0) {
    assignedDomainsStatus.textContent = "No hay dominios asignados a proyectos o aplicaciones.";
    return;
  }
  assignedDomainsStatus.textContent = `${domains.length} dominio${domains.length === 1 ? "" : "s"} asignado${domains.length === 1 ? "" : "s"}.`;
  for (const domain of domains) {
    const row = document.createElement("div");
    row.className = "resource";
    const main = document.createElement("div");
    main.className = "resource-main";
    const name = document.createElement("div");
    name.className = "resource-name";
    name.textContent = domain.hostname;
    const detail = document.createElement("div");
    detail.className = "resource-detail domain-zone-detail";
    detail.textContent = `${domain.zone} · ${domain.projectName} · Cloudflare${domain.proxied ? " Proxy" : ""}`;
    main.append(name, detail);
    row.append(main);
    assignedDomainsList.append(row);
  }
}

async function loadDomains() {
  domainZonesStatus.textContent = "Consultando dominios conectados…";
  try {
    const result = await request("/api/domains");
    domainData = result;
    renderManualApplicationZones(result.zones);
    ingressIpInput.value = result.ingressIp ?? "";
    cloudflareTunnelOriginSelect.value = result.tunnel?.originProtocol
      ?? result.defaultTunnelOriginProtocol
      ?? "https";
    cloudflareTunnelOriginSelect.querySelector('option[value="http"]').disabled
      = !result.localTunnelOriginAvailable;
    ingressIpCard.hidden = result.ingressMode === "cloudflare-tunnel";
    renderDomainZones(result.zones);
    renderCloudflareTunnelManagerZones(result.zones, result.tunnel);
    renderCloudflareTunnel(result.tunnel, result.tunnelStatusError);
    renderAssignedDomains(result.domains);
    if (["pending", "in_progress"].includes(result.tunnel?.latestTask?.status)) {
      if (cloudflareTunnelPollTimer !== undefined) clearTimeout(cloudflareTunnelPollTimer);
      cloudflareTunnelPollTimer = setTimeout(() => {
        cloudflareTunnelPollTimer = undefined;
        void loadDomains();
      }, 3000);
    } else if (cloudflareTunnelPollTimer !== undefined) {
      clearTimeout(cloudflareTunnelPollTimer);
      cloudflareTunnelPollTimer = undefined;
    }
    if (projects.length) renderProjects();
  } catch (error) {
    domainData = { zones: [], domains: [] };
    renderManualApplicationZones([]);
    domainZonesList.replaceChildren();
    assignedDomainsList.replaceChildren();
    domainZonesStatus.textContent = error.message;
    assignedDomainsStatus.textContent = error.message;
    cloudflareTunnelStatus.textContent = `No se pudo consultar el estado: ${error.message}`;
  }
}

function renderCloudflareTunnelManagerZones(zones, tunnel) {
  const options = [new Option("Sin hostname propio para el panel", "")];
  for (const zone of zones) {
    const option = new Option(
      `${zone.zone}${zone.connectionStatus === "connected" && zone.tokenConfigured ? "" : " (revisar conexión)"}`,
      zone.id,
    );
    options.push(option);
  }
  cloudflareTunnelManagerZoneSelect.replaceChildren(...options);
  cloudflareTunnelManagerZoneSelect.value = tunnel?.managerZoneId ?? "";
  cloudflareTunnelManagerSubdomainInput.value = tunnel?.managerSubdomain ?? "";
  cloudflareTunnelManagerZoneSelect.required = Boolean(cloudflareTunnelManagerSubdomainInput.value.trim());
}

cloudflareTunnelManagerSubdomainInput.addEventListener("input", () => {
  cloudflareTunnelManagerZoneSelect.required = Boolean(cloudflareTunnelManagerSubdomainInput.value.trim());
});

function renderCloudflareTunnel(tunnel, tunnelStatusError) {
  const task = tunnel?.latestTask;
  cloudflareTunnelStatus.setAttribute("role", task?.status === "failed" || tunnelStatusError ? "alert" : "status");
  if (!tunnel) {
    cloudflareTunnelStatus.textContent = tunnelStatusError
      ?? "No hay un túnel configurado. Puedes crear uno para publicar servicios sin IPv4 pública ni puertos abiertos.";
    cloudflareTunnelAccountInput.readOnly = false;
    cloudflareTunnelNameInput.readOnly = false;
    cloudflareTunnelTokenInput.required = true;
    cloudflareTunnelTokenInput.placeholder = "";
    cloudflareTunnelSaveButton.textContent = "Crear y conectar túnel";
    cloudflareTunnelOriginSelect.disabled = true;
    cloudflareTunnelManagerSubdomainInput.value = "";
    cloudflareTunnelManagerZoneSelect.value = "";
    return;
  }
  cloudflareTunnelOriginSelect.value = tunnel.originProtocol ?? "https";
  cloudflareTunnelOriginSelect.disabled = false;
  cloudflareTunnelAccountInput.value = tunnel.accountId;
  cloudflareTunnelNameInput.value = tunnel.name;
  cloudflareTunnelAccountInput.readOnly = true;
  cloudflareTunnelNameInput.readOnly = true;
  cloudflareTunnelTokenInput.required = !tunnel.configured;
  cloudflareTunnelTokenInput.placeholder = tunnel.configured
    ? "Vacío para reutilizar el token guardado"
    : "";
  cloudflareTunnelSaveButton.textContent = tunnel.configured
    ? "Reconectar túnel"
    : "Actualizar token y reconectar";
  const taskStatus = tunnel.lastError
    ? `Falló la última configuración. Motivo: ${tunnel.lastError}`
    : task?.status === "pending"
    ? "Solicitud aceptada; esperando que el agente del VPS tome la tarea."
    : task?.status === "in_progress"
      ? "El agente está configurando el conector de Cloudflare en Swarm."
      : task?.status === "completed"
        ? `Conectado correctamente. ${task.result?.message ?? "El conector de Cloudflare está activo en Swarm."}`
        : task?.status === "failed"
          ? `Falló la conexión. Motivo: ${task.error || "la tarea falló sin proporcionar detalles."}`
              : "El túnel está creado; todavía no hay una tarea de conexión registrada.";
  const recoveryGuidance = tunnel.lastError || task?.status === "failed"
    ? "Acción: pulsa «Reconectar túnel» para intentarlo de nuevo. Si el API Token caducó, sustitúyelo por uno con permiso Account → Cloudflare Tunnel → Edit."
    : "";
  cloudflareTunnelStatus.textContent = [
    `Cloudflare Tunnel “${tunnel.name}” (${tunnel.tunnelId}).`,
    tunnel.managerHostname ? `Panel: https://${tunnel.managerHostname}.` : "El panel no tiene un hostname propio en el túnel.",
    tunnel.configured ? "API Token protegido." : "Falta el API Token protegido; vuelve a introducirlo.",
    taskStatus,
    task?.id ? `Tarea: ${task.id}.` : "",
    tunnelStatusError ?? "",
    recoveryGuidance,
  ].filter(Boolean).join(" ");
}

cloudflareTunnelOriginSelect.addEventListener("change", async () => {
  const originProtocol = cloudflareTunnelOriginSelect.value;
  cloudflareTunnelOriginSelect.disabled = true;
  cloudflareTunnelOriginStatus.textContent = "Actualizando la configuración de ingreso del túnel…";
  try {
    const result = await request("/api/cloudflare/tunnel/origin", {
      method: "PUT",
      body: JSON.stringify({ originProtocol }),
    });
    cloudflareTunnelOriginStatus.textContent = result.message;
    await loadDomains();
  } catch (error) {
    cloudflareTunnelOriginStatus.textContent = error.message;
    cloudflareTunnelOriginStatus.setAttribute("role", "alert");
    void loadDomains();
  } finally {
    cloudflareTunnelOriginSelect.disabled = false;
  }
});

function openNewDomainZoneDialog() {
  resetDomainZoneForm();
  domainZoneDialog.showModal();
  domainZoneNameInput.focus();
}

function getApplicationVersionFromImage(image) {
  const tag = image.match(/:([^/:@]+)$/)?.[1];
  return tag && (/^\d+\.\d+\.\d+$/.test(tag) || tag === "latest") ? tag : "latest";
}

function getApplicationTemplateDefinition(templateId = manualApplicationTemplate.value) {
  return applicationTemplateDefinitions.get(templateId);
}

function applyManualApplicationTemplate() {
  const definition = getApplicationTemplateDefinition();
  const isN8n = definition?.kind === "n8n";
  const isSupabase = definition?.kind === "supabase";
  const defaults = definition?.defaults ?? {};
  const fields = Object.fromEntries(
    ["name", "id", "version", "category", "description", "image", "port", "volumeTarget", "cpus", "memoryMb"]
      .map((name) => [name, manualApplicationForm.elements.namedItem(name)]),
  );
  for (const [name, value] of Object.entries(defaults)) {
    const field = fields[name] ?? manualApplicationForm.elements.namedItem(name);
    if (field && value !== undefined) field.value = String(value);
  }
  if (!isN8n && fields.version.value === "latest") {
    fields.version.value = "1.0.0";
    fields.image.value = "";
  }
  manualApplicationCard.hidden = isSupabase;
  supabaseCreateForm.hidden = !isSupabase;
  supabaseCreateForm.classList.toggle("hidden", !isSupabase);
  manualApplicationForm.hidden = isSupabase;
  document.querySelector("#manual-app-metadata-fields").hidden = isN8n;
  document.querySelector("#manual-app-fixed-fields").hidden = isN8n;
  document.querySelector("#manual-app-fixed-volume-field").hidden = isN8n;
  fields.volumeTarget.readOnly = isN8n;
  fields.image.placeholder = isN8n ? "n8nio/n8n:latest" : "docker.io/usuario/aplicacion:1.0.0";
  document.querySelector("#manual-app-environment-label").textContent = isN8n
    ? "Variables de entorno adicionales (una por línea: NOMBRE=valor)"
    : "Variables no secretas (una por línea: NOMBRE=valor)";
  document.querySelector("#manual-app-secrets-label").textContent = isN8n
    ? "Secretos Swarm adicionales (una por línea: NOMBRE=valor)"
    : "Secretos Swarm (una por línea: NOMBRE=valor)";
  fields.id.readOnly = isN8n;
  document.querySelector("#manual-app-timezone-label").hidden = !isN8n;
  const timezone = manualApplicationForm.elements.timezone;
  timezone.hidden = !isN8n;
  manualApplicationWebhookFields.hidden = !isN8n;
  manualApplicationWebhookZoneSelect.required = isN8n;
  manualApplicationWebhookSubdomainInput.required = isN8n;
  manualApplicationSubmit.textContent = isN8n ? "Crear y desplegar n8n" : "Agregar y desplegar";
  document.querySelector("#application-create-title").textContent = isSupabase
    ? "Crear instancia de Supabase"
    : isN8n
      ? "Crear instancia de n8n"
      : "Agregar aplicación";
  document.querySelector("#application-create-form-title").textContent = isN8n
    ? "Configurar instancia de n8n"
    : "Detalles de la instancia";
  applicationCreateDescription.textContent = isSupabase
    ? "Define en esta ventana los servicios, dominios y límites propios de esta instancia."
    : "Configura la aplicación y sus opciones antes de desplegarla en el VPS.";
}

async function initializeApplicationCreateRoute() {
  if (window.location.pathname !== "/applications/new") return;
  try {
    const response = await fetch("/application-templates.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const schema = await response.json();
    if (schema.schemaVersion !== 1 || !Array.isArray(schema.templates)) {
      throw new Error("el archivo de plantillas no tiene un formato compatible.");
    }
    if (schema.templates.some((template) =>
      !template || typeof template.id !== "string" || !/^[a-z][a-z0-9-]{0,62}$/.test(template.id)
        || typeof template.label !== "string" || !template.label.trim()
        || typeof template.kind !== "string"
        || !template.defaults || typeof template.defaults !== "object" || Array.isArray(template.defaults))) {
      throw new Error("cada plantilla debe declarar id, etiqueta, tipo y valores predeterminados.");
    }
    applicationTemplateDefinitions = new Map(
      schema.templates.map((template) => [template.id, template]),
    );
    if (applicationTemplateDefinitions.size !== schema.templates.length
      || !applicationTemplateDefinitions.has("custom")
      || !applicationTemplateDefinitions.has("n8n")
      || !applicationTemplateDefinitions.has("supabase")) {
      throw new Error("el JSON debe incluir plantillas únicas para custom, n8n y Supabase.");
    }
    manualApplicationTemplate.replaceChildren(...schema.templates.map((template) =>
      new Option(template.label, template.id)));
    const requestedTemplate = new URLSearchParams(window.location.search).get("template");
    manualApplicationTemplate.value = applicationTemplateDefinitions.has(requestedTemplate)
      ? requestedTemplate
      : "custom";
    applyManualApplicationTemplate();
    if (manualApplicationTemplate.value === "supabase") {
      supabaseConfigurationStatus.textContent = "Consultando VPS y valores preconfigurados…";
      initializeSupabaseCreateDefaults();
    }
  } catch (error) {
    applicationCreateDescription.textContent = `No se pudieron cargar las plantillas JSON: ${error.message}`;
    manualApplicationSubmit.disabled = true;
    manualApplicationTemplate.disabled = true;
    document.querySelector("#save-supabase-configuration").disabled = true;
    document.querySelector("#deploy-supabase-configuration").disabled = true;
  }
}

async function loadN8nApplication() {
  try {
    const { application } = await request("/api/system/applications/n8n");
    const legacyActions = document.querySelector("#n8n-legacy-actions");
    legacyActions.replaceChildren();
    const legacyLink = createApplicationUrlLink(application.domain, "Abrir n8n");
    if (application.installed && legacyLink) {
      const label = document.createElement("span");
      label.className = "application-instance-meta";
      label.textContent = "Instancia heredada";
      legacyActions.append(label, legacyLink);
    }
    legacyActions.hidden = !application.installed || !legacyLink;
    n8nStatus.dataset.state = application.installed ? "success" : "info";
    n8nStatus.textContent = application.installed
      ? application.domain
        ? `Hay una instalación heredada de n8n en ${application.domain}. Las nuevas instalaciones se crean como instancias independientes.`
        : "Hay una instalación heredada de n8n sin dominio configurado. Las nuevas instalaciones se crean como instancias independientes."
      : "Crea una instancia independiente de n8n desde el catálogo.";
  } catch (error) {
    n8nStatus.dataset.state = "error";
    n8nStatus.textContent = error.message;
  }
}

function schedulePostgresqlStatusPoll() {
  if (postgresqlStatusPollTimer !== undefined || dashboardView.classList.contains("hidden")) return;
  postgresqlStatusPollTimer = setTimeout(() => {
    postgresqlStatusPollTimer = undefined;
    void loadPostgresqlApplication();
  }, 3000);
}

async function loadPostgresqlApplication() {
  try {
    const { application } = await request("/api/system/applications/postgresql");
    const connection = document.querySelector("#postgresql-connection");
    connection.textContent = `${application.host}:${application.port} · ${application.database} · usuario ${application.username} (solo red Swarm)`;
    installPostgresqlButton.classList.toggle("hidden", !application.available);
    installPostgresqlButton.disabled = application.installing;
    revealPostgresqlCredentialsButton.classList.toggle("hidden", !application.credentialsAvailable);
    postgresqlStatus.textContent = application.latestTask?.message
      ?? (application.installed
        ? "PostgreSQL está instalado y disponible en la red privada de Swarm como vps-manager-postgresql:5432."
        : application.nameConflict
          ? "El nombre del servicio de PostgreSQL está ocupado por un servicio ajeno a VPS Manager."
          : "Instala PostgreSQL para habilitar una base de datos privada y persistente.");
    postgresqlStatus.dataset.state = application.installing
      ? "pending"
      : application.nameConflict
        ? "error"
        : application.installed
          ? "success"
          : application.latestTask?.status === "failed"
            ? "error"
            : "info";
    if (application.installing) schedulePostgresqlStatusPoll();
    else if (postgresqlStatusPollTimer !== undefined) {
      clearTimeout(postgresqlStatusPollTimer);
      postgresqlStatusPollTimer = undefined;
    }
  } catch (error) {
    postgresqlStatus.dataset.state = "error";
    postgresqlStatus.textContent = error.message;
    if (postgresqlStatusPollTimer !== undefined) {
      clearTimeout(postgresqlStatusPollTimer);
      postgresqlStatusPollTimer = undefined;
    }
  }
}

function getSupabaseDefaults(configurationSchema) {
  const defaults = configurationSchema?.defaults ?? {};
  return {
    ...defaults,
    enabledServices: defaults.enabledServices
      ?? Object.keys(supabaseApplicationData?.catalogEntry?.serviceManifest?.services ?? {}),
    resourceLimits: defaults.resourceLimits ?? {},
    smtp: defaults.smtp ?? null,
    oauthProviders: defaults.oauthProviders ?? {},
  };
}

function renderSupabaseServiceSelection(entry, selectedServices) {
  const container = document.querySelector("#supabase-service-selection");
  const services = entry?.serviceManifest?.services ?? {};
  const requiredServices = new Set(entry?.serviceManifest?.selection?.required ?? []);
  const dependencies = entry?.serviceManifest?.selection?.dependencies ?? {};
  container.replaceChildren();

  for (const [serviceId, service] of Object.entries(services)) {
    const label = document.createElement("label");
    label.className = "checkbox-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "enabledServices";
    checkbox.value = serviceId;
    checkbox.checked = selectedServices.includes(serviceId);
    checkbox.disabled = requiredServices.has(serviceId);
    checkbox.dataset.serviceId = serviceId;
    const description = document.createElement("span");
    const dependencyNames = dependencies[serviceId] ?? [];
    description.textContent = `${serviceId}${requiredServices.has(serviceId) ? " (obligatorio)" : ""} — ${service.image}`
      + (dependencyNames.length ? ` · requiere ${dependencyNames.join(", ")}` : "");
    label.dataset.search = `${serviceId} ${service.image}`.toLocaleLowerCase();
    label.append(checkbox, description);
    container.append(label);
  }
  applySupabaseServiceFilter();
  container.onchange = (event) => {
    const changed = event.target;
    if (!(changed instanceof HTMLInputElement) || changed.name !== "enabledServices") return;
    const selected = new Set(
      [...container.querySelectorAll('input[name="enabledServices"]:checked')]
        .map((checkbox) => checkbox.value),
    );
    if (changed.checked) {
      for (const dependency of dependencies[changed.value] ?? []) selected.add(dependency);
    } else {
      let removed;
      do {
        removed = false;
        for (const [serviceId, requiredDependencies] of Object.entries(dependencies)) {
          if (selected.has(serviceId) && requiredDependencies.some((dependency) => !selected.has(dependency))) {
            selected.delete(serviceId);
            removed = true;
          }
        }
      } while (removed);
    }
    for (const checkbox of container.querySelectorAll('input[name="enabledServices"]')) {
      checkbox.checked = selected.has(checkbox.value);
    }
    applySupabaseServiceFilter();
  };
}

function applySupabaseServiceFilter() {
  const query = supabaseServiceFilter.value.trim().toLocaleLowerCase();
  const labels = [...document.querySelectorAll("#supabase-service-selection > label")];
  let visibleCount = 0;
  for (const label of labels) {
    label.hidden = query.length > 0 && !label.dataset.search.includes(query);
    if (!label.hidden) visibleCount += 1;
  }
  updateSupabaseServiceFilterStatus(visibleCount, labels.length, query);
}

function updateSupabaseServiceFilterStatus(visibleCount, totalCount, query = supabaseServiceFilter.value.trim()) {
  const selectedCount = document.querySelectorAll(
    '#supabase-service-selection input[name="enabledServices"]:checked',
  ).length;
  const status = document.querySelector("#supabase-service-filter-status");
  status.textContent = query && visibleCount === 0
    ? "No hay servicios que coincidan con ese filtro."
    : `${selectedCount} seleccionados · ${visibleCount ?? document.querySelectorAll("#supabase-service-selection > label").length}`
      + `${totalCount === undefined ? "" : ` de ${totalCount}`} servicios visibles.`;
}

function fillSupabaseConfigurationForm(serverNodeId, instance = null) {
  const node = supabaseApplicationData?.servers.find((server) => server.id === serverNodeId);
  if (!node) return;
  const templateDefaults = getApplicationTemplateDefinition("supabase")?.defaults ?? {};
  const schemaDefaults = getSupabaseDefaults(supabaseApplicationData.catalogEntry?.configurationSchema);
  const configuration = instance?.configuration ?? {
    ...schemaDefaults,
    ...templateDefaults,
    resourceLimits: {
      ...schemaDefaults.resourceLimits,
      ...templateDefaults.resourceLimits,
    },
  };
  const presetName = templateDefaults.name?.replace("{{hostname}}", node.hostname);
  supabaseConfigurationForm.dataset.instanceId = instance?.id ?? "";
  supabaseServerNodeSelect.disabled = Boolean(instance);
  for (const fieldName of ["apiDomain", "studioDomain"]) {
    supabaseConfigurationForm.elements.namedItem(fieldName).readOnly = Boolean(instance);
  }
  document.querySelector("#supabase-domains-readonly-note").hidden = !instance;
  saveSupabaseConfigurationButton.textContent = instance ? "Guardar cambios" : "Guardar configuración";
  deploySupabaseConfigurationButton.textContent = instance ? "Guardar y desplegar" : "Crear y desplegar";
  const values = {
    name: instance?.name ?? presetName ?? `Supabase - ${node.hostname}`,
    enabledServices: configuration.enabledServices
      ?? Object.keys(supabaseApplicationData.catalogEntry?.serviceManifest?.services ?? {}),
    exposeDatabasePorts: configuration.exposeDatabasePorts ?? true,
    apiDomain: configuration.apiDomain ?? "",
    studioDomain: configuration.studioDomain ?? "",
    siteUrl: configuration.siteUrl ?? "",
    additionalRedirectUrls: (configuration.additionalRedirectUrls ?? []).join("\n"),
    organizationName: configuration.organizationName,
    projectName: configuration.projectName,
    disableSignup: configuration.disableSignup,
    enableEmailSignup: configuration.enableEmailSignup,
    enableEmailAutoconfirm: configuration.enableEmailAutoconfirm,
    enableAnonymousUsers: configuration.enableAnonymousUsers,
    jwtExpirySeconds: configuration.jwtExpirySeconds,
    maxRows: configuration.maxRows,
    storageFileSizeLimitBytes: configuration.storageFileSizeLimitBytes,
    storageRegion: configuration.storageRegion,
    enableImageTransformation: configuration.enableImageTransformation,
    functionsVerifyJwt: configuration.functionsVerifyJwt,
    smtp: configuration.smtp,
    oauthProviders: configuration.oauthProviders,
    resourceLimits: configuration.resourceLimits,
  };
  for (const [name, value] of Object.entries(values)) {
    if (name === "enabledServices") continue;
    const field = supabaseConfigurationForm.elements.namedItem(name);
    if (!field) continue;
    if (field.type === "checkbox") field.checked = value === true;
    else if (name === "smtp") field.value = value ? JSON.stringify(value, null, 2) : "";
    else if (name === "oauthProviders" || name === "resourceLimits") field.value = JSON.stringify(value, null, 2);
    else field.value = value ?? "";
  }
  renderSupabaseServiceSelection(supabaseApplicationData.catalogEntry, values.enabledServices);
  supabaseServiceFilter.value = "";
  applySupabaseServiceFilter();
  supabaseConfigurationForm.elements.serverNodeId.value = node.id;
  supabaseConfigurationStatus.textContent = instance
    ? `Editando la configuración guardada para ${node.hostname}. Los cambios se aplicarán al guardar y desplegar.`
    : `Se creará una instancia Supabase independiente en ${node.hostname}.`;
  if (node.state !== "ready" || node.availability !== "active") {
    supabaseConfigurationStatus.textContent += " El VPS no está activo y listo; reactívalo para poder guardar cambios.";
  }
  const nodeUnavailable = node.state !== "ready" || node.availability !== "active";
  const instanceInstalling = instance?.status === "installing";
  saveSupabaseConfigurationButton.disabled = nodeUnavailable || instanceInstalling;
  deploySupabaseConfigurationButton.disabled = nodeUnavailable || instanceInstalling;
}

function initializeSupabaseCreateDefaults() {
  if (window.location.pathname !== "/applications/new"
    || manualApplicationTemplate.value !== "supabase"
    || !supabaseApplicationData) return;
  const query = new URLSearchParams(window.location.search);
  const requestedInstanceId = query.get("instanceId");
  if (requestedInstanceId) {
    const instance = supabaseApplicationData.instances.find((candidate) =>
      candidate.id.toLowerCase() === requestedInstanceId.toLowerCase());
    if (!instance) {
      supabaseConfigurationStatus.textContent = "No se encontró la instancia de Supabase que quieres editar.";
      saveSupabaseConfigurationButton.disabled = true;
      deploySupabaseConfigurationButton.disabled = true;
      return;
    }
    supabaseServerNodeSelect.value = instance.serverNodeId;
    fillSupabaseConfigurationForm(instance.serverNodeId, instance);
    return;
  }
  const requestedNode = query.get("serverNodeId");
  if (requestedNode && [...supabaseServerNodeSelect.options].some((option) => option.value === requestedNode)) {
    supabaseServerNodeSelect.value = requestedNode;
  }
  if (!supabaseServerNodeSelect.value && supabaseServerNodeSelect.options.length) {
    supabaseServerNodeSelect.selectedIndex = 0;
  }
  if (supabaseServerNodeSelect.value) {
    fillSupabaseConfigurationForm(supabaseServerNodeSelect.value);
  } else {
    supabaseConfigurationStatus.textContent = "No hay un VPS activo y listo para crear una instancia de Supabase.";
    saveSupabaseConfigurationButton.disabled = true;
    deploySupabaseConfigurationButton.disabled = true;
  }
}

function renderSupabaseInstances(instances) {
  supabaseInstancesList.replaceChildren();
  if (instances.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Aún no hay instancias de Supabase.";
    supabaseInstancesList.append(empty);
    return;
  }
  for (const instance of instances) {
    const row = document.createElement("article");
    row.className = "application-instance";
    const main = document.createElement("div");
    main.className = "application-instance-main";
    const name = document.createElement("div");
    name.className = "application-instance-name";
    name.textContent = instance.name;
    const detail = document.createElement("div");
    detail.className = "application-instance-meta";
    detail.textContent = `${instance.serverHostname} · ${instanceStatusLabel(instance.status)}`;
    detail.dataset.state = instance.status === "installed"
      ? "success"
      : instance.status === "failed"
        ? "error"
        : "pending";
    const runtimeServices = instance.runtimeServices ?? [];
    const enabledServices = runtimeServices.filter((service) => service.enabled);
    const runningServices = enabledServices.filter((service) => service.running);
    const summary = document.createElement("div");
    summary.className = "application-instance-meta";
    summary.textContent = `${runningServices.length} de ${enabledServices.length} servicios seleccionados en ejecución`;
    summary.dataset.state = enabledServices.length > 0 && runningServices.length === enabledServices.length
      ? "success"
      : "warning";
    const domainList = document.createElement("div");
    domainList.className = "application-instance-domains";
    for (const [label, hostname] of [
      ["Studio", instance.configuration.studioDomain],
      ["API", instance.configuration.apiDomain],
    ]) {
      if (typeof hostname !== "string" || !hostname) continue;
      const domain = document.createElement("a");
      domain.href = `https://${hostname}/`;
      domain.target = "_blank";
      domain.rel = "noopener noreferrer";
      domain.textContent = `${label}: ${hostname}`;
      domainList.append(domain);
    }
    const actions = document.createElement("div");
    actions.className = "application-instance-actions";
    const details = document.createElement("a");
    details.className = "button secondary";
    details.href = `/applications/${encodeURIComponent(instance.id)}`;
    details.textContent = "Detalles";
    const openStudio = createApplicationUrlLink(instance.configuration.studioDomain, "Abrir Studio");
    const deploy = document.createElement("button");
    deploy.className = "button secondary";
    deploy.type = "button";
    deploy.textContent = instance.status === "installing"
      ? "Desplegando…"
      : instance.status === "installed"
        ? "Reaplicar"
        : "Desplegar";
    deploy.disabled = instance.status === "installing";
    deploy.addEventListener("click", () => void deploySupabaseInstance(instance, deploy));
    const edit = document.createElement("a");
    edit.className = "button secondary";
    edit.href = `/applications/new?template=supabase&serverNodeId=${encodeURIComponent(instance.serverNodeId)}&instanceId=${encodeURIComponent(instance.id)}`;
    edit.textContent = "Editar";
    const remove = document.createElement("button");
    remove.className = "button button-danger";
    remove.type = "button";
    remove.textContent = "Eliminar";
    remove.disabled = instance.status === "installing";
    remove.addEventListener("click", () => void deleteApplicationInstance({
      instance,
      button: remove,
      statusElement: supabaseStatus,
    }));
    if (openStudio) actions.append(openStudio);
    actions.append(details, edit, deploy, remove);
    main.append(name, detail, summary, domainList, actions);
    row.append(main);
    supabaseInstancesList.append(row);
  }
}

function createApplicationUrlLink(hostname, label) {
  if (typeof hostname !== "string" || !hostname) return null;
  const link = document.createElement("a");
  link.className = "button";
  link.href = `https://${hostname}/`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function instanceStatusLabel(status) {
  return ({
    configured: "Configurada",
    installing: "Desplegando",
    installed: "Instalada",
    failed: "Fallida",
  })[status] ?? status;
}

async function deploySupabaseInstance(instance, button) {
  button.disabled = true;
  button.textContent = "Iniciando despliegue…";
  supabaseStatus.textContent = `Preparando el stack de Supabase para ${instance.name}…`;
  try {
    const result = await request(
      `/api/applications/supabase/instances/${encodeURIComponent(instance.id)}/deploy`,
      { method: "POST" },
    );
    supabaseStatus.textContent = result.message;
    void pollSupabaseDeploymentTask(result.task.id, instance.name);
  } catch (error) {
    supabaseStatus.textContent = error.message;
    button.disabled = false;
    button.textContent = instance.status === "installed" ? "Reaplicar configuración" : "Instalar Supabase";
  }
}

async function pollSupabaseDeploymentTask(taskId, instanceName, statusElement = supabaseStatus, instanceId = null) {
  try {
    const result = await request("/api/system/tasks");
    const task = result.tasks.find((candidate) => candidate.id === taskId);
    if (task?.status === "completed") {
      if (instanceId) {
        window.location.assign(`/applications/${encodeURIComponent(instanceId)}`);
        return;
      }
      await Promise.all([loadSupabaseApplications(), loadTaskHistory()]);
      statusElement.textContent = task.result?.message
        ?? `${instanceName} se desplegó. Consulta el estado de cada servicio en la instalación.`;
      return;
    }
    if (task?.status === "failed") {
      await Promise.all([loadSupabaseApplications(), loadTaskHistory()]);
      statusElement.textContent = `No se pudo desplegar ${instanceName}: ${task.error ?? "revisa la tarea para ver el detalle."}`;
      return;
    }
    const { operation } = await request("/api/system/service-operations");
    statusElement.textContent = operation?.id === taskId && operation.message
      ? operation.message
      : `Desplegando ${instanceName} y esperando que los servicios estén disponibles…`;
    setTimeout(() => void pollSupabaseDeploymentTask(taskId, instanceName, statusElement, instanceId), 2500);
  } catch (error) {
    statusElement.textContent = `No se pudo consultar el avance del despliegue: ${error.message}`;
    setTimeout(() => void pollSupabaseDeploymentTask(taskId, instanceName, statusElement, instanceId), 5000);
  }
}

function parseManualEnvironment(value, label) {
  const entries = {};
  for (const [index, rawLine] of value.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error(`${label}: la línea ${index + 1} debe tener formato NOMBRE=valor.`);
    const name = line.slice(0, separator).trim();
    const entryValue = line.slice(separator + 1);
    if (!/^[A-Z_][A-Z0-9_]{0,127}$/.test(name) || Object.hasOwn(entries, name)) {
      throw new Error(`${label}: nombre inválido o repetido en la línea ${index + 1}.`);
    }
    entries[name] = entryValue;
  }
  return entries;
}

function renderManualApplications(catalog, instances, servers) {
  manualApplicationsList.replaceChildren();
  const definitions = catalog.filter((application) =>
    application.serviceManifest?.manual === true && application.id !== "n8n-instance");
  const definitionById = new Map(definitions.map((application) => [application.id, application]));
  const deployedInstances = instances.filter((instance) => definitionById.has(instance.applicationId));
  manualApplicationServers = servers;
  renderManualApplicationZones(domainData.zones);
  updateManualApplicationAvailability();
  if (deployedInstances.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Aún no has agregado aplicaciones manuales.";
    manualApplicationsList.append(empty);
  } else {
    for (const instance of deployedInstances) {
      const application = definitionById.get(instance.applicationId);
      const row = document.createElement("article");
      row.className = "application-instance";
      const main = document.createElement("div");
      main.className = "application-instance-main";
      const name = document.createElement("div");
      name.className = "application-instance-name";
      name.textContent = instance.name;
      const detail = document.createElement("div");
      detail.className = "application-instance-meta";
      detail.dataset.state = instance.status === "installed"
        ? "success"
        : instance.status === "failed"
          ? "error"
          : "pending";
      const secretNames = instance.configuration.secretNames?.length
        ? ` · Secretos Swarm: ${instance.configuration.secretNames.join(", ")}`
        : "";
      detail.textContent = `${instance.serverHostname} · ${instanceStatusLabel(instance.status)} · ${instance.configuration.version ?? application.version} · ${instance.configuration.image ?? application.serviceManifest.image}${secretNames}`;
      main.append(name, detail);
      if (instance.configuration.domain) {
        const domain = document.createElement("a");
        domain.className = "application-instance-domain";
        domain.href = `https://${instance.configuration.domain}/`;
        domain.textContent = instance.configuration.domain;
        domain.target = "_blank";
        domain.rel = "noopener noreferrer";
        main.append(domain);
      } else {
        const domain = document.createElement("span");
        domain.className = "application-instance-meta";
        domain.textContent = "Dominio pendiente";
        main.append(domain);
      }
      const actions = document.createElement("div");
      actions.className = "application-instance-actions";
      const detailsLink = document.createElement("a");
      detailsLink.className = "button secondary";
      detailsLink.href = `/applications/${encodeURIComponent(instance.id)}`;
      detailsLink.textContent = "Detalles";
      actions.append(detailsLink);
      row.append(main);
      if (instance.configuration.domain && instance.status === "installed") {
        const open = createApplicationUrlLink(instance.configuration.domain, "Abrir aplicación");
        if (open) actions.prepend(open);
      }
      row.append(actions);
      manualApplicationsList.append(row);
    }
  }
  manualApplicationsStatus.dataset.state = deployedInstances.length > 0 ? "success" : "info";
  manualApplicationsStatus.textContent = `${definitions.length} aplicación${definitions.length === 1 ? "" : "es"} manual${definitions.length === 1 ? "" : "es"} en el catálogo; ${deployedInstances.length} instalación${deployedInstances.length === 1 ? "" : "es"}.`;
}

function updateManualApplicationHostnamePreview() {
  const zone = domainData.zones.find((candidate) => candidate.id === manualApplicationZoneSelect.value);
  const subdomain = manualApplicationSubdomainInput.value.trim();
  manualApplicationHostnamePreview.textContent = zone && subdomain
    ? `${subdomain}.${zone.zone}`
    : "Elige un dominio conectado y escribe el subdominio.";
}

function renderManualApplicationZones(zones) {
  const connectedZones = zones.filter((zone) =>
    zone.connectionStatus === "connected" && zone.tokenConfigured);
  const selectedZoneId = manualApplicationZoneSelect.value;
  const options = [new Option(
    connectedZones.length ? "Selecciona un dominio conectado" : "No hay dominios conectados",
    "",
  )];
  for (const zone of connectedZones) options.push(new Option(zone.zone, zone.id));
  manualApplicationZoneSelect.replaceChildren(...options);
  const webhookSelectedZoneId = manualApplicationWebhookZoneSelect.value;
  manualApplicationWebhookZoneSelect.replaceChildren(
    new Option(
      connectedZones.length ? "Selecciona un dominio conectado" : "No hay dominios conectados",
      "",
    ),
    ...connectedZones.map((zone) => new Option(zone.zone, zone.id)),
  );
  if (connectedZones.some((zone) => zone.id === selectedZoneId)) {
    manualApplicationZoneSelect.value = selectedZoneId;
  }
  if (connectedZones.some((zone) => zone.id === webhookSelectedZoneId)) {
    manualApplicationWebhookZoneSelect.value = webhookSelectedZoneId;
  }
  manualApplicationZoneSelect.disabled = connectedZones.length === 0;
  updateManualApplicationHostnamePreview();
  updateManualApplicationWebhookHostnamePreview();
  updateManualApplicationAvailability();
}

function updateManualApplicationWebhookHostnamePreview() {
  const zone = domainData.zones.find((candidate) =>
    candidate.id === manualApplicationWebhookZoneSelect.value);
  const subdomain = manualApplicationWebhookSubdomainInput.value.trim();
  manualApplicationWebhookHostnamePreview.textContent = zone && subdomain
    ? `${subdomain}.${zone.zone}`
    : "Elige un dominio conectado y escribe el subdominio.";
}

function updateManualApplicationAvailability() {
  const readyManager = manualApplicationServers.some((server) =>
    server.role === "manager" && server.state === "ready" && server.availability === "active");
  const connectedZone = domainData.zones.some((zone) =>
    zone.connectionStatus === "connected" && zone.tokenConfigured);
  manualApplicationSubmit.disabled = !readyManager || !connectedZone;
}

function renderN8nInstances(instances) {
  n8nInstancesList.replaceChildren();
  if (instances.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Aún no hay instancias de n8n.";
    n8nInstancesList.append(empty);
    return;
  }
  for (const instance of instances) {
    const row = document.createElement("article");
    row.className = "application-instance";
    const main = document.createElement("div");
    main.className = "application-instance-main";
    const name = document.createElement("div");
    name.className = "application-instance-name";
    name.textContent = instance.name;
    const detail = document.createElement("div");
    detail.className = "application-instance-meta";
    detail.dataset.state = instance.status === "installed"
      ? "success"
      : instance.status === "failed"
        ? "error"
        : "pending";
    const version = instance.configuration.version ?? instance.configuration.image ?? "n8n";
    detail.textContent = `${instance.serverHostname} · ${instanceStatusLabel(instance.status)} · ${version}`;
    const hostname = instance.configuration.domain ?? instance.configuration.domains?.[0];
    const domain = document.createElement("a");
    domain.className = "application-instance-domain";
    if (hostname) {
      domain.href = `https://${hostname}/`;
      domain.target = "_blank";
      domain.rel = "noopener noreferrer";
      domain.textContent = hostname;
    } else {
      domain.textContent = "Dominio pendiente";
    }
    main.append(name, detail);
    main.append(domain);
    row.append(main);
    const actions = document.createElement("div");
    actions.className = "application-instance-actions";
    if (hostname && instance.status === "installed") {
      const open = createApplicationUrlLink(hostname, "Abrir n8n");
      if (open) actions.append(open);
    }
    const details = document.createElement("a");
    details.className = "button secondary";
    details.href = `/applications/${encodeURIComponent(instance.id)}`;
    details.textContent = "Detalles";
    actions.append(details);
    row.append(actions);
    n8nInstancesList.append(row);
  }
}

function clearSupabaseCredentialDisplay() {
  revealedSupabaseCredentials = null;
  const credentials = document.querySelector("#application-detail-supabase-credentials");
  if (!credentials) return;
  credentials.replaceChildren();
  credentials.hidden = true;
  document.querySelector("#application-detail-supabase-reveal").hidden = false;
  document.querySelector("#application-detail-supabase-hide").hidden = true;
  document.querySelector("#application-detail-supabase-copy").hidden = true;
}

function renderApplicationDetail(instances) {
  const routeMatch = window.location.pathname.match(/^\/applications\/([0-9a-f-]{36})$/i);
  if (!routeMatch) return;
  const instance = instances.find((candidate) =>
    candidate.id.toLowerCase() === routeMatch[1].toLowerCase());
  const title = document.querySelector("#application-detail-title");
  const summary = document.querySelector("#application-detail-summary");
  const status = document.querySelector("#application-detail-status");
  const state = document.querySelector("#application-detail-state");
  const open = document.querySelector("#application-detail-open");
  const domains = document.querySelector("#application-detail-domains");
  const loginGuide = document.querySelector("#application-detail-login-guide");
  const usersGuide = document.querySelector("#application-detail-users-guide");
  const deleteButton = document.querySelector("#application-detail-delete");
  const supabaseDetails = document.querySelector("#application-detail-supabase");
  const supabaseServicesPanel = document.querySelector("#application-detail-supabase-services-panel");
  const supabaseConfigurationPanel = document.querySelector("#application-detail-supabase-configuration-panel");
  const supabaseServices = document.querySelector("#application-detail-supabase-services");
  const supabaseCredentialsPanel = document.querySelector("#application-detail-supabase-credentials-panel");
  const supabaseUrls = document.querySelector("#application-detail-supabase-urls");
  const supabaseConfiguration = document.querySelector("#application-detail-supabase-configuration");
  const supabaseLimits = document.querySelector("#application-detail-supabase-limits");
  const supabaseCredentialsStatus = document.querySelector("#application-detail-supabase-credentials-status");
  const supabaseRevealButton = document.querySelector("#application-detail-supabase-reveal");
  clearSupabaseCredentialDisplay();
  domains.replaceChildren();
  supabaseUrls.replaceChildren();
  supabaseServices.replaceChildren();
  supabaseConfiguration.replaceChildren();
  supabaseLimits.replaceChildren();
  open.hidden = true;
  loginGuide.hidden = true;
  usersGuide.hidden = true;
  deleteButton.hidden = true;
  supabaseDetails.hidden = true;
  supabaseServicesPanel.hidden = true;
  supabaseConfigurationPanel.hidden = true;
  supabaseCredentialsPanel.hidden = true;
  if (!instance) {
    title.textContent = "Instancia no encontrada";
    summary.textContent = "";
    state.textContent = "";
    status.textContent = "No se encontró esta instancia en el catálogo.";
    return;
  }

  const configuration = instance.configuration ?? {};
  const isSupabase = instance.applicationId === "supabase";
  const instanceDomains = isSupabase
    ? [
      { hostname: configuration.studioDomain, label: "Supabase Studio" },
      { hostname: configuration.apiDomain, label: "Supabase API" },
    ].filter((domain) => typeof domain.hostname === "string" && domain.hostname)
    : configuration.domains?.length
    ? configuration.domains
    : configuration.domain ? [{ hostname: configuration.domain }] : [];
  const instanceStatusLabels = {
    configured: "Configurada",
    installing: "Desplegando",
    installed: "Instalada",
    failed: "Fallida",
    deploying: "Desplegando",
    pending: "Pendiente",
  };
  title.textContent = instance.name;
  summary.textContent = `${instance.serverHostname} · ${configuration.image ?? instance.applicationId}`;
  state.textContent = instanceStatusLabels[instance.status] ?? instance.status;
  deleteButton.hidden = !["n8n-instance", "supabase"].includes(instance.applicationId)
    || instance.status === "installing";
  deleteButton.dataset.instanceId = instance.id;
  deleteButton.dataset.instanceName = instance.name;
  deleteButton.dataset.applicationId = instance.applicationId;
  status.textContent = instance.status === "installed"
    ? isSupabase
      ? "Instancia lista. Consulta aquí los endpoints, servicios y credenciales de Supabase."
      : "Instancia lista. Usa el dominio principal para abrirla."
    : instance.status === "failed"
      ? "El despliegue falló. Revisa la pestaña Tareas para consultar el detalle."
      : `Estado de la instancia: ${instanceStatusLabels[instance.status] ?? instance.status}.`;

  instanceDomains.forEach((domain, index) => {
    const item = document.createElement("div");
    item.className = "application-detail-domain";
    const label = document.createElement("strong");
    label.textContent = domain.label
      ?? (index === 0 ? "Dominio principal" : "Dominio de webhooks");
    const link = document.createElement("a");
    link.href = `https://${domain.hostname}/`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = domain.hostname;
    item.append(label, link);
    domains.append(item);
  });
  if (instance.status === "installed" && instanceDomains[0]?.hostname) {
    open.href = `https://${instanceDomains[0].hostname}/`;
    open.hidden = false;
  }
  loginGuide.hidden = instance.applicationId !== "n8n-instance" || instance.status !== "installed";
  usersGuide.hidden = instance.applicationId !== "n8n-instance" || instance.status !== "installed";
  if (isSupabase) {
    supabaseDetails.hidden = false;
    supabaseServicesPanel.hidden = false;
    supabaseConfigurationPanel.hidden = false;
    supabaseCredentialsPanel.hidden = false;
    supabaseCredentialsStatus.textContent = instance.credentialsAvailable
      ? "Credenciales disponibles. Se consultarán solo cuando pulses «Mostrar credenciales»."
      : instance.status === "installing"
        ? "Las credenciales aparecerán cuando el agente genere los secretos al iniciar el despliegue."
        : instance.status === "installed"
        ? "No hay credenciales protegidas guardadas para esta instalación."
        : "Inicia el despliegue para generar y guardar las credenciales de esta instancia.";
    supabaseRevealButton.disabled = !instance.credentialsAvailable;
    supabaseRevealButton.dataset.instanceId = instance.id;
    const addUrl = (labelText, value) => {
      if (typeof value !== "string" || !value) return;
      const label = document.createElement("dt");
      label.textContent = labelText;
      const valueElement = document.createElement("dd");
      const link = document.createElement("a");
      link.href = value;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = value;
      valueElement.append(link);
      supabaseUrls.append(label, valueElement);
    };
    addUrl("API de Supabase", configuration.apiDomain ? `https://${configuration.apiDomain}` : "");
    addUrl("Supabase Studio", configuration.studioDomain ? `https://${configuration.studioDomain}` : "");
    addUrl("URL del sitio", configuration.siteUrl);
    const addConnection = (labelText, connectionText) => {
      const label = document.createElement("dt");
      label.textContent = labelText;
      const value = document.createElement("dd");
      const code = document.createElement("code");
      code.textContent = connectionText;
      value.append(code);
      supabaseUrls.append(label, value);
    };
    addConnection("Base de datos privada (Swarm)", "db:5432");
    if (configuration.enabledServices?.includes("supavisor")) {
      addConnection("Pool de conexiones privado (Swarm)", "supavisor:6543");
    }
    if (configuration.exposeDatabasePorts) {
      addConnection("Base de datos desde el VPS", `${instance.serverHostname}:5432`);
      if (configuration.enabledServices?.includes("supavisor")) {
        addConnection("Pool desde el VPS", `${instance.serverHostname}:6543`);
      }
    }

    const services = instance.runtimeServices ?? [];
    const selectedServices = services.filter((service) => service.enabled);
    const runningServices = selectedServices.filter((service) => service.running);
    document.querySelector("#application-detail-supabase-service-summary").textContent =
      `${selectedServices.length} seleccionados · ${runningServices.length} corriendo · `
      + `${selectedServices.filter((service) => service.installed).length} instalados`;
    for (const service of services) {
      const row = document.createElement("div");
      row.className = "supabase-runtime-service";
      const name = document.createElement("strong");
      name.className = "supabase-runtime-name";
      name.textContent = service.id;
      const serviceState = document.createElement("span");
      serviceState.className = "supabase-runtime-state";
      if (!service.enabled) {
        serviceState.dataset.state = "disabled";
        serviceState.textContent = "Deshabilitado";
      } else if (service.running) {
        serviceState.dataset.state = "running";
        serviceState.textContent = `Corriendo (${service.runningContainers}/${service.containers})`;
      } else if (service.installed) {
        serviceState.dataset.state = "stopped";
        serviceState.textContent = `Instalado, detenido${service.status ? ` · ${service.status}` : ""}`;
      } else {
        serviceState.dataset.state = "missing";
        serviceState.textContent = "No instalado";
      }
      row.append(name, serviceState);
      supabaseServices.append(row);
    }
    const addConfigurationValue = (labelText, valueText) => {
      const label = document.createElement("dt");
      label.textContent = labelText;
      const value = document.createElement("dd");
      value.textContent = valueText;
      supabaseConfiguration.append(label, value);
    };
    const yesNo = (value) => value ? "Sí" : "No";
    addConfigurationValue("Organización", configuration.organizationName ?? "—");
    addConfigurationValue("Proyecto", configuration.projectName ?? "—");
    addConfigurationValue("Registro de usuarios", configuration.disableSignup ? "Deshabilitado" : "Habilitado");
    addConfigurationValue("Registro por correo", yesNo(configuration.enableEmailSignup));
    addConfigurationValue("Confirmación automática", yesNo(configuration.enableEmailAutoconfirm));
    addConfigurationValue("Usuarios anónimos", yesNo(configuration.enableAnonymousUsers));
    addConfigurationValue("Duración del JWT", `${configuration.jwtExpirySeconds ?? "—"} segundos`);
    addConfigurationValue("Máximo de filas REST", String(configuration.maxRows ?? "—"));
    addConfigurationValue(
      "Tamaño máximo de archivo",
      Number.isFinite(configuration.storageFileSizeLimitBytes)
        ? `${(configuration.storageFileSizeLimitBytes / 1_048_576).toFixed(1)} MiB`
        : "—",
    );
    addConfigurationValue("Región de almacenamiento", configuration.storageRegion ?? "—");
    addConfigurationValue("Transformación de imágenes", yesNo(configuration.enableImageTransformation));
    addConfigurationValue("Verificación JWT en Functions", yesNo(configuration.functionsVerifyJwt));
    addConfigurationValue("Puertos de base de datos publicados", yesNo(configuration.exposeDatabasePorts));
    addConfigurationValue(
      "URLs adicionales de redirección",
      Array.isArray(configuration.additionalRedirectUrls) && configuration.additionalRedirectUrls.length
        ? configuration.additionalRedirectUrls.join("\n")
        : "Ninguna configurada",
    );
    const enabledOAuthProviders = Object.entries(configuration.oauthProviders ?? {})
      .filter(([, provider]) => provider?.enabled)
      .map(([provider]) => provider);
    addConfigurationValue("Proveedores OAuth habilitados", enabledOAuthProviders.join(", ") || "Ninguno");
    const smtp = configuration.smtp;
    addConfigurationValue(
      "SMTP",
      smtp ? `${smtp.host ?? "Host configurado"}${smtp.port ? ` · puerto ${smtp.port}` : ""}` : "No configurado",
    );
    for (const [serviceId, limit] of Object.entries(configuration.resourceLimits ?? {})) {
      if (!limit || typeof limit !== "object") continue;
      const row = document.createElement("div");
      row.className = "supabase-runtime-service";
      const name = document.createElement("strong");
      name.className = "supabase-runtime-name";
      name.textContent = serviceId;
      const value = document.createElement("span");
      value.className = "supabase-runtime-state";
      value.textContent = `${limit.cpus ?? "—"} CPU · ${limit.memoryMb ?? "—"} MiB RAM`;
      row.append(name, value);
      supabaseLimits.append(row);
    }
  }
  if (instance.applicationId !== "n8n-instance" && instanceDomains.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Esta instancia no tiene dominios configurados.";
    domains.append(empty);
  }
}

function renderSupabaseCatalog(catalog, servers, instances) {
  const entry = catalog.find((application) => application.id === "supabase");
  supabaseApplicationData = { catalogEntry: entry, catalog, servers, instances };
  const services = entry?.serviceManifest?.services ?? {};
  const readyServers = servers.filter((server) => server.state === "ready" && server.availability === "active");
  supabaseServerNodeSelect.replaceChildren();
  for (const server of servers) {
    const hasConfiguration = instances.some((instance) => instance.serverNodeId === server.id);
    if (!readyServers.includes(server) && !hasConfiguration) continue;
    const option = document.createElement("option");
    option.value = server.id;
    option.textContent = `${server.hostname} · ${server.role} · Docker ${server.engineVersion ?? "?"}`;
    option.disabled = !readyServers.includes(server);
    supabaseServerNodeSelect.append(option);
  }
  configureSupabaseButton.disabled = !entry || readyServers.length === 0;
  configureSupabaseButton.title = !entry
    ? "Supabase no está disponible en el catálogo."
    : readyServers.length === 0
      ? "Necesitas al menos un nodo Swarm activo para instalar Supabase."
      : "";
  refreshSupabaseStateButton.disabled = !entry;
  renderSupabaseInstances(instances);
  initializeSupabaseCreateDefaults();
  const runtimeServices = instances.flatMap((instance) => instance.runtimeServices ?? []);
  const selectedServices = runtimeServices.filter((service) => service.enabled);
  const installedServices = selectedServices.filter((service) => service.installed);
  const runningServices = selectedServices.filter((service) => service.running);
  supabaseStatus.dataset.state = instances.length === 0
    ? "info"
    : selectedServices.length > 0 && runningServices.length === selectedServices.length
      ? "success"
      : "warning";
  supabaseStatus.textContent = entry
    ? `${entry.name} ${entry.version}: ${Object.keys(services).length} servicios en el catálogo. `
      + (instances.length
        ? `${installedServices.length}/${selectedServices.length} servicios instalados; ${runningServices.length} corriendo.`
        : "Aún no hay una instalación configurada.")
      + ` ${readyServers.length} VPS activos disponibles.`
    : "Supabase no está habilitado en el catálogo.";
}

async function loadSupabaseApplications() {
  supabaseStatus.dataset.state = "pending";
  manualApplicationsStatus.dataset.state = "pending";
  supabaseStatus.textContent = "Consultando catálogo y servidores Swarm…";
  manualApplicationsStatus.textContent = "Consultando aplicaciones…";
  try {
    const result = await request("/api/applications");
    renderSupabaseCatalog(
      result.catalog,
      result.servers,
      result.instances.filter((instance) => instance.applicationId === "supabase"),
    );
    renderManualApplications(result.catalog, result.instances, result.servers);
    const n8nInstances = result.instances.filter((instance) => instance.applicationId === "n8n-instance");
    renderN8nInstances(n8nInstances);
    renderApplicationDetail(result.instances);
  } catch (error) {
    configureSupabaseButton.disabled = true;
    configureSupabaseButton.title = "No se pudo consultar la disponibilidad. Actualiza el estado para reintentar.";
    refreshSupabaseStateButton.disabled = false;
    supabaseStatus.dataset.state = "error";
    supabaseStatus.textContent = error.message;
    manualApplicationSubmit.disabled = true;
    manualApplicationsStatus.dataset.state = "error";
    manualApplicationsStatus.textContent = error.message;
    for (const [list, applicationName] of [
      [manualApplicationsList, "las aplicaciones personalizadas"],
      [n8nInstancesList, "las instancias de n8n"],
      [supabaseInstancesList, "las instancias de Supabase"],
    ]) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = `No se pudieron cargar ${applicationName}. Usa “Actualizar estado” para reintentar.`;
      list.replaceChildren(message);
    }
    document.querySelector("#application-detail-status").textContent = error.message;
  }
}

function parseSupabaseJsonField(name, fallback) {
  const raw = supabaseConfigurationForm.elements.namedItem(name).value.trim();
  return raw ? JSON.parse(raw) : fallback;
}

function getSupabaseConfigurationFormValues() {
  const values = Object.fromEntries(new FormData(supabaseConfigurationForm));
  const configuration = {
    enabledServices: [...supabaseConfigurationForm.querySelectorAll(
      'input[name="enabledServices"]:checked',
    )].map((checkbox) => checkbox.value),
    exposeDatabasePorts: supabaseConfigurationForm.elements.exposeDatabasePorts.checked,
    apiDomain: values.apiDomain,
    studioDomain: values.studioDomain,
    siteUrl: values.siteUrl,
    additionalRedirectUrls: values.additionalRedirectUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
    organizationName: values.organizationName,
    projectName: values.projectName,
    disableSignup: supabaseConfigurationForm.elements.disableSignup.checked,
    enableEmailSignup: supabaseConfigurationForm.elements.enableEmailSignup.checked,
    enableEmailAutoconfirm: supabaseConfigurationForm.elements.enableEmailAutoconfirm.checked,
    enableAnonymousUsers: supabaseConfigurationForm.elements.enableAnonymousUsers.checked,
    jwtExpirySeconds: Number(values.jwtExpirySeconds),
    maxRows: Number(values.maxRows),
    storageFileSizeLimitBytes: Number(values.storageFileSizeLimitBytes),
    storageRegion: values.storageRegion,
    enableImageTransformation: supabaseConfigurationForm.elements.enableImageTransformation.checked,
    functionsVerifyJwt: supabaseConfigurationForm.elements.functionsVerifyJwt.checked,
    smtp: parseSupabaseJsonField("smtp", null),
    oauthProviders: parseSupabaseJsonField("oauthProviders", {}),
    resourceLimits: parseSupabaseJsonField("resourceLimits", {}),
  };
  return {
    name: values.name.trim(),
    serverNodeId: supabaseServerNodeSelect.value,
    ...(supabaseConfigurationForm.dataset.instanceId
      ? { instanceId: supabaseConfigurationForm.dataset.instanceId }
      : {}),
    configuration,
  };
}

async function loadRegistryConfiguration() {
  try {
    const result = await request("/api/registry");
    const registry = result.registry;
    registryState.textContent = registry ? "Configurado" : "Sin configurar";
    registryStatus.textContent = registry
      ? `Configurado en https://${registry.domain}/. Verifica que el DNS apunte al VPS y que Traefik emita el certificado antes de publicar builds.`
      : "La configuración se realiza aquí después de instalar VPS Manager.";
    if (registry) {
      registryDomainInput.value = registry.domain;
      registryUsernameInput.value = registry.username;
      registrySaveButton.textContent = "Actualizar configuración";
    } else {
      registrySaveButton.textContent = "Configurar registro privado";
    }
    registryPasswordInput.value = "";
  } catch (error) {
    registryState.textContent = "Estado desconocido";
    registryStatus.textContent = error.message;
  }
}

async function pollRegistryConfigurationTask(taskId) {
  try {
    const result = await request("/api/system/tasks");
    const task = result.tasks.find((candidate) => candidate.id === taskId);
    if (task?.status === "completed") {
      await Promise.all([loadRegistryConfiguration(), loadTaskHistory()]);
      registryFormStatus.textContent = `Configuración aplicada en https://${task.domain}/. Los builds manuales publicarán allí cuando DNS y HTTPS estén disponibles.`;
      registrySaveButton.disabled = false;
      registryConfigurationPollTimer = undefined;
      return;
    }
    if (task?.status === "failed") {
      registryFormStatus.textContent = `No se pudo configurar el registro: ${task.error ?? "error desconocido"}`;
      await loadRegistryConfiguration();
      registrySaveButton.disabled = false;
      registryConfigurationPollTimer = undefined;
      return;
    }
    registryFormStatus.textContent = "Configurando el servicio privado en el VPS…";
    registryConfigurationPollTimer = setTimeout(() => void pollRegistryConfigurationTask(taskId), 2000);
  } catch (error) {
    registryFormStatus.textContent = error.message;
    registrySaveButton.disabled = false;
    registryConfigurationPollTimer = undefined;
  }
}

async function pollSwarmNodeEnrollment(taskId) {
  try {
    const result = await request("/api/system/tasks");
    const task = result.tasks.find((candidate) => candidate.id === taskId);
    if (task?.status === "completed") {
      nodeEnrollStatus.textContent = task.result?.message ?? "El nodo se incorporó al Swarm.";
      await Promise.all([loadSwarmNodes(), loadTaskHistory()]);
      nodeEnrollSubmit.disabled = false;
      nodeEnrollmentPollTimer = undefined;
      return;
    }
    if (task?.status === "failed") {
      nodeEnrollStatus.textContent = `No se pudo incorporar el nodo: ${task.error ?? "error desconocido"}`;
      await Promise.all([loadSwarmNodes(), loadTaskHistory()]);
      nodeEnrollSubmit.disabled = false;
      nodeEnrollmentPollTimer = undefined;
      return;
    }
    nodeEnrollStatus.textContent = "Instalando Docker, configurando UFW y esperando a que Swarm marque el nodo ready…";
    nodeEnrollmentPollTimer = setTimeout(() => void pollSwarmNodeEnrollment(taskId), 2500);
  } catch (error) {
    nodeEnrollStatus.textContent = error.message;
    nodeEnrollSubmit.disabled = false;
    nodeEnrollmentPollTimer = undefined;
  }
}

async function pollManualApplicationDeployment(taskId, applicationName, instanceId) {
  try {
    const result = await request("/api/system/tasks");
    const task = result.tasks.find((candidate) => candidate.id === taskId);
    try {
      const { operation } = await request("/api/system/service-operations");
      if (operation?.id === taskId && operation.message) appendManualApplicationLog(operation.message);
    } catch (error) {
      appendManualApplicationLog(`No se pudo consultar el avance del agente: ${error.message}`);
    }
    if (task?.status === "completed") {
      window.location.assign(`/applications/${encodeURIComponent(instanceId)}`);
      return;
    }
    if (task?.status === "failed") {
      const message = `No se pudo desplegar ${applicationName}: ${task.error ?? "error desconocido"}`;
      manualApplicationStatus.textContent = message;
      appendManualApplicationLog(message);
      await Promise.all([loadSupabaseApplications(), loadTaskHistory()]);
      updateManualApplicationAvailability();
      return;
    }
    manualApplicationStatus.textContent = `Desplegando ${applicationName} en el VPS…`;
    setTimeout(() => void pollManualApplicationDeployment(taskId, applicationName, instanceId), 2500);
  } catch (error) {
    manualApplicationStatus.textContent = `No se pudo consultar el despliegue: ${error.message}`;
    appendManualApplicationLog(`Error al consultar el despliegue: ${error.message}`);
    updateManualApplicationAvailability();
    setTimeout(() => void pollManualApplicationDeployment(taskId, applicationName, instanceId), 5000);
  }
}

function appendManualApplicationLog(message) {
  const lines = manualApplicationLogs.textContent.split("\n").filter(Boolean);
  if (lines.at(-1) === message) return;
  lines.push(message);
  manualApplicationLogs.textContent = lines.slice(-100).join("\n");
  manualApplicationLogs.hidden = false;
  manualApplicationLogs.scrollTop = manualApplicationLogs.scrollHeight;
}

async function installGitea() {
  const confirmation = giteaNeedsLocalUpgrade
    ? "Se actualizará el servicio local de Gitea para habilitar la API privada. Se recreará el contenedor conservando el volumen persistente con usuarios y repositorios. El acceso web usará el túnel SSH. ¿Continuar?"
    : giteaNeedsDomainMigration
      ? "Gitea se migrará a HTTPS. Se recreará el servicio conservando el volumen persistente, repositorios, usuarios y credenciales actuales; no se generará una contraseña nueva. Asegúrate de que el DNS git.<dominio> apunte a este VPS, Traefik ya tenga HTTPS funcional y el puerto TCP 2222 esté libre para Git SSH. ¿Continuar?"
    : giteaLocalOnly
    ? "Gitea se instalará sin puertos propios publicados. Su interfaz web se limitará a conexiones loopback de Traefik y el panel accederá a la API por la red privada de Swarm. ¿Continuar?"
    : "Gitea se instalará con almacenamiento persistente, HTTPS en git.<dominio> y Git SSH en el puerto TCP 2222. Asegúrate de que el DNS apunte a este VPS y que el puerto 2222 esté libre. ¿Continuar?";
  if (!confirm(confirmation)) {
    return;
  }
  installGiteaButton.disabled = true;
  giteaStatus.textContent = "Solicitando la instalación segura de Gitea…";
  try {
    await request("/api/system/applications/gitea", { method: "POST" });
    await Promise.all([loadGiteaApplication(), loadTaskHistory()]);
  } catch (error) {
    giteaStatus.textContent = error.message;
    installGiteaButton.disabled = false;
  }
}

for (const tab of projectDetailView.querySelectorAll("[data-project-tab]")) {
  tab.addEventListener("click", () => setProjectTab(tab.dataset.projectTab));
  tab.addEventListener("keydown", (event) => {
    const tabs = [...projectDetailView.querySelectorAll("[data-project-tab]")];
    const currentIndex = tabs.indexOf(tab);
    const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length
      : event.key === "ArrowLeft" ? (currentIndex - 1 + tabs.length) % tabs.length
        : event.key === "Home" ? 0
          : event.key === "End" ? tabs.length - 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    tabs[nextIndex].focus();
    setProjectTab(tabs[nextIndex].dataset.projectTab);
  });
}
for (const button of projectDetailView.querySelectorAll("[data-project-open-settings]")) {
  button.addEventListener("click", () => {
    setProjectTab("settings");
    projectDetailView.querySelector('[data-project-tab="settings"]').focus();
    projectDetailView.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
projectInstallationSelect.addEventListener("change", async () => {
  githubImportStatus.textContent = "";
  await loadProjectRepositories();
});
projectRepositorySelect.addEventListener("change", () => void loadProjectBranches("main"));
projectProductionBranchSelect.addEventListener("change", () => void loadGithubProjectProfile());
githubDeploymentTypeSelect.addEventListener("change", updateGithubProfileSummary);
githubBuildStrategySelect.addEventListener("change", updateGithubProfileSummary);
githubInternalPortInput.addEventListener("input", updateGithubProfileSummary);
refreshProjectsButton.addEventListener("click", () => void loadProjects());
window.addEventListener("vps-manager:projects-updated", () => void loadProjects());
window.addEventListener("vps-manager:domains-updated", () => void loadDomains());
projectBuildStrategySelect.addEventListener("change", () => {
  updateProjectBuildFields();
});
projectDeploymentTypeSelect.addEventListener("change", () => {
  if (projectDeploymentTypeSelect.value !== "dynamic") {
    const port = document.querySelector("#project-port").value;
    if (port && port !== "80") previousDynamicProjectPort = port;
  } else {
    document.querySelector("#project-port").value = previousDynamicProjectPort;
  }
  updateProjectDeploymentFields();
});
projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentProjectEdit) return;
  projectSaveButton.disabled = true;
  projectFormStatus.textContent = "Guardando configuración…";
  const sourceType = currentProjectEdit.sourceType;
  const input = {
    name: projectNameInput.value.trim(),
    description: projectDescriptionInput.value.trim(),
    sourceType,
    deploymentType: projectDeploymentTypeSelect.value,
    buildStrategy: projectBuildStrategySelect.value,
    buildContext: document.querySelector("#project-build-context").value.trim(),
    dockerfilePath: document.querySelector("#project-dockerfile").value.trim(),
    buildCommand: document.querySelector("#project-build-command").value.trim(),
    buildOutputDirectory: document.querySelector("#project-build-output-directory").value.trim(),
    internalPort: Number(document.querySelector("#project-port").value),
    framework: currentProjectEdit.framework ?? "Desconocido",
    autoDeploy: document.querySelector("#project-auto-deploy").checked,
    ...(sourceType === "github" ? {
      githubInstallationId: currentProjectEdit.githubInstallationId,
      repository: currentProjectEdit.repository,
      productionBranch: currentProjectEdit.productionBranch,
    } : {}),
  };
  if (input.deploymentType === "static") {
    input.buildStrategy = "dockerfile";
    input.internalPort = 80;
  } else if (input.deploymentType === "build") {
    input.buildStrategy = "dockerfile";
    input.internalPort = 80;
  }
  try {
    const projectId = projectIdInput.value;
    await request(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    await Promise.all([loadProjects(), loadGithubStatus()]);
    projectsStatus.textContent = "Configuración del proyecto guardada.";
  } catch (error) {
    projectFormStatus.textContent = error.message;
  } finally {
    projectSaveButton.disabled = false;
  }
});

githubConfigForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = githubConfigForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  githubStatus.textContent = "Cifrando y guardando las credenciales…";
  try {
    await request("/api/github/config", {
      method: "POST",
      body: JSON.stringify({
        clientId: githubClientIdInput.value.trim(),
        clientSecret: githubClientSecretInput.value,
      }),
    });
    githubConfigForm.reset();
    const result = await loadGithubStatus();
    window.dispatchEvent(new CustomEvent("vps-manager:github-config-updated"));
    githubStatus.textContent = result?.configured
      ? "Configuración OAuth guardada cifrada. Ya puedes conectar tu cuenta."
      : "No se pudo confirmar la configuración OAuth.";
  } catch (error) {
    githubStatus.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

githubImportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const accountId = Number(projectInstallationSelect.value);
  const repository = projectRepositorySelect.value;
  const productionBranch = projectProductionBranchSelect.value;
  if (!Number.isSafeInteger(accountId) || !repository || !productionBranch) return;
  githubImportButton.disabled = true;
  githubImportStatus.textContent = "Conectando el webhook y encolando el primer despliegue…";
  try {
    const result = await request("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: repository.split("/")[1],
        sourceType: "github",
        githubInstallationId: accountId,
        repository,
        productionBranch,
        deploymentType: githubDeploymentTypeSelect.value,
        buildStrategy: githubDeploymentTypeSelect.value === "dynamic" ? githubBuildStrategySelect.value : "dockerfile",
        buildContext: githubBuildContextInput.value.trim(),
        dockerfilePath: githubDockerfileInput.value.trim(),
        framework: githubDetectedBuildProfile?.framework ?? "Desconocido",
        internalPort: githubDeploymentTypeSelect.value === "dynamic"
          ? Number(githubInternalPortInput.value)
          : 80,
        buildCommand: githubBuildCommandInput.value.trim(),
        buildOutputDirectory: githubOutputDirectoryInput.value.trim(),
        autoDeploy: true,
      }),
    });
    const deploymentMethod = result.project.deploymentType === "dynamic"
      ? result.project.buildStrategy === "railpack" ? "Railpack" : "Dockerfile"
      : result.project.deploymentType === "build" ? "BuildKit + Nginx" : "Nginx";
    githubImportStatus.textContent = result.deploymentQueued
      ? `${repository} importado como ${result.project.framework} con ${deploymentMethod}; se inició el primer despliegue y los siguientes pushes se desplegarán automáticamente.`
      : result.warning ?? `${repository} importado como ${result.project.framework} con ${deploymentMethod}.`;
    await Promise.all([loadProjects(), loadTaskHistory()]);
  } catch (error) {
    githubImportStatus.textContent = error.message;
    githubImportButton.disabled = false;
  } finally {
    if (projectProductionBranchSelect.value) githubImportButton.disabled = false;
  }
});

openDomainZoneDialogButton.addEventListener("click", openNewDomainZoneDialog);
closeDomainZoneDialogButton.addEventListener("click", () => domainZoneDialog.close());
document.querySelector("#domain-zone-cancel").addEventListener("click", () => domainZoneDialog.close());
domainZoneDialog.addEventListener("close", resetDomainZoneForm);
domainZoneForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = domainZoneIdInput.value;
  const token = domainZoneTokenInput.value;
  const input = {
    zone: domainZoneNameInput.value.trim(),
    proxied: domainZoneProxied,
    ...(token ? { token } : {}),
  };
  domainZoneSaveButton.disabled = true;
  domainZoneFormStatus.textContent = "Verificando la zona en Cloudflare…";
  try {
    const result = await request(id ? `/api/domain-zones/${encodeURIComponent(id)}` : "/api/domain-zones", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    });
    resetDomainZoneForm();
    domainZoneDialog.close();
    domainZonesStatus.textContent = result.message;
    await Promise.all([loadDomains(), loadN8nApplication()]);
  } catch (error) {
    domainZoneFormStatus.textContent = error.message;
    void loadDomains();
  } finally {
    domainZoneSaveButton.disabled = false;
  }
});
refreshDomainsButton.addEventListener("click", () => void Promise.all([loadDomains(), loadN8nApplication()]));
cloudflareTunnelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  cloudflareTunnelSaveButton.disabled = true;
  cloudflareTunnelStatus.textContent = "Validando permisos y configurando el túnel de Cloudflare…";
  try {
    const result = await request("/api/cloudflare/tunnel", {
      method: "POST",
      body: JSON.stringify({
        accountId: cloudflareTunnelAccountInput.value.trim(),
        name: cloudflareTunnelNameInput.value.trim(),
        token: cloudflareTunnelTokenInput.value,
        originProtocol: cloudflareTunnelOriginSelect.value,
        managerSubdomain: cloudflareTunnelManagerSubdomainInput.value.trim(),
        managerZoneId: cloudflareTunnelManagerSubdomainInput.value.trim()
          ? cloudflareTunnelManagerZoneSelect.value
          : "",
      }),
    });
    cloudflareTunnelTokenInput.value = "";
    cloudflareTunnelStatus.textContent = result.task.message;
    await loadDomains();
  } catch (error) {
    cloudflareTunnelStatus.textContent = error.message;
    cloudflareTunnelStatus.setAttribute("role", "alert");
  } finally {
    cloudflareTunnelSaveButton.disabled = false;
  }
});
ingressIpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  ingressIpSaveButton.disabled = true;
  ingressIpStatus.textContent = "Guardando la IPv4 y sincronizando los registros DNS…";
  try {
    const result = await request("/api/domains/ingress-ip", {
      method: "PUT",
      body: JSON.stringify({ ipv4: ingressIpInput.value.trim() }),
    });
    const failures = result.failures?.map(({ hostname, error }) => `${hostname}: ${error}`).join(" · ");
    ingressIpStatus.textContent = failures ? `${result.message} ${failures}` : result.message;
    await loadDomains();
  } catch (error) {
    ingressIpStatus.textContent = error.message;
  } finally {
    ingressIpSaveButton.disabled = false;
  }
});
async function revealPostgresqlCredentials() {
  revealPostgresqlCredentialsButton.disabled = true;
  try {
    const { application } = await request("/api/system/applications/postgresql");
    if (!application.credentialsAvailable || !application.latestTask?.id) {
      throw new Error("No hay credenciales de PostgreSQL disponibles para mostrar.");
    }
    const result = await request(`/api/system/applications/postgresql/credentials/${encodeURIComponent(application.latestTask.id)}`);
    const { credentials } = result;
    document.querySelector("#postgresql-credential-host").textContent = credentials.host;
    document.querySelector("#postgresql-credential-port").textContent = String(credentials.port);
    document.querySelector("#postgresql-credential-database").textContent = credentials.database;
    document.querySelector("#postgresql-credential-username").textContent = credentials.username;
    document.querySelector("#postgresql-credential-password").textContent = credentials.password;
    postgresqlCredentialsDialog.showModal();
    await loadPostgresqlApplication();
  } catch (error) {
    postgresqlStatus.textContent = error.message;
    revealPostgresqlCredentialsButton.classList.add("hidden");
  } finally {
    revealPostgresqlCredentialsButton.disabled = false;
  }
}

async function loadResources() {
  refreshButton.disabled = true;
  statusMessage.textContent = "Consultando Docker…";
  try {
    const [containersResult, servicesResult, serverResult, stacksResult, systemResult] = await Promise.all([
      request("/api/docker/containers"),
      request("/api/docker/services"),
      request("/api/docker/info"),
      request("/api/docker/stacks"),
      request("/api/system/status"),
    ]);
    renderServerInfo(serverResult.server, systemResult.database);
    containerMetrics.clear();
    containerMetricsHost = null;
    containerMetricsUnavailable = [];
    runningContainerCount = 0;
    metricsLoaded = false;
    metricsLoadError = "";
    metricsTotal.replaceChildren();
    renderMetricsGroups();
    metricsGroups.replaceChildren();
    metricsGroups.classList.add("hidden");
    metricsContainers.replaceChildren();
    metricsEmpty.textContent = "Actualiza CPU/RAM para consultar los contenedores activos.";
    metricsEmpty.classList.remove("hidden");
    metricsStatus.textContent = "";
    resourceData.containers = containersResult.containers;
    resourceData.services = servicesResult.services;
    resourceData.stacks = stacksResult.stacks;
    renderFilteredResources();
    await Promise.all([
      loadMetricsSettings(),
      loadMetricsHistory(),
      loadMetricAlerts(),
      loadBackups(),
      loadAuditLog(),
      loadDiagnostics(),
      loadSwarmNodes(),
      loadServiceOperationStatus(),
      loadTaskHistory(),
      loadN8nApplication(),
      loadPostgresqlApplication(),
      loadSupabaseApplications(),
      loadDomains(),
      loadProjects(),
      loadGithubStatus(),
      loadRegistryConfiguration(),
    ]);
    if (window.location.hash === "#tab-monitoring") void loadContainerMetrics();
    void checkForUpdates();
    statusMessage.textContent = `Última actualización: ${new Date().toLocaleTimeString("es-MX")}`;
  } catch (error) {
    statusMessage.textContent = error.message;
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadResources);
document.querySelector("#application-detail-supabase-reveal").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const instanceId = button.dataset.instanceId;
  if (!instanceId) return;
  const status = document.querySelector("#application-detail-supabase-credentials-status");
  button.disabled = true;
  status.textContent = "Consultando credenciales protegidas…";
  try {
    const result = await request(
      `/api/applications/${encodeURIComponent(instanceId)}/supabase-credentials`,
      { method: "POST", body: JSON.stringify({}) },
    );
    const currentInstanceId = window.location.pathname.match(/^\/applications\/([0-9a-f-]{36})$/i)?.[1];
    if (currentInstanceId?.toLowerCase() !== instanceId.toLowerCase()) return;
    const fields = [
      ["Usuario de Studio", "dashboardUsername"],
      ["Contraseña de Studio", "dashboardPassword"],
      ["Contraseña PostgreSQL", "postgresPassword"],
      ["Anon key (clave pública)", "anonKey"],
      ["Service role key (administrativa)", "serviceRoleKey"],
    ];
    const values = fields.map(([label, key]) => [label, result.credentials?.[key]]);
    if (values.some(([, value]) => typeof value !== "string" || !value)) {
      throw new Error("La respuesta no contiene todas las credenciales de Supabase esperadas.");
    }
    revealedSupabaseCredentials = values;
    const list = document.querySelector("#application-detail-supabase-credentials");
    list.replaceChildren();
    for (const [labelText, valueText] of values) {
      const label = document.createElement("dt");
      label.textContent = labelText;
      const value = document.createElement("dd");
      const code = document.createElement("code");
      code.textContent = valueText;
      value.append(code);
      list.append(label, value);
    }
    list.hidden = false;
    document.querySelector("#application-detail-supabase-reveal").hidden = true;
    document.querySelector("#application-detail-supabase-hide").hidden = false;
    document.querySelector("#application-detail-supabase-copy").hidden = false;
    status.textContent = "Credenciales visibles. Ocúltalas cuando termines y guárdalas en un gestor seguro.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
document.querySelector("#application-detail-supabase-hide").addEventListener("click", () => {
  clearSupabaseCredentialDisplay();
  document.querySelector("#application-detail-supabase-credentials-status").textContent =
    "Credenciales ocultas.";
});
document.querySelector("#application-detail-supabase-copy").addEventListener("click", async () => {
  if (!revealedSupabaseCredentials) return;
  const status = document.querySelector("#application-detail-supabase-credentials-status");
  try {
    await navigator.clipboard.writeText(revealedSupabaseCredentials
      .map(([label, value]) => `${label}: ${value}`).join("\n"));
    status.textContent = "Credenciales copiadas. Guárdalas en un gestor seguro.";
  } catch (error) {
    status.textContent = `No se pudieron copiar las credenciales: ${error.message}`;
  }
});
document.querySelector("#application-detail-delete").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const { instanceId, instanceName, applicationId } = button.dataset;
  if (!instanceId || !applicationId) return;
  await deleteApplicationInstance({
    instance: { id: instanceId, name: instanceName, applicationId },
    button,
    statusElement: document.querySelector("#application-detail-status"),
    returnToCatalog: true,
  });
});

async function deleteApplicationInstance({
  instance,
  button,
  statusElement,
  returnToCatalog = false,
}) {
  const isSupabase = instance.applicationId === "supabase";
  const dataDescription = isSupabase
    ? "Se eliminarán los servicios, las bases de datos y archivos persistentes, las credenciales protegidas y los registros DNS de API y Studio."
    : "Se eliminarán el servicio, el volumen con workflows, credenciales e historial, los secretos Swarm y los registros DNS.";
  if (!confirm(`¿Eliminar la instancia ${instance.name}? ${dataDescription} Esta acción no se puede deshacer.`)) return;
  button.disabled = true;
  button.textContent = "Eliminando…";
  statusElement.textContent = isSupabase
    ? "Retirando el stack, los datos persistentes, las credenciales y los dominios DNS…"
    : "Eliminando servicio, datos persistentes, secretos y dominios DNS…";
  try {
    await request(`/api/applications/${encodeURIComponent(instance.id)}`, { method: "DELETE" });
    if (returnToCatalog) {
      window.location.assign("/#tab-apps");
      return;
    }
    await loadSupabaseApplications();
  } catch (error) {
    statusElement.textContent = error.message;
    button.disabled = false;
    button.textContent = returnToCatalog ? "Eliminar instancia" : "Eliminar";
  }
}
configureSupabaseButton.addEventListener("click", () => {
  const serverNodeId = supabaseServerNodeSelect.value;
  const query = new URLSearchParams({ template: "supabase" });
  if (serverNodeId) query.set("serverNodeId", serverNodeId);
  window.location.assign(`/applications/new?${query}`);
});
refreshSupabaseStateButton.addEventListener("click", async () => {
  refreshSupabaseStateButton.disabled = true;
  supabaseStatus.textContent = "Consultando el estado de los servicios en Docker…";
  await loadSupabaseApplications();
});
supabaseServerNodeSelect.addEventListener("change", () => fillSupabaseConfigurationForm(supabaseServerNodeSelect.value));
supabaseServiceFilter.addEventListener("input", applySupabaseServiceFilter);
supabaseConfigurationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const action = event.submitter?.value === "deploy" ? "deploy" : "save";
  let deploymentStarted = false;
  saveSupabaseConfigurationButton.disabled = true;
  deploySupabaseConfigurationButton.disabled = true;
  supabaseConfigurationStatus.textContent = action === "deploy"
    ? "Guardando la configuración y preparando Supabase…"
    : "Guardando configuración de Supabase…";
  try {
    const body = getSupabaseConfigurationFormValues();
    const result = await request("/api/applications/supabase/instances", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const instance = result.instance;
    if (!instance?.id) {
      throw new Error("La configuración se guardó, pero el servidor no devolvió el identificador de instancia.");
    }
    const query = new URLSearchParams(window.location.search);
    query.set("template", "supabase");
    query.set("serverNodeId", instance.serverNodeId);
    query.set("instanceId", instance.id);
    window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
    fillSupabaseConfigurationForm(instance.serverNodeId, instance);
    await loadSupabaseApplications();
    supabaseConfigurationStatus.textContent = result.message;
    if (action === "deploy") {
      const deployment = await request(
        `/api/applications/supabase/instances/${encodeURIComponent(instance.id)}/deploy`,
        { method: "POST" },
      );
      if (!deployment.task?.id) throw new Error("El servidor no devolvió el identificador de tarea de despliegue.");
      supabaseConfigurationStatus.textContent = deployment.message;
      deploymentStarted = true;
      deploySupabaseConfigurationButton.disabled = true;
      void pollSupabaseDeploymentTask(
        deployment.task.id,
        instance.name,
        supabaseConfigurationStatus,
        instance.id,
      );
      return;
    }
  } catch (error) {
    supabaseConfigurationStatus.textContent = error.message;
  } finally {
    const selectedServer = supabaseApplicationData?.servers.find((server) => server.id === supabaseServerNodeSelect.value);
    const nodeUnavailable = !selectedServer
      || selectedServer.state !== "ready"
      || selectedServer.availability !== "active";
    const instanceInstalling = supabaseApplicationData.instances.some((instance) =>
      instance.id === supabaseConfigurationForm.dataset.instanceId && instance.status === "installing");
    saveSupabaseConfigurationButton.disabled = deploymentStarted || nodeUnavailable || instanceInstalling;
    deploySupabaseConfigurationButton.disabled = deploymentStarted || nodeUnavailable || instanceInstalling;
  }
});
refreshNodesButton.addEventListener("click", loadSwarmNodes);
refreshDiagnosticsButton.addEventListener("click", loadDiagnostics);
refreshMetricsButton.addEventListener("click", loadContainerMetrics);
pruneBuilderCacheButton.addEventListener("click", startBuilderCachePrune);
manualApplicationZoneSelect.addEventListener("change", updateManualApplicationHostnamePreview);
manualApplicationSubdomainInput.addEventListener("input", updateManualApplicationHostnamePreview);
manualApplicationWebhookZoneSelect.addEventListener("change", updateManualApplicationWebhookHostnamePreview);
manualApplicationWebhookSubdomainInput.addEventListener("input", updateManualApplicationWebhookHostnamePreview);
manualApplicationTemplate.addEventListener("change", () => {
  applyManualApplicationTemplate();
  if (manualApplicationTemplate.value === "supabase") initializeSupabaseCreateDefaults();
});
manualApplicationForm.elements.image.addEventListener("input", () => {
  if (getApplicationTemplateDefinition()?.kind === "n8n") {
    manualApplicationForm.elements.version.value = getApplicationVersionFromImage(
      manualApplicationForm.elements.image.value.trim(),
    );
  }
});
void initializeApplicationCreateRoute();
for (const button of document.querySelectorAll("[data-metrics-view]")) {
  button.addEventListener("click", () => {
    metricsView = button.dataset.metricsView;
    for (const option of document.querySelectorAll("[data-metrics-view]")) {
      option.setAttribute("aria-pressed", String(option === button));
    }
    renderMetricsGroups();
  });
}
window.addEventListener("dashboardtabchange", (event) => {
  if (event.detail?.tabId === "monitoring" && window.managerAuthenticated) {
    void loadContainerMetrics();
    void loadBuilderCachePruneStatus(builderCachePruneOperationId);
  }
});
document.querySelector("#refresh-history").addEventListener("click", loadMetricsHistory);
document.querySelector("#refresh-backups").addEventListener("click", loadBackups);
document.querySelector("#refresh-audit").addEventListener("click", loadAuditLog);
document.querySelector("#check-updates").addEventListener("click", checkForUpdates);
document.querySelector("#refresh-tasks").addEventListener("click", loadTaskHistory);
installPostgresqlButton.addEventListener("click", async () => {
  if (!confirm("PostgreSQL se instalará con almacenamiento persistente, una contraseña aleatoria como secreto Swarm y acceso solo por la red privada de Swarm. No se publicarán puertos del VPS. Las credenciales estarán disponibles una vez durante 30 minutos. ¿Continuar?")) return;
  installPostgresqlButton.disabled = true;
  postgresqlStatus.textContent = "Solicitando la instalación segura de PostgreSQL…";
  try {
    await request("/api/system/applications/postgresql", { method: "POST" });
    await Promise.all([loadPostgresqlApplication(), loadTaskHistory()]);
  } catch (error) {
    postgresqlStatus.textContent = error.message;
    installPostgresqlButton.disabled = false;
  }
});
nodeEnrollForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!confirm("El manager se conectará por SSH, instalará Docker y añadirá reglas UFW para el Swarm en los dos VPS. No se habilitará UFW ni se cambiarán reglas SSH. ¿Continuar?")) return;
  nodeEnrollSubmit.disabled = true;
  nodeEnrollStatus.textContent = "Validando VPS y enviando la solicitud segura…";
  try {
    const values = Object.fromEntries(new FormData(nodeEnrollForm));
    values.sshPort = Number(values.sshPort);
    const result = await request("/api/nodes/enroll", {
      method: "POST",
      body: JSON.stringify(values),
    });
    nodePrivateKey.value = "";
    nodeEnrollStatus.textContent = result.message;
    await loadTaskHistory();
    pollSwarmNodeEnrollment(result.task.id);
  } catch (error) {
    nodePrivateKey.value = "";
    nodeEnrollStatus.textContent = error.message;
    nodeEnrollSubmit.disabled = false;
  }
});
registryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  registrySaveButton.disabled = true;
  registryFormStatus.textContent = "Solicitando la configuración segura del registro…";
  try {
    const result = await request("/api/registry/configure", {
      method: "POST",
      body: JSON.stringify({
        domain: registryDomainInput.value.trim(),
        username: registryUsernameInput.value,
        password: registryPasswordInput.value,
      }),
    });
    registryPasswordInput.value = "";
    registryFormStatus.textContent = result.task.message;
    await loadTaskHistory();
    pollRegistryConfigurationTask(result.task.id);
  } catch (error) {
    registryFormStatus.textContent = error.message;
    registrySaveButton.disabled = false;
  }
});
manualApplicationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  manualApplicationLogs.textContent = "";
  manualApplicationLogs.hidden = true;
  manualApplicationSubmit.disabled = true;
  manualApplicationStatus.textContent = "Validando configuración y solicitando el despliegue…";
  appendManualApplicationLog("Validando configuración y solicitando el despliegue…");
  try {
    const form = new FormData(manualApplicationForm);
    const environmentValues = parseManualEnvironment(form.get("environment"), "Variables no secretas");
    const body = {
      id: form.get("id").trim(),
      version: form.get("version").trim(),
      name: form.get("name").trim(),
      description: form.get("description").trim(),
      category: form.get("category").trim(),
      image: form.get("image").trim(),
      port: Number(form.get("port")),
      cpus: Number(form.get("cpus")),
      memoryMb: Number(form.get("memoryMb")),
      volumeTarget: form.get("volumeTarget").trim() || undefined,
      zoneId: form.get("zoneId"),
      subdomain: form.get("subdomain").trim(),
      environmentValues,
      secretValues: parseManualEnvironment(form.get("secrets"), "Secretos"),
    };
    if (getApplicationTemplateDefinition()?.kind === "n8n") {
      environmentValues.GENERIC_TIMEZONE = form.get("timezone").trim();
      body.webhookZoneId = form.get("webhookZoneId");
      body.webhookSubdomain = form.get("webhookSubdomain").trim();
    }
    const result = await request("/api/applications", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!result.instance?.id || !result.task?.id) {
      throw new Error("El servidor no devolvió los identificadores de instancia y despliegue.");
    }
    manualApplicationStatus.textContent = result.message
      ?? `${form.get("name").trim()} registrada; preparando el despliegue…`;
    await Promise.all([loadSupabaseApplications(), loadTaskHistory()]);
    pollManualApplicationDeployment(result.task.id, form.get("name").trim(), result.instance.id);
  } catch (error) {
    manualApplicationForm.querySelector('[name="secrets"]').value = "";
    manualApplicationStatus.textContent = error.message;
    updateManualApplicationAvailability();
  }
});
revealPostgresqlCredentialsButton.addEventListener("click", revealPostgresqlCredentials);
document.querySelector("#close-postgresql-credentials").addEventListener("click", () => postgresqlCredentialsDialog.close());
document.querySelector("#copy-postgresql-credentials").addEventListener("click", async () => {
  const credentials = Object.fromEntries(["host", "port", "database", "username", "password"].map((field) => [
    field,
    document.querySelector(`#postgresql-credential-${field}`).textContent,
  ]));
  try {
    await navigator.clipboard.writeText(
      `Host: ${credentials.host}\nPuerto: ${credentials.port}\nBase de datos: ${credentials.database}\nUsuario: ${credentials.username}\nContraseña: ${credentials.password}`,
    );
    postgresqlStatus.textContent = "Credenciales copiadas. Guárdalas en un gestor seguro.";
  } catch (error) {
    postgresqlStatus.textContent = `No se pudieron copiar las credenciales: ${error.message}`;
  }
});
webUpdateButton.addEventListener("click", startWebUpdate);
document.querySelector("#copy-update-command").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(updateCommand.textContent);
    updatesStatus.textContent = "Comando copiado. Ejecútalo en una sesión SSH del VPS.";
  } catch (error) {
    updatesStatus.textContent = `No se pudo copiar el comando: ${error.message}`;
  }
});
createBackupButton.addEventListener("click", async () => {
  createBackupButton.disabled = true;
  backupsStatus.textContent = "Creando y cifrando respaldo de PostgreSQL…";
  try {
    const result = await request("/api/system/backups", { method: "POST" });
    backupsStatus.textContent = `Respaldo ${result.backup.id} creado y cifrado.`;
    await loadBackups();
  } catch (error) {
    backupsStatus.textContent = error.message;
  } finally {
    createBackupButton.disabled = false;
  }
});
backupSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = backupSettingsForm.querySelector("button");
  submitButton.disabled = true;
  backupSettingsStatus.textContent = "Guardando intervalo…";
  try {
    const result = await request("/api/system/backup-settings", {
      method: "PATCH",
      body: JSON.stringify({ intervalHours: Number(backupIntervalInput.value) }),
    });
    backupIntervalInput.value = String(result.intervalHours);
    backupSettingsStatus.textContent = `Respaldo automático cada ${result.intervalHours} h · retención: ${result.retentionDays} días.`;
  } catch (error) {
    backupSettingsStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});
restoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedBackupId) return;
  const submitButton = document.querySelector("#confirm-restore");
  submitButton.disabled = true;
  restoreStatus.textContent = "Validando y restaurando el respaldo…";
  try {
    await request(`/api/system/backups/${encodeURIComponent(selectedBackupId)}/restore`, {
      method: "POST",
      body: JSON.stringify({ confirmation: restoreConfirmationInput.value }),
    });
    restoreDialog.close();
    backupsStatus.textContent = "Base de datos restaurada correctamente.";
    selectedBackupId = undefined;
    await loadResources();
  } catch (error) {
    restoreStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});
for (const selector of ["#close-restore", "#cancel-restore"]) {
  document.querySelector(selector).addEventListener("click", () => {
    selectedBackupId = undefined;
    restoreDialog.close();
  });
}
metricsSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = metricsSettingsForm.querySelector("button");
  submitButton.disabled = true;
  metricsSettingsStatus.textContent = "Guardando configuración…";
  try {
    const result = await request("/api/system/metrics-settings", {
      method: "PATCH",
      body: JSON.stringify({
        intervalMinutes: Number(metricsIntervalInput.value),
        cpuPercent: Number(metricsCpuThresholdInput.value),
        memoryPercent: Number(metricsMemoryThresholdInput.value),
        diskFreePercent: Number(metricsDiskThresholdInput.value),
        restartCount: Number(metricsRestartCountInput.value),
        restartWindowMinutes: Number(metricsRestartWindowInput.value),
        httpTimeoutSeconds: Number(metricsHttpTimeoutInput.value),
        certificateWarningDays: Number(metricsCertificateDaysInput.value),
      }),
    });
    metricsIntervalInput.value = String(result.intervalMinutes);
    metricsCpuThresholdInput.value = String(result.cpuPercent);
    metricsMemoryThresholdInput.value = String(result.memoryPercent);
    metricsDiskThresholdInput.value = String(result.diskFreePercent);
    metricsRestartCountInput.value = String(result.restartCount);
    metricsRestartWindowInput.value = String(result.restartWindowMinutes);
    metricsHttpTimeoutInput.value = String(result.httpTimeoutSeconds);
    metricsCertificateDaysInput.value = String(result.certificateWarningDays);
    metricsSettingsStatus.textContent = `Retención: ${result.retentionDays} días. CPU/RAM: ${result.consecutiveSamples} muestras consecutivas.`;
    await loadMetricAlerts();
  } catch (error) {
    metricsSettingsStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});
for (const selector of ["#container-search", "#service-search", "#stack-search"]) {
  document.querySelector(selector).addEventListener("input", renderFilteredResources);
}
for (const selector of ["#container-filter", "#service-filter", "#stack-filter"]) {
  document.querySelector(selector).addEventListener("change", renderFilteredResources);
}
document.querySelector("#close-logs").addEventListener("click", () => logsDialog.close());
const copyBuildLogsButton = document.querySelector("#project-detail-build-operation-copy");
if (copyBuildLogsButton) {
  copyBuildLogsButton.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const status = document.querySelector("#project-detail-build-operation-copy-status");
    const output = document.querySelector("#project-detail-build-operation-logs").textContent;
    button.disabled = true;
    status.textContent = "Copiando salida…";
    try {
      if (!output.trim()) throw new Error("No hay salida de BuildKit para copiar.");
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(output);
      } else {
        const temporary = document.createElement("textarea");
        temporary.value = output;
        temporary.setAttribute("readonly", "");
        temporary.style.position = "fixed";
        temporary.style.opacity = "0";
        document.body.append(temporary);
        temporary.select();
        const copied = document.execCommand("copy");
        temporary.remove();
        if (!copied) throw new Error("El navegador no permitió copiar al portapapeles.");
      }
      status.textContent = "Salida copiada al portapapeles.";
    } catch (error) {
      status.textContent = `No se pudo copiar la salida: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
}

window.addEventListener("vps-manager:auth", (event) => {
  const { authenticated } = event.detail;
  handleAuthenticationChange(authenticated);
  if (authenticated) void loadResources();
});
if (window.managerAuthenticated) void loadResources();
