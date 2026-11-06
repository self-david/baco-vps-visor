import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { checkProjectHealth } from "../project-health.mjs";

const runningProject = {
  id: "project-running",
  deployment: { runningReplicas: 1 },
};

test("checks assigned project URLs and reports service and HTTP health", async () => {
  const health = await checkProjectHealth(
    [runningProject],
    [
      { projectId: runningProject.id, hostname: "app.example.com" },
      { projectId: runningProject.id, hostname: "broken.example.com" },
    ],
    {
      fetchImpl: async (url, options) => {
        assert.equal(options.method, "GET");
        assert.equal(options.redirect, "manual");
        assert.equal(options.signal.aborted, false);
        return {
          status: url.includes("broken") ? 503 : 200,
          body: { cancel: async () => {} },
        };
      },
    },
  );

  assert.equal(health.get(runningProject.id).serviceStatus, "running");
  assert.equal(health.get(runningProject.id).urlStatus, "degraded");
  assert.deepEqual(health.get(runningProject.id).urls.map(({ hostname, state, httpStatus }) => ({
    hostname,
    state,
    httpStatus,
  })), [
    { hostname: "app.example.com", state: "online", httpStatus: 200 },
    { hostname: "broken.example.com", state: "unavailable", httpStatus: 503 },
  ]);
  assert.match(health.get(runningProject.id).urls[1].error, /HTTP 503/);
});

test("does not probe URLs for projects without a running service", async () => {
  const projects = [
    { id: "not-deployed", deployment: null },
    { id: "stopped", deployment: { runningReplicas: 0 } },
  ];
  const health = await checkProjectHealth(
    projects,
    [
      { projectId: "not-deployed", hostname: "new.example.com" },
      { projectId: "stopped", hostname: "stopped.example.com" },
    ],
    { fetchImpl: async () => assert.fail("URLs without a running service must not be probed.") },
  );

  assert.equal(health.get("not-deployed").serviceStatus, "not-deployed");
  assert.equal(health.get("not-deployed").urls[0].state, "unavailable");
  assert.equal(health.get("stopped").serviceStatus, "stopped");
  assert.equal(health.get("stopped").urls[0].state, "unavailable");
});

test("limits concurrent URL checks and records network failures", async () => {
  let activeChecks = 0;
  let maxActiveChecks = 0;
  const health = await checkProjectHealth(
    [runningProject],
    Array.from({ length: 5 }, (_, index) => ({
      projectId: runningProject.id,
      hostname: `app-${index}.example.com`,
    })),
    {
      concurrency: 2,
      fetchImpl: async () => {
        activeChecks += 1;
        maxActiveChecks = Math.max(maxActiveChecks, activeChecks);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeChecks -= 1;
        throw new TypeError("network detail");
      },
    },
  );

  assert.equal(maxActiveChecks, 2);
  assert.equal(health.get(runningProject.id).urlStatus, "degraded");
  assert.equal(health.get(runningProject.id).urls.length, 5);
  assert.match(health.get(runningProject.id).urls[0].error, /No se pudo conectar/);
});

test("treats a responding application-level 404 as reachable, not an infrastructure alert", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("Node app is ready");
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Cannot GET /missing");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const health = await checkProjectHealth(
      [runningProject],
      [
        { projectId: runningProject.id, hostname: "node.example.com" },
        { projectId: runningProject.id, hostname: "node-missing.example.com" },
      ],
      {
        fetchImpl: (url, options) => {
          const path = new URL(url).hostname.startsWith("node-missing") ? "/missing" : "/";
          return fetch(`http://127.0.0.1:${port}${path}`, options);
        },
      },
    );

    const result = health.get(runningProject.id);
    const nodeHealth = result.urls;
    assert.equal(result.urlStatus, "online");
    assert.equal(nodeHealth.find(({ hostname }) => hostname === "node.example.com").state, "online");
    const missingPage = nodeHealth.find(({ hostname }) => hostname === "node-missing.example.com");
    assert.equal(missingPage.httpStatus, 404);
    assert.equal(missingPage.state, "online");
    assert.equal(Object.hasOwn(missingPage, "error"), false);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
