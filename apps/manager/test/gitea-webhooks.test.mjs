import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  createGiteaWebhookProcessor,
  deriveGiteaWebhookSecret,
  parseGiteaPushWebhook,
} from "../gitea-webhooks.mjs";

const signingKey = Buffer.alloc(32, 7);
const deliveryId = "e3f2a4d6-1234-4abc-8def-0123456789ab";
const payload = Buffer.from(JSON.stringify({
  ref: "refs/heads/main",
  after: "a".repeat(40),
  repository: { full_name: "vpsadmin/project" },
}));

function signedInput(overrides = {}) {
  const signature = createHmac(
    "sha256",
    deriveGiteaWebhookSecret(signingKey, "vpsadmin/project"),
  ).update(payload).digest("hex");
  return {
    body: payload,
    deliveryId,
    event: "push",
    signature,
    ...overrides,
  };
}

test("authenticates and extracts only the push metadata needed by the receiver", () => {
  assert.deepEqual(parseGiteaPushWebhook({ ...signedInput(), signingKey }), {
    deliveryId,
    event: "push",
    repository: "vpsadmin/project",
    ref: "refs/heads/main",
    commitSha: "a".repeat(40),
  });
});

test("rejects invalid signatures, malformed deliveries, and unsupported refs", () => {
  assert.throws(() => parseGiteaPushWebhook({
    ...signedInput({ signature: "0".repeat(64) }),
    signingKey,
  }), { code: "INVALID_WEBHOOK_SIGNATURE" });
  assert.throws(() => parseGiteaPushWebhook({
    ...signedInput({ deliveryId: "not-a-uuid" }),
    signingKey,
  }), { code: "INVALID_WEBHOOK" });

  const invalidRef = Buffer.from(JSON.stringify({
    ref: "refs/pull/1/head",
    after: "a".repeat(40),
    repository: { full_name: "vpsadmin/project" },
  }));
  const signature = createHmac(
    "sha256",
    deriveGiteaWebhookSecret(signingKey, "vpsadmin/project"),
  ).update(invalidRef).digest("hex");
  assert.throws(() => parseGiteaPushWebhook({
    ...signedInput({ body: invalidRef, signature }),
    signingKey,
  }), { code: "INVALID_WEBHOOK" });
});

test("persists authenticated deliveries once and identifies retries", async () => {
  const ids = new Set();
  const processor = createGiteaWebhookProcessor({
    signingKey,
    async recordDelivery(delivery) {
      if (ids.has(delivery.deliveryId)) return false;
      ids.add(delivery.deliveryId);
      return true;
    },
  });

  assert.deepEqual(await processor(signedInput()), {
    delivery: {
      deliveryId,
      event: "push",
      repository: "vpsadmin/project",
      ref: "refs/heads/main",
      commitSha: "a".repeat(40),
    },
    duplicate: false,
  });
  assert.equal((await processor(signedInput())).duplicate, true);
});
