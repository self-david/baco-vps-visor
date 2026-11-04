import assert from "node:assert/strict";
import test from "node:test";
import { validateProjectId, validateProjectInput } from "../project-manager.mjs";

test("validates GitHub project configuration with a selectable production branch", () => {
  assert.deepEqual(validateProjectInput({
    name: "  my app  ",
    description: "  A test app ",
    repository: "vpsadmin/my-app",
    githubInstallationId: 123,
    productionBranch: "release/1.0",
  }), {
    name: "my app",
    description: "A test app",
    repository: "vpsadmin/my-app",
    sourceType: "github",
    githubInstallationId: 123,
    productionBranch: "release/1.0",
    buildStrategy: "dockerfile",
    buildContext: ".",
    dockerfilePath: "Dockerfile",
    internalPort: 3000,
    autoDeploy: true,
  });
  const project = validateProjectInput({
    name: "project",
    sourceType: "upload",
    buildStrategy: "railpack",
    internalPort: 8080,
    autoDeploy: false,
  });
  assert.equal(project.description, "");
  assert.equal(project.productionBranch, "main");
  assert.equal(project.internalPort, 8080);
  assert.equal(project.autoDeploy, false);
});

test("rejects unsafe or incomplete project metadata and malformed IDs", () => {
  for (const project of [
    { name: "", sourceType: "upload" },
    { name: "bad/name", sourceType: "upload" },
    { name: "project", repository: "../project", githubInstallationId: 1 },
    { name: "project", repository: "owner/repo", githubInstallationId: 0 },
    { name: "project", repository: "owner/repo", githubInstallationId: 1, productionBranch: "main\n" },
    { name: "project", sourceType: "upload", repository: "owner/repo" },
    { name: "project", sourceType: "upload", buildContext: "../escape" },
    { name: "project", sourceType: "upload", dockerfilePath: "/etc/passwd" },
    { name: "project", sourceType: "upload", buildStrategy: "nixpacks" },
    { name: "project", sourceType: "upload", internalPort: 0 },
    { name: "project", sourceType: "upload", autoDeploy: "yes" },
    { name: "project", sourceType: "upload", extra: true },
    { name: "project", sourceType: "upload", description: "x".repeat(501) },
  ]) {
    assert.throws(() => validateProjectInput(project), { code: "INVALID_PROJECT" });
  }
  assert.equal(validateProjectId("d909f79b-e7f9-41e7-9e7a-6ea000000001"), "d909f79b-e7f9-41e7-9e7a-6ea000000001");
  assert.equal(validateProjectId("D909F79B-E7F9-41E7-9E7A-6EA000000001"), "d909f79b-e7f9-41e7-9e7a-6ea000000001");
  assert.throws(() => validateProjectId("../project"), { code: "INVALID_PROJECT_ID" });
});
