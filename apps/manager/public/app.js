const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const logoutButton = document.querySelector("#logout");
const refreshButton = document.querySelector("#refresh");
const statusMessage = document.querySelector("#status-message");
const logsDialog = document.querySelector("#logs-dialog");
const logsTitle = document.querySelector("#logs-title");
const logsStatus = document.querySelector("#logs-status");
const logsContent = document.querySelector("#logs-content");
const resourceData = { containers: [], services: [], stacks: [] };

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
}

function renderResources(target, resources, getDetail, getState, onAction, emptyMessage) {
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
    if (onAction) {
      const action = document.createElement("button");
      action.className = "button secondary resource-action";
      action.type = "button";
      action.textContent = "Ver logs";
      action.addEventListener("click", () => onAction(resource));
      row.append(action);
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

function renderServerInfo(server) {
  const details = [
    ["Nombre", server.name],
    ["Sistema operativo", `${server.operatingSystem} · ${server.architecture}`],
    ["Docker Engine", server.serverVersion],
    ["CPU", `${server.cpuCount} núcleos`],
    ["Memoria", `${(server.memoryBytes / 1024 ** 3).toFixed(1)} GiB`],
    ["Contenedores", `${server.containers.running} activos · ${server.containers.stopped} detenidos · ${server.containers.total} total`],
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
      return [item.image, item.id, item.status, ...ports].filter(Boolean).join(" · ");
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

async function loadResources() {
  refreshButton.disabled = true;
  statusMessage.textContent = "Consultando Docker…";
  try {
    const [containersResult, servicesResult, serverResult, stacksResult] = await Promise.all([
      request("/api/docker/containers"),
      request("/api/docker/services"),
      request("/api/docker/info"),
      request("/api/docker/stacks"),
    ]);
    renderServerInfo(serverResult.server);
    resourceData.containers = containersResult.containers;
    resourceData.services = servicesResult.services;
    resourceData.stacks = stacksResult.stacks;
    renderFilteredResources();
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
