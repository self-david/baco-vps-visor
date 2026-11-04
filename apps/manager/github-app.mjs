import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createSign,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { chmod, lstat, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const appSlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
const repositoryPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const branchPattern = /^[^\u0000-\u001f\u007f\\]{1,255}$/;
const maximumArchiveBytes = 32 * 1024 * 1024;
const apiBaseUrl = "https://api.github.com";

function githubError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateConfiguration(input) {
  if (!input || typeof input !== "object"
    || !/^[1-9][0-9]{0,19}$/.test(String(input.appId ?? ""))
    || typeof input.appSlug !== "string" || !appSlugPattern.test(input.appSlug)
    || typeof input.privateKey !== "string" || input.privateKey.length > 16_384
    || typeof input.webhookSecret !== "string" || input.webhookSecret.length < 20
    || input.webhookSecret.length > 256
    || /[\u0000-\u001f\u007f]/.test(input.webhookSecret)) {
    throw new TypeError("La configuración de GitHub App no es válida.");
  }
  try {
    createPrivateKey(input.privateKey);
  } catch (error) {
    throw new TypeError("La llave privada de GitHub App no es válida.", { cause: error });
  }
  return {
    appId: String(input.appId),
    appSlug: input.appSlug,
    privateKey: input.privateKey,
    webhookSecret: input.webhookSecret,
    ...(input.pendingSetupState ? {
      pendingSetupState: input.pendingSetupState,
      pendingSetupExpiresAt: input.pendingSetupExpiresAt,
    } : {}),
  };
}

function readKey(path) {
  return readFile(path, "utf8").then((value) => {
    const key = value.trim();
    if (!/^[a-f0-9]{64}$/i.test(key)) {
      throw new Error("La llave de cifrado no tiene el formato esperado.");
    }
    return Buffer.from(key, "hex");
  });
}

function encodeEncrypted(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: encrypted.toString("hex"),
  }) + "\n";
}

function decodeEncrypted(value, key) {
  if (!value || value.version !== 1
    || !/^[a-f0-9]{24}$/i.test(value.iv ?? "")
    || !/^[a-f0-9]{32}$/i.test(value.tag ?? "")
    || !/^(?:[a-f0-9]{2})+$/i.test(value.data ?? "")
    || value.data.length > 40_000) {
    throw new Error("El archivo cifrado de GitHub App no es válido.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "hex"));
  decipher.setAuthTag(Buffer.from(value.tag, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.data, "hex")),
    decipher.final(),
  ]).toString("utf8");
  return validateConfiguration(JSON.parse(plaintext));
}

function encodeJwt(configuration, now = Date.now()) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const issuedAt = Math.floor(now / 1000) - 60;
  const payload = Buffer.from(JSON.stringify({
    iat: issuedAt,
    exp: issuedAt + 540,
    iss: configuration.appId,
  })).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  return `${unsigned}.${signer.sign(configuration.privateKey, "base64url")}`;
}

async function readLimitedResponse(response, limit) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw githubError("GITHUB_ARCHIVE_TOO_LARGE", "El archivo del repositorio supera el límite de 32 MiB.");
  }
  const chunks = [];
  let length = 0;
  if (!response.body) return Buffer.alloc(0);
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > limit) {
      throw githubError("GITHUB_ARCHIVE_TOO_LARGE", "El archivo del repositorio supera el límite de 32 MiB.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

export function createGithubApp({
  directory,
  keyFile = process.env.BACKUP_KEY_FILE ?? "/run/secrets/backup_key",
  fetchImpl = fetch,
  now = () => Date.now(),
} = {}) {
  if (typeof directory !== "string" || !directory || typeof fetchImpl !== "function"
    || typeof now !== "function") {
    throw new TypeError("La integración de GitHub App no está configurada.");
  }
  const path = join(directory, "github-app-config.enc");

  async function loadConfiguration() {
    let descriptor;
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile()) throw new Error("La configuración de GitHub App debe ser un archivo regular.");
      descriptor = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
    try {
      const metadata = await descriptor.stat();
      if (!metadata.isFile()
        || (process.platform !== "win32" && (metadata.mode & 0o077) !== 0)
        || metadata.size > 50_000) {
        throw new Error("El archivo cifrado de GitHub App tiene permisos o tamaño inválidos.");
      }
      const encrypted = JSON.parse(await descriptor.readFile("utf8"));
      return decodeEncrypted(encrypted, await readKey(keyFile));
    } finally {
      await descriptor.close();
    }
  }

  async function saveConfiguration(configuration) {
    const validated = validateConfiguration(configuration);
    const temporary = join(directory, `.github-app-${randomBytes(12).toString("hex")}.tmp`);
    try {
      await writeFile(temporary, encodeEncrypted(validated, await readKey(keyFile)), { flag: "wx", mode: 0o600 });
      await chmod(temporary, 0o600);
      await rename(temporary, path);
    } catch (error) {
      await unlink(temporary).catch((cleanupError) => {
        if (cleanupError?.code !== "ENOENT") throw cleanupError;
      });
      throw error;
    }
  }

  async function request(url, { token, method = "GET", body, allowRedirect = false } = {}) {
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20_000),
        redirect: "manual",
      });
    } catch (error) {
      throw githubError("GITHUB_UNAVAILABLE", "GitHub no está disponible en este momento.");
    }
    if (!response.ok && !(allowRedirect && response.status === 302)) {
      const code = response.status === 401 ? "GITHUB_TOKEN_INVALID"
        : response.status === 403 ? "GITHUB_TOKEN_FORBIDDEN"
          : response.status === 404 ? "GITHUB_RESOURCE_NOT_FOUND"
            : "GITHUB_REQUEST_FAILED";
      throw githubError(code, `GitHub respondió con estado ${response.status}.`);
    }
    return response;
  }

  async function createInstallationToken(installationId) {
    if (!Number.isSafeInteger(installationId) || installationId < 1) {
      throw new TypeError("El identificador de instalación de GitHub no es válido.");
    }
    const configuration = await loadConfiguration();
    if (!configuration) throw githubError("GITHUB_APP_NOT_CONFIGURED", "Configura primero GitHub App.");
    const jwt = encodeJwt(configuration, now());
    const response = await request(
      `${apiBaseUrl}/app/installations/${installationId}/access_tokens`,
      { token: jwt, method: "POST" },
    );
    const result = await response.json();
    if (typeof result.token !== "string" || !result.token) {
      throw githubError("GITHUB_REQUEST_FAILED", "GitHub no devolvió un token de instalación válido.");
    }
    return result.token;
  }

  async function getInstallation(installationId) {
    const configuration = await loadConfiguration();
    if (!configuration) throw githubError("GITHUB_APP_NOT_CONFIGURED", "Configura primero GitHub App.");
    const response = await request(`${apiBaseUrl}/app/installations/${installationId}`, {
      token: encodeJwt(configuration, now()),
    });
    const installation = await response.json();
    if (!Number.isSafeInteger(installation.id)
      || typeof installation.account?.login !== "string"
      || !["User", "Organization"].includes(installation.account?.type)) {
      throw githubError("GITHUB_REQUEST_FAILED", "GitHub devolvió datos de instalación inválidos.");
    }
    return {
      installationId: installation.id,
      accountLogin: installation.account.login,
      accountType: installation.account.type,
    };
  }

  async function listRepositories(installationId) {
    const token = await createInstallationToken(installationId);
    const repositories = [];
    for (let page = 1; page <= 10; page += 1) {
      const response = await request(
        `${apiBaseUrl}/installation/repositories?per_page=100&page=${page}`,
        { token },
      );
      const result = await response.json();
      if (!Array.isArray(result.repositories)) {
        throw githubError("GITHUB_REQUEST_FAILED", "GitHub devolvió una lista de repositorios inválida.");
      }
      for (const repository of result.repositories) {
        if (typeof repository.full_name === "string" && repositoryPattern.test(repository.full_name)) {
          repositories.push({ fullName: repository.full_name, private: repository.private === true });
        }
      }
      if (result.repositories.length < 100) return repositories;
    }
    throw githubError("GITHUB_TOO_MANY_REPOSITORIES", "La instalación tiene más de 1000 repositorios disponibles.");
  }

  async function withRepositoryToken(installationId, repository, pathSuffix) {
    if (!repositoryPattern.test(repository ?? "")) throw new TypeError("El repositorio de GitHub no es válido.");
    const token = await createInstallationToken(installationId);
    return request(`${apiBaseUrl}/repos/${repository}/${pathSuffix}`, { token });
  }

  async function listBranches(installationId, repository) {
    if (!repositoryPattern.test(repository ?? "")) throw new TypeError("El repositorio de GitHub no es válido.");
    const token = await createInstallationToken(installationId);
    const branches = [];
    for (let page = 1; page <= 5; page += 1) {
      const response = await request(
        `${apiBaseUrl}/repos/${repository}/branches?per_page=100&page=${page}`,
        { token },
      );
      const result = await response.json();
      if (!Array.isArray(result)) throw githubError("GITHUB_REQUEST_FAILED", "GitHub devolvió ramas inválidas.");
      branches.push(...result.filter((branch) => typeof branch.name === "string").map((branch) => ({
        name: branch.name,
        commitSha: branch.commit?.sha ?? null,
      })));
      if (result.length < 100) return branches;
    }
    throw githubError("GITHUB_TOO_MANY_BRANCHES", "El repositorio tiene más de 500 ramas.");
  }

  async function getCommit(installationId, repository, reference) {
    if (!branchPattern.test(reference ?? "")) throw new TypeError("La referencia GitHub no es válida.");
    const response = await withRepositoryToken(
      installationId,
      repository,
      `commits/${encodeURIComponent(reference)}`,
    );
    const commit = await response.json();
    if (!/^[a-f0-9]{40}$/i.test(commit.sha ?? "")) {
      throw githubError("GITHUB_REQUEST_FAILED", "GitHub devolvió un commit inválido.");
    }
    return commit.sha.toLowerCase();
  }

  async function downloadArchive(installationId, repository, commitSha) {
    if (!repositoryPattern.test(repository ?? "") || !/^[a-f0-9]{40}$/i.test(commitSha ?? "")) {
      throw new TypeError("El repositorio o commit de GitHub no es válido.");
    }
    const token = await createInstallationToken(installationId);
    const response = await request(
      `${apiBaseUrl}/repos/${repository}/zipball/${commitSha}`,
      { token, allowRedirect: true },
    );
    const location = response.headers.get("location");
    if (!location) throw githubError("GITHUB_REQUEST_FAILED", "GitHub no devolvió el enlace de descarga.");
    const archiveUrl = new URL(location, apiBaseUrl);
    if (archiveUrl.protocol !== "https:" || !["codeload.github.com", "github.com"].includes(archiveUrl.hostname)) {
      throw githubError("GITHUB_REQUEST_FAILED", "GitHub devolvió un destino de descarga no permitido.");
    }
    let archiveResponse;
    try {
      archiveResponse = await fetchImpl(archiveUrl, {
        signal: AbortSignal.timeout(60_000),
        redirect: "error",
      });
    } catch {
      throw githubError("GITHUB_UNAVAILABLE", "No se pudo descargar el código desde GitHub.");
    }
    if (!archiveResponse.ok) throw githubError("GITHUB_REQUEST_FAILED", "Falló la descarga del repositorio.");
    return readLimitedResponse(archiveResponse, maximumArchiveBytes);
  }

  async function createInstallationUrl() {
    const configuration = await loadConfiguration();
    if (!configuration) throw githubError("GITHUB_APP_NOT_CONFIGURED", "Configura primero GitHub App.");
    const state = randomBytes(32).toString("hex");
    await saveConfiguration({
      ...configuration,
      pendingSetupState: state,
      pendingSetupExpiresAt: now() + 10 * 60 * 1000,
    });
    return `https://github.com/apps/${configuration.appSlug}/installations/new?state=${state}`;
  }

  async function completeInstallation({ installationId, state } = {}) {
    if (!Number.isSafeInteger(installationId) || installationId < 1 || typeof state !== "string") {
      throw githubError("GITHUB_INSTALLATION_INVALID", "La respuesta de instalación de GitHub no es válida.");
    }
    const configuration = await loadConfiguration();
    if (!configuration?.pendingSetupState || !/^[a-f0-9]{64}$/i.test(configuration.pendingSetupState)
      || !Number.isSafeInteger(configuration.pendingSetupExpiresAt)
      || configuration.pendingSetupExpiresAt < now()
      || !/^[a-f0-9]{64}$/i.test(state)
      || !timingSafeEqual(Buffer.from(state, "hex"), Buffer.from(configuration.pendingSetupState, "hex"))) {
      throw githubError("GITHUB_INSTALLATION_STATE_INVALID", "El enlace de instalación expiró o ya fue utilizado.");
    }
    const installation = await getInstallation(installationId);
    await saveConfiguration({
      ...configuration,
      pendingSetupState: undefined,
      pendingSetupExpiresAt: undefined,
    });
    return installation;
  }

  return {
    saveConfiguration,
    loadConfiguration,
    async getStatus() {
      const configuration = await loadConfiguration();
      return configuration ? { configured: true, appId: configuration.appId, appSlug: configuration.appSlug } : { configured: false };
    },
    createInstallationUrl,
    completeInstallation,
    createInstallationToken,
    listRepositories,
    listBranches,
    getCommit,
    downloadArchive,
  };
}
