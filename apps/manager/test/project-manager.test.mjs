import assert from "node:assert/strict";
import test from "node:test";
import { validateProjectId, validateProjectInput } from "../project-manager.mjs";

test("validates and normalizes project metadata linked to a Gitea branch", () => {
  assert.deepEqual(validateProjectInput({
    name: "  my app  ",
    description: "  A test app ",
    repository: "vpsadmin/my-app",
    productionBranch: "release/1.0",
  }), {
    name: "my app",
    description: "A test app",
    repository: "vpsadmin/my-app",
    productionBranch: "release/1.0",
  });
  assert.equal(validateProjectInput({
    name: "project",
    repository: "vpsadmin/project",
    productionBranch: "main",
  }).description, "");
});

test("rejects unsafe or incomplete project metadata and malformed IDs", () => {
  for (const project of [
    { name: "", repository: "vpsadmin/project", productionBranch: "main" },
    { name: "bad/name", repository: "vpsadmin/project", productionBranch: "main" },
    { name: "project", repository: "../project", productionBranch: "main" },
    { name: "project", repository: "vpsadmin/project", productionBranch: "main\n" },
    { name: "project", repository: "vpsadmin/project", productionBranch: "main", extra: true },
    { name: "project", repository: "vpsadmin/project", productionBranch: "main", description: "x".repeat(501) },
  ]) {
    assert.throws(() => validateProjectInput(project), { code: "INVALID_PROJECT" });
  }
  assert.equal(validateProjectId("d909f79b-e7f9-41e7-9e7a-6ea000000001"), "d909f79b-e7f9-41e7-9e7a-6ea000000001");
  assert.equal(validateProjectId("D909F79B-E7F9-41E7-9E7A-6EA000000001"), "d909f79b-e7f9-41e7-9e7a-6ea000000001");
  assert.throws(() => validateProjectId("../project"), { code: "INVALID_PROJECT_ID" });
});
