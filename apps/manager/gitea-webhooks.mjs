import { createHmac, timingSafeEqual } from "node:crypto";
import { validateRepositoryReference } from "./gitea-client.mjs";

const deliveryIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function webhookError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function deriveGiteaWebhookSecret(signingKey, repository) {
  if (!Buffer.isBuffer(signingKey) || signingKey.length < 32) {
    throw new TypeError("The Gitea webhook signing key must contain at least 32 bytes.");
  }
  const reference = validateRepositoryReference(repository);
  return createHmac("sha256", signingKey)
    .update(`vps-manager:gitea-webhook:v1:${reference.fullName}`)
    .digest("hex");
}

export function parseGiteaPushWebhook({ body, deliveryId, event, signature, signingKey }) {
  if (!Buffer.isBuffer(body) || !deliveryIdPattern.test(deliveryId ?? "")
    || event !== "push" || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
    throw webhookError("INVALID_WEBHOOK", "La solicitud de webhook no es válida.");
  }

  let payload;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    throw webhookError("INVALID_WEBHOOK", "El JSON del webhook no es válido.");
  }
  let repository;
  try {
    repository = validateRepositoryReference(payload?.repository?.full_name);
  } catch {
    throw webhookError("INVALID_WEBHOOK", "El webhook no incluye un repositorio válido.");
  }

  const expected = Buffer.from(
    createHmac("sha256", deriveGiteaWebhookSecret(signingKey, repository.fullName))
      .update(body)
      .digest("hex"),
    "hex",
  );
  const actual = Buffer.from(signature, "hex");
  if (!timingSafeEqual(actual, expected)) {
    throw webhookError("INVALID_WEBHOOK_SIGNATURE", "La firma del webhook no es válida.");
  }

  const ref = payload.ref;
  const commitSha = payload.after;
  if (typeof ref !== "string" || !/^refs\/(?:heads|tags)\/[^\\\u0000-\u001f\u007f]+$/.test(ref)
    || typeof commitSha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha)) {
    throw webhookError("INVALID_WEBHOOK", "El webhook no contiene una referencia o commit válido.");
  }

  return {
    deliveryId,
    event,
    repository: repository.fullName,
    ref,
    commitSha: commitSha.toLowerCase(),
  };
}

export function createGiteaWebhookProcessor({ signingKey, recordDelivery } = {}) {
  if (!Buffer.isBuffer(signingKey) || signingKey.length < 32 || typeof recordDelivery !== "function") {
    throw new TypeError("Gitea webhook processor configuration is invalid.");
  }
  return async function processGiteaPushWebhook(input) {
    const delivery = parseGiteaPushWebhook({ ...input, signingKey });
    const inserted = await recordDelivery(delivery);
    return { delivery, duplicate: !inserted };
  };
}
