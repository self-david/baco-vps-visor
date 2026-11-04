import assert from "node:assert/strict";
import test from "node:test";
import {
  createProjectZip,
  detectProjectBuildProfile,
  inspectProjectZip,
} from "../public/project-archive.mjs";
import { projectTemplates } from "../public/project-templates.mjs";
import { validateProjectArchive } from "../project-archive-validation.mjs";

function fileWithPath(name, content, path) {
  const file = new Blob([content]);
  Object.defineProperties(file, {
    name: { value: name },
    webkitRelativePath: { value: path },
  });
  return file;
}

test("recommends deploy strategies only for supported project layouts", () => {
  assert.deepEqual(detectProjectBuildProfile(["index.html", "assets/site.css"]), {
    buildStrategy: "dockerfile",
    internalPort: 80,
    isStaticSite: true,
    recommendedDeploymentType: "static",
    simpleNodeServer: false,
    simplePythonApp: false,
    requiresCustomDockerfile: false,
  });
  assert.equal(detectProjectBuildProfile(["server.js"]).simpleNodeServer, true);
  assert.equal(detectProjectBuildProfile(["main.py"]).simplePythonApp, true);
  assert.equal(detectProjectBuildProfile(["package.json", "server.js"]).buildStrategy, "railpack");
  assert.equal(detectProjectBuildProfile(["package.json", "server.js"]).recommendedDeploymentType, "dynamic");
  assert.equal(detectProjectBuildProfile(["package.json", "package-lock.json"]).recommendedDeploymentType, "build");
  assert.equal(detectProjectBuildProfile(["main.cpp"]).requiresCustomDockerfile, true);
});

test("included project templates create valid archives with deployable profiles", async () => {
  assert.deepEqual(projectTemplates.map(({ id }) => id), [
    "html-vanilla",
    "node-no-dependencies",
    "python-no-dependencies",
  ]);
  for (const template of projectTemplates) {
    const files = template.files.map(({ name, content }) => ({
      file: fileWithPath(name, content, name),
      path: name,
    }));
    const archive = await createProjectZip(files, template.name);
    const inspected = await inspectProjectZip(archive);
    const profile = detectProjectBuildProfile(inspected.paths);
    assert.equal(profile.recommendedDeploymentType, template.deploymentType, template.id);
    assert.deepEqual(inspected.paths, template.files.map(({ name }) => name), template.id);
  }

  const nodeTemplate = projectTemplates.find(({ id }) => id === "node-no-dependencies");
  assert.match(nodeTemplate.files[0].content, /require\("node:http"\)/);
  assert.match(nodeTemplate.files[0].content, /"0\.0\.0\.0"/);
  const pythonTemplate = projectTemplates.find(({ id }) => id === "python-no-dependencies");
  assert.match(pythonTemplate.files[0].content, /ThreadingHTTPServer\(\("0\.0\.0\.0", port\)/);
  assert.match(pythonTemplate.files[0].content, /\/health/);
});

test("creates a ZIP with one project root and UTF-8 filenames", async () => {
  const archive = await createProjectZip([
    { file: fileWithPath("index.html", "<h1>Hola</h1>", "mi-app/index.html"), path: "mi-app/index.html" },
    { file: fileWithPath("Dockerfile", "FROM nginx", "mi-app/Dockerfile"), path: "mi-app/Dockerfile" },
  ], "mi-app");

  assert.equal(archive.type, "application/zip");
  assert.ok(archive.size < 1024);
  const result = await inspectProjectZip(archive);
  assert.deepEqual(result, { root: "mi-app", paths: ["index.html", "Dockerfile"], hasDockerfile: true });
  assert.deepEqual(validateProjectArchive(Buffer.from(await archive.arrayBuffer())), [
    "index.html",
    "Dockerfile",
  ]);

  const bytes = new Uint8Array(await archive.arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  const nameLength = view.getUint16(26, true);
  assert.equal(new TextDecoder().decode(bytes.subarray(30, 30 + nameLength)), "mi-app/");
});

test("strips a root directory identified only by ZIP external attributes", async () => {
  const blob = await createProjectZip([
    { file: fileWithPath("index.html", "ok", "index.html"), path: "index.html" },
  ], "sitio");
  const original = Buffer.from(await blob.arrayBuffer());
  const endOffset = original.length - 22;
  const directoryOffset = original.readUInt32LE(endOffset + 16);
  const nameLength = original.readUInt16LE(directoryOffset + 28);
  assert.equal(original.subarray(directoryOffset + 46, directoryOffset + 46 + nameLength).toString(), "sitio/");

  const slashOffset = directoryOffset + 46 + nameLength - 1;
  const archive = Buffer.concat([original.subarray(0, slashOffset), original.subarray(slashOffset + 1)]);
  archive.writeUInt16LE(nameLength - 1, directoryOffset + 28);
  archive.writeUInt32LE(original.readUInt32LE(endOffset + 12) - 1, endOffset - 1 + 12);

  assert.deepEqual(validateProjectArchive(archive), ["index.html"]);
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
  assert.deepEqual(validateProjectArchive(multipleRoots), ["bravo/index.html"]);
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
  assert.deepEqual(validateProjectArchive(rootFileArchive), ["index.html"]);

  const unsafePath = Buffer.from(await archive.arrayBuffer());
  const unsafeName = Buffer.from("alpha/index.html");
  offset = unsafePath.indexOf(unsafeName);
  while (offset >= 0) {
    unsafePath.write("alpha/../evil.tx", offset, "utf8");
    offset = unsafePath.indexOf(unsafeName, offset + unsafeName.length);
  }
  assert.throws(() => validateProjectArchive(unsafePath), /ruta no válida/);
});
