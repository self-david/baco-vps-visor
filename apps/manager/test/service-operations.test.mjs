import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createServiceOperationAgent,
  findManagedService,
  isPublicHostname,
  validateServiceScale,
} from "../service-operations.mjs";

const requestId = "d909f79b-e7f9-41e7-9e7a-6ea000000001";
const secondRequestId = "a3f51b09-13bf-4c7a-9b03-9ba000000002";
const serviceId = "9a7f51bdff120d8d0d48d4ca5";
const managedService = { ID: serviceId, Spec: { Labels: { "vps-manager.managed": "true" } } };

test("resolves only one Swarm service explicitly managed by VPS Manager", () => {
  assert.equal(findManagedService([managedService], serviceId.slice(0, 12)), managedService);
  assert.throws(() => findManagedService([], serviceId), { code: "SERVICE_NOT_FOUND" });
  assert.throws(() => findManagedService([
    managedService,
    { ...managedService, ID: "9a7f51bdff120d8d0d48d4cb0" },
  ], serviceId.slice(0, 12)), { code: "SERVICE_ID_AMBIGUOUS" });
  assert.throws(() => findManagedService([
    { ID: serviceId, Spec: { Labels: {} } },
  ], serviceId), { code: "SERVICE_NOT_MANAGED" });
});

test("validates scale targets for replicated services without allowing panel downtime", () => {
  const service = {
    ID: serviceId,
    Spec: {
      Labels: { "vps-manager.managed": "true" },
      Mode: { Replicated: { Replicas: 3 } },
    },
  };
  assert.equal(validateServiceScale(service, 4), 3);
  assert.throws(() => validateServiceScale(service, 0), { code: "INVALID_REPLICA_COUNT" });
  assert.throws(() => validateServiceScale(service, 101), { code: "INVALID_REPLICA_COUNT" });
  assert.throws(() => validateServiceScale({
    ...service,
    Spec: { ...service.Spec, Mode: { Global: {} } },
  }, 4), { code: "SERVICE_NOT_REPLICATED" });
  assert.throws(() => validateServiceScale({
    ...service,
    Spec: { ...service.Spec, Labels: { "vps-manager.component": "api" } },
  }, 2), { code: "PANEL_REPLICA_COUNT" });
  assert.equal(validateServiceScale({
    ...service,
    Spec: { ...service.Spec, Labels: { "vps-manager.component": "api" } },
  }, 1), 3);
  assert.throws(() => validateServiceScale({
    ...service,
    Spec: {
      ...service.Spec,
      Labels: { "vps-manager.managed": "true", "vps-manager.component": "gitea" },
    },
  }, 2), { code: "APPLICATION_REPLICA_COUNT" });
  assert.throws(() => validateServiceScale({
    ...service,
    Spec: {
      ...service.Spec,
      Labels: { "vps-manager.managed": "true", "vps-manager.component": "n8n" },
    },
  }, 2), { code: "APPLICATION_REPLICA_COUNT" });
  assert.throws(() => validateServiceScale({
    ...service,
    Spec: {
      ...service.Spec,
      Labels: { "vps-manager.managed": "true", "vps-manager.component": "registry" },
    },
  }, 2), { code: "APPLICATION_REPLICA_COUNT" });
  assert.throws(() => validateServiceScale({
    ...service,
    Spec: {
      ...service.Spec,
      Labels: { "vps-manager.managed": "true", "vps-manager.component": "project" },
    },
  }, 2), { code: "PROJECT_REPLICA_COUNT" });
});

test("accepts only public DNS hostnames for application subdomains", () => {
  assert.equal(isPublicHostname("git.example.com"), true);
  assert.equal(isPublicHostname("192.168.100.158"), false);
  assert.equal(isPublicHostname("git.example.com;id"), false);
  assert.equal(isPublicHostname("git.local"), false);
});

test("stages SSH credentials separately from the Swarm node request", async () => {
  const fixture = await createFixture();
  try {
    const node = {
      address: "10.10.0.12",
      sshUser: "vpsadmin",
      sshPort: 22,
      hostFingerprint: `SHA256:${"A".repeat(43)}`,
      privateCidr: "10.10.0.0/24",
      managerAddress: "10.10.0.2",
      role: "worker",
    };
    const privateKey = "-----BEGIN OPENSSH PRIVATE KEY-----\nprivate-key-data\n-----END OPENSSH PRIVATE KEY-----";
    await fixture.agent.stageNodeCredentials(requestId, privateKey);
    await fixture.agent.requestSwarmNodeEnrollment(node, requestId);
    const requestContents = await readFile(join(fixture.directory, "request.json"), "utf8");
    assert.doesNotMatch(requestContents, /private-key-data/);
    assert.deepEqual(await fixture.agent.getStatus(), {
      id: requestId,
      state: "queued",
      operation: "enroll-swarm-node",
      nodeAddress: node.address,
      sshUser: node.sshUser,
      sshPort: node.sshPort,
      hostFingerprint: node.hostFingerprint,
      privateCidr: node.privateCidr,
      managerAddress: node.managerAddress,
      role: node.role,
      replicas: undefined,
      message: `Alta de nodo ${node.address} aceptada; esperando al agente host.`,
    });
    await fixture.agent.removeNodeCredentials(requestId);
    await assert.rejects(readFile(join(fixture.directory, `node-ssh-key-${requestId}`)), { code: "ENOENT" });
  } finally {
    await fixture.cleanup();
  }
});

test("queues n8n installation without including generated encryption material", async () => {
  const fixture = await createFixture();
  try {
    const operation = await fixture.agent.requestN8nInstall("automation.example.com", requestId);
    const requestContents = await readFile(join(fixture.directory, "request.json"), "utf8");

    assert.deepEqual(operation, {
      id: requestId,
      state: "queued",
      operation: "install-n8n",
      domain: "automation.example.com",
      message: "Instalación de n8n aceptada para automation.example.com; el agente del VPS iniciará el servicio.",
    });
    assert.deepEqual(JSON.parse(requestContents), {
      id: requestId,
      operation: "install-n8n",
      domain: "automation.example.com",
    });
    await assert.rejects(fixture.agent.requestN8nInstall("automation.example.com;id"), /hostname público válido/);
  } finally {
    await fixture.cleanup();
  }
});

test("queues PostgreSQL installation without credentials and reveals them only once", async () => {
  const fixture = await createFixture();
  try {
    const operation = await fixture.agent.requestPostgresqlInstall(requestId);
    assert.equal(operation.state, "queued");
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "install-postgresql",
    });
    assert.equal((await fixture.agent.getStatus()).operation, "install-postgresql");
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      operation: "install-postgresql",
      state: "running",
      credentialsAvailable: false,
      updatedAt: new Date().toISOString(),
      message: "Starting PostgreSQL.",
    }));
    assert.equal((await fixture.agent.getStatus()).credentialsAvailable, false);

    const credentialsPath = join(fixture.directory, `postgresql-credentials-${requestId}.json`);
    await writeFile(credentialsPath, JSON.stringify({
      taskId: requestId,
      username: "vps_manager_app",
      database: "vps_manager_app",
      password: "a".repeat(64),
    }));
    assert.equal(await fixture.agent.hasPostgresqlCredentials(requestId), true);
    assert.deepEqual(await fixture.agent.consumePostgresqlCredentials(requestId), {
      host: "vps-manager-postgresql",
      port: 5432,
      database: "vps_manager_app",
      username: "vps_manager_app",
      password: "a".repeat(64),
    });
    assert.equal(await fixture.agent.hasPostgresqlCredentials(requestId), false);
    await assert.rejects(fixture.agent.consumePostgresqlCredentials(requestId), {
      code: "CREDENTIALS_UNAVAILABLE",
    });
    await assert.rejects(fixture.agent.requestPostgresqlInstall("invalid"), /identifier is invalid/);
  } finally {
    await fixture.cleanup();
  }
});

async function createFixture(createId = () => requestId) {
  const directory = await mkdtemp(join(tmpdir(), "vps-service-operations-"));
  return {
    directory,
    agent: createServiceOperationAgent({ directory, createId }),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

test("queues a fixed service restart request without accepting command input", async () => {
  const fixture = await createFixture();
  try {
    const result = await fixture.agent.requestRestart(serviceId);
    assert.equal(result.id, requestId);
    assert.equal(result.state, "queued");
    assert.equal(result.serviceId, serviceId);
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "restart-service",
      serviceId,
    });
    assert.equal((await fixture.agent.getStatus()).state, "queued");
  } finally {
    await fixture.cleanup();
  }
});

test("queues a validated scale request through the fixed service-operation channel", async () => {
  const fixture = await createFixture();
  try {
    const result = await fixture.agent.requestScale(serviceId, 4);
    assert.equal(result.operation, "scale-service");
    assert.equal(result.replicas, 4);
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "scale-service",
      serviceId,
      replicas: 4,
    });
    assert.equal((await fixture.agent.getStatus()).replicas, 4);
    assert.equal((await fixture.agent.requestScale(serviceId, 4)).replicas, 4);
    await assert.rejects(fixture.agent.requestScale(serviceId, 5), /different service operation/);
    await assert.rejects(fixture.agent.requestScale(serviceId, 0), /between 1 and 100/);
  } finally {
    await fixture.cleanup();
  }
});

test("queues a Gitea install request without credentials and reveals generated credentials only once", async () => {
  const fixture = await createFixture();
  try {
    const result = await fixture.agent.requestGiteaInstall("git.example.com");
    assert.equal(result.state, "queued");
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "install-gitea",
      domain: "git.example.com",
    });
    assert.equal((await fixture.agent.getStatus()).domain, "git.example.com");
    await assert.rejects(fixture.agent.requestGiteaInstall("git.example.com;id"), /hostname público válido/);

    const credentialsPath = join(fixture.directory, `gitea-credentials-${requestId}.json`);
    await writeFile(credentialsPath, JSON.stringify({
      taskId: requestId,
      username: "vpsadmin",
      password: "a".repeat(64),
      domain: "git.example.com",
    }), { mode: 0o640 });
    assert.equal(await fixture.agent.hasGiteaCredentials(requestId), true);
    assert.deepEqual(await fixture.agent.consumeGiteaCredentials(requestId), {
      username: "vpsadmin",
      password: "a".repeat(64),
      url: "https://git.example.com/",
      sshCommand: "ssh -p 2222 git@git.example.com",
    });
    assert.equal(await fixture.agent.hasGiteaCredentials(requestId), false);
    await assert.rejects(fixture.agent.consumeGiteaCredentials(requestId), { code: "CREDENTIALS_UNAVAILABLE" });
  } finally {
    await fixture.cleanup();
  }
});

test("accepts only the local Gitea target for the loopback test installation", async () => {
  const fixture = await createFixture();
  try {
    const result = await fixture.agent.requestGiteaInstall("localhost");
    assert.equal(result.domain, "localhost");
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "install-gitea",
      domain: "localhost",
    });
    assert.equal((await fixture.agent.getStatus()).domain, "localhost");
    const credentialsPath = join(fixture.directory, `gitea-credentials-${requestId}.json`);
    await writeFile(credentialsPath, JSON.stringify({
      taskId: requestId,
      username: "vpsadmin",
      password: "b".repeat(64),
      domain: "localhost",
    }), { mode: 0o640 });
    assert.deepEqual(await fixture.agent.consumeGiteaCredentials(requestId), {
      username: "vpsadmin",
      password: "b".repeat(64),
      url: "http://localhost:3001/gitea/",
      sshCommand: "ssh -L 3001:127.0.0.1:80 usuario@IP_DEL_VPS; abre http://localhost:3001/gitea/",
    });
  } finally {
    await fixture.cleanup();
  }
});

test("queues the Gitea API token only for the host agent and reports secret mount status", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vps-service-operations-"));
  const tokenPath = join(directory, "gitea-api-token");
  const agent = createServiceOperationAgent({ directory, giteaApiTokenPath: tokenPath });
  const token = "gta_0123456789abcdef0123456789abcdef01234567";
  try {
    const operation = await agent.requestGiteaApiToken(token);
    const queued = JSON.parse(await readFile(join(directory, "request.json"), "utf8"));
    assert.equal(queued.id, operation.id);
    assert.equal(queued.operation, "configure-gitea-token");
    assert.equal(queued.token, token);
    assert.equal(Object.hasOwn(operation, "token"), false);
    assert.equal(Object.hasOwn(await agent.getStatus(), "token"), false);
    await rm(join(directory, "request.json"));
    await writeFile(join(directory, "status.json"), JSON.stringify({
      id: operation.id,
      operation: "configure-gitea-token",
      state: "succeeded",
      updatedAt: "2026-11-03T18:00:00Z",
      message: "Token configurado.",
    }));
    assert.deepEqual(await agent.getStatus(), {
      id: operation.id,
      operation: "configure-gitea-token",
      state: "succeeded",
      updatedAt: "2026-11-03T18:00:00Z",
      message: "Token configurado.",
    });
    await assert.rejects(agent.requestGiteaApiToken("invalid"), /20 y 512 caracteres/);
    assert.equal(await agent.hasGiteaApiToken(), false);
    await writeFile(tokenPath, "NOT_CONFIGURED");
    assert.equal(await agent.hasGiteaApiToken(), false);
    await writeFile(tokenPath, token);
    assert.equal(await agent.hasGiteaApiToken(), true);
    await writeFile(tokenPath, "malformed-token");
    await assert.rejects(agent.hasGiteaApiToken(), /invalid format/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("stages private registry credentials separately and exposes only public configuration status", async () => {
  const fixture = await createFixture();
  const password = "r".repeat(32);
  const credentialsPath = join(fixture.directory, `registry-credentials-${requestId}.json`);
  try {
    await fixture.agent.stageRegistryCredentials(requestId, {
      domain: "registry.example.com",
      username: "registry-user",
      password,
    });
    const staged = JSON.parse(await readFile(credentialsPath, "utf8"));
    assert.equal(staged.password, password);
    const operation = await fixture.agent.requestRegistryConfiguration(
      "registry.example.com",
      "registry-user",
      requestId,
    );
    assert.equal(operation.state, "queued");
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "configure-registry",
      domain: "registry.example.com",
      username: "registry-user",
    });
    assert.equal(JSON.stringify(await fixture.agent.getStatus()).includes(password), false);
    assert.deepEqual(await fixture.agent.getStatus(), {
      id: requestId,
      state: "queued",
      operation: "configure-registry",
      domain: "registry.example.com",
      username: "registry-user",
      replicas: undefined,
      message: "Configuración del registro aceptada para registry.example.com; esperando al agente del VPS.",
    });
    await assert.rejects(
      fixture.agent.stageRegistryCredentials(secondRequestId, {
        domain: "localhost",
        username: "user",
        password,
      }),
      /configuration fields are invalid/,
    );
    await assert.rejects(
      fixture.agent.stageRegistryCredentials(secondRequestId, {
        domain: "registry.example.com",
        username: "user",
        password: "short",
      }),
      /configuration fields are invalid/,
    );

    await rm(join(fixture.directory, "request.json"));
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      operation: "configure-registry",
      state: "succeeded",
      domain: "registry.example.com",
      username: "registry-user",
      updatedAt: "2026-11-03T18:00:00Z",
      message: "Registro configurado.",
      password,
    }));
    await assert.rejects(fixture.agent.getStatus(), /invalid format/);
    await rm(join(fixture.directory, "status.json"));
    await writeFile(join(fixture.directory, "registry-status.json"), JSON.stringify({
      domain: "registry.example.com",
      username: "registry-user",
    }));
    assert.deepEqual(await fixture.agent.getRegistryConfiguration(), {
      domain: "registry.example.com",
      username: "registry-user",
    });
    await writeFile(join(fixture.directory, "registry-status.json"), JSON.stringify({
      domain: "registry.example.com",
      username: "registry-user",
      password,
    }));
    await assert.rejects(fixture.agent.getRegistryConfiguration(), /invalid format/);
    await fixture.agent.removeRegistryCredentials(requestId);
    await assert.rejects(readFile(credentialsPath), { code: "ENOENT" });
  } finally {
    await fixture.cleanup();
  }
});

test("stages a bounded project archive and requests only a fixed BuildKit operation", async () => {
  const fixture = await createFixture();
  const projectId = "9a7f51bd-13bf-4c7a-9b03-9ba000000002";
  const commitSha = "a".repeat(40);
  const archive = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const archivePath = join(fixture.directory, `build-source-${requestId}.zip`);
  try {
    await fixture.agent.stageProjectBuildArchive(requestId, archive);
    assert.deepEqual(await readFile(archivePath), archive);
    const operation = await fixture.agent.requestProjectBuild(projectId, commitSha, requestId);
    assert.equal(operation.state, "queued");
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "build-project",
      projectId,
      commitSha,
    });
    assert.equal((await fixture.agent.getStatus()).projectId, projectId);
    await assert.rejects(
      fixture.agent.requestProjectBuild(projectId, commitSha, secondRequestId),
      { code: "OPERATION_IN_PROGRESS" },
    );

    await rm(join(fixture.directory, "request.json"));
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      operation: "build-project",
      state: "succeeded",
      projectId,
      commitSha,
      image: `vps-manager-project-${projectId.replaceAll("-", "")}:${commitSha}`,
      updatedAt: "2026-11-03T18:00:00Z",
      message: "Imagen construida.",
    }));
    assert.equal((await fixture.agent.getStatus()).image, `vps-manager-project-${projectId.replaceAll("-", "")}:${commitSha}`);
    await fixture.agent.removeProjectBuildArchive(requestId);
    await assert.rejects(readFile(archivePath), { code: "ENOENT" });
  } finally {
    await fixture.cleanup();
  }
});

test("requests a fixed Swarm deployment and removal for a project", async () => {
  const fixture = await createFixture();
  const projectId = "9a7f51bd-13bf-4c7a-9b03-9ba000000002";
  const commitSha = "a".repeat(40);
  try {
    const deployment = await fixture.agent.requestProjectDeploy(projectId, commitSha, requestId);
    assert.equal(deployment.state, "queued");
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: requestId,
      operation: "deploy-project",
      projectId,
      commitSha,
    });
    assert.equal((await fixture.agent.getStatus()).commitSha, commitSha);
    await assert.rejects(
      fixture.agent.requestProjectDeploy(projectId, "bad", secondRequestId),
      /fields are invalid/,
    );
    await assert.rejects(
      fixture.agent.requestProjectDeploy(projectId, commitSha, secondRequestId),
      { code: "OPERATION_IN_PROGRESS" },
    );

    await rm(join(fixture.directory, "request.json"));
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      operation: "deploy-project",
      state: "succeeded",
      projectId,
      commitSha,
      serviceId,
      image: `registry.example.com/vps-manager-project-${projectId.replaceAll("-", "")}:${commitSha}`,
      updatedAt: "2026-11-03T18:00:00Z",
      message: "Servicio desplegado.",
    }));
    assert.equal((await fixture.agent.getStatus()).serviceId, serviceId);

    const removal = await fixture.agent.requestProjectUndeploy(projectId, secondRequestId);
    assert.equal(removal.state, "queued");
    assert.deepEqual(JSON.parse(await readFile(join(fixture.directory, "request.json"), "utf8")), {
      id: secondRequestId,
      operation: "remove-project",
      projectId,
    });
    await rm(join(fixture.directory, "request.json"));
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: secondRequestId,
      operation: "remove-project",
      state: "succeeded",
      projectId,
      updatedAt: "2026-11-03T18:01:00Z",
      message: "Servicio retirado.",
    }));
    assert.equal((await fixture.agent.getStatus()).operation, "remove-project");
  } finally {
    await fixture.cleanup();
  }
});

test("rejects malformed service IDs before creating a request", async () => {
  const fixture = await createFixture();
  try {
    await assert.rejects(fixture.agent.requestRestart("$(touch /tmp/unexpected)"), /identifier/);
    assert.equal(await fixture.agent.getStatus(), null);
  } finally {
    await fixture.cleanup();
  }
});

test("returns the existing task for duplicate IDs and rejects different active requests", async () => {
  const fixture = await createFixture();
  try {
    await fixture.agent.requestRestart(serviceId);
    assert.equal((await fixture.agent.requestRestart(serviceId)).id, requestId);
    await rm(join(fixture.directory, "request.json"));
    await writeFile(join(fixture.directory, "request.json"), JSON.stringify({
      id: requestId,
      operation: "scale-service",
      serviceId,
      replicas: 101,
    }));
    await assert.rejects(fixture.agent.getStatus(), /invalid format/);
    await rm(join(fixture.directory, "request.json"));
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      state: "running",
      serviceId,
      updatedAt: "2026-11-03T18:00:00Z",
      message: "running",
    }));
    assert.equal((await fixture.agent.requestRestart(serviceId)).state, "running");
    await assert.rejects(
      fixture.agent.requestRestart(serviceId, secondRequestId),
      { code: "OPERATION_IN_PROGRESS" },
    );
  } finally {
    await fixture.cleanup();
  }
});

test("does not requeue an operation whose matching ID is already terminal", async () => {
  const fixture = await createFixture();
  try {
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      state: "succeeded",
      serviceId,
      updatedAt: "2026-11-03T18:00:00Z",
      message: "Servicio reiniciado.",
    }));

    assert.equal((await fixture.agent.requestRestart(serviceId, requestId)).state, "succeeded");
    await assert.rejects(readFile(join(fixture.directory, "request.json")), { code: "ENOENT" });
  } finally {
    await fixture.cleanup();
  }
});

test("reports terminal host operation states and accepts a subsequent restart", async () => {
  const fixture = await createFixture(() => secondRequestId);
  try {
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      state: "succeeded",
      serviceId,
      updatedAt: "2026-11-03T18:00:00Z",
      message: "Servicio reiniciado.",
    }));
    assert.equal((await fixture.agent.getStatus()).state, "succeeded");
    assert.equal((await fixture.agent.requestRestart(serviceId)).id, secondRequestId);
  } finally {
    await fixture.cleanup();
  }
});

test("rejects malformed requests, invalid state files, and unsupported operations", async () => {
  const fixture = await createFixture();
  try {
    await writeFile(join(fixture.directory, "request.json"), JSON.stringify({
      id: requestId,
      operation: "run-command",
      serviceId,
      command: "docker service rm something",
    }));
    await assert.rejects(fixture.agent.getStatus(), /invalid format/);

    await rm(join(fixture.directory, "request.json"));
    await writeFile(join(fixture.directory, "status.json"), JSON.stringify({
      id: requestId,
      state: "unknown",
      serviceId,
      updatedAt: "2026-11-03T18:00:00Z",
      message: "invalid",
    }));
    await assert.rejects(fixture.agent.getStatus(), /invalid format/);
  } finally {
    await fixture.cleanup();
  }
});

test("rejects non-regular request and status paths", async () => {
  const fixture = await createFixture();
  try {
    await mkdir(join(fixture.directory, "request.json"));
    await assert.rejects(fixture.agent.getStatus(), /regular file/);
    await rm(join(fixture.directory, "request.json"), { recursive: true });
    await mkdir(join(fixture.directory, "status.json"));
    await assert.rejects(fixture.agent.getStatus(), /regular file/);
  } finally {
    await fixture.cleanup();
  }
});

test("only one concurrent request can win the atomic queue", async () => {
  const fixture = await createFixture(() => requestId);
  const otherAgent = createServiceOperationAgent({
    directory: fixture.directory,
    createId: () => secondRequestId,
  });
  try {
    const results = await Promise.allSettled([
      fixture.agent.requestRestart(serviceId),
      otherAgent.requestRestart("a8a39c99ff120d8d0d48d4000"),
    ]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
    assert.equal(results.filter(({ status, reason }) =>
      status === "rejected" && reason.code === "OPERATION_IN_PROGRESS").length, 1);
  } finally {
    await fixture.cleanup();
  }
});
