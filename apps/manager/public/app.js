const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const logoutButton = document.querySelector("#logout");
const refreshButton = document.querySelector("#refresh");
const refreshMetricsButton = document.querySelector("#refresh-metrics");
const statusMessage = document.querySelector("#status-message");
const metricsStatus = document.querySelector("#metrics-status");
const metricsGroups = document.querySelector("#metrics-groups");
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
const giteaUrl = document.querySelector("#gitea-url");
const giteaSsh = document.querySelector("#gitea-ssh");
const installGiteaButton = document.querySelector("#install-gitea");
const n8nStatus = document.querySelector("#n8n-status");
const n8nUrl = document.querySelector("#n8n-url");
const installN8nButton = document.querySelector("#install-n8n");
const postgresqlStatus = document.querySelector("#postgresql-status");
const installPostgresqlButton = document.querySelector("#install-postgresql");
const revealPostgresqlCredentialsButton = document.querySelector("#reveal-postgresql-credentials");
const postgresqlCredentialsDialog = document.querySelector("#postgresql-credentials-dialog");
const supabaseStatus = document.querySelector("#supabase-status");
const supabaseInstancesList = document.querySelector("#supabase-instances");
const configureSupabaseButton = document.querySelector("#configure-supabase");
const supabaseConfigurationDialog = document.querySelector("#supabase-configuration-dialog");
const supabaseConfigurationForm = document.querySelector("#supabase-configuration-form");
const supabaseConfigurationStatus = document.querySelector("#supabase-configuration-status");
const supabaseServerNodeSelect = document.querySelector("#supabase-server-node");
const saveSupabaseConfigurationButton = document.querySelector("#save-supabase-configuration");
const revealGiteaCredentialsButton = document.querySelector("#reveal-gitea-credentials");
const giteaCredentialsDialog = document.querySelector("#gitea-credentials-dialog");
const giteaTokenForm = document.querySelector("#gitea-token-form");
const giteaApiTokenInput = document.querySelector("#gitea-api-token");
const giteaApiTokenStatus = document.querySelector("#gitea-api-token-status");
const giteaRepositoryForm = document.querySelector("#gitea-repository-form");
const giteaRepositoryStatus = document.querySelector("#gitea-repository-status");
const giteaRepositoryResult = document.querySelector("#gitea-repository-result");
const giteaBranchManagement = document.querySelector("#gitea-branch-management");
const giteaBranchRepository = document.querySelector("#gitea-branch-repository");
const giteaBranchRefresh = document.querySelector("#gitea-branch-refresh");
const giteaWebhookConfigure = document.querySelector("#gitea-webhook-configure");
const giteaWebhookStatus = document.querySelector("#gitea-webhook-status");
const giteaDefaultBranchForm = document.querySelector("#gitea-default-branch-form");
const giteaDefaultBranchSelect = document.querySelector("#gitea-default-branch");
const giteaDefaultBranchSubmit = document.querySelector("#gitea-default-branch-submit");
const giteaBranchStatus = document.querySelector("#gitea-branch-status");
const projectForm = document.querySelector("#project-form");
const projectFormTitle = document.querySelector("#project-form-title");
const projectFormStatus = document.querySelector("#project-form-status");
const projectIdInput = document.querySelector("#project-id");
const projectNameInput = document.querySelector("#project-name");
const projectDescriptionInput = document.querySelector("#project-description");
const projectRepositorySelect = document.querySelector("#project-repository");
const projectProductionBranchSelect = document.querySelector("#project-production-branch");
const projectSaveButton = document.querySelector("#project-save");
const projectCancelEditButton = document.querySelector("#project-cancel-edit");
const projectsStatus = document.querySelector("#projects-status");
const projectsList = document.querySelector("#projects-list");
const projectEnvironmentDialog = document.querySelector("#project-environment-dialog");
const projectEnvironmentForm = document.querySelector("#project-environment-form");
const projectEnvironmentId = document.querySelector("#project-environment-id");
const projectEnvironmentJson = document.querySelector("#project-environment-json");
const projectEnvironmentStatus = document.querySelector("#project-environment-status");
const domainsIngressForm = document.querySelector("#domains-ingress-form");
const domainsIngressIp = document.querySelector("#domains-ingress-ip");
const domainsIngressStatus = document.querySelector("#domains-ingress-status");
const domainForm = document.querySelector("#domain-form");
const domainFormTitle = document.querySelector("#domain-form-title");
const domainIdInput = document.querySelector("#domain-id");
const domainProviderSelect = document.querySelector("#domain-provider");
const domainZoneInput = document.querySelector("#domain-zone");
const domainHostnameInput = document.querySelector("#domain-hostname");
const domainProjectSelect = document.querySelector("#domain-project");
const domainPortInput = document.querySelector("#domain-port");
const domainTokenInput = document.querySelector("#domain-token");
const domainProxiedInput = document.querySelector("#domain-proxied");
const domainFormStatus = document.querySelector("#domain-form-status");
const domainSaveButton = document.querySelector("#domain-save");
const domainCancelEditButton = document.querySelector("#domain-cancel-edit");
const domainsStatus = document.querySelector("#domains-status");
const domainsList = document.querySelector("#domains-list");
const refreshDomainsButton = document.querySelector("#refresh-domains");
const registryForm = document.querySelector("#registry-configure-form");
const registryDomainInput = document.querySelector("#registry-domain");
const registryUsernameInput = document.querySelector("#registry-username");
const registryPasswordInput = document.querySelector("#registry-password");
const registryState = document.querySelector("#registry-state");
const registryStatus = document.querySelector("#registry-status");
const registryFormStatus = document.querySelector("#registry-form-status");
const registrySaveButton = document.querySelector("#registry-save");
let giteaStatusPollTimer;
let n8nStatusPollTimer;
let postgresqlStatusPollTimer;
let giteaTokenConfigurationPending = false;
let giteaRepositoriesLoaded = false;
let giteaRepositoriesLoading = false;
let giteaRepositories = new Map();
let giteaCurrentDefaultBranch = "";
let giteaBranchRequestId = 0;
let projectBranchRequestId = 0;
let projects = [];
let giteaCanManageProjects = false;
const resourceData = { containers: [], services: [], stacks: [] };
const containerMetrics = new Map();
let metricsLoaded = false;
let metricAlertsRefreshTimer;
let metricAlertsSignature = "";
let selectedBackupId;
let webUpdatePollTimer;
let webUpdatePending = false;
let lastWebUpdateState;
let serviceOperationPollTimer;
let serviceOperationPending = false;
let registryConfigurationPollTimer;
let nodeEnrollmentPollTimer;
let supabaseApplicationData;

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? `Error HTTP ${response.status}`);
  return result;
}

function showAuthenticated(authenticated) {
  loginView.classList.toggle("hidden", authenticated);
  dashboardView.classList.toggle("hidden", !authenticated);
  logoutButton.classList.toggle("hidden", !authenticated);
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
    name.textContent = resource.name;
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
  for (const metrics of containerMetrics.values()) {
    const group = groups.get(metrics.group) ?? { cpuPercent: 0, memoryUsageBytes: 0, containerCount: 0 };
    group.cpuPercent += metrics.cpuPercent;
    group.memoryUsageBytes += metrics.memoryUsageBytes;
    group.containerCount += 1;
    groups.set(metrics.group, group);
  }

  metricsGroups.replaceChildren();
  metricsGroups.classList.toggle("hidden", groups.size === 0);
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
}

function renderFilteredResources() {
  const containerQuery = document.querySelector("#container-search").value.trim().toLocaleLowerCase("es-MX");
  const containerFilter = document.querySelector("#container-filter").value;
  const containers = resourceData.containers.filter((container) => {
    const matchesState = containerFilter === "all"
      || (containerFilter === "running" ? container.state === "running" : container.state !== "running");
    const ports = container.ports.map((port) => `${port.public ?? ""} ${port.private}/${port.type}`);
    return matchesState && matchesSearch([container.name, container.image, container.id, container.status, ...ports], containerQuery);
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
  );
  updateResourceCount("#container-count", containers.length, resourceData.containers.length);

  const serviceQuery = document.querySelector("#service-search").value.trim().toLocaleLowerCase("es-MX");
  const serviceFilter = document.querySelector("#service-filter").value;
  const services = resourceData.services.filter((service) => (
    (serviceFilter === "all" || service.mode === serviceFilter)
      && matchesSearch([service.name, service.image, service.id, service.mode, service.replicas], serviceQuery)
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
      serviceOperationStatus.textContent = "Solo se pueden reiniciar o escalar servicios administrados por VPS Manager.";
    }
    if (serviceOperationPending) {
      scheduleServiceOperationPoll();
    } else if (serviceOperationPollTimer !== undefined) {
      clearTimeout(serviceOperationPollTimer);
      serviceOperationPollTimer = undefined;
    }
    if (previousPending && !serviceOperationPending) {
      const result = await request("/api/docker/services");
      resourceData.services = result.services;
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
  refreshMetricsButton.disabled = true;
  metricsStatus.textContent = "Consultando CPU y memoria…";
  try {
    const result = await request("/api/docker/container-metrics");
    containerMetrics.clear();
    for (const metrics of result.metrics) {
      containerMetrics.set(metrics.id, metrics);
    }
    metricsLoaded = true;
    renderMetricsGroups();
    renderFilteredResources();
    const unavailableCount = result.unavailable.length;
    const updatedAt = new Date().toLocaleTimeString("es-MX");
    metricsStatus.textContent = unavailableCount
      ? `Muestra puntual · CPU agregada (puede superar 100%) · ${unavailableCount} sin métricas · ${updatedAt}`
      : `Muestra puntual actualizada · CPU agregada (puede superar 100%) · ${updatedAt}`;
    await Promise.all([loadMetricsHistory(), loadMetricAlerts()]);
  } catch (error) {
    metricsStatus.textContent = error.message;
  } finally {
    refreshMetricsButton.disabled = false;
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
    installGiteaButton.classList.toggle("hidden", !application.available);
    installGiteaButton.disabled = application.installing;
    revealGiteaCredentialsButton.classList.toggle("hidden", !application.credentialsAvailable);
    giteaTokenForm.classList.toggle("hidden", !application.installed);
    giteaApiTokenStatus.classList.toggle("hidden", !application.installed);
    giteaRepositoryForm.classList.toggle("hidden", !application.installed || !application.apiTokenConfigured);
    giteaBranchManagement.classList.toggle("hidden", !application.installed || !application.apiTokenConfigured);
    projectForm.classList.toggle("hidden", !application.installed || !application.apiTokenConfigured);
    giteaCanManageProjects = application.installed && application.apiTokenConfigured;
    renderProjects();
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
    giteaStatus.textContent = application.latestTask?.message
      ?? (application.installed
        ? "Gitea está instalado."
        : application.nameConflict
          ? "El nombre del servicio de Gitea está ocupado por un servicio ajeno a VPS Manager."
          : application.domain
            ? `Listo para instalar en ${application.domain}. Confirma que el DNS apunte al VPS y que TCP 80/443 estén disponibles.`
            : "Requiere VPS Manager con HTTPS y un dominio público; no está disponible en modo de prueba ni con una dirección IP.");
    if (application.domain && application.installed) {
      giteaUrl.href = application.url;
      giteaUrl.classList.remove("hidden");
      giteaSsh.textContent = `Git SSH: puerto ${application.sshPort}`;
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

function renderProjects() {
  projectsList.replaceChildren();
  if (projects.length === 0) {
    projectsStatus.textContent = "Todavía no hay proyectos registrados.";
    return;
  }
  projectsStatus.textContent = `${projects.length} proyecto${projects.length === 1 ? "" : "s"} registrado${projects.length === 1 ? "" : "s"}. Los pushes no despliegan aplicaciones.`;
  for (const project of projects) {
    const row = document.createElement("div");
    row.className = "resource";
    const main = document.createElement("div");
    main.className = "resource-main";
    const name = document.createElement("div");
    name.className = "resource-name";
    name.textContent = project.name;
    const details = document.createElement("div");
    details.className = "resource-detail";
    const latestBuild = project.latestBuild
      ? `Último build: ${project.latestBuild.commitSha.slice(0, 12)}`
      : "Sin builds exitosos";
    const deployment = project.deployment
      ? `Servicio ${project.deployment.serviceName} · ${project.deployment.runningReplicas}/${project.deployment.desiredReplicas} nodos activos · ${project.deployment.commitSha?.slice(0, 12) ?? "commit desconocido"}`
      : "Sin servicio desplegado";
    details.textContent = `${project.repository} · ${project.productionBranch}${project.description ? ` · ${project.description}` : ""} · ${latestBuild} · ${deployment}`;
    main.append(name, details);

    const actions = document.createElement("div");
    actions.className = "resource-actions";
    const edit = document.createElement("button");
    edit.className = "button secondary resource-action";
    edit.type = "button";
    edit.textContent = "Editar";
    edit.disabled = !giteaCanManageProjects;
    edit.addEventListener("click", async () => {
      projectIdInput.value = project.id;
      projectNameInput.value = project.name;
      projectDescriptionInput.value = project.description;
      projectRepositorySelect.value = project.repository;
      projectFormTitle.textContent = "Editar proyecto";
      projectSaveButton.textContent = "Guardar cambios";
      projectCancelEditButton.classList.remove("hidden");
      await loadProjectBranches(project.productionBranch);
      projectForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    const configureEnvironment = document.createElement("button");
    configureEnvironment.className = "button secondary resource-action";
    configureEnvironment.type = "button";
    configureEnvironment.textContent = "Variables";
    configureEnvironment.disabled = !giteaCanManageProjects;
    configureEnvironment.addEventListener("click", async () => {
      configureEnvironment.disabled = true;
      projectEnvironmentStatus.textContent = `Consultando variables de ${project.name}…`;
      try {
        const result = await request(`/api/projects/${encodeURIComponent(project.id)}/environment`);
        projectEnvironmentId.value = project.id;
        projectEnvironmentJson.value = JSON.stringify(result.environment, null, 2);
        projectEnvironmentStatus.textContent = "";
        projectEnvironmentDialog.showModal();
      } catch (error) {
        projectsStatus.textContent = error.message;
      } finally {
        configureEnvironment.disabled = !giteaCanManageProjects;
      }
    });

    const build = document.createElement("button");
    build.className = "button secondary resource-action";
    build.type = "button";
    build.textContent = "Construir imagen";
    build.disabled = !giteaCanManageProjects;
    build.addEventListener("click", async () => {
      if (!confirm(`¿Construir y publicar una imagen de ${project.name} desde ${project.repository} · ${project.productionBranch}? No se desplegará automáticamente.`)) return;
      build.disabled = true;
      projectsStatus.textContent = `Solicitando construcción de ${project.name}…`;
      try {
        const result = await request(`/api/projects/${encodeURIComponent(project.id)}/build`, {
          method: "POST",
          body: JSON.stringify({ branch: project.productionBranch }),
        });
        projectsStatus.textContent = result.message;
        await loadTaskHistory();
      } catch (error) {
        projectsStatus.textContent = error.message;
      } finally {
        build.disabled = !giteaCanManageProjects;
      }
    });

    const deploy = document.createElement("button");
    deploy.className = "button secondary resource-action";
    deploy.type = "button";
    const deploymentIsCurrent = project.deployment?.commitSha === project.latestBuild?.commitSha
      && project.deployment.mode === "global"
      && project.deployment.desiredReplicas > 0
      && project.deployment.runningReplicas === project.deployment.desiredReplicas
      && project.deployment.configurationCurrent === true;
    deploy.textContent = deploymentIsCurrent
      ? "Ya desplegado"
      : project.deployment?.commitSha === project.latestBuild?.commitSha
        ? project.deployment.configurationCurrent === false
          ? "Aplicar configuración"
          : "Reintentar despliegue"
      : "Desplegar imagen";
    deploy.disabled = !project.latestBuild || deploymentIsCurrent;
    deploy.addEventListener("click", async () => {
      if (!confirm(`¿Desplegar en Swarm la imagen ${project.latestBuild.commitSha.slice(0, 12)} de ${project.name}? Se ejecutará una instancia por cada VPS/nodo activo. Se aplicarán las variables y rutas de dominio configuradas; no se publicarán puertos del host.`)) return;
      deploy.disabled = true;
      projectsStatus.textContent = `Solicitando despliegue de ${project.name}…`;
      try {
        const result = await request(`/api/projects/${encodeURIComponent(project.id)}/deploy`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        projectsStatus.textContent = result.message;
        await loadTaskHistory();
      } catch (error) {
        projectsStatus.textContent = error.message;
      } finally {
        deploy.disabled = !project.latestBuild || deploymentIsCurrent;
      }
    });

    const undeploy = document.createElement("button");
    undeploy.className = "button secondary resource-action";
    undeploy.type = "button";
    undeploy.textContent = "Retirar servicio";
    undeploy.disabled = !project.deployment;
    undeploy.addEventListener("click", async () => {
      if (!confirm(`¿Retirar el servicio Swarm de ${project.name}? La imagen publicada en el registro no se eliminará.`)) return;
      undeploy.disabled = true;
      projectsStatus.textContent = `Solicitando retiro del servicio de ${project.name}…`;
      try {
        const result = await request(`/api/projects/${encodeURIComponent(project.id)}/deployment`, {
          method: "DELETE",
        });
        projectsStatus.textContent = result.message;
        await loadTaskHistory();
      } catch (error) {
        projectsStatus.textContent = error.message;
        undeploy.disabled = !project.deployment;
      }
    });

    const rollbackTarget = project.deploymentHistory
      ?.find((deploymentItem) => deploymentItem.commitSha !== project.deployment?.commitSha);
    const rollback = document.createElement("button");
    rollback.className = "button secondary resource-action";
    rollback.type = "button";
    rollback.textContent = rollbackTarget
      ? `Rollback · ${rollbackTarget.commitSha.slice(0, 12)}`
      : "Rollback";
    rollback.disabled = !project.deployment || !rollbackTarget || !giteaCanManageProjects;
    rollback.title = rollbackTarget
      ? `Volver al despliegue exitoso ${rollbackTarget.commitSha.slice(0, 12)}`
      : "No hay un despliegue exitoso anterior.";
    rollback.addEventListener("click", async () => {
      if (!rollbackTarget
        || !confirm(`¿Revertir ${project.name} al despliegue exitoso ${rollbackTarget.commitSha.slice(0, 12)}? Se conservarán las variables y dominios actuales.`)) return;
      rollback.disabled = true;
      projectsStatus.textContent = `Solicitando rollback de ${project.name}…`;
      try {
        const result = await request(`/api/projects/${encodeURIComponent(project.id)}/rollback`, {
          method: "POST",
          body: JSON.stringify({ commitSha: rollbackTarget.commitSha }),
        });
        projectsStatus.textContent = result.message;
        await loadTaskHistory();
      } catch (error) {
        projectsStatus.textContent = error.message;
        rollback.disabled = !project.deployment || !rollbackTarget || !giteaCanManageProjects;
      }
    });

    const remove = document.createElement("button");
    remove.className = "button secondary resource-action";
    remove.type = "button";
    remove.textContent = "Eliminar";
    remove.disabled = Boolean(project.deployment);
    remove.title = project.deployment ? "Retira primero el servicio desplegado." : "";
    remove.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar la configuración del proyecto ${project.name}? El repositorio y su webhook de Gitea no se eliminarán.`)) return;
      remove.disabled = true;
      try {
        await request(`/api/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" });
        await loadProjects();
      } catch (error) {
        projectsStatus.textContent = error.message;
        remove.disabled = false;
      }
    });
    actions.append(edit, configureEnvironment, build, deploy, rollback);
    if (project.deployment) actions.append(undeploy);
    actions.append(remove);
    row.append(main, actions);
    projectsList.append(row);
  }
}

async function loadProjects() {
  projectsStatus.textContent = "Consultando proyectos…";
  try {
    const result = await request("/api/projects");
    projects = result.projects;
    renderProjects();
  } catch (error) {
    projects = [];
    projectsList.replaceChildren();
    projectsStatus.textContent = error.message;
  }
}

function resetDomainForm() {
  domainForm.reset();
  domainIdInput.value = "";
  domainPortInput.value = "3000";
  domainFormTitle.textContent = "Conectar dominio";
  domainSaveButton.textContent = "Conectar dominio";
  domainCancelEditButton.classList.add("hidden");
  domainTokenInput.required = true;
  domainTokenInput.placeholder = "Token con Zone:Read y DNS:Edit";
  domainFormStatus.textContent = "";
  updateDomainPortForTarget();
}

function renderDomains(domains, availableProjects) {
  domainProjectSelect.replaceChildren(
    new Option(availableProjects.length ? "Selecciona un proyecto o aplicación" : "Selecciona n8n o registra un proyecto", ""),
    ...availableProjects.map((project) => new Option(project.name, `project:${project.id}`)),
    new Option("n8n", "application:n8n"),
  );
  domainProjectSelect.disabled = false;
  domainsList.replaceChildren();
  if (domains.length === 0) {
    domainsStatus.textContent = "Todavía no hay dominios conectados.";
    return;
  }
  domainsStatus.textContent = `${domains.length} dominio${domains.length === 1 ? "" : "s"} conectado${domains.length === 1 ? "" : "s"}. Los cambios de enrutamiento se aplican en el próximo despliegue.`;
  for (const domain of domains) {
    const row = document.createElement("div");
    row.className = "resource";
    const main = document.createElement("div");
    main.className = "resource-main";
    const name = document.createElement("div");
    name.className = "resource-name";
    name.textContent = domain.hostname;
    const details = document.createElement("div");
    details.className = "resource-detail";
    details.textContent = `${domain.provider} · ${domain.projectName} · puerto ${domain.port} · ${domain.proxied ? "proxy Cloudflare activo" : "DNS directo"} · token ${domain.tokenConfigured ? "guardado" : "faltante"}`;
    main.append(name, details);

    const actions = document.createElement("div");
    actions.className = "resource-actions";
    const edit = document.createElement("button");
    edit.className = "button secondary resource-action";
    edit.type = "button";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => {
      domainIdInput.value = domain.id;
      domainProviderSelect.value = domain.provider;
      domainZoneInput.value = domain.zone;
      domainHostnameInput.value = domain.hostname;
      domainProjectSelect.value = domain.applicationId
        ? `application:${domain.applicationId}`
        : `project:${domain.projectId}`;
      domainPortInput.value = String(domain.port);
      updateDomainPortForTarget();
      domainProxiedInput.checked = domain.proxied;
      domainTokenInput.value = "";
      domainTokenInput.required = false;
      domainTokenInput.placeholder = domain.tokenConfigured
        ? "Deja vacío para conservar el token actual"
        : "Token con Zone:Read y DNS:Edit";
      domainFormTitle.textContent = `Editar ${domain.hostname}`;
      domainSaveButton.textContent = "Guardar dominio";
      domainCancelEditButton.classList.remove("hidden");
      domainFormStatus.textContent = "";
      domainForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    const remove = document.createElement("button");
    remove.className = "button secondary resource-action";
    remove.type = "button";
    remove.textContent = "Quitar";
    remove.addEventListener("click", async () => {
      if (!confirm(`¿Quitar la configuración de ${domain.hostname}? El registro A de Cloudflare no se eliminará.${domain.applicationId === "n8n" ? " n8n debe estar desinstalado primero." : " El servicio actualizará sus rutas en el próximo despliegue."}`)) return;
      remove.disabled = true;
      try {
        const result = await request(`/api/domains/${encodeURIComponent(domain.id)}`, { method: "DELETE" });
        domainsStatus.textContent = result.message;
        await Promise.all([loadDomains(), loadProjects(), loadN8nApplication()]);
      } catch (error) {
        domainsStatus.textContent = error.message;
        remove.disabled = false;
      }
    });
    actions.append(edit, remove);
    row.append(main, actions);
    domainsList.append(row);
  }
}

async function loadDomains() {
  domainsStatus.textContent = "Consultando dominios…";
  try {
    const result = await request("/api/domains");
    domainsIngressIp.value = result.ingressIp ?? "";
    renderDomains(result.domains, result.projects);
  } catch (error) {
    domainsList.replaceChildren();
    domainsStatus.textContent = error.message;
  }
}

function updateDomainPortForTarget(resetPort = false) {
  const isN8n = domainProjectSelect.value === "application:n8n";
  if (isN8n) domainPortInput.value = "5678";
  else if (resetPort && domainPortInput.disabled) domainPortInput.value = "3000";
  domainPortInput.disabled = isN8n;
  domainPortInput.required = !isN8n;
}

function scheduleN8nStatusPoll() {
  if (n8nStatusPollTimer !== undefined || dashboardView.classList.contains("hidden")) return;
  n8nStatusPollTimer = setTimeout(() => {
    n8nStatusPollTimer = undefined;
    void loadN8nApplication();
  }, 3000);
}

async function loadN8nApplication() {
  try {
    const { application } = await request("/api/system/applications/n8n");
    installN8nButton.classList.toggle("hidden", !application.available);
    installN8nButton.disabled = application.installing;
    if (application.domain && application.installed) {
      n8nUrl.href = application.url;
      n8nUrl.classList.remove("hidden");
    } else {
      n8nUrl.classList.add("hidden");
    }
    n8nStatus.textContent = application.latestTask?.message
      ?? (application.installed
        ? `n8n está instalado en ${application.domain}.`
        : application.nameConflict
          ? "El nombre del servicio de n8n está ocupado por un servicio ajeno a VPS Manager."
          : application.domain
            ? `Dominio ${application.domain} listo. Puedes instalar n8n.`
            : "Conecta primero un dominio en la pestaña Dominios y asígnalo a n8n.");
    if (application.installing) scheduleN8nStatusPoll();
    else if (n8nStatusPollTimer !== undefined) {
      clearTimeout(n8nStatusPollTimer);
      n8nStatusPollTimer = undefined;
    }
  } catch (error) {
    n8nStatus.textContent = error.message;
    if (n8nStatusPollTimer !== undefined) {
      clearTimeout(n8nStatusPollTimer);
      n8nStatusPollTimer = undefined;
    }
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
    installPostgresqlButton.classList.toggle("hidden", !application.available);
    installPostgresqlButton.disabled = application.installing;
    revealPostgresqlCredentialsButton.classList.toggle("hidden", !application.credentialsAvailable);
    postgresqlStatus.textContent = application.latestTask?.message
      ?? (application.installed
        ? "PostgreSQL está instalado y disponible en la red privada de Swarm como vps-manager-postgresql:5432."
        : application.nameConflict
          ? "El nombre del servicio de PostgreSQL está ocupado por un servicio ajeno a VPS Manager."
          : "Instala PostgreSQL para habilitar una base de datos privada y persistente.");
    if (application.installing) schedulePostgresqlStatusPoll();
    else if (postgresqlStatusPollTimer !== undefined) {
      clearTimeout(postgresqlStatusPollTimer);
      postgresqlStatusPollTimer = undefined;
    }
  } catch (error) {
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
    resourceLimits: defaults.resourceLimits ?? {},
    smtp: defaults.smtp ?? null,
    oauthProviders: defaults.oauthProviders ?? {},
  };
}

function fillSupabaseConfigurationForm(serverNodeId) {
  const node = supabaseApplicationData?.servers.find((server) => server.id === serverNodeId);
  if (!node) return;
  const instance = supabaseApplicationData.instances.find((item) => item.serverNodeId === serverNodeId);
  const configuration = instance?.configuration
    ?? getSupabaseDefaults(supabaseApplicationData.catalogEntry?.configurationSchema);
  const values = {
    name: instance?.name ?? `Supabase - ${node.hostname}`,
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
    const field = supabaseConfigurationForm.elements.namedItem(name);
    if (!field) continue;
    if (field.type === "checkbox") field.checked = value === true;
    else if (name === "smtp") field.value = value ? JSON.stringify(value, null, 2) : "";
    else if (name === "oauthProviders" || name === "resourceLimits") field.value = JSON.stringify(value, null, 2);
    else field.value = value ?? "";
  }
  supabaseConfigurationStatus.textContent = instance
    ? `Editando la configuración guardada para ${node.hostname}.`
    : `Se creará la única instancia Supabase de ${node.hostname}.`;
  if (node.state !== "ready" || node.availability !== "active") {
    supabaseConfigurationStatus.textContent += " El VPS no está activo y listo; reactívalo para poder guardar cambios.";
  }
  saveSupabaseConfigurationButton.disabled = node.state !== "ready" || node.availability !== "active";
}

function renderSupabaseInstances(instances) {
  supabaseInstancesList.replaceChildren();
  if (instances.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Todavía no hay configuraciones guardadas.";
    supabaseInstancesList.append(empty);
    return;
  }
  for (const instance of instances) {
    const row = document.createElement("div");
    row.className = "resource";
    const main = document.createElement("div");
    main.className = "resource-main";
    const name = document.createElement("div");
    name.className = "resource-name";
    name.textContent = instance.name;
    const detail = document.createElement("div");
    detail.className = "resource-detail";
    detail.textContent = `${instance.serverHostname} · ${instance.status} · API ${instance.configuration.apiDomain} · Studio ${instance.configuration.studioDomain}`;
    const edit = document.createElement("button");
    edit.className = "button secondary resource-action";
    edit.type = "button";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => {
      supabaseServerNodeSelect.value = instance.serverNodeId;
      fillSupabaseConfigurationForm(instance.serverNodeId);
      supabaseConfigurationDialog.showModal();
    });
    main.append(name, detail);
    row.append(main, edit);
    supabaseInstancesList.append(row);
  }
}

function renderSupabaseCatalog(catalog, servers, instances) {
  const entry = catalog.find((application) => application.id === "supabase");
  supabaseApplicationData = { catalogEntry: entry, catalog, servers, instances };
  const services = entry?.serviceManifest?.services ?? {};
  const serviceList = document.querySelector("#supabase-services");
  serviceList.replaceChildren();
  for (const [name, service] of Object.entries(services)) {
    const item = document.createElement("li");
    item.textContent = `${name}: ${service.image}${service.port ? ` · puerto interno ${service.port}` : ""}`;
    serviceList.append(item);
  }
  const schema = entry?.configurationSchema ?? {};
  const settings = document.querySelector("#supabase-settings-summary");
  settings.textContent = [
    `Volúmenes persistentes: ${(schema.fields?.find((field) => field.key === "persistentVolumes")?.default
      ? Object.entries(schema.fields.find((field) => field.key === "persistentVolumes").default)
        .map(([name, path]) => `${name} → ${path}`).join(" · ")
      : "definidos por catálogo")}`,
    `Red: ${schema.network?.name ?? "vps-manager-proxy"} (${schema.network?.type ?? "overlay"})`,
    `Secretos generados por VPS: ${(schema.fields?.find((field) => field.key === "secrets")?.values ?? []).join(", ")}`,
  ].join("\n");
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
  renderSupabaseInstances(instances);
  supabaseStatus.textContent = entry
    ? `${entry.name} ${entry.version}: ${Object.keys(services).length} servicios. ${readyServers.length} VPS activos disponibles; ${instances.length} configuración${instances.length === 1 ? "" : "es"} guardada${instances.length === 1 ? "" : "s"}.`
    : "Supabase no está habilitado en el catálogo.";
}

async function loadSupabaseApplications() {
  supabaseStatus.textContent = "Consultando catálogo y servidores Swarm…";
  try {
    const result = await request("/api/applications");
    renderSupabaseCatalog(result.catalog, result.servers, result.instances);
  } catch (error) {
    configureSupabaseButton.disabled = true;
    supabaseStatus.textContent = error.message;
  }
}

function parseSupabaseJsonField(name, fallback) {
  const raw = supabaseConfigurationForm.elements.namedItem(name).value.trim();
  return raw ? JSON.parse(raw) : fallback;
}

function getSupabaseConfigurationFormValues() {
  const values = Object.fromEntries(new FormData(supabaseConfigurationForm));
  const configuration = {
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
  return { name: values.name.trim(), serverNodeId: values.serverNodeId, configuration };
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

async function loadProjectBranches(preferredBranch = "") {
  const repository = projectRepositorySelect.value;
  const requestId = ++projectBranchRequestId;
  projectProductionBranchSelect.replaceChildren(new Option("Consultando ramas…", ""));
  projectProductionBranchSelect.disabled = true;
  if (!repository) {
    projectProductionBranchSelect.replaceChildren(new Option("Selecciona un repositorio", ""));
    projectFormStatus.textContent = "Selecciona un repositorio de Gitea.";
    return;
  }
  projectFormStatus.textContent = "Consultando ramas…";
  try {
    const query = new URLSearchParams({ repository });
    const result = await request(`/api/system/applications/gitea/branches?${query}`);
    if (requestId !== projectBranchRequestId || repository !== projectRepositorySelect.value) return;
    projectProductionBranchSelect.replaceChildren();
    for (const branch of result.branches) {
      projectProductionBranchSelect.add(new Option(branch.name, branch.name));
    }
    const preferredBranchExists = result.branches.some((branch) => branch.name === preferredBranch);
    projectProductionBranchSelect.value = preferredBranchExists
      ? preferredBranch
      : preferredBranch ? "" : result.branches[0]?.name ?? "";
    projectProductionBranchSelect.disabled = result.branches.length === 0;
    projectFormStatus.textContent = preferredBranch && !preferredBranchExists
      ? "La rama de producción guardada ya no existe; selecciona otra rama."
      : result.branches.length
        ? `${result.branches.length} ramas disponibles.`
        : "El repositorio no tiene ramas para seleccionar.";
  } catch (error) {
    if (requestId !== projectBranchRequestId || repository !== projectRepositorySelect.value) return;
    projectProductionBranchSelect.replaceChildren(new Option("No se pudieron consultar ramas", ""));
    projectFormStatus.textContent = error.message;
  }
}

function resetProjectForm() {
  projectForm.reset();
  projectIdInput.value = "";
  projectFormTitle.textContent = "Registrar proyecto";
  projectSaveButton.textContent = "Registrar proyecto";
  projectCancelEditButton.classList.add("hidden");
  projectProductionBranchSelect.replaceChildren(new Option("Selecciona un repositorio", ""));
  projectProductionBranchSelect.disabled = true;
  projectFormStatus.textContent = "";
}

async function installGitea() {
  if (!confirm("Gitea se instalará con almacenamiento persistente, HTTPS en git.<dominio> y Git SSH en el puerto TCP 2222. Asegúrate de que el DNS apunte a este VPS y que el puerto 2222 esté libre. ¿Continuar?")) {
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

giteaTokenForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = giteaTokenForm.querySelector("button");
  submitButton.disabled = true;
  giteaApiTokenStatus.textContent = "Validando el token con Gitea…";
  try {
    await request("/api/system/applications/gitea/token", {
      method: "POST",
      body: JSON.stringify({ token: giteaApiTokenInput.value }),
    });
    giteaApiTokenInput.value = "";
    giteaTokenConfigurationPending = true;
    giteaApiTokenStatus.textContent = "Token validado. Se guardará como secreto Swarm y el panel se reiniciará para montarlo.";
    scheduleGiteaStatusPoll();
  } catch (error) {
    giteaApiTokenStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

giteaRepositoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = giteaRepositoryForm.querySelector("button");
  submitButton.disabled = true;
  giteaRepositoryStatus.textContent = "Creando repositorio privado…";
  giteaRepositoryResult.replaceChildren();
  giteaRepositoryResult.classList.add("hidden");
  try {
    const formData = new FormData(giteaRepositoryForm);
    const { repository } = await request("/api/system/applications/gitea/repositories", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description"),
      }),
    });
    const heading = document.createElement("h4");
    heading.textContent = `Repositorio privado: ${repository.name}`;
    const link = document.createElement("a");
    link.href = repository.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = repository.url;
    const httpsClone = document.createElement("p");
    httpsClone.textContent = `HTTPS: ${repository.cloneUrl}`;
    const sshClone = document.createElement("p");
    sshClone.textContent = `SSH: ${repository.sshUrl}`;
    giteaRepositoryResult.append(heading, link, httpsClone, sshClone);
    giteaRepositoryResult.classList.remove("hidden");
    giteaRepositoryStatus.textContent = "Repositorio creado correctamente.";
    giteaRepositoryForm.reset();
    await loadGiteaRepositories(true, repository.fullName);
  } catch (error) {
    giteaRepositoryStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

giteaBranchRepository.addEventListener("change", () => void loadGiteaBranches());
projectRepositorySelect.addEventListener("change", () => void loadProjectBranches());
projectCancelEditButton.addEventListener("click", resetProjectForm);
projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!giteaCanManageProjects) return;
  const id = projectIdInput.value;
  const input = {
    name: projectNameInput.value,
    description: projectDescriptionInput.value,
    repository: projectRepositorySelect.value,
    productionBranch: projectProductionBranchSelect.value,
  };
  projectSaveButton.disabled = true;
  projectFormStatus.textContent = id ? "Actualizando proyecto…" : "Registrando proyecto…";
  try {
    await request(id ? `/api/projects/${encodeURIComponent(id)}` : "/api/projects", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(input),
    });
    resetProjectForm();
    await loadProjects();
  } catch (error) {
    projectFormStatus.textContent = error.message;
  } finally {
    projectSaveButton.disabled = false;
  }
});
projectEnvironmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const projectId = projectEnvironmentId.value;
  const submitButton = projectEnvironmentForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  projectEnvironmentStatus.textContent = "Guardando variables en el VPS…";
  try {
    const environment = JSON.parse(projectEnvironmentJson.value);
    if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
      throw new Error("Proporciona un objeto JSON con nombres y valores de variables.");
    }
    const result = await request(`/api/projects/${encodeURIComponent(projectId)}/environment`, {
      method: "PUT",
      body: JSON.stringify({ environment }),
    });
    projectEnvironmentStatus.textContent = result.message;
    await loadProjects();
  } catch (error) {
    projectEnvironmentStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelector("#close-project-environment").addEventListener("click", () => projectEnvironmentDialog.close());
domainCancelEditButton.addEventListener("click", resetDomainForm);
domainProjectSelect.addEventListener("change", () => updateDomainPortForTarget(true));
domainForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = domainIdInput.value;
  const token = domainTokenInput.value;
  const input = {
    provider: domainProviderSelect.value,
    zone: domainZoneInput.value.trim(),
    hostname: domainHostnameInput.value.trim(),
    ...(domainProjectSelect.value.startsWith("application:")
      ? { applicationId: domainProjectSelect.value.slice("application:".length), port: 5678 }
      : {
        projectId: domainProjectSelect.value.slice("project:".length),
        port: Number(domainPortInput.value),
      }),
    proxied: domainProxiedInput.checked,
    ...(token ? { token } : {}),
  };
  domainSaveButton.disabled = true;
  domainFormStatus.textContent = "Validando zona y configurando el registro DNS en Cloudflare…";
  try {
    const result = await request(id ? `/api/domains/${encodeURIComponent(id)}` : "/api/domains", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    });
    domainFormStatus.textContent = result.message;
    domainTokenInput.value = "";
    resetDomainForm();
    domainsStatus.textContent = result.message;
    await Promise.all([loadDomains(), loadProjects(), loadN8nApplication()]);
  } catch (error) {
    domainFormStatus.textContent = error.message;
  } finally {
    domainSaveButton.disabled = false;
  }
});
domainsIngressForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = domainsIngressForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  domainsIngressStatus.textContent = "Actualizando registros A de Cloudflare…";
  try {
    const result = await request("/api/domains/ingress-ip", {
      method: "PUT",
      body: JSON.stringify({ ipv4: domainsIngressIp.value.trim() }),
    });
    const failures = result.failures?.map((failure) => `${failure.hostname}: ${failure.error}`).join(" · ");
    domainsIngressStatus.textContent = failures ? `${result.message} ${failures}` : result.message;
    await loadDomains();
  } catch (error) {
    domainsIngressStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});
refreshDomainsButton.addEventListener("click", () => void Promise.all([loadDomains(), loadN8nApplication()]));
giteaBranchRefresh.addEventListener("click", () => {
  if (giteaBranchRepository.value) void loadGiteaBranches();
  else void loadGiteaRepositories(true);
});
giteaWebhookConfigure.addEventListener("click", async () => {
  const repository = giteaRepositories.get(giteaBranchRepository.value);
  if (!repository?.canAdmin) return;
  giteaWebhookConfigure.disabled = true;
  giteaWebhookStatus.textContent = "Configurando webhook de push…";
  try {
    const { webhook } = await request("/api/system/applications/gitea/webhooks", {
      method: "POST",
      body: JSON.stringify({ repository: repository.fullName }),
    });
    giteaWebhookStatus.textContent = `Webhook activo para eventos push en ${webhook.url}. Los eventos se validan y registran; aún no inician despliegues.`;
  } catch (error) {
    giteaWebhookStatus.textContent = error.message;
  } finally {
    updateGiteaDefaultBranchAction();
  }
});
giteaDefaultBranchSelect.addEventListener("change", updateGiteaDefaultBranchAction);
giteaDefaultBranchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const repository = giteaRepositories.get(giteaBranchRepository.value);
  const branch = giteaDefaultBranchSelect.value;
  if (!repository?.canAdmin || !branch) return;
  if (!confirm(`¿Cambiar la rama predeterminada de ${repository.fullName} a ${branch}?`)) return;
  giteaDefaultBranchSubmit.disabled = true;
  giteaBranchStatus.textContent = "Actualizando rama predeterminada…";
  try {
    const result = await request("/api/system/applications/gitea/default-branch", {
      method: "PATCH",
      body: JSON.stringify({ repository: repository.fullName, branch }),
    });
    giteaCurrentDefaultBranch = result.repository.defaultBranch;
    giteaBranchStatus.textContent = `La rama predeterminada de ${repository.fullName} ahora es ${giteaCurrentDefaultBranch}.`;
    await loadGiteaRepositories(true, repository.fullName);
  } catch (error) {
    giteaBranchStatus.textContent = error.message;
  } finally {
    updateGiteaDefaultBranchAction();
  }
});

async function revealGiteaCredentials() {
  revealGiteaCredentialsButton.disabled = true;
  try {
    const { application } = await request("/api/system/applications/gitea");
    if (!application.credentialsAvailable || !application.latestTask?.id) {
      throw new Error("No hay credenciales de Gitea disponibles para mostrar.");
    }
    const result = await request(`/api/system/applications/gitea/credentials/${encodeURIComponent(application.latestTask.id)}`);
    const { credentials } = result;
    const url = document.querySelector("#gitea-credential-url");
    url.href = credentials.url;
    url.textContent = credentials.url;
    document.querySelector("#gitea-credential-username").textContent = credentials.username;
    document.querySelector("#gitea-credential-password").textContent = credentials.password;
    document.querySelector("#gitea-credential-ssh").textContent = credentials.sshCommand;
    giteaCredentialsDialog.showModal();
    await loadGiteaApplication();
  } catch (error) {
    giteaStatus.textContent = error.message;
    revealGiteaCredentialsButton.classList.add("hidden");
  } finally {
    revealGiteaCredentialsButton.disabled = false;
  }
}

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
    metricsLoaded = false;
    metricsGroups.replaceChildren();
    metricsGroups.classList.add("hidden");
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
      loadGiteaApplication(),
      loadN8nApplication(),
      loadPostgresqlApplication(),
      loadSupabaseApplications(),
      loadProjects(),
      loadDomains(),
      loadRegistryConfiguration(),
    ]);
    void checkForUpdates();
    statusMessage.textContent = `Última actualización: ${new Date().toLocaleTimeString("es-MX")}`;
  } catch (error) {
    statusMessage.textContent = error.message;
  } finally {
    refreshButton.disabled = false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const submitButton = loginForm.querySelector("button");
  submitButton.disabled = true;
  try {
    await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: new FormData(loginForm).get("password") }),
    });
    loginForm.reset();
    showAuthenticated(true);
    await loadResources();
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await request("/api/auth/logout", { method: "POST" });
  showAuthenticated(false);
});

refreshButton.addEventListener("click", loadResources);
configureSupabaseButton.addEventListener("click", () => {
  fillSupabaseConfigurationForm(supabaseServerNodeSelect.value);
  supabaseConfigurationDialog.showModal();
});
supabaseServerNodeSelect.addEventListener("change", () => fillSupabaseConfigurationForm(supabaseServerNodeSelect.value));
document.querySelector("#close-supabase-configuration").addEventListener("click", () => supabaseConfigurationDialog.close());
supabaseConfigurationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveSupabaseConfigurationButton.disabled = true;
  supabaseConfigurationStatus.textContent = "Guardando configuración de Supabase…";
  try {
    const body = getSupabaseConfigurationFormValues();
    const result = await request("/api/applications/supabase/instances", {
      method: "POST",
      body: JSON.stringify(body),
    });
    supabaseConfigurationDialog.close();
    supabaseStatus.textContent = result.message;
    await loadSupabaseApplications();
  } catch (error) {
    supabaseConfigurationStatus.textContent = error.message;
  } finally {
    const selectedServer = supabaseApplicationData?.servers.find((server) => server.id === supabaseServerNodeSelect.value);
    saveSupabaseConfigurationButton.disabled = !selectedServer
      || selectedServer.state !== "ready"
      || selectedServer.availability !== "active";
  }
});
refreshNodesButton.addEventListener("click", loadSwarmNodes);
refreshDiagnosticsButton.addEventListener("click", loadDiagnostics);
refreshMetricsButton.addEventListener("click", loadContainerMetrics);
document.querySelector("#refresh-history").addEventListener("click", loadMetricsHistory);
document.querySelector("#refresh-backups").addEventListener("click", loadBackups);
document.querySelector("#refresh-audit").addEventListener("click", loadAuditLog);
document.querySelector("#check-updates").addEventListener("click", checkForUpdates);
document.querySelector("#refresh-tasks").addEventListener("click", loadTaskHistory);
installGiteaButton.addEventListener("click", installGitea);
installN8nButton.addEventListener("click", async () => {
  if (!confirm("n8n se instalará con SQLite y un volumen persistente administrado, HTTPS en el dominio configurado y una clave de cifrado guardada como secreto Swarm. No se publicarán puertos del VPS. ¿Continuar?")) return;
  installN8nButton.disabled = true;
  n8nStatus.textContent = "Solicitando la instalación segura de n8n…";
  try {
    await request("/api/system/applications/n8n", { method: "POST" });
    await Promise.all([loadN8nApplication(), loadTaskHistory()]);
  } catch (error) {
    n8nStatus.textContent = error.message;
    installN8nButton.disabled = false;
  }
});
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
revealGiteaCredentialsButton.addEventListener("click", revealGiteaCredentials);
revealPostgresqlCredentialsButton.addEventListener("click", revealPostgresqlCredentials);
document.querySelector("#close-gitea-credentials").addEventListener("click", () => giteaCredentialsDialog.close());
document.querySelector("#close-postgresql-credentials").addEventListener("click", () => postgresqlCredentialsDialog.close());
document.querySelector("#copy-gitea-credentials").addEventListener("click", async () => {
  const username = document.querySelector("#gitea-credential-username").textContent;
  const password = document.querySelector("#gitea-credential-password").textContent;
  const url = document.querySelector("#gitea-credential-url").textContent;
  const sshCommand = document.querySelector("#gitea-credential-ssh").textContent;
  try {
    await navigator.clipboard.writeText(`URL: ${url}\nUsuario: ${username}\nContraseña: ${password}\nGit SSH: ${sshCommand}`);
    document.querySelector("#gitea-status").textContent = "Credenciales copiadas. Guárdalas en un gestor seguro.";
  } catch (error) {
    document.querySelector("#gitea-status").textContent = `No se pudieron copiar las credenciales: ${error.message}`;
  }
});
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

try {
  const session = await request("/api/auth/session");
  showAuthenticated(session.authenticated);
  if (session.authenticated) await loadResources();
} catch (error) {
  statusMessage.textContent = error.message;
}
