import assert from "node:assert/strict";
import test from "node:test";
import { mapSwarmNode, validateSwarmNodeEnrollment } from "../swarm-node-manager.mjs";

const enrollment = {
  address: "10.10.0.12",
  sshUser: "vpsadmin",
  sshPort: 22,
  hostFingerprint: `SHA256:${"A".repeat(43)}`,
  privateCidr: "10.10.0.0/24",
  managerAddress: "10.10.0.2",
  role: "worker",
  privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nkey-data\n-----END OPENSSH PRIVATE KEY-----",
};

test("validates a private Swarm node enrollment and canonicalizes its CIDR", () => {
  assert.deepEqual(validateSwarmNodeEnrollment(enrollment), enrollment);
  assert.equal(validateSwarmNodeEnrollment({
    ...enrollment,
    privateCidr: "10.10.0.99/24",
  }).privateCidr, "10.10.0.0/24");
});

test("rejects public, out-of-subnet, unsafe SSH, and invalid role values", () => {
  for (const invalid of [
    { ...enrollment, address: "8.8.8.8" },
    { ...enrollment, managerAddress: "10.11.0.2" },
    { ...enrollment, privateCidr: "0.0.0.0/0" },
    { ...enrollment, sshUser: "root" },
    { ...enrollment, role: "administrator" },
    { ...enrollment, hostFingerprint: "unverified" },
    { ...enrollment, privateKey: "not a private key" },
  ]) {
    assert.throws(() => validateSwarmNodeEnrollment(invalid), TypeError);
  }
});

test("maps Docker node status without exposing unrelated spec fields", () => {
  assert.deepEqual(mapSwarmNode({
    ID: "node-id",
    Spec: { Role: "manager", Availability: "active", Labels: { secret: "not-returned" } },
    Status: { Addr: "10.10.0.12", State: "ready", Message: "ready" },
    Description: {
      Hostname: "worker-1",
      Engine: { EngineVersion: "28.0.0" },
      Platform: { Architecture: "x86_64", OS: "linux" },
      Resources: { NanoCPUs: 2_000_000_000, MemoryBytes: 4_294_967_296 },
    },
    ManagerStatus: { Reachability: "reachable", Leader: false },
  }), {
    id: "node-id",
    hostname: "worker-1",
    address: "10.10.0.12",
    role: "manager",
    availability: "active",
    state: "ready",
    message: "ready",
    engineVersion: "28.0.0",
    architecture: "x86_64/linux",
    cpuCount: 2,
    memoryBytes: 4_294_967_296,
    managerReachability: "reachable",
    leader: false,
  });
});
