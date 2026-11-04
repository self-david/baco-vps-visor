import { createProjectZip, inspectProjectZip } from "/project-archive.mjs";

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
const dropzone = document.querySelector("#project-dropzone");
const zipInput = document.querySelector("#project-zip-input");
const folderInput = document.querySelector("#project-folder-input");
const uploadStatus = document.querySelector("#project-upload-status");
const selection = document.querySelector("#project-selection");
const selectionName = document.querySelector("#project-selection-name");
const selectionDetails = document.querySelector("#project-selection-details");
const importButton = document.querySelector("#project-import-files");

let selectedFiles = [];
let importing = false;

function showSelection(files) {
  selectedFiles = files.filter(({ file }) => file && Number.isFinite(file.size));
  if (!selectedFiles.length) {
    selection.classList.add("hidden");
    importButton.disabled = true;
    return;
  }
  const archives = selectedFiles.filter(({ file }) => /\.zip$/i.test(file.name));
  const paths = selectedFiles.map(({ file, path }) => path || file.webkitRelativePath || file.name);
  const root = archives.length
    ? archives[0].file.name.replace(/\.zip$/i, "")
    : paths[0].split("/")[0];
  const totalBytes = selectedFiles.reduce((sum, { file }) => sum + file.size, 0);
  const size = totalBytes < 1024 * 1024
    ? `${Math.max(1, Math.ceil(totalBytes / 1024))} KiB`
    : `${(totalBytes / (1024 * 1024)).toFixed(1)} MiB`;
  selectionName.textContent = root;
  selectionDetails.textContent = archives.length
    ? `${archives[0].file.name} · ${size}`
    : `${selectedFiles.length} archivos · ${size}`;
  selection.classList.remove("hidden");
  importButton.disabled = importing;
  uploadStatus.textContent = "";
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
    let root;
    let hasDockerfile = false;
    const zipFiles = selectedFiles.filter(({ file }) => /\.zip$/i.test(file.name));
    if (zipFiles.length) {
      if (selectedFiles.length !== 1 || zipFiles.length !== 1) {
        throw new Error("Selecciona un único ZIP o una carpeta, no ambos.");
      }
      if (zipFiles[0].file.size > 32 * 1024 * 1024) {
        throw new Error("El ZIP supera el límite de 32 MiB.");
      }
      const inspected = await inspectProjectZip(zipFiles[0].file);
      root = inspected.root;
      hasDockerfile = inspected.hasDockerfile;
      archive = zipFiles[0].file;
    } else {
      const paths = selectedFiles.map(({ file, path }) => path || file.webkitRelativePath || file.name);
      const roots = new Set(paths.map((path) => path.split("/")[0]));
      if (roots.size !== 1) throw new Error("Arrastra una sola carpeta de proyecto cada vez.");
      root = [...roots][0];
      hasDockerfile = paths.some((path) => {
        const parts = path.split("/");
        return parts.length === 2 && parts[1] === "Dockerfile";
      });
      archive = await createProjectZip(selectedFiles.map(({ file, path }, index) => ({
        file,
        path: path || file.webkitRelativePath || paths[index],
      })), root);
    }

    uploadStatus.textContent = "Creando el proyecto y guardando sus archivos…";
    const result = await request("/api/projects/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/zip",
        "X-Project-Name": safeProjectName(root),
        "X-Build-Strategy": hasDockerfile ? "dockerfile" : "railpack",
      },
      body: archive,
    });
    uploadStatus.textContent = `${result.project.name} se creó con sus archivos. Configura el puerto y pulsa “Construir” cuando esté listo.`;
    selectedFiles = [];
    selection.classList.add("hidden");
    zipInput.value = "";
    folderInput.value = "";
    window.dispatchEvent(new CustomEvent("vps-manager:projects-updated"));
  } catch (error) {
    uploadStatus.textContent = error.message;
  } finally {
    importing = false;
    importButton.disabled = selectedFiles.length === 0;
  }
}

githubConnectButton.addEventListener("click", async () => {
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
});

async function refreshGithubStatus() {
  try {
    const result = await request("/api/github/status");
    const callbackState = new URLSearchParams(window.location.search).get("github");
    githubConnectButton.textContent = result.accounts?.length ? "Conectar otra cuenta" : "Conectar cuenta";
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
    githubConnectStatus.textContent = `No se pudo consultar la configuración OAuth: ${error.message}`;
    if (githubStatus) githubStatus.textContent = error.message;
  }
}

void refreshGithubStatus();
window.addEventListener("vps-manager:auth", (event) => {
  if (event.detail.authenticated) void refreshGithubStatus();
});
window.addEventListener("vps-manager:github-config-updated", () => void refreshGithubStatus());

zipInput.addEventListener("change", () => {
  const file = zipInput.files?.[0];
  showSelection(file ? [{ file, path: file.name }] : []);
});
folderInput.addEventListener("change", () => {
  showSelection(Array.from(folderInput.files ?? []).map((file) => ({
    file,
    path: file.webkitRelativePath,
  })));
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
      showSelection(groups.flat());
    } catch (error) {
      uploadStatus.textContent = error.message;
    }
    return;
  }
  showSelection(Array.from(event.dataTransfer?.files ?? []).map((file) => ({ file, path: file.name })));
});

importButton.disabled = true;
githubConnectButton.disabled = false;
