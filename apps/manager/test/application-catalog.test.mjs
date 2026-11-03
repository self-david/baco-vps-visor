import assert from "node:assert/strict";
import test from "node:test";
import { applicationCatalog } from "../src/data/application-catalog.mjs";

test("Gitea is represented as an optional catalog application with subdomain access", () => {
  const gitea = applicationCatalog.find((application) => application.id === "gitea");

  assert.ok(gitea);
  assert.equal(gitea.installation.status, "optional");
  assert.equal(gitea.installation.enabled, true);
  assert.match(gitea.features.join(" "), /git\.<dominio>/);
  assert.match(gitea.features.join(" "), /2222/);
});
