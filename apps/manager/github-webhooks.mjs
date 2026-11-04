import { createHmac, timingSafeEqual } from "node:crypto";

const deliveryIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const repositoryPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function webhookError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function parseGithubWebhook({ body, deliveryId, event, signature, secret } = {}) {
  if (!Buffer.isBuffer(body) || !deliveryIdPattern.test(deliveryId ?? "")
    || typeof event !== "string" || !/^[a-z_]{1,50}$/.test(event)
    || typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/i.test(signature)
    || typeof secret !== "string" || secret.length < 20) {
    throw webhookError("INVALID_WEBHOOK", "La solicitud de webhook no es válida.");
  }
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(signature.slice("sha256=".length), "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw webhookError("INVALID_WEBHOOK_SIGNATURE", "La firma del webhook no es válida.");
  }
  if (event !== "push") return { event, deliveryId, ignored: true };

  let payload;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    throw webhookError("INVALID_WEBHOOK", "El JSON del webhook no es válido.");
  }
  if (payload?.deleted === true) return { event, deliveryId, ignored: true };
  const repository = payload?.repository?.full_name;
  const ref = payload?.ref;
  const commitSha = payload?.after;
  if (typeof repository !== "string" || !repositoryPattern.test(repository)
    || typeof ref !== "string" || !/^refs\/heads\/[^\\\u0000-\u001f\u007f]+$/.test(ref)
    || typeof commitSha !== "string" || !/^[a-f0-9]{40}$/i.test(commitSha)) {
    throw webhookError("INVALID_WEBHOOK", "El webhook no contiene un repositorio, rama o commit válido.");
  }
  return {
    deliveryId,
    event,
    repository,
    ref,
    commitSha: commitSha.toLowerCase(),
  };
}

export function createGithubWebhookProcessor({ getSecret, recordDelivery } = {}) {
  if (typeof getSecret !== "function" || typeof recordDelivery !== "function") {
    throw new TypeError("GitHub webhook processor configuration is invalid.");
  }
  return async function processGithubWebhook(input) {
    const secret = await getSecret();
    const delivery = parseGithubWebhook({ ...input, secret });
    if (delivery.ignored) return { delivery, duplicate: false };
    const inserted = await recordDelivery(delivery);
    return { delivery, duplicate: !inserted };
  };
}
