import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";
import { createGithubWebhookProcessor, parseGithubWebhook } from "../github-webhooks.mjs";

const secret = "github-webhook-secret-that-is-long-enough";

function signedInput(payload, event = "push") {
  const body = Buffer.from(JSON.stringify(payload));
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return {
    body,
    deliveryId: randomUUID(),
    event,
    signature,
  };
}

test("validates GitHub push signatures and extracts the exact branch commit", () => {
  const input = signedInput({
    ref: "refs/heads/main",
    after: "a".repeat(40),
    repository: { full_name: "example-org/site" },
  });
  assert.deepEqual(parseGithubWebhook({ ...input, secret }), {
    deliveryId: input.deliveryId,
    event: "push",
    repository: "example-org/site",
    ref: "refs/heads/main",
    commitSha: "a".repeat(40),
  });
  assert.throws(
    () => parseGithubWebhook({ ...input, signature: `sha256=${"0".repeat(64)}`, secret }),
    { code: "INVALID_WEBHOOK_SIGNATURE" },
  );
});

test("ignores authenticated non-push events and rejects malformed push data", async () => {
  const input = signedInput({ action: "created" }, "installation");
  const processor = createGithubWebhookProcessor({
    async getSecret() { return secret; },
    async recordDelivery() { throw new Error("Non-push events must not be recorded."); },
  });
  assert.deepEqual(await processor(input), {
    delivery: { event: "installation", deliveryId: input.deliveryId, ignored: true },
    duplicate: false,
  });

  const malformed = signedInput({
    ref: "refs/heads/main",
    after: "bad",
    repository: { full_name: "example-org/site" },
  });
  assert.throws(() => parseGithubWebhook({ ...malformed, secret }), { code: "INVALID_WEBHOOK" });
});
