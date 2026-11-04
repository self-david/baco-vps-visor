import assert from "node:assert/strict";
import test from "node:test";
import { createProjectZip, inspectProjectZip } from "../public/project-archive.mjs";
import { validateProjectArchive } from "../project-archive-validation.mjs";

function fileWithPath(name, content, path) {
  const file = new Blob([content]);
  Object.defineProperties(file, {
    name: { value: name },
    webkitRelativePath: { value: path },
  });
  return file;
}

test("creates a ZIP with one project root and UTF-8 filenames", async () => {
  const archive = await createProjectZip([
    { file: fileWithPath("index.html", "<h1>Hola</h1>", "mi-app/index.html"), path: "mi-app/index.html" },
    { file: fileWithPath("Dockerfile", "FROM nginx", "mi-app/Dockerfile"), path: "mi-app/Dockerfile" },
  ], "mi-app");

  assert.equal(archive.type, "application/zip");
  assert.ok(archive.size < 1024);
  const result = await inspectProjectZip(archive);
  assert.deepEqual(result, { root: "mi-app", paths: ["index.html", "Dockerfile"], hasDockerfile: true });
  validateProjectArchive(Buffer.from(await archive.arrayBuffer()));

  const bytes = new Uint8Array(await archive.arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  const nameLength = view.getUint16(26, true);
  assert.equal(new TextDecoder().decode(bytes.subarray(30, 30 + nameLength)), "mi-app/");
});

test("accepts root-level files and multiple ZIP roots while rejecting unsafe folder paths", async () => {
  const blob = new Blob(["not a zip"], { type: "application/zip" });
  await assert.rejects(inspectProjectZip(blob), /incompleto o no es válido/);

  await assert.rejects(
    createProjectZip([{ file: fileWithPath("file.txt", "x", "mi-app/../secret"), path: "mi-app/../secret" }], "mi-app"),
    /ruta no válida/,
  );
  await assert.rejects(createProjectZip([], "mi-app"), /no contiene archivos/);

  const archive = await createProjectZip([
    { file: fileWithPath("index.html", "ok", "alpha/index.html"), path: "alpha/index.html" },
  ], "alpha");
  const multipleRoots = Buffer.from(await archive.arrayBuffer());
  const entryName = Buffer.from("alpha/index.html");
  let offset = multipleRoots.indexOf(entryName);
  while (offset >= 0) {
    multipleRoots.write("bravo/index.html", offset, "utf8");
    offset = multipleRoots.indexOf(entryName, offset + entryName.length);
  }
  assert.doesNotThrow(() => validateProjectArchive(multipleRoots));
  assert.deepEqual((await inspectProjectZip(new Blob([multipleRoots]))).paths, ["bravo/index.html"]);
  const rootFile = await createProjectZip([
    { file: fileWithPath("index.html", "<h1>Solo</h1>", "index.html"), path: "index.html" },
  ], "sitio");
  assert.deepEqual(await inspectProjectZip(rootFile), {
    root: "sitio",
    paths: ["index.html"],
    hasDockerfile: false,
  });
  const rootFileArchive = Buffer.from(await rootFile.arrayBuffer());
  assert.doesNotThrow(() => validateProjectArchive(rootFileArchive));

  const unsafePath = Buffer.from(await archive.arrayBuffer());
  const unsafeName = Buffer.from("alpha/index.html");
  offset = unsafePath.indexOf(unsafeName);
  while (offset >= 0) {
    unsafePath.write("alpha/../evil.tx", offset, "utf8");
    offset = unsafePath.indexOf(unsafeName, offset + unsafeName.length);
  }
  assert.throws(() => validateProjectArchive(unsafePath), /ruta no válida/);
});
