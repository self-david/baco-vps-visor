import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { chmod, lstat, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const accountIdPattern = /^[1-9][0-9]{0,15}$/;
const repositoryPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const branchPattern = /^[^\u0000-\u001f\u007f\\]{1,255}$/;
const apiBaseUrl = "https://api.github.com";
const maximumArchiveBytes = 32 * 1024 * 1024;
const requiredScopes = new Set(["repo", "admin:repo_hook"]);

function githubError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateConfiguration(value) {
  if (!value || typeof value !== "object"
    || typeof value.clientId !== "string" || !/^[A-Za-z0-9._-]{1,100}$/.test(value.clientId)
    || typeof value.clientSecret !== "string" || value.clientSecret.length < 20
    || value.clientSecret.length > 256 || /[\u0000-\u001f\u007f]/.test(value.clientSecret)
    || typeof value.webhookSecret !== "string" || value.webhookSecret.length < 20
    || value.webhookSecret.length > 256 || /[\u0000-\u001f\u007f]/.test(value.webhookSecret)
    || !Array.isArray(value.accounts)) {
    throw new TypeError("La configuración de GitHub OAuth no es válida.");
  }
  const accounts = value.accounts.map((account) => {
    if (!account || !accountIdPattern.test(String(account.id ?? ""))
      || typeof account.login !== "string" || !/^[A-Za-z0-9-]{1,39}$/.test(account.login)
      || typeof account.accessToken !== "string" || account.accessToken.length < 20
      || account.accessToken.length > 4096
      || (account.refreshToken !== undefined && (typeof account.refreshToken !== "string" || account.refreshToken.length > 4096))
      || (account.expiresAt !== undefined && (!Number.isSafeInteger(account.expiresAt) || account.expiresAt < 1))) {
      throw new TypeError("La cuenta conectada de GitHub no es válida.");
    }
    return {
      id: String(account.id),
      login: account.login,
      accessToken: account.accessToken,
      ...(account.refreshToken ? { refreshToken: account.refreshToken } : {}),
      ...(account.expiresAt ? { expiresAt: account.expiresAt } : {}),
    };
  });
  return {
    clientId: value.clientId,
    clientSecret: value.clientSecret,
    webhookSecret: value.webhookSecret,
    accounts,
    ...(value.pendingState ? {
      pendingState: value.pendingState,
      pendingExpiresAt: value.pendingExpiresAt,
      pendingRedirectUri: value.pendingRedirectUri,
    } : {}),
  };
}

async function readKey(path) {
  const value = (await readFile(path, "utf8")).trim();
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("La llave de cifrado no tiene el formato esperado.");
  return Buffer.from(value, "hex");
}

function encrypt(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `${JSON.stringify({
    version: 1,
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: data.toString("hex"),
  })}\n`;
}

function decrypt(value, key) {
  if (!value || value.version !== 1
    || !/^[a-f0-9]{24}$/i.test(value.iv ?? "")
    || !/^[a-f0-9]{32}$/i.test(value.tag ?? "")
    || !/^(?:[a-f0-9]{2})+$/i.test(value.data ?? "")
    || value.data.length > 1_000_000) {
    throw new Error("El archivo cifrado de GitHub OAuth no es válido.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "hex"));
  decipher.setAuthTag(Buffer.from(value.tag, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.data, "hex")),
    decipher.final(),
  ]).toString("utf8");
  return validateConfiguration(JSON.parse(plaintext));
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
    if (length > limit) throw githubError("GITHUB_ARCHIVE_TOO_LARGE", "El archivo del repositorio supera el límite de 32 MiB.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

export function createGithubOAuth({
  directory,
  keyFile = process.env.BACKUP_KEY_FILE ?? "/run/secrets/backup_key",
  fetchImpl = fetch,
  now = () => Date.now(),
} = {}) {
  if (typeof directory !== "string" || !directory || typeof fetchImpl !== "function" || typeof now !== "function") {
    throw new TypeError("La integración OAuth de GitHub no está configurada.");
  }
  const path = join(directory, "github-oauth-config.enc");

  async function loadConfiguration() {
    let descriptor;
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile()) throw new Error("La configuración OAuth de GitHub debe ser un archivo regular.");
      descriptor = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
    try {
      const metadata = await descriptor.stat();
      if (!metadata.isFile() || (process.platform !== "win32" && (metadata.mode & 0o077) !== 0)
        || metadata.size > 1_100_000) {
        throw new Error("El archivo cifrado de GitHub OAuth tiene permisos o tamaño inválidos.");
      }
      return decrypt(JSON.parse(await descriptor.readFile("utf8")), await readKey(keyFile));
    } finally {
      await descriptor.close();
    }
  }

  async function saveConfiguration(value) {
    const configuration = validateConfiguration(value);
    const temporary = join(directory, `.github-oauth-${randomBytes(12).toString("hex")}.tmp`);
    try {
      await writeFile(temporary, encrypt(configuration, await readKey(keyFile)), { flag: "wx", mode: 0o600 });
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
        redirect: allowRedirect ? "manual" : "error",
      });
    } catch (error) {
      throw githubError("GITHUB_UNAVAILABLE", "GitHub no está disponible en este momento.");
    }
    if (!response.ok && !(allowRedirect && response.status === 302)) {
      const code = response.status === 401 ? "GITHUB_TOKEN_INVALID"
        : response.status === 403 ? "GITHUB_TOKEN_FORBIDDEN"
          : response.status === 404 ? "GITHUB_RESOURCE_NOT_FOUND"
            : response.status === 422 ? "GITHUB_VALIDATION_FAILED"
              : "GITHUB_REQUEST_FAILED";
      throw githubError(code, `GitHub respondió con estado ${response.status}.`);
    }
    return response;
  }

  async function exchangeToken(body) {
    let response;
    try {
      response = await fetchImpl("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
        redirect: "error",
      });
    } catch {
      throw githubError("GITHUB_UNAVAILABLE", "No se pudo completar la autorización con GitHub.");
    }
    if (!response.ok) throw githubError("GITHUB_REQUEST_FAILED", "GitHub rechazó el intercambio de autorización.");
    const result = await response.json();
    if (typeof result.access_token !== "string" || result.access_token.length < 20) {
      throw githubError("GITHUB_OAUTH_DENIED", "GitHub no devolvió un token de acceso. Revisa la autorización e inténtalo de nuevo.");
    }
    const scopes = new Set(String(result.scope ?? "").split(/[,\s]+/).filter(Boolean));
    for (const scope of requiredScopes) {
      if (!scopes.has(scope)) {
        throw githubError("GITHUB_OAUTH_SCOPE_MISSING", `La autorización no concedió el permiso ${scope}.`);
      }
    }
    return {
      accessToken: result.access_token,
      ...(typeof result.refresh_token === "string" ? { refreshToken: result.refresh_token } : {}),
      ...(Number.isSafeInteger(result.expires_in) ? { expiresAt: now() + result.expires_in * 1000 } : {}),
    };
  }

  async function refreshAccessToken(configuration, account) {
    if (!account.refreshToken) throw githubError("GITHUB_TOKEN_EXPIRED", "La autorización de GitHub expiró. Conecta la cuenta de nuevo.");
    let response;
    try {
      response = await fetchImpl("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: configuration.clientId,
          client_secret: configuration.clientSecret,
          grant_type: "refresh_token",
          refresh_token: account.refreshToken,
        }),
        signal: AbortSignal.timeout(20_000),
        redirect: "error",
      });
    } catch {
      throw githubError("GITHUB_UNAVAILABLE", "No se pudo renovar la autorización de GitHub.");
    }
    if (!response.ok) throw githubError("GITHUB_TOKEN_EXPIRED", "No se pudo renovar la autorización. Conecta la cuenta de nuevo.");
    const result = await response.json();
    if (typeof result.access_token !== "string" || typeof result.refresh_token !== "string"
      || !Number.isSafeInteger(result.expires_in)) {
      throw githubError("GITHUB_TOKEN_EXPIRED", "GitHub no permitió renovar la autorización. Conecta la cuenta de nuevo.");
    }
    const updated = {
      ...account,
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresAt: now() + result.expires_in * 1000,
    };
    configuration.accounts = configuration.accounts.map((item) => item.id === account.id ? updated : item);
    await saveConfiguration(configuration);
    return updated.accessToken;
  }

  async function getAccessToken(accountId) {
    if (!accountIdPattern.test(String(accountId ?? ""))) throw new TypeError("La cuenta conectada de GitHub no es válida.");
    const configuration = await loadConfiguration();
    const account = configuration?.accounts.find((item) => item.id === String(accountId));
    if (!configuration || !account) throw githubError("GITHUB_ACCOUNT_NOT_CONNECTED", "Conecta la cuenta de GitHub antes de continuar.");
    if (account.expiresAt && account.expiresAt <= now() + 60_000) return refreshAccessToken(configuration, account);
    return account.accessToken;
  }

  async function authorizedRequest(accountId, url, options = {}) {
    return request(url, { ...options, token: await getAccessToken(accountId) });
  }

  async function withRepository(accountId, repository, suffix, options) {
    if (!repositoryPattern.test(repository ?? "")) throw new TypeError("El repositorio de GitHub no es válido.");
    return authorizedRequest(accountId, `${apiBaseUrl}/repos/${repository}/${suffix}`, options);
  }

  async function createAuthorizationUrl(redirectUri) {
    const configuration = await loadConfiguration();
    if (!configuration) throw githubError("GITHUB_OAUTH_NOT_CONFIGURED", "Configura GitHub OAuth antes de conectar una cuenta.");
    const callback = new URL(redirectUri);
    if (!["https:", "http:"].includes(callback.protocol) || callback.username || callback.password
      || callback.pathname !== "/api/github/callback") {
      throw new TypeError("La URL de retorno OAuth de GitHub no es válida.");
    }
    const state = randomBytes(32).toString("hex");
    await saveConfiguration({
      ...configuration,
      pendingState: state,
      pendingExpiresAt: now() + 10 * 60 * 1000,
      pendingRedirectUri: callback.toString(),
    });
    const authorization = new URL("https://github.com/login/oauth/authorize");
    authorization.searchParams.set("client_id", configuration.clientId);
    authorization.searchParams.set("redirect_uri", callback.toString());
    authorization.searchParams.set("scope", [...requiredScopes].join(" "));
    authorization.searchParams.set("state", state);
    return authorization.toString();
  }

  async function completeAuthorization({ code, state } = {}) {
    if (typeof code !== "string" || !/^[A-Za-z0-9._~-]{1,256}$/.test(code)
      || typeof state !== "string" || !/^[a-f0-9]{64}$/i.test(state)) {
      throw githubError("GITHUB_OAUTH_STATE_INVALID", "La respuesta de autorización de GitHub no es válida.");
    }
    const configuration = await loadConfiguration();
    if (!configuration?.pendingState || !/^[a-f0-9]{64}$/i.test(configuration.pendingState)
      || !Number.isSafeInteger(configuration.pendingExpiresAt) || configuration.pendingExpiresAt < now()
      || !timingSafeEqual(Buffer.from(state, "hex"), Buffer.from(configuration.pendingState, "hex"))) {
      throw githubError("GITHUB_OAUTH_STATE_INVALID", "La autorización expiró o no corresponde a esta sesión.");
    }
    const token = await exchangeToken({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      code,
      redirect_uri: configuration.pendingRedirectUri,
    });
    const profile = await (await request(`${apiBaseUrl}/user`, { token: token.accessToken })).json();
    if (!Number.isSafeInteger(profile.id) || typeof profile.login !== "string"
      || !/^[A-Za-z0-9-]{1,39}$/.test(profile.login)) {
      throw githubError("GITHUB_REQUEST_FAILED", "GitHub devolvió un perfil de cuenta inválido.");
    }
    const account = { id: String(profile.id), login: profile.login, ...token };
    configuration.accounts = [
      ...configuration.accounts.filter((item) => item.id !== account.id),
      account,
    ];
    delete configuration.pendingState;
    delete configuration.pendingExpiresAt;
    delete configuration.pendingRedirectUri;
    await saveConfiguration(configuration);
    return { installationId: Number(account.id), accountLogin: account.login, accountType: "User" };
  }

  async function listRepositories(accountId) {
    const repositories = [];
    for (let page = 1; page <= 10; page += 1) {
      const response = await authorizedRequest(
        accountId,
        `${apiBaseUrl}/user/repos?per_page=100&page=${page}&sort=full_name&affiliation=owner,collaborator,organization_member`,
      );
      const result = await response.json();
      if (!Array.isArray(result)) throw githubError("GITHUB_REQUEST_FAILED", "GitHub devolvió una lista de repositorios inválida.");
      repositories.push(...result.filter((repo) => typeof repo.full_name === "string" && repositoryPattern.test(repo.full_name))
        .map((repo) => ({ fullName: repo.full_name, private: repo.private === true })));
      if (result.length < 100) return repositories;
    }
    throw githubError("GITHUB_TOO_MANY_REPOSITORIES", "La cuenta tiene más de 1000 repositorios disponibles.");
  }

  async function listBranches(accountId, repository) {
    if (!repositoryPattern.test(repository ?? "")) throw new TypeError("El repositorio de GitHub no es válido.");
    const branches = [];
    for (let page = 1; page <= 5; page += 1) {
      const response = await authorizedRequest(
        accountId,
        `${apiBaseUrl}/repos/${repository}/branches?per_page=100&page=${page}`,
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

  async function getCommit(accountId, repository, reference) {
    if (!branchPattern.test(reference ?? "")) throw new TypeError("La referencia GitHub no es válida.");
    const response = await withRepository(accountId, repository, `commits/${encodeURIComponent(reference)}`);
    const commit = await response.json();
    if (!/^[a-f0-9]{40}$/i.test(commit.sha ?? "")) throw githubError("GITHUB_REQUEST_FAILED", "GitHub devolvió un commit inválido.");
    return commit.sha.toLowerCase();
  }

  async function downloadArchive(accountId, repository, commitSha) {
    if (!repositoryPattern.test(repository ?? "") || !/^[a-f0-9]{40}$/i.test(commitSha ?? "")) {
      throw new TypeError("El repositorio o commit de GitHub no es válido.");
    }
    const token = await getAccessToken(accountId);
    const response = await request(`${apiBaseUrl}/repos/${repository}/zipball/${commitSha}`, { token, allowRedirect: true });
    const location = response.headers.get("location");
    const archiveUrl = location ? new URL(location, apiBaseUrl) : new URL(response.url);
    if (archiveUrl.protocol !== "https:" || !["codeload.github.com", "github.com"].includes(archiveUrl.hostname)) {
      throw githubError("GITHUB_REQUEST_FAILED", "GitHub devolvió un destino de descarga no permitido.");
    }
    let archiveResponse;
    try {
      archiveResponse = await fetchImpl(archiveUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(60_000),
        redirect: "error",
      });
    } catch {
      throw githubError("GITHUB_UNAVAILABLE", "No se pudo descargar el código desde GitHub.");
    }
    if (!archiveResponse.ok) throw githubError("GITHUB_REQUEST_FAILED", "Falló la descarga del repositorio.");
    return readLimitedResponse(archiveResponse, maximumArchiveBytes);
  }

  async function configurePushWebhook(accountId, repository, endpoint) {
    if (!repositoryPattern.test(repository ?? "")) throw new TypeError("El repositorio de GitHub no es válido.");
    const target = new URL(endpoint);
    if (target.protocol !== "https:" || target.username || target.password || target.pathname !== "/api/webhooks/github") {
      throw new TypeError("El endpoint de webhook debe usar HTTPS y la ruta pública de GitHub.");
    }
    const configuration = await loadConfiguration();
    if (!configuration) throw githubError("GITHUB_OAUTH_NOT_CONFIGURED", "Configura GitHub OAuth antes de continuar.");
    const hooksResponse = await withRepository(accountId, repository, "hooks?per_page=100");
    const hooks = await hooksResponse.json();
    if (!Array.isArray(hooks)) throw githubError("GITHUB_REQUEST_FAILED", "GitHub devolvió una lista de webhooks inválida.");
    const existing = hooks.find((hook) => hook.config?.url === target.toString());
    const body = {
      name: "web",
      active: true,
      events: ["push"],
      config: {
        url: target.toString(),
        content_type: "json",
        secret: configuration.webhookSecret,
        insecure_ssl: "0",
      },
    };
    if (existing && Number.isSafeInteger(existing.id)) {
      await withRepository(accountId, repository, `hooks/${existing.id}`, { method: "PATCH", body });
      return { configured: true, updated: true };
    }
    await withRepository(accountId, repository, "hooks", { method: "POST", body });
    return { configured: true, updated: false };
  }

  return {
    async saveConfiguration(input) {
      const current = await loadConfiguration();
      await saveConfiguration({
        ...input,
        accounts: current?.accounts ?? [],
      });
    },
    async getStatus() {
      const configuration = await loadConfiguration();
      return configuration
        ? { configured: true, clientId: configuration.clientId }
        : { configured: false };
    },
    async getWebhookSecret() {
      const configuration = await loadConfiguration();
      if (!configuration) throw githubError("GITHUB_OAUTH_NOT_CONFIGURED", "Configura GitHub OAuth antes de continuar.");
      return configuration.webhookSecret;
    },
    createAuthorizationUrl,
    completeAuthorization,
    listRepositories,
    listBranches,
    getCommit,
    downloadArchive,
    configurePushWebhook,
  };
}
