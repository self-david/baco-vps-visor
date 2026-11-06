const maximumArchiveBytes = 32 * 1024 * 1024;
const maximumArchiveEntries = 100_000;
const maximumMetadataFileBytes = 256 * 1024;
const utf8 = new TextEncoder();

const ignoredProjectDirectories = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vercel",
  "node_modules",
  "coverage",
  "vendor",
  "unpacked",
]);
const ignoredProjectFiles = new Set([".env", ".ds_store", "thumbs.db"]);

export function isIgnoredProjectFile(path) {
  const parts = path.replaceAll("\\", "/").split("/");
  return parts.some((part) => ignoredProjectDirectories.has(part.toLowerCase()))
    || parts.some((part, index) => part.toLowerCase() === ".yarn"
      && ["cache", "install-state.gz"].includes(parts[index + 1]?.toLowerCase()))
    || ignoredProjectFiles.has(parts.at(-1).toLowerCase())
    || /^\.env\.(?!example$|sample$|template$)/i.test(parts.at(-1));
}

function packageJsonContent(files) {
  const context = files?.__buildContext ?? ".";
  const content = files?.[context === "." ? "package.json" : `${context}/package.json`]
    ?? files?.["package.json"];
  if (typeof content !== "string" || content.length > maximumMetadataFileBytes) return null;
  try {
    const manifest = JSON.parse(content);
    return manifest && typeof manifest === "object" && !Array.isArray(manifest) ? manifest : null;
  } catch {
    return null;
  }
}

export function detectProjectBuildProfile(paths, files = {}) {
  const normalizedPaths = paths.map((path) => path.replaceAll("\\", "/"));
  const sourcePaths = normalizedPaths.filter((path) => !isIgnoredProjectFile(path));
  const manifestNames = new Set([
    "package.json", "requirements.txt", "pyproject.toml", "pipfile", "cargo.toml",
    "go.mod", "composer.json", "pom.xml", "gemfile", "deno.json", "deno.jsonc",
  ]);
  const manifestContexts = [...new Set(sourcePaths
    .filter((path) => manifestNames.has(path.split("/").at(-1).toLowerCase()))
    .map((path) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "."))];
  const rootHasManifest = manifestContexts.includes(".");
  const rootHasDockerfile = sourcePaths.includes("Dockerfile");
  const context = rootHasDockerfile || rootHasManifest || manifestContexts.length !== 1 ? "." : manifestContexts[0];
  const contextPaths = context === "."
    ? sourcePaths
    : sourcePaths.filter((path) => path.startsWith(`${context}/`))
      .map((path) => path.slice(context.length + 1));
  const rootPaths = contextPaths.filter((path) => !path.includes("/"));
  const rootNames = new Set(rootPaths.map((path) => path.toLowerCase()));
  const fileNames = new Set(contextPaths
    .map((path) => path.split("/").at(-1).toLowerCase()));
  const manifest = packageJsonContent({ ...files, __buildContext: context });
  const astroConfigPath = rootPaths.find((path) => /^astro\.config\.[cm]?[jt]s$/i.test(path));
  const astroConfig = astroConfigPath ? files[astroConfigPath.toLowerCase()] : "";
  const dependencies = {
    ...manifest?.dependencies,
    ...manifest?.devDependencies,
  };
  const packageManagerLocks = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"]
    .filter((name) => rootNames.has(name));
  const lockfileConflict = packageManagerLocks.length > 1 && !manifest?.packageManager;
  const scripts = manifest?.scripts && typeof manifest.scripts === "object" ? manifest.scripts : {};
  const hasDockerfile = rootNames.has("dockerfile");
  const hasManifest = [
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
  ].some((fileName) => rootNames.has(fileName));
  const simpleNodeServer = fileNames.has("server.js") && !hasManifest
    && !fileNames.has("main.py") && !fileNames.has("main.cpp");
  const simplePythonApp = fileNames.has("main.py") && !hasManifest
    && !fileNames.has("server.js") && !fileNames.has("main.cpp");
  const requiresCustomDockerfile = rootNames.has("main.cpp")
    || rootNames.has("cmakelists.txt") || rootNames.has("makefile");
  const nextProject = Boolean(dependencies.next) || [...rootNames].some((path) => /^next\.config\./.test(path));
  const astroProject = Boolean(dependencies.astro) || [...rootNames].some((path) => /^astro\.config\./.test(path));
  const astroServerOutput = astroProject
    && typeof astroConfig === "string"
    && /\boutput\s*:\s*(['"])server\1/.test(astroConfig);
  const viteProject = Boolean(dependencies.vite) || [...rootNames].some((path) => /^vite\.config\./.test(path));
  const reactProject = Boolean(dependencies.react);
  const createReactApp = Boolean(dependencies["react-scripts"]);
  const vueProject = Boolean(dependencies.vue);
  const svelteProject = Boolean(dependencies["@sveltejs/kit"] || dependencies.svelte);
  const angularProject = Boolean(dependencies["@angular/core"]);
  const frontendBuild = (astroProject && !astroServerOutput) || viteProject || angularProject || vueProject || svelteProject
    || (reactProject && !nextProject);
  const nodeServerProject = typeof scripts.start === "string" && Boolean(scripts.start.trim())
    && !nextProject && !frontendBuild;
  const goProject = rootNames.has("go.mod");
  const rustProject = rootNames.has("cargo.toml");
  const phpProject = rootNames.has("composer.json");
  const javaProject = rootNames.has("pom.xml");
  const rubyProject = rootNames.has("gemfile");
  const denoProject = rootNames.has("deno.json") || rootNames.has("deno.jsonc");
  const hasPythonManifest = rootNames.has("requirements.txt") || rootNames.has("pyproject.toml")
    || rootNames.has("pipfile");
  const requirementsPath = context === "." ? "requirements.txt" : `${context}/requirements.txt`;
  const pyprojectPath = context === "." ? "pyproject.toml" : `${context}/pyproject.toml`;
  const pythonDependencies = `${files[requirementsPath] ?? files["requirements.txt"] ?? ""}\n${files[pyprojectPath] ?? files["pyproject.toml"] ?? ""}`.toLowerCase();
  const isStaticSite = rootNames.has("index.html")
    && !hasDockerfile && !hasManifest && !simpleNodeServer && !simplePythonApp && !requiresCustomDockerfile;
  const hasServerEntrypoint = fileNames.has("server.js") || fileNames.has("main.py")
    || fileNames.has("app.py") || fileNames.has("server.py");
  const recommendedDeploymentType = isStaticSite
    ? "static"
    : hasDockerfile ? "dynamic"
      : nextProject ? "dynamic"
      : astroServerOutput ? "dynamic"
      : frontendBuild && !hasDockerfile ? "build"
        : nodeServerProject ? "dynamic"
        : hasPythonManifest || goProject || rustProject || phpProject || javaProject || rubyProject || denoProject
          ? "dynamic"
      : hasManifest && !hasServerEntrypoint && !hasDockerfile ? "build"
        : "dynamic";
  const framework = nextProject ? "Next.js"
      : astroProject ? "Astro"
        : angularProject ? "Angular"
          : svelteProject ? dependencies["@sveltejs/kit"] ? "SvelteKit" : "Svelte"
            : vueProject ? viteProject ? "Vue + Vite" : "Vue"
              : reactProject && viteProject ? "React + Vite"
                : reactProject ? "React"
                  : viteProject ? "Vite"
                    : isStaticSite ? "HTML/CSS/JavaScript vanilla"
                      : simpleNodeServer || (hasServerEntrypoint && rootNames.has("package.json"))
                        ? "Node.js"
                        : hasPythonManifest || simplePythonApp ? "Python"
                          : goProject ? "Go"
                            : rustProject ? "Rust"
                              : phpProject ? "PHP"
                                : javaProject ? "Java"
                                  : rubyProject ? "Ruby"
                                    : denoProject ? "Deno"
                          : requiresCustomDockerfile ? "C/C++"
                            : hasDockerfile ? "Dockerfile personalizado"
                            : manifest ? "Node.js"
                              : "Proyecto web";
  const pythonFramework = /\bfastapi\b/.test(pythonDependencies) ? "FastAPI"
    : /\bdjango\b/.test(pythonDependencies) ? "Django"
      : /\bflask\b/.test(pythonDependencies) ? "Flask" : null;
  const pythonInternalPort = pythonFramework === "Flask" ? 5000 : pythonFramework ? 8000 : 3000;
  const resolvedFramework = framework === "Python" && pythonFramework ? `Python · ${pythonFramework}` : framework;
  const buildStrategy = hasDockerfile || isStaticSite || frontendBuild || requiresCustomDockerfile
    ? "dockerfile"
    : "railpack";
  const buildOutputDirectory = createReactApp ? "build" : "dist";
  const warnings = [];
  if (lockfileConflict) {
    warnings.push(`Se detectaron varios lockfiles (${packageManagerLocks.join(", ")}); conserva solo el que usa el proyecto para que Railpack instale dependencias de forma predecible.`);
  }
  if (astroServerOutput && !(typeof scripts.start === "string" && scripts.start.trim())) {
    warnings.push('Astro genera un servidor Node.js. Añade el script "start": "node ./dist/server/entry.mjs" antes de desplegar.');
  }
  return {
    framework: resolvedFramework,
    buildStrategy,
    internalPort: isStaticSite || recommendedDeploymentType === "build" ? 80 : pythonInternalPort,
    isStaticSite,
    recommendedDeploymentType,
    simpleNodeServer,
    simplePythonApp,
    requiresCustomDockerfile,
    buildCommand: typeof scripts.build === "string" ? "npm run build" : "npm run build",
    buildOutputDirectory,
    buildContext: context,
    dockerfilePath: context === "." ? "Dockerfile" : `${context}/Dockerfile`,
    confidence: lockfileConflict ? "media"
      : hasDockerfile || nextProject || astroProject || reactProject || simpleNodeServer
      || simplePythonApp || isStaticSite ? "alta" : hasManifest ? "media" : "baja",
    reason: manifestContexts.length > 1 && !rootHasManifest
      ? "Se encontraron varias aplicaciones en subdirectorios; confirma el directorio de contexto."
      : hasDockerfile ? `Se encontró Dockerfile en ${context === "." ? "la raíz" : context}.`
      : nextProject ? "Se detectó Next.js en package.json o en su configuración."
        : astroServerOutput ? "Astro configura output: 'server'; necesita un runtime Node.js, no Nginx estático."
        : frontendBuild ? "Se detectó un framework frontend con salida estática; se compilará y servirá con Nginx."
          : isStaticSite ? "Se encontró index.html sin manifiesto de dependencias."
            : hasPythonManifest || simplePythonApp ? "Se detectó un manifiesto o punto de entrada Python."
              : hasManifest || simpleNodeServer ? "Se detectó un manifiesto o punto de entrada Node.js."
                : "No se encontró un framework reconocido; revisa la configuración antes de desplegar.",
    ...(warnings.length ? { warning: warnings.join(" ") } : {}),
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

async function readZipEntry(bytes, entry, maximumBytes) {
  if (entry.uncompressedSize > maximumBytes) {
    throw new RangeError("El contenido descomprimido del ZIP supera los límites permitidos.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = entry.localHeaderOffset;
  if (header + 30 > bytes.length || view.getUint32(header, true) !== 0x04034b50) {
    throw new TypeError("El ZIP contiene un archivo de configuración inválido.");
  }
  const dataOffset = header + 30 + view.getUint16(header + 26, true) + view.getUint16(header + 28, true);
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataEnd > bytes.length) throw new TypeError("El ZIP está incompleto o no es válido.");
  const compressed = bytes.subarray(dataOffset, dataEnd);
  let content;
  if (entry.compressionMethod === 0) {
    content = compressed;
  } else if (entry.compressionMethod === 8) {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const reader = stream.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel();
        throw new RangeError("El contenido descomprimido del ZIP supera los límites permitidos.");
      }
      chunks.push(value);
    }
    content = new Uint8Array(length);
    let contentOffset = 0;
    for (const chunk of chunks) {
      content.set(chunk, contentOffset);
      contentOffset += chunk.byteLength;
    }
  } else {
    throw new TypeError("El ZIP utiliza un método de compresión que no se puede limpiar automáticamente.");
  }
  if (content.byteLength > maximumBytes || content.byteLength !== entry.uncompressedSize) {
    throw new TypeError("Un archivo del ZIP supera el tamaño permitido o está dañado.");
  }
  return content;
}

async function readZipMetadataFile(bytes, entry) {
  if (entry.uncompressedSize > maximumMetadataFileBytes || ![0, 8].includes(entry.compressionMethod)) return null;
  const content = await readZipEntry(bytes, entry, maximumMetadataFileBytes);
  return new TextDecoder("utf-8", { fatal: true }).decode(content);
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
    entries.push({
      path,
      directory,
      compressionMethod: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
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
  const metadataFiles = {};
  const metadataNames = new Set(["package.json", "requirements.txt", "pyproject.toml"]);
  for (const entry of entries) {
    const path = stripRoot ? entry.path.split("/").slice(1).join("/") : entry.path;
    const fileName = path.split("/").at(-1).toLowerCase();
    if (entry.directory || (!metadataNames.has(fileName) && !/^astro\.config\.[cm]?[jt]s$/.test(fileName))
      || Object.keys(metadataFiles).length >= 10) continue;
    const content = await readZipMetadataFile(bytes, entry);
    if (content !== null) metadataFiles[path.toLowerCase()] = content;
  }
  return {
    root,
    paths,
    hasDockerfile: paths.includes("Dockerfile"),
    metadataFiles,
  };
}

export async function sanitizeProjectZip(file, rootName) {
  await inspectProjectZip(file);
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
  const directoryOffset = view.getUint32(endOffset + 16, true);
  if (!entryCount || entryCount > maximumArchiveEntries) {
    throw new TypeError("El ZIP contiene demasiados archivos.");
  }
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries = [];
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      throw new TypeError("El ZIP está incompleto o no es válido.");
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length) throw new TypeError("El ZIP está incompleto o no es válido.");
    const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const directory = path.endsWith("/") || Boolean(view.getUint32(offset + 38, true) & 0x10);
    const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;
    validateArchivePath(normalizedPath);
    entries.push({
      path: normalizedPath,
      directory,
      compressionMethod: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset = end;
  }
  const topLevelDirectories = new Set(entries
    .filter((entry) => entry.directory && !entry.path.includes("/"))
    .map((entry) => entry.path));
  const root = topLevelDirectories.values().next().value ?? entries[0]?.path.split("/")[0] ?? "";
  const hasRootContents = entries.some((entry) => entry.path.startsWith(`${root}/`));
  const stripRoot = entries.every((entry) => entry.path === root || entry.path.startsWith(`${root}/`))
    && (topLevelDirectories.size === 1 || hasRootContents);
  const files = [];
  let totalBytes = 0;
  for (const entry of entries) {
    const path = stripRoot ? entry.path.split("/").slice(1).join("/") : entry.path;
    if (entry.directory || !path || isIgnoredProjectFile(path)) continue;
    totalBytes += entry.uncompressedSize;
    if (totalBytes > maximumArchiveBytes) {
      throw new RangeError("El contenido que se conservará supera el límite de 32 MiB.");
    }
    const content = await readZipEntry(bytes, entry, maximumArchiveBytes);
    files.push({
      file: {
        name: path.split("/").at(-1),
        size: content.byteLength,
        arrayBuffer: async () => content.buffer.slice(
          content.byteOffset,
          content.byteOffset + content.byteLength,
        ),
      },
      path,
    });
  }
  return createProjectZip(files, rootName);
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
