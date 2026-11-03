const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const dashboardTabs = [...document.querySelectorAll('[role="tab"][aria-controls]')];
const dashboardPanels = dashboardTabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
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
const tasksList = document.querySelector("#tasks-list");
const tasksStatus = document.querySelector("#tasks-status");
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

function activateDashboardTab(tabId, { focus = false, updateHash = true } = {}) {
  const selectedTab = dashboardTabs.find((tab) => tab.id === `tab-button-${tabId}`);
  if (!selectedTab) return false;

  for (const tab of dashboardTabs) {
    const active = tab === selectedTab;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const panel of dashboardPanels) {
    const active = panel.id === selectedTab.getAttribute("aria-controls");
    panel.hidden = !active;
    panel.classList.toggle("hidden", !active);
  }
  if (focus) selectedTab.focus();
  if (updateHash && location.hash !== `#${selectedTab.getAttribute("aria-controls")}`) {
    history.replaceState(null, "", `#${selectedTab.getAttribute("aria-controls")}`);
  }
  return true;
}

for (const tab of dashboardTabs) {
  tab.addEventListener("click", () => activateDashboardTab(tab.id.replace("tab-button-", "")));
  tab.addEventListener("keydown", (event) => {
    const currentIndex = dashboardTabs.indexOf(tab);
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % dashboardTabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + dashboardTabs.length) % dashboardTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = dashboardTabs.length - 1;
    else return;
    event.preventDefault();
    activateDashboardTab(dashboardTabs[nextIndex].id.replace("tab-button-", ""), { focus: true });
  });
}

window.addEventListener("hashchange", () => {
  const panelId = location.hash.slice(1);
  const tab = dashboardTabs.find((item) => item.getAttribute("aria-controls") === panelId);
  if (tab) activateDashboardTab(tab.id.replace("tab-button-", ""), { updateHash: false });
});
const initialPanelId = location.hash.slice(1);
const initialTab = dashboardTabs.find((tab) => tab.getAttribute("aria-controls") === initialPanelId);
if (initialTab) activateDashboardTab(initialTab.id.replace("tab-button-", ""), { updateHash: false });

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
      const secondaryAction = getSecondaryAction?.(resource);
      if (secondaryAction) {
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
      ? { label: "Reiniciar", onClick: requestServiceRestart }
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
      serviceOperationStatus.textContent = "Solo se pueden reiniciar servicios administrados por VPS Manager.";
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
      title.textContent = task.type === "service.restart"
        ? `Reinicio de ${task.serviceName}`
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
      details.textContent = `${currentStatus} · ${createdAt}${attempts}${finishedAt}`;
      main.append(title, details);
      row.append(main);
      if (task.error || task.result?.message) {
        const message = document.createElement("div");
        message.className = `task-result${task.status === "failed" ? " status-error" : ""}`;
        message.textContent = task.error ?? task.result.message;
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
      loadServiceOperationStatus(),
      loadTaskHistory(),
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
refreshDiagnosticsButton.addEventListener("click", loadDiagnostics);
refreshMetricsButton.addEventListener("click", loadContainerMetrics);
document.querySelector("#refresh-history").addEventListener("click", loadMetricsHistory);
document.querySelector("#refresh-backups").addEventListener("click", loadBackups);
document.querySelector("#refresh-audit").addEventListener("click", loadAuditLog);
document.querySelector("#check-updates").addEventListener("click", checkForUpdates);
document.querySelector("#refresh-tasks").addEventListener("click", loadTaskHistory);
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
