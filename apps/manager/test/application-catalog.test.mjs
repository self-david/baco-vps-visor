import assert from "node:assert/strict";
import test from "node:test";
import { applicationCatalog } from "../src/data/application-catalog.mjs";

test("Gitea is represented as a planned, non-installable catalog entry", () => {
  const gitea = applicationCatalog.find((application) => application.id === "gitea");

  assert.ok(gitea);
  assert.equal(gitea.installation.status, "planned");
  assert.equal(gitea.installation.enabled, false);
  assert.match(gitea.features.join(" "), /git\.<dominio>/);
  assert.match(gitea.features.join(" "), /2222/);
});
