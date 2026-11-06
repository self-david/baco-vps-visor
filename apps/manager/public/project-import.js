import {
  createProjectZip,
  detectProjectBuildProfile,
  inspectProjectZip,
  isIgnoredProjectFile,
  sanitizeProjectZip,
} from "/project-archive.mjs";
import { projectTemplates } from "/project-templates.mjs";

const request = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof Blob) ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? `Error HTTP ${response.status}`);
  return result;
};

const githubConnectButton = document.querySelector("#github-install");
const githubConnectStatus = document.querySelector("#github-connect-status");
const githubStatus = document.querySelector("#github-status");
const githubSettings = document.querySelector("#github-settings");
const githubClientIdInput = document.querySelector("#github-client-id");
const dropzone = document.querySelector("#project-dropzone");
const zipInput = document.querySelector("#project-zip-input");
const folderInput = document.querySelector("#project-folder-input");
const filesInput = document.querySelector("#project-files-input");
const importDialog = document.querySelector("#project-import-dialog");
const importStepLabel = document.querySelector("#project-import-step-label");
const importFilesStep = document.querySelector("#project-import-files-step");
const importSettingsStep = document.querySelector("#project-import-settings-step");
const importSuccessStep = document.querySelector("#project-import-success");
const importSuccessMessage = document.querySelector("#project-import-success-message");
const importFilesStepIndicator = document.querySelector("#project-import-step-files");
const importSettingsStepIndicator = document.querySelector("#project-import-step-settings");
const importBackButton = document.querySelector("#project-import-back");
const importNextButton = document.querySelector("#project-import-next");
const importCloseButton = document.querySelector("#project-import-close");
const importOpenProjectLink = document.querySelector("#project-import-open-project");
const uploadStatus = document.querySelector("#project-upload-status");
const selection = document.querySelector("#project-selection");
const selectionName = document.querySelector("#project-selection-name");
const selectionDetails = document.querySelector("#project-selection-details");
const projectNameInput = document.querySelector("#project-import-name");
const createDomainInput = document.querySelector("#project-import-create-domain");
const domainZoneSelect = document.querySelector("#project-import-domain-zone");
const domainSubdomainInput = document.querySelector("#project-import-domain-subdomain");
const domainPreview = document.querySelector("#project-import-domain-preview");
const domainStatus = document.querySelector("#project-import-domain-status");
const detectionProfile = document.querySelector("#project-detection-profile");
const selectionTree = document.querySelector("#project-selection-tree");
const importButton = document.querySelector("#project-import-files");
const deploymentTypeSelect = document.querySelector("#project-import-deployment-type");
const buildStrategySelect = document.querySelector("#project-import-build-strategy");
const buildContextInput = document.querySelector("#project-import-build-context");
const dockerfileInput = document.querySelector("#project-import-dockerfile");
const internalPortInput = document.querySelector("#project-import-port");
const buildCommandInput = document.querySelector("#project-import-build-command");
const outputDirectoryInput = document.querySelector("#project-import-output-directory");
const templateButtons = document.querySelectorAll("[data-project-template]");

let selectedFiles = [];
let importing = false;
let importStep = 1;
let importCompleted = false;
let githubConfigured = false;
let selectedProjectName = "";
let selectedArchiveInfo;
let selectedPaths = [];
let selectedBuildProfile;
let domainNameCustomized = false;
let availableDomainZones = [];

function projectDomainLabel(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}

function updateProjectDomainPreview() {
  const enabled = createDomainInput.checked;
  const subdomain = domainSubdomainInput.value.trim().toLowerCase();
  const validSubdomain = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain);
  const zone = domainZoneSelect.value;
  domainSubdomainInput.setCustomValidity(enabled && !validSubdomain
    ? "Usa un subdominio de 1 a 63 letras minúsculas, números o guiones; no puede empezar ni terminar con guion."
    : "");
  domainZoneSelect.setCustomValidity(enabled && !zone ? "Selecciona un dominio raíz conectado." : "");
  domainZoneSelect.disabled = !enabled || availableDomainZones.length === 0;
  domainSubdomainInput.disabled = !enabled || availableDomainZones.length === 0;
  domainPreview.textContent = enabled && validSubdomain && zone
    ? `Se conectará https://${subdomain}.${zone}/; la ruta se activará al desplegar el proyecto.`
    : enabled ? "Indica un subdominio válido y selecciona una zona." : "";
}

async function loadImportDomainZones() {
  const wasUnavailable = createDomainInput.disabled;
  try {
    const result = await request("/api/domains");
    availableDomainZones = (Array.isArray(result.zones) ? result.zones : [])
      .filter((zone) => zone.connectionStatus === "connected" && zone.tokenConfigured);
    const selectedZone = domainZoneSelect.value;
    domainZoneSelect.replaceChildren(new Option(
      availableDomainZones.length ? "Selecciona un dominio raíz" : "No hay dominios disponibles",
      "",
    ));
    for (const zone of availableDomainZones) {
      const option = new Option(zone.zone, zone.zone);
      domainZoneSelect.add(option);
    }
    if (availableDomainZones.some((zone) => zone.zone === selectedZone)) {
      domainZoneSelect.value = selectedZone;
    } else if (availableDomainZones.length) {
      domainZoneSelect.value = availableDomainZones[0].zone;
    }
    if (!availableDomainZones.length) {
      createDomainInput.checked = false;
      createDomainInput.disabled = true;
      domainStatus.textContent = "No hay zonas de Cloudflare conectadas y verificadas. Puedes importar el proyecto y asignar un dominio desde su detalle.";
    } else {
      if (wasUnavailable) createDomainInput.checked = true;
      createDomainInput.disabled = false;
      domainStatus.textContent = "El subdominio se sugerirá a partir del nombre y se conectará a Cloudflare.";
    }
  } catch (error) {
    availableDomainZones = [];
    createDomainInput.checked = false;
    createDomainInput.disabled = true;
    domainZoneSelect.replaceChildren(new Option("Dominios no disponibles", ""));
    domainStatus.textContent = `No se pudieron consultar los dominios: ${error.message}. Puedes importar el proyecto y asignar un dominio desde su detalle.`;
  }
  updateProjectDomainPreview();
}

function updateProjectName() {
  const name = projectNameInput.value.trim();
  projectNameInput.setCustomValidity(name.includes("..") || (name && safeProjectName(name) !== name)
    ? "El nombre debe usar caracteres seguros y no terminar en punto o guion."
    : "");
  selectionName.textContent = name || "Proyecto sin nombre";
  importButton.disabled = importing || selectedFiles.length === 0 || !projectNameInput.validity.valid;
  if (!domainNameCustomized) domainSubdomainInput.value = projectDomainLabel(name);
  updateProjectDomainPreview();
}

function openGithubSetup() {
  githubSettings.open = true;
  githubSettings.scrollIntoView({ behavior: "smooth", block: "center" });
  githubClientIdInput.focus({ preventScroll: true });
  githubConnectStatus.textContent = "Para conectar GitHub una sola vez, crea una OAuth App, pega su Client ID y Client Secret, y pulsa “Guardar y continuar”.";
}

function renderFileTree(paths) {
  const tree = new Map();
  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    let children = tree;
    for (const [index, part] of parts.entries()) {
      const current = children.get(part) ?? { children: new Map(), file: index === parts.length - 1 };
      if (index < parts.length - 1) current.file = false;
      children.set(part, current);
      children = current.children;
    }
  }
  const appendEntries = (parent, entries) => {
    for (const [name, entry] of [...entries].sort(([left], [right]) => left.localeCompare(right))) {
      const item = document.createElement("li");
      if (entry.children.size) {
        item.className = "project-file-directory";
        const nested = document.createElement("ul");
        appendEntries(nested, entry.children);
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
  selectionTree.replaceChildren();
  appendEntries(selectionTree, tree);
}

async function showSelection(files, projectName = "") {
  selectedFiles = files.filter(({ file, path }) =>
    file && Number.isFinite(file.size) && !isIgnoredProjectFile(path || file.webkitRelativePath || file.name));
  selectedArchiveInfo = undefined;
  selectedPaths = [];
  if (!selectedFiles.length) {
    selection.classList.add("hidden");
    importButton.disabled = true;
    return;
  }
  selection.classList.remove("hidden");
  importDialog.querySelector("#project-import-dialog-title").textContent = "Revisar archivos";
  importNextButton.disabled = true;
  importButton.disabled = true;
  uploadStatus.textContent = "Analizando los archivos seleccionados…";
  setImportStep(1);
  if (!importDialog.open) importDialog.showModal();
  const archives = selectedFiles.filter(({ file }) => /\.zip$/i.test(file.name));
  await loadImportDomainZones();
  const sourcePaths = selectedFiles.map(({ file, path }) => path || file.webkitRelativePath || file.name);
  if (archives.length && (selectedFiles.length !== 1 || archives.length !== 1)) {
    selectedFiles = [];
    selection.classList.add("hidden");
    uploadStatus.textContent = "Selecciona un ZIP a la vez; no lo combines con archivos o carpetas.";
    importButton.disabled = true;
    return;
  }
  const paths = [];
  if (archives.length) {
    if (archives[0].file.size > 32 * 1024 * 1024) {
      selectedFiles = [];
      selection.classList.add("hidden");
      uploadStatus.textContent = "El ZIP supera el límite de 32 MiB.";
      importButton.disabled = true;
      return;
    }
    try {
      selectedArchiveInfo = await inspectProjectZip(archives[0].file);
      paths.push(...selectedArchiveInfo.paths);
    } catch (error) {
      selectedFiles = [];
      selection.classList.add("hidden");
      uploadStatus.textContent = error.message;
      importButton.disabled = true;
      return;
    }
  } else {
    const commonRoot = sourcePaths.length > 0
      && sourcePaths.every((path) => path.includes("/") && path.split("/")[0] === sourcePaths[0].split("/")[0])
      ? sourcePaths[0].split("/")[0]
      : "";
    paths.push(...sourcePaths.map((path) => commonRoot ? path.slice(commonRoot.length + 1) : path));
  }
  const inferredName = archives.length
    ? archives[0].file.name.replace(/\.zip$/i, "")
    : selectedFiles.length === 1 && !sourcePaths[0].includes("/")
      ? selectedFiles[0].file.name.replace(/\.[^.]+$/, "")
      : sourcePaths[0].includes("/") ? sourcePaths[0].split("/")[0] : sourcePathsRoot(selectedFiles);
  selectedProjectName = projectName || inferredName;
  domainNameCustomized = false;
  projectNameInput.value = selectedProjectName;
  updateProjectName();
  selectedPaths = paths;
  const metadataFiles = selectedArchiveInfo?.metadataFiles ?? {};
  if (!archives.length) {
    for (const [index, path] of paths.entries()) {
      const fileName = path.split("/").at(-1).toLowerCase();
      const isBuildMetadata = ["package.json", "requirements.txt", "pyproject.toml"].includes(fileName)
        || /^astro\.config\.[cm]?[jt]s$/.test(fileName);
      if (!isBuildMetadata || Object.keys(metadataFiles).length >= 10) continue;
      const file = selectedFiles[index]?.file;
      if (file && file.size <= 256 * 1024) metadataFiles[path.toLowerCase()] = await file.text();
    }
  }
  selectedBuildProfile = detectProjectBuildProfile(paths, metadataFiles);
  deploymentTypeSelect.value = selectedBuildProfile.recommendedDeploymentType;
  buildStrategySelect.value = selectedBuildProfile.buildStrategy;
  buildContextInput.value = selectedBuildProfile.buildContext;
  dockerfileInput.value = selectedBuildProfile.dockerfilePath;
  internalPortInput.value = String(selectedBuildProfile.internalPort);
  buildCommandInput.value = selectedBuildProfile.buildCommand;
  outputDirectoryInput.value = selectedBuildProfile.buildOutputDirectory;
  updateSelectionProfile();
  const totalBytes = selectedFiles.reduce((sum, { file }) => sum + file.size, 0);
  const size = totalBytes < 1024 * 1024
    ? `${Math.max(1, Math.ceil(totalBytes / 1024))} KiB`
    : `${(totalBytes / (1024 * 1024)).toFixed(1)} MiB`;
  selectionDetails.textContent = archives.length
    ? `${archives[0].file.name} · ${size}`
    : `${selectedFiles.length} archivos · ${size}`;
  renderFileTree(paths);
  selection.classList.remove("hidden");
  importCompleted = false;
  importOpenProjectLink.hidden = true;
  importSuccessStep.hidden = true;
  importFilesStep.hidden = false;
  importSettingsStep.hidden = false;
  importButton.hidden = false;
  importButton.disabled = importing;
  importNextButton.hidden = false;
  importNextButton.disabled = false;
  setImportStep(1);
  uploadStatus.textContent = "";
  if (!importDialog.open) importDialog.showModal();
}

function updateSelectionProfile() {
  if (!selectedBuildProfile) return;
  const deployment = {
    static: "Estático con Nginx",
    dynamic: "Aplicación dinámica",
    build: "Build estático con Nginx",
  }[deploymentTypeSelect.value];
  const strategy = deploymentTypeSelect.value === "dynamic"
    ? buildStrategySelect.value === "railpack" ? "Railpack" : "Dockerfile personalizado"
    : deploymentTypeSelect.value === "static" ? "Nginx sin build" : "BuildKit + Nginx";
  const warning = selectedBuildProfile.warning ? ` Aviso: ${selectedBuildProfile.warning}` : "";
  detectionProfile.textContent = `Detectado: ${selectedBuildProfile.framework} · ${deployment} · ${strategy} · puerto ${deploymentTypeSelect.value === "dynamic" ? internalPortInput.value : 80}. ${selectedBuildProfile.reason} Confianza ${selectedBuildProfile.confidence}.${warning}`;
  buildStrategySelect.disabled = deploymentTypeSelect.value !== "dynamic";
  internalPortInput.disabled = deploymentTypeSelect.value !== "dynamic";
  buildCommandInput.disabled = deploymentTypeSelect.value === "static";
  outputDirectoryInput.disabled = deploymentTypeSelect.value !== "build";
  document.querySelector("#project-import-build-strategy-field").hidden = deploymentTypeSelect.value !== "dynamic";
  document.querySelector("#project-import-build-context-field").hidden = deploymentTypeSelect.value === "static";
  document.querySelector("#project-import-dockerfile-field").hidden = deploymentTypeSelect.value !== "dynamic"
    || buildStrategySelect.value !== "dockerfile";
  document.querySelector("#project-import-port-field").hidden = deploymentTypeSelect.value !== "dynamic";
  document.querySelector("#project-import-build-output-fields").hidden = deploymentTypeSelect.value !== "build";
  document.querySelector("#project-import-field-help").textContent = deploymentTypeSelect.value === "static"
    ? "Nginx sirve los archivos tal cual. No se usan opciones de build, Dockerfile ni puerto."
    : deploymentTypeSelect.value === "build"
      ? "Se instala según el lockfile, se ejecuta el comando de compilación y Nginx sirve la carpeta de salida en el puerto 80."
      : buildStrategySelect.value === "railpack"
        ? `Railpack detecta cómo construir y arrancar la aplicación en el puerto ${internalPortInput.value}. No se usa la ruta de Dockerfile.`
        : `Docker construye desde el contexto seleccionado y ejecuta el Dockerfile; el servicio escucha en el puerto ${internalPortInput.value}.`;
}

function setImportStep(step) {
  importStep = step;
  const isReviewingFiles = step === 1;
  importFilesStep.hidden = !isReviewingFiles;
  importSettingsStep.hidden = isReviewingFiles;
  importBackButton.hidden = isReviewingFiles;
  importNextButton.hidden = !isReviewingFiles;
  importButton.hidden = isReviewingFiles || importCompleted;
  importStepLabel.textContent = isReviewingFiles
    ? "Paso 1 de 2 · Revisa los archivos seleccionados"
    : "Paso 2 de 2 · Elige nombre y configuración de despliegue";
  importFilesStepIndicator.toggleAttribute("aria-current", isReviewingFiles);
  importSettingsStepIndicator.toggleAttribute("aria-current", !isReviewingFiles);
  if (!isReviewingFiles) projectNameInput.focus({ preventScroll: true });
}

function resetImportDialog() {
  if (importing) return;
  selectedFiles = [];
  selectedPaths = [];
  selectedArchiveInfo = undefined;
  selectedBuildProfile = undefined;
  selectedProjectName = "";
  projectNameInput.value = "";
  zipInput.value = "";
  folderInput.value = "";
  filesInput.value = "";
  selection.classList.add("hidden");
  importCompleted = false;
  importSuccessStep.hidden = true;
  importOpenProjectLink.hidden = true;
  uploadStatus.textContent = "";
}

function sourcePathsRoot(files) {
  const roots = new Set(files.map(({ file, path }) => (path || file.webkitRelativePath || file.name).split("/")[0]));
  return roots.size === 1 ? [...roots][0] : "proyecto";
}

function readDroppedEntry(entry, parentPath = "") {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file((file) => resolve([{ file, path }]), reject);
    });
  }
  if (!entry.isDirectory) return Promise.resolve([]);
  const reader = entry.createReader();
  return new Promise((resolve, reject) => {
    const files = [];
    const readBatch = () => reader.readEntries(async (entries) => {
      if (!entries.length) {
        resolve(files);
        return;
      }
      try {
        const batches = await Promise.all(entries.map((child) => readDroppedEntry(child, path)));
        for (const batch of batches) files.push(...batch);
        readBatch();
      } catch (error) {
        reject(error);
      }
    }, reject);
    readBatch();
  });
}

function safeProjectName(root) {
  return root
    .replace(/[^A-Za-z0-9._ -]/g, "-")
    .replace(/\.\.+/g, "-")
    .trim()
    .replace(/^[^A-Za-z0-9]+|[.-]+$/g, "")
    .slice(0, 100) || "proyecto";
}

async function importSelectedFiles() {
  updateProjectName();
  if (!selectedFiles.length || importing || !projectNameInput.reportValidity()) return;
  if (createDomainInput.checked
    && (!domainSubdomainInput.reportValidity() || !domainZoneSelect.reportValidity())) return;
  importing = true;
  importButton.disabled = true;
  importCloseButton.disabled = true;
  importBackButton.disabled = true;
  uploadStatus.textContent = "Preparando los archivos…";
  try {
    let archive;
    const root = safeProjectName(projectNameInput.value.trim());
    const buildProfile = selectedBuildProfile;
    const deploymentType = deploymentTypeSelect.value;
    const zipFiles = selectedFiles.filter(({ file }) => /\.zip$/i.test(file.name));
    if (zipFiles.length) {
      const ignoredPaths = selectedArchiveInfo.paths.filter(isIgnoredProjectFile);
      if (ignoredPaths.length) {
        uploadStatus.textContent = `Omitiendo ${ignoredPaths.length} archivos o cachés excluidos del ZIP…`;
        archive = await sanitizeProjectZip(zipFiles[0].file, safeProjectName(root));
      } else {
        archive = zipFiles[0].file;
      }
    } else {
      archive = await createProjectZip(selectedFiles.map(({ file, path }, index) => ({
        file,
        path: path || file.webkitRelativePath || selectedPaths[index],
      })), root);
    }

    uploadStatus.textContent = "Creando el proyecto y guardando sus archivos…";
    const result = await request("/api/projects/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/zip",
        "X-Project-Name": safeProjectName(root),
        "X-Deployment-Type": deploymentType,
        "X-Build-Strategy": deploymentType === "dynamic" ? buildStrategySelect.value : "dockerfile",
        "X-Project-Framework": buildProfile.framework,
        "X-Internal-Port": deploymentType === "dynamic" ? internalPortInput.value : "80",
        "X-Build-Command": buildCommandInput.value,
        "X-Build-Output-Directory": outputDirectoryInput.value,
        "X-Build-Context": buildContextInput.value.trim(),
        "X-Dockerfile-Path": dockerfileInput.value.trim(),
      },
      body: archive,
    });
    const importMessage = deploymentType === "static"
      ? `${result.project.name} se creó como sitio estático con Nginx (puerto 80). Pulsa “Construir” para prepararlo.`
      : deploymentType === "build"
        ? `${result.project.name} (${result.project.framework}) se creó para compilar con ${result.project.buildCommand} y publicar ${result.project.buildOutputDirectory}. Revisa la configuración y pulsa “Construir”.`
        : `${result.project.name} se detectó como ${result.project.framework}; quedó configurado con ${result.project.buildStrategy} en el puerto ${result.project.internalPort}. Revisa Configuración y pulsa “Construir” cuando esté listo.`;
    let domainMessage = "";
    if (createDomainInput.checked) {
      const zone = domainZoneSelect.value;
      const hostname = `${domainSubdomainInput.value.trim().toLowerCase()}.${zone}`;
      const zoneConfiguration = availableDomainZones.find((candidate) => candidate.zone === zone);
      try {
        const domain = await request("/api/domains", {
          method: "POST",
          body: JSON.stringify({
            zone,
            hostname,
            projectId: result.project.id,
            port: result.project.internalPort,
            proxied: zoneConfiguration?.proxied ?? false,
          }),
        });
        domainMessage = ` ${domain.message}`;
        window.dispatchEvent(new CustomEvent("vps-manager:domains-updated"));
      } catch (error) {
        domainMessage = ` El proyecto se creó, pero no se pudo asignar ${hostname}: ${error.message} Puedes asignarlo desde el detalle del proyecto.`;
      }
    }
    uploadStatus.textContent = `${importMessage}${domainMessage}`;
    importCompleted = true;
    importFilesStep.hidden = true;
    importSettingsStep.hidden = true;
    importSuccessStep.hidden = false;
    importStepLabel.textContent = "Paso 2 de 2 · Proyecto creado";
    importFilesStepIndicator.removeAttribute("aria-current");
    importSettingsStepIndicator.setAttribute("aria-current", "step");
    importSuccessMessage.textContent = `${importMessage}${domainMessage}`;
    importOpenProjectLink.href = `/projects/${encodeURIComponent(result.project.id)}`;
    importOpenProjectLink.hidden = false;
    importNextButton.hidden = true;
    importBackButton.hidden = true;
    importButton.hidden = true;
    document.querySelector("#project-import-dialog-title").textContent = result.project.name;
    selectedFiles = [];
    selectedPaths = [];
    selectedArchiveInfo = undefined;
    selectedBuildProfile = undefined;
    zipInput.value = "";
    folderInput.value = "";
    filesInput.value = "";
    window.dispatchEvent(new CustomEvent("vps-manager:projects-updated"));
  } catch (error) {
    uploadStatus.textContent = error.message;
  } finally {
    importing = false;
    importCloseButton.disabled = false;
    importBackButton.disabled = false;
    if (!importCompleted) updateProjectName();
  }
}

projectNameInput.addEventListener("input", updateProjectName);
document.querySelector("#project-import-next").addEventListener("click", () => {
  setImportStep(2);
  updateProjectName();
  projectNameInput.reportValidity();
});
importBackButton.addEventListener("click", () => setImportStep(1));
importCloseButton.addEventListener("click", () => importDialog.close());
importDialog.addEventListener("cancel", (event) => {
  if (importing) event.preventDefault();
});
importDialog.addEventListener("close", resetImportDialog);
domainSubdomainInput.addEventListener("input", () => {
  domainNameCustomized = true;
  domainSubdomainInput.value = domainSubdomainInput.value.toLowerCase();
  updateProjectDomainPreview();
});
domainZoneSelect.addEventListener("change", updateProjectDomainPreview);
createDomainInput.addEventListener("change", updateProjectDomainPreview);
deploymentTypeSelect.addEventListener("change", updateSelectionProfile);
buildStrategySelect.addEventListener("change", updateSelectionProfile);
internalPortInput.addEventListener("input", updateSelectionProfile);

async function connectGithubAccount() {
  if (!githubConfigured) {
    openGithubSetup();
    return;
  }
  githubConnectButton.disabled = true;
  githubConnectStatus.textContent = "Iniciando la autorización segura con GitHub…";
  try {
    const result = await request("/api/github/connect", { method: "POST" });
    if (typeof result.url !== "string" || new URL(result.url).origin !== "https://github.com") {
      throw new Error("El servidor devolvió una URL de autorización de GitHub no válida.");
    }
    githubConnectStatus.textContent = "Abriendo GitHub para autorizar el acceso…";
    window.location.assign(result.url);
  } catch (error) {
    githubConnectStatus.textContent = `No se pudo conectar con GitHub: ${error.message}`;
    githubConnectButton.disabled = false;
  }
}

githubConnectButton.addEventListener("click", () => void connectGithubAccount());

async function refreshGithubStatus() {
  try {
    const result = await request("/api/github/status");
    githubConfigured = result.configured === true;
    const callbackState = new URLSearchParams(window.location.search).get("github");
    githubConnectButton.textContent = !githubConfigured
      ? "Configurar GitHub"
      : result.accounts?.length ? "Conectar otra cuenta" : "Conectar cuenta";
    githubConnectButton.classList.toggle("secondary", !githubConfigured);
    if (!githubConfigured) githubSettings.open = true;
    if (callbackState === "connected") {
      githubConnectStatus.textContent = "Cuenta de GitHub conectada. Selecciona la cuenta, repositorio y rama para importar.";
    } else if (callbackState === "denied") {
      githubConnectStatus.textContent = "Se canceló la autorización de GitHub.";
    } else if (callbackState === "error") {
      githubConnectStatus.textContent = new URLSearchParams(window.location.search).get("message")
        || "No se pudo completar la conexión con GitHub.";
    } else {
      githubConnectStatus.textContent = result.configured
        ? "Autoriza GitHub para consultar tus repositorios."
        : "Primero guarda las credenciales de una GitHub OAuth App en “Configuración de GitHub OAuth”.";
    }
  } catch (error) {
    githubConfigured = false;
    githubConnectStatus.textContent = `No se pudo consultar la configuración OAuth: ${error.message}`;
    if (githubStatus) githubStatus.textContent = error.message;
  }
}

void refreshGithubStatus();
window.addEventListener("vps-manager:auth", (event) => {
  if (event.detail.authenticated) {
    void refreshGithubStatus();
    void loadImportDomainZones();
  }
});
window.addEventListener("vps-manager:github-config-updated", async () => {
  await refreshGithubStatus();
  if (githubConfigured) await connectGithubAccount();
});

zipInput.addEventListener("change", () => {
  const file = zipInput.files?.[0];
  void showSelection(file ? [{ file, path: file.name }] : []);
});
folderInput.addEventListener("change", () => {
  void showSelection(Array.from(folderInput.files ?? []).map((file) => ({
    file,
    path: file.webkitRelativePath,
  })));
});
filesInput.addEventListener("change", () => {
  void showSelection(Array.from(filesInput.files ?? []).map((file) => ({ file, path: file.name })));
});
importButton.addEventListener("click", () => void importSelectedFiles());
for (const button of templateButtons) {
  button.addEventListener("click", async () => {
    const template = projectTemplates.find(({ id }) => id === button.dataset.projectTemplate);
    if (!template) {
      uploadStatus.textContent = "No se encontró la plantilla seleccionada.";
      return;
    }
    for (const candidate of templateButtons) candidate.disabled = true;
    try {
      await showSelection(template.files.map(({ name, type, content }) => ({
        file: new File([content], name, { type }),
        path: name,
      })), template.name);
      deploymentTypeSelect.value = template.deploymentType;
      updateSelectionProfile();
      setImportStep(2);
    } catch (error) {
      uploadStatus.textContent = `No se pudo preparar la plantilla: ${error.message}`;
    } finally {
      for (const candidate of templateButtons) candidate.disabled = false;
    }
  });
}

for (const eventName of ["dragenter", "dragover"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  });
}
dropzone.addEventListener("drop", async (event) => {
  const items = Array.from(event.dataTransfer?.items ?? []);
  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) {
    uploadStatus.textContent = "Leyendo los archivos seleccionados…";
    try {
      const groups = await Promise.all(entries.map((entry) => readDroppedEntry(entry)));
      await showSelection(groups.flat());
    } catch (error) {
      uploadStatus.textContent = error.message;
    }
    return;
  }
  void showSelection(Array.from(event.dataTransfer?.files ?? []).map((file) => ({ file, path: file.name })));
});

importButton.disabled = true;
githubConnectButton.disabled = false;
if (window.managerAuthenticated) void loadImportDomainZones();
