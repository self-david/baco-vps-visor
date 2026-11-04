const maximumArchiveBytes = 32 * 1024 * 1024;
const maximumArchiveEntries = 100_000;
const utf8 = new TextEncoder();

export function detectProjectBuildProfile(paths) {
  const fileNames = new Set(paths.map((path) => path.split("/").at(-1).toLowerCase()));
  const hasDockerfile = fileNames.has("dockerfile");
  const manifestFiles = [
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "pipfile",
    "cargo.toml",
    "go.mod",
    "cmakelists.txt",
    "makefile",
    "composer.json",
    "pom.xml",
    "gemfile",
    "deno.json",
    "deno.jsonc",
    "bun.lock",
    "bun.lockb",
  ];
  const hasManifest = manifestFiles.some((fileName) => fileNames.has(fileName));
  const simpleNodeServer = fileNames.has("server.js")
    && !hasManifest
    && !fileNames.has("main.py")
    && !fileNames.has("main.cpp");
  const simplePythonApp = fileNames.has("main.py")
    && !hasManifest
    && !fileNames.has("server.js")
    && !fileNames.has("main.cpp");
  const requiresCustomDockerfile = fileNames.has("main.cpp")
    || fileNames.has("cmakelists.txt")
    || fileNames.has("makefile");
  const isStaticSite = paths.includes("index.html")
    && !hasDockerfile
    && !hasManifest
    && !simpleNodeServer
    && !simplePythonApp
    && !requiresCustomDockerfile;
  return {
    buildStrategy: hasDockerfile || isStaticSite || simpleNodeServer || simplePythonApp || requiresCustomDockerfile
      ? "dockerfile"
      : "railpack",
    internalPort: isStaticSite ? 80 : 3000,
    isStaticSite,
    simpleNodeServer,
    simplePythonApp,
    requiresCustomDockerfile,
  };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function validateArchivePath(path) {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\")) {
    throw new TypeError("La carpeta contiene una ruta no válida.");
  }
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new TypeError("La carpeta contiene una ruta no válida.");
  }
  return parts;
}

export async function inspectProjectZip(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new TypeError("El ZIP está incompleto o no es válido.");

  const entryCount = view.getUint16(endOffset + 10, true);
  const centralDirectorySize = view.getUint32(endOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);
  if (!entryCount || entryCount > maximumArchiveEntries
    || centralDirectoryOffset + centralDirectorySize > endOffset) {
    throw new TypeError("El ZIP no contiene una estructura de proyecto válida.");
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let offset = centralDirectoryOffset;
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      throw new TypeError("El ZIP está incompleto o no es válido.");
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length) throw new TypeError("El ZIP está incompleto o no es válido.");
    let path;
    try {
      path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    } catch {
      throw new TypeError("El ZIP debe usar nombres de archivo UTF-8.");
    }
    const directory = path.endsWith("/") || Boolean(view.getUint32(offset + 38, true) & 0x10);
    if (path.endsWith("/")) path = path.slice(0, -1);
    validateArchivePath(path);
    entries.push({ path, directory });
    offset = end;
  }
  const topLevelDirectories = new Set(entries
    .filter((entry) => entry.directory && !entry.path.includes("/"))
    .map((entry) => entry.path));
  const root = topLevelDirectories.values().next().value ?? entries[0]?.path.split("/")[0] ?? "";
  const hasRootContents = entries.some((entry) => entry.path.startsWith(`${root}/`));
  const stripRoot = entries.every((entry) => entry.path === root || entry.path.startsWith(`${root}/`))
    && (topLevelDirectories.size === 1 || hasRootContents);
  const paths = entries
    .filter((entry) => !entry.directory)
    .map(({ path }) => stripRoot ? path.split("/").slice(1).join("/") : path);
  if (!paths.length) throw new TypeError("El ZIP no contiene archivos de proyecto.");
  return {
    root,
    paths,
    hasDockerfile: paths.includes("Dockerfile"),
  };
}

export async function createProjectZip(files, rootName) {
  if (!Array.isArray(files) || files.length === 0 || files.length + 1 > maximumArchiveEntries) {
    throw new TypeError("La carpeta no contiene archivos válidos.");
  }
  const rootParts = validateArchivePath(rootName);
  if (rootParts.length !== 1) throw new TypeError("El nombre de la carpeta no es válido.");
  const root = rootParts[0];
  const entries = [{ name: `${root}/`, bytes: new Uint8Array(), directory: true }];
  const filePaths = files.map(({ file, path }) => path || file.name);
  const firstParts = filePaths.map((path) => validateArchivePath(path));
  const commonDirectory = firstParts.length > 0
    && firstParts.every((parts) => parts.length > 1 && parts[0] === firstParts[0][0])
    ? firstParts[0][0]
    : null;
  let contentBytes = 0;
  for (const [index, item] of files.entries()) {
    const parts = firstParts[index];
    const relativePath = commonDirectory ? parts.slice(1) : parts;
    contentBytes += item.file.size;
    if (contentBytes > maximumArchiveBytes) {
      throw new RangeError("La carpeta supera el límite de 32 MiB.");
    }
    entries.push({
      name: `${root}/${relativePath.join("/")}`,
      bytes: new Uint8Array(await item.file.arrayBuffer()),
      directory: false,
    });
  }
  if (entries.length === 1) throw new TypeError("La carpeta no contiene archivos de proyecto.");

  const timestamp = dosTimestamp();
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;
  for (const entry of entries) {
    const nameBytes = utf8.encode(entry.name);
    const checksum = crc32(entry.bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, timestamp.time, true);
    localView.setUint16(12, timestamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, entry.bytes.length, true);
    localView.setUint32(22, entry.bytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    localRecords.push(local, entry.bytes);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 0x0314, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, timestamp.time, true);
    centralView.setUint16(14, timestamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, entry.bytes.length, true);
    centralView.setUint32(24, entry.bytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(38, entry.directory ? 0x10 : 0, true);
    centralView.setUint32(42, localOffset, true);
    central.set(nameBytes, 46);
    centralRecords.push(central);
    localOffset += local.length + entry.bytes.length;
  }

  const centralDirectory = new Blob(centralRecords);
  const centralBytes = new Uint8Array(await centralDirectory.arrayBuffer());
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralBytes.length, true);
  endView.setUint32(16, localOffset, true);
  const archive = new Blob([...localRecords, centralBytes, end], { type: "application/zip" });
  if (archive.size > maximumArchiveBytes) {
    throw new RangeError("El ZIP generado supera el límite de 32 MiB.");
  }
  return archive;
}
