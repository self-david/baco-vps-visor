export class ProjectArchiveValidationError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "ProjectArchiveValidationError";
    this.statusCode = statusCode;
  }
}

function rejectArchive(statusCode, message) {
  throw new ProjectArchiveValidationError(statusCode, message);
}

export function validateProjectArchive(archive) {
  const maximumFiles = 100_000;
  const maximumUncompressedBytes = 1024 * 1024 * 1024;
  const minimumOffset = Math.max(0, archive.length - 65_557);
  let endOffset = -1;
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) rejectArchive(400, "El ZIP está incompleto o no es válido.");
  const commentLength = archive.readUInt16LE(endOffset + 20);
  const diskNumber = archive.readUInt16LE(endOffset + 4);
  const directoryDiskNumber = archive.readUInt16LE(endOffset + 6);
  const diskEntryCount = archive.readUInt16LE(endOffset + 8);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const directorySize = archive.readUInt32LE(endOffset + 12);
  const directoryOffset = archive.readUInt32LE(endOffset + 16);
  if (endOffset + 22 + commentLength !== archive.length
    || diskNumber !== 0 || directoryDiskNumber !== 0 || diskEntryCount !== entryCount
    || entryCount === 0xffff || !entryCount || entryCount > maximumFiles
    || directorySize === 0xffffffff || directoryOffset === 0xffffffff
    || directoryOffset + directorySize > endOffset) {
    rejectArchive(400, "El ZIP no contiene una estructura de proyecto válida.");
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let offset = directoryOffset;
  let fileCount = 0;
  let uncompressedBytes = 0;
  const paths = new Set();
  const filePaths = [];
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > archive.length || archive.readUInt32LE(offset) !== 0x02014b50) {
      rejectArchive(400, "El ZIP está incompleto o no es válido.");
    }
    const madeBy = archive.readUInt16LE(offset + 4) >>> 8;
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const entryCommentLength = archive.readUInt16LE(offset + 32);
    const entryEnd = offset + 46 + nameLength + extraLength + entryCommentLength;
    if (entryEnd > archive.length) rejectArchive(400, "El ZIP está incompleto o no es válido.");
    let name;
    try {
      name = decoder.decode(archive.subarray(offset + 46, offset + 46 + nameLength));
    } catch {
      rejectArchive(400, "El ZIP debe usar nombres de archivo UTF-8.");
    }
    const isDirectory = name.endsWith("/");
    const path = isDirectory ? name.slice(0, -1) : name;
    const parts = path.split("/");
    if (!path || path.startsWith("/") || path.includes("\\")
      || parts.some((part) => !part || part === "." || part === "..")
      || paths.has(path)) {
      rejectArchive(400, "El ZIP contiene una ruta no válida o duplicada.");
    }
    paths.add(path);
    entries.push({ path, directory: isDirectory });
    const externalAttributes = archive.readUInt32LE(offset + 38);
    const mode = (externalAttributes >>> 16) & 0xf000;
    if (madeBy === 3 && mode !== 0
      && mode !== (isDirectory ? 0x4000 : 0x8000)) {
      rejectArchive(400, "El ZIP contiene enlaces o archivos especiales no permitidos.");
    }
    if (!isDirectory) {
      fileCount += 1;
      filePaths.push(path);
      uncompressedBytes += archive.readUInt32LE(offset + 24);
      if (fileCount > maximumFiles || uncompressedBytes > maximumUncompressedBytes) {
        rejectArchive(413, "El contenido descomprimido del ZIP supera los límites permitidos.");
      }
    }
    offset = entryEnd;
  }
  if (!fileCount || offset !== directoryOffset + directorySize) {
    rejectArchive(400, "El ZIP no contiene archivos de proyecto válidos.");
  }
  const topLevelDirectories = new Set(entries
    .filter((entry) => entry.directory && !entry.path.includes("/"))
    .map((entry) => entry.path));
  const root = topLevelDirectories.values().next().value ?? entries[0].path.split("/")[0];
  const hasRootContents = entries.some((entry) => entry.path.startsWith(`${root}/`));
  const stripRoot = entries.every((entry) => entry.path === root || entry.path.startsWith(`${root}/`))
    && (topLevelDirectories.size === 1 || hasRootContents);
  return stripRoot
    ? filePaths.map((path) => path.split("/").slice(1).join("/"))
    : filePaths;
}
