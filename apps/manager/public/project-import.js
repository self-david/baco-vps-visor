import { createProjectZip, detectProjectBuildProfile, inspectProjectZip } from "/project-archive.mjs";

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
const uploadStatus = document.querySelector("#project-upload-status");
const selection = document.querySelector("#project-selection");
const selectionName = document.querySelector("#project-selection-name");
const selectionDetails = document.querySelector("#project-selection-details");
const selectionTree = document.querySelector("#project-selection-tree");
const importButton = document.querySelector("#project-import-files");
const deploymentTypeSelect = document.querySelector("#project-import-deployment-type");

let selectedFiles = [];
let importing = false;
let githubConfigured = false;
let selectedProjectName = "";
let selectedArchiveInfo;
let selectedPaths = [];

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
      item.textContent = name;
      if (entry.children.size) {
        item.className = "project-file-directory";
        const nested = document.createElement("ul");
        appendEntries(nested, entry.children);
        item.append(nested);
      }
      parent.append(item);
    }
  };
  selectionTree.replaceChildren();
  appendEntries(selectionTree, tree);
}

async function showSelection(files, projectName = "") {
  selectedFiles = files.filter(({ file }) => file && Number.isFinite(file.size));
  selectedArchiveInfo = undefined;
  selectedPaths = [];
  if (!selectedFiles.length) {
    selection.classList.add("hidden");
    importButton.disabled = true;
    return;
  }
  const archives = selectedFiles.filter(({ file }) => /\.zip$/i.test(file.name));
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
  selectedPaths = paths;
  const buildProfile = detectProjectBuildProfile(paths);
  deploymentTypeSelect.value = buildProfile.isStaticSite ? "static" : "dynamic";
  const totalBytes = selectedFiles.reduce((sum, { file }) => sum + file.size, 0);
  const size = totalBytes < 1024 * 1024
    ? `${Math.max(1, Math.ceil(totalBytes / 1024))} KiB`
    : `${(totalBytes / (1024 * 1024)).toFixed(1)} MiB`;
  selectionName.textContent = selectedProjectName;
  selectionDetails.textContent = archives.length
    ? `${archives[0].file.name} · ${size}`
    : `${selectedFiles.length} archivos · ${size}`;
  renderFileTree(paths);
  selection.classList.remove("hidden");
  importButton.disabled = importing;
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
  if (!selectedFiles.length || importing) return;
  importing = true;
  importButton.disabled = true;
  uploadStatus.textContent = "Preparando los archivos…";
  try {
    let archive;
    const root = selectedProjectName;
    const buildProfile = detectProjectBuildProfile(selectedPaths);
    const deploymentType = deploymentTypeSelect.value;
    const zipFiles = selectedFiles.filter(({ file }) => /\.zip$/i.test(file.name));
    if (zipFiles.length) {
      archive = zipFiles[0].file;
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
        "X-Build-Strategy": deploymentType === "static" ? "dockerfile" : buildProfile.buildStrategy,
      },
      body: archive,
    });
    uploadStatus.textContent = deploymentType === "static"
      ? `${result.project.name} se creó como sitio estático con Nginx (puerto 80). Pulsa “Construir” para prepararlo.`
      : buildProfile.simpleNodeServer || buildProfile.simplePythonApp
        ? `${result.project.name} usará un contenedor básico para su archivo principal. Verifica el puerto de escucha en Configuración antes de desplegar.`
        : buildProfile.requiresCustomDockerfile
          ? `${result.project.name} requiere un Dockerfile que defina su build y puerto HTTP.`
          : `${result.project.name} se creó con sus archivos. Configura el puerto y pulsa “Construir” cuando esté listo.`;
    selectedFiles = [];
    selectedPaths = [];
    selectedArchiveInfo = undefined;
    selection.classList.add("hidden");
    zipInput.value = "";
    folderInput.value = "";
    filesInput.value = "";
    window.dispatchEvent(new CustomEvent("vps-manager:projects-updated"));
  } catch (error) {
    uploadStatus.textContent = error.message;
  } finally {
    importing = false;
    importButton.disabled = selectedFiles.length === 0;
  }
}

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
  if (event.detail.authenticated) void refreshGithubStatus();
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
