import assert from "node:assert/strict";
import test from "node:test";
import {
  createProjectZip,
  detectProjectBuildProfile,
  inspectProjectZip,
  isIgnoredProjectFile,
  sanitizeProjectZip,
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
    framework: "HTML/CSS/JavaScript vanilla",
    buildStrategy: "dockerfile",
    internalPort: 80,
    isStaticSite: true,
    recommendedDeploymentType: "static",
    simpleNodeServer: false,
    simplePythonApp: false,
    requiresCustomDockerfile: false,
    buildCommand: "npm run build",
    buildOutputDirectory: "dist",
    buildContext: ".",
    dockerfilePath: "Dockerfile",
    confidence: "alta",
    reason: "Se encontró index.html sin manifiesto de dependencias.",
  });
  assert.equal(detectProjectBuildProfile(["server.js"]).simpleNodeServer, true);
  assert.equal(detectProjectBuildProfile(["main.py"]).simplePythonApp, true);
  assert.equal(detectProjectBuildProfile(["package.json", "server.js"]).buildStrategy, "railpack");
  assert.equal(detectProjectBuildProfile(["package.json", "server.js"]).recommendedDeploymentType, "dynamic");
  assert.equal(detectProjectBuildProfile(["package.json", "package-lock.json"]).recommendedDeploymentType, "build");
  assert.equal(detectProjectBuildProfile(["main.cpp"]).requiresCustomDockerfile, true);
  const saludo = detectProjectBuildProfile(
    ["package.json", "index.js"],
    {
      "package.json": JSON.stringify({
        main: "index.js",
        scripts: { start: "node index.js" },
        dependencies: { express: "^4.18.2" },
      }),
    },
  );
  assert.equal(saludo.framework, "Node.js");
  assert.equal(saludo.recommendedDeploymentType, "dynamic");
  assert.equal(saludo.buildStrategy, "railpack");

  const python = detectProjectBuildProfile(
    ["pyproject.toml", "main.py"],
    { "pyproject.toml": "[project]\ndependencies = ['fastapi']" },
  );
  assert.equal(python.framework, "Python · FastAPI");
  assert.equal(python.recommendedDeploymentType, "dynamic");
  assert.equal(python.buildStrategy, "railpack");
  assert.equal(python.internalPort, 8000);

  const flask = detectProjectBuildProfile(
    ["main.py", "requirements.txt"],
    { "requirements.txt": "flask==3.1.0" },
  );
  assert.equal(flask.framework, "Python · Flask");
  assert.equal(flask.internalPort, 5000);
  assert.equal(detectProjectBuildProfile(["main.py"]).internalPort, 3000);

  const go = detectProjectBuildProfile(["go.mod", "main.go"]);
  assert.equal(go.framework, "Go");
  assert.equal(go.recommendedDeploymentType, "dynamic");
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

test("detects popular frameworks and recommends a matching build method", () => {
  const next = detectProjectBuildProfile(
    ["package.json", "next.config.mjs", "app/page.tsx", "pnpm-lock.yaml", "yarn.lock"],
    {
      "package.json": JSON.stringify({
        dependencies: { next: "15.2.4", react: "19.0.0" },
        scripts: { build: "next build", start: "next start" },
      }),
    },
  );
  assert.equal(next.framework, "Next.js");
  assert.equal(next.recommendedDeploymentType, "dynamic");
  assert.equal(next.buildStrategy, "railpack");
  assert.equal(next.internalPort, 3000);
  assert.equal(next.confidence, "media");
  assert.match(next.warning, /pnpm-lock\.yaml, yarn\.lock/);
  assert.equal(detectProjectBuildProfile(
    ["package.json", "Dockerfile", "next.config.mjs"],
    { "package.json": JSON.stringify({ dependencies: { next: "15.0.0" } }) },
  ).recommendedDeploymentType, "dynamic");

  const astro = detectProjectBuildProfile(
    ["package.json", "astro.config.mjs", "src/pages/index.astro", "pnpm-lock.yaml"],
    { "package.json": JSON.stringify({ devDependencies: { astro: "^5.0.0" }, scripts: { build: "astro build" } }) },
  );
  assert.equal(astro.framework, "Astro");
  assert.equal(astro.recommendedDeploymentType, "build");
  assert.equal(astro.buildStrategy, "dockerfile");
  assert.equal(astro.internalPort, 80);

  const astroServer = detectProjectBuildProfile(
    ["package.json", "astro.config.mjs", "src/pages/index.astro", "pnpm-lock.yaml"],
    {
      "package.json": JSON.stringify({
        dependencies: { "@astrojs/node": "^9.0.0", astro: "^5.0.0" },
        scripts: { build: "astro build" },
      }),
      "astro.config.mjs": "export default defineConfig({ output: 'server', adapter: node({ mode: 'standalone' }) });",
    },
  );
  assert.equal(astroServer.framework, "Astro");
  assert.equal(astroServer.recommendedDeploymentType, "dynamic");
  assert.equal(astroServer.buildStrategy, "railpack");
  assert.equal(astroServer.internalPort, 3000);
  assert.match(astroServer.reason, /runtime Node\.js/);
  assert.match(astroServer.warning, /dist\/server\/entry\.mjs/);

  const astroServerWithStart = detectProjectBuildProfile(
    ["package.json", "astro.config.mjs", "src/pages/index.astro"],
    {
      "package.json": JSON.stringify({
        dependencies: { astro: "^5.0.0" },
        scripts: { build: "astro build", start: "node ./dist/server/entry.mjs" },
      }),
      "astro.config.mjs": 'export default defineConfig({ output: "server" });',
    },
  );
  assert.equal(Object.hasOwn(astroServerWithStart, "warning"), false);

  const react = detectProjectBuildProfile(
    ["package.json", "vite.config.ts", "src/main.tsx", "package-lock.json"],
    { "package.json": JSON.stringify({ dependencies: { react: "^19.0.0" }, devDependencies: { vite: "^6.0.0" } }) },
  );
  assert.equal(react.framework, "React + Vite");
  assert.equal(react.recommendedDeploymentType, "build");
  assert.equal(react.buildOutputDirectory, "dist");
  assert.equal(isIgnoredProjectFile("liteimage/node_modules/react/index.js"), true);
  assert.equal(isIgnoredProjectFile("liteimage/.next/cache/data"), true);
  assert.equal(isIgnoredProjectFile("liteimage/.yarn/cache/package.zip"), true);
  assert.equal(isIgnoredProjectFile("liteimage/.yarn/install-state.gz"), true);
  assert.equal(isIgnoredProjectFile("liteimage/.env.local"), true);
  assert.equal(isIgnoredProjectFile("liteimage/.env.example"), false);
});

test("reads only root build manifests from an uploaded ZIP", async () => {
  const archive = await createProjectZip([
    {
      file: fileWithPath("package.json", JSON.stringify({ dependencies: { astro: "5.0.0" } }), "site/package.json"),
      path: "site/package.json",
    },
    {
      file: fileWithPath("astro.config.mjs", "export default defineConfig({ output: 'server' })", "site/astro.config.mjs"),
      path: "site/astro.config.mjs",
    },
    {
      file: fileWithPath("index.astro", "---\n---\n<h1>Own Mind</h1>", "site/src/pages/index.astro"),
      path: "site/src/pages/index.astro",
    },
  ], "site");

  const inspected = await inspectProjectZip(archive);
  assert.deepEqual(inspected.paths, ["package.json", "astro.config.mjs", "src/pages/index.astro"]);
  assert.equal(JSON.parse(inspected.metadataFiles["package.json"]).dependencies.astro, "5.0.0");
  assert.equal(
    detectProjectBuildProfile(inspected.paths, inspected.metadataFiles).recommendedDeploymentType,
    "dynamic",
  );
});

test("sanitizes ZIP uploads by excluding dependency caches and local environment secrets", async () => {
  const archive = await createProjectZip([
    { file: fileWithPath("package.json", "{}", "site/package.json"), path: "site/package.json" },
    { file: fileWithPath(".env.local", "SECRET=do-not-upload", "site/.env.local"), path: "site/.env.local" },
    { file: fileWithPath(".env.example", "PORT=3000", "site/.env.example"), path: "site/.env.example" },
    { file: fileWithPath("index.js", "module.exports = 1", "site/node_modules/pkg/index.js"), path: "site/node_modules/pkg/index.js" },
    { file: fileWithPath("data", "cache", "site/.next/cache/data"), path: "site/.next/cache/data" },
    { file: fileWithPath("state", "local", "site/.yarn/install-state.gz"), path: "site/.yarn/install-state.gz" },
  ], "site");

  const cleaned = await sanitizeProjectZip(archive, "liteimage");
  const inspected = await inspectProjectZip(cleaned);
  assert.deepEqual(inspected.paths.sort(), [".env.example", "package.json"]);
  assert.doesNotMatch(await cleaned.text(), /SECRET=do-not-upload/);
});

test("creates a ZIP with one project root and UTF-8 filenames", async () => {
  const archive = await createProjectZip([
    { file: fileWithPath("index.html", "<h1>Hola</h1>", "mi-app/index.html"), path: "mi-app/index.html" },
    { file: fileWithPath("Dockerfile", "FROM nginx", "mi-app/Dockerfile"), path: "mi-app/Dockerfile" },
  ], "mi-app");

  assert.equal(archive.type, "application/zip");
  assert.ok(archive.size < 1024);
  const result = await inspectProjectZip(archive);
  assert.deepEqual(result, {
    root: "mi-app",
    paths: ["index.html", "Dockerfile"],
    hasDockerfile: true,
    metadataFiles: {},
  });
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
    metadataFiles: {},
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
