const repositoryNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const repositoryReferencePattern = /^([A-Za-z0-9][A-Za-z0-9._-]{0,99})\/([A-Za-z0-9][A-Za-z0-9._-]{0,99})$/;

export function validateRepositoryInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some((key) => !["name", "description"].includes(key))
    || typeof body.name !== "string"
    || !repositoryNamePattern.test(body.name)
    || body.name.endsWith(".")
    || body.name.includes("..")
    || (body.description !== undefined
      && (typeof body.description !== "string" || body.description.length > 500))) {
    const error = new TypeError("El nombre debe tener 1–100 caracteres alfanuméricos, puntos, guiones o guiones bajos; la descripción admite hasta 500 caracteres.");
    error.code = "INVALID_REPOSITORY";
    throw error;
  }
  return {
    name: body.name,
    description: body.description?.trim() ?? "",
  };
}

export function validateRepositoryReference(reference) {
  if (typeof reference !== "string") {
    const invalid = new TypeError("Selecciona un repositorio válido de Gitea.");
    invalid.code = "INVALID_REPOSITORY";
    throw invalid;
  }
  const match = repositoryReferencePattern.exec(reference);
  if (!match || match[1].endsWith(".") || match[2].endsWith(".")
    || match[1].includes("..") || match[2].includes("..")) {
    const invalid = new TypeError("Selecciona un repositorio válido de Gitea.");
    invalid.code = "INVALID_REPOSITORY";
    throw invalid;
  }
  return { owner: match[1], name: match[2], fullName: reference };
}

function validateBranchName(branch) {
  if (typeof branch !== "string" || branch.length < 1 || branch.length > 255
    || /[\u0000-\u001f\u007f]/.test(branch)) {
    const invalid = new TypeError("Selecciona una rama válida de Gitea.");
    invalid.code = "INVALID_BRANCH";
    throw invalid;
  }
  return branch;
}

export function createGiteaClient({ domain, fetchImpl = fetch } = {}) {
  if (typeof domain !== "string"
    || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
    || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)
    || typeof fetchImpl !== "function") {
    throw new TypeError("Gitea client configuration is invalid.");
  }
  const apiUrl = `https://${domain}/api/v1`;

  async function request(path, token, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${apiUrl}${path}`, {
        ...options,
        headers: {
          Accept: "application/json",
          Authorization: `token ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      const unavailable = new Error("No se pudo conectar con la API HTTPS de Gitea.");
      unavailable.code = "GITEA_UNAVAILABLE";
      throw unavailable;
    }

    if (response.status === 401) {
      const invalid = new Error("El token de Gitea fue rechazado o ya no es válido.");
      invalid.code = "GITEA_TOKEN_INVALID";
      throw invalid;
    }
    if (response.status === 403) {
      const forbidden = new Error("El token no tiene permisos suficientes para administrar repositorios.");
      forbidden.code = "GITEA_TOKEN_FORBIDDEN";
      throw forbidden;
    }
    if (response.status === 409 && options.method === "POST" && path === "/user/repos") {
      const conflict = new Error("Ya existe un repositorio con ese nombre en la cuenta conectada.");
      conflict.code = "GITEA_REPOSITORY_EXISTS";
      throw conflict;
    }
    if (response.status === 409) {
      const conflict = new Error("Gitea rechazó la operación por un conflicto con el estado actual.");
      conflict.code = "GITEA_REQUEST_CONFLICT";
      throw conflict;
    }
    if (response.status === 404) {
      const missing = new Error("No se encontró el repositorio o la rama solicitados.");
      missing.code = "GITEA_RESOURCE_NOT_FOUND";
      throw missing;
    }
    if (!response.ok) {
      const failed = new Error("Gitea no pudo completar la operación solicitada.");
      failed.code = "GITEA_REQUEST_FAILED";
      throw failed;
    }
    try {
      return await response.json();
    } catch {
      const invalid = new Error("Gitea devolvió una respuesta inválida.");
      invalid.code = "GITEA_INVALID_RESPONSE";
      throw invalid;
    }
  }

  async function requestArchive(path, token) {
    let response;
    try {
      response = await fetchImpl(`${apiUrl}${path}`, {
        headers: {
          Accept: "application/zip, application/octet-stream",
          Authorization: `token ${token}`,
        },
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      const unavailable = new Error("No se pudo descargar el código desde Gitea.");
      unavailable.code = "GITEA_UNAVAILABLE";
      throw unavailable;
    }

    if (response.status === 401) {
      const invalid = new Error("El token de Gitea fue rechazado o ya no es válido.");
      invalid.code = "GITEA_TOKEN_INVALID";
      throw invalid;
    }
    if (response.status === 403) {
      const forbidden = new Error("El token no tiene permiso para leer el repositorio.");
      forbidden.code = "GITEA_TOKEN_FORBIDDEN";
      throw forbidden;
    }
    if (response.status === 404) {
      const missing = new Error("No se encontró el repositorio o el commit solicitados.");
      missing.code = "GITEA_RESOURCE_NOT_FOUND";
      throw missing;
    }
    if (!response.ok) {
      const failed = new Error("Gitea no pudo descargar el código solicitado.");
      failed.code = "GITEA_REQUEST_FAILED";
      throw failed;
    }

    const archiveUrl = new URL(response.url);
    if (archiveUrl.protocol !== "https:" || archiveUrl.hostname !== domain) {
      const invalid = new Error("Gitea devolvió una descarga fuera de su dominio HTTPS.");
      invalid.code = "GITEA_INVALID_RESPONSE";
      throw invalid;
    }
    const maximumBytes = 32 * 1024 * 1024;
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
      const tooLarge = new Error("El código del proyecto supera el límite de descarga de 32 MiB.");
      tooLarge.code = "GITEA_ARCHIVE_TOO_LARGE";
      throw tooLarge;
    }
    if (!response.body) {
      const invalid = new Error("Gitea devolvió un archivo vacío.");
      invalid.code = "GITEA_INVALID_RESPONSE";
      throw invalid;
    }

    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maximumBytes) {
          const tooLarge = new Error("El código del proyecto supera el límite de descarga de 32 MiB.");
          tooLarge.code = "GITEA_ARCHIVE_TOO_LARGE";
          throw tooLarge;
        }
        chunks.push(chunk);
      }
    } catch (error) {
      if (error?.code === "GITEA_ARCHIVE_TOO_LARGE") throw error;
      const unavailable = new Error("La descarga del código desde Gitea se interrumpió.");
      unavailable.code = "GITEA_UNAVAILABLE";
      throw unavailable;
    }
    const archive = Buffer.concat(chunks);
    if (archive.length < 4 || archive[0] !== 0x50 || archive[1] !== 0x4b) {
      const invalid = new Error("Gitea devolvió un archivo ZIP inválido.");
      invalid.code = "GITEA_INVALID_RESPONSE";
      throw invalid;
    }
    return archive;
  }

  async function listBranches(token, repositoryReference) {
    const repository = validateRepositoryReference(repositoryReference);
    const branches = [];
    const pageSize = 50;
    const maximumPages = 20;
    for (let page = 1; page <= maximumPages; page += 1) {
      const result = await request(
        `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/branches?limit=${pageSize}&page=${page}`,
        token,
      );
      if (!Array.isArray(result)) {
        const invalid = new Error("Gitea devolvió una lista de ramas inválida.");
        invalid.code = "GITEA_INVALID_RESPONSE";
        throw invalid;
      }
      for (const branch of result) {
        if (!branch || typeof branch.name !== "string") {
          const invalid = new Error("Gitea devolvió datos incompletos de una rama.");
          invalid.code = "GITEA_INVALID_RESPONSE";
          throw invalid;
        }
        branches.push({ name: validateBranchName(branch.name) });
      }
      if (result.length < pageSize) return branches;
    }
    const tooMany = new Error("El repositorio supera el límite de ramas que permite consultar el panel.");
    tooMany.code = "GITEA_TOO_MANY_BRANCHES";
    throw tooMany;
  }

  async function configurePushWebhook(token, repositoryReference, endpoint, secret) {
    const repository = validateRepositoryReference(repositoryReference);
    let webhookUrl;
    try {
      webhookUrl = new URL(endpoint);
    } catch {
      const invalid = new TypeError("La URL del webhook debe ser HTTPS.");
      invalid.code = "INVALID_WEBHOOK";
      throw invalid;
    }
    if (webhookUrl.protocol !== "https:" || webhookUrl.username || webhookUrl.password
      || webhookUrl.search || webhookUrl.hash
      || typeof secret !== "string" || !/^[a-f0-9]{64}$/i.test(secret)) {
      const invalid = new TypeError("La configuración del webhook no es válida.");
      invalid.code = "INVALID_WEBHOOK";
      throw invalid;
    }

    const hooks = [];
    for (let page = 1; page <= 20; page += 1) {
      const result = await request(
        `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/hooks?limit=50&page=${page}`,
        token,
      );
      if (!Array.isArray(result)) {
        const invalid = new Error("Gitea devolvió una lista de webhooks inválida.");
        invalid.code = "GITEA_INVALID_RESPONSE";
        throw invalid;
      }
      hooks.push(...result);
      if (result.length < 50) break;
      if (page === 20) {
        const tooMany = new Error("El repositorio supera el límite de webhooks que permite consultar el panel.");
        tooMany.code = "GITEA_TOO_MANY_WEBHOOKS";
        throw tooMany;
      }
    }
    const existing = hooks.find((hook) => hook?.config?.url === endpoint);
    if (existing && (!Number.isInteger(existing.id) || existing.id < 1)) {
      const invalid = new Error("Gitea devolvió un identificador de webhook inválido.");
      invalid.code = "GITEA_INVALID_RESPONSE";
      throw invalid;
    }

    const config = {
      url: endpoint,
      content_type: "json",
      secret,
      insecure_ssl: "0",
    };
    const result = await request(
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/hooks${existing ? `/${existing.id}` : ""}`,
      token,
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify(existing
          ? { config, events: ["push"], active: true }
          : { type: "gitea", config, events: ["push"], active: true }),
      },
    );
    if (!result || !Number.isInteger(result.id) || result.id < 1
      || result.active !== true || result.config?.url !== endpoint
      || !Array.isArray(result.events) || !result.events.includes("push")) {
      const invalid = new Error("Gitea no confirmó la configuración del webhook.");
      invalid.code = "GITEA_INVALID_RESPONSE";
      throw invalid;
    }
    return {
      id: result.id,
      url: endpoint,
      active: true,
      events: ["push"],
      updated: Boolean(existing),
    };
  }

  return {
    async verifyToken(token) {
      if (typeof token !== "string" || !/^[A-Za-z0-9._-]{20,512}$/.test(token)) {
        const invalid = new TypeError("El token de Gitea debe contener entre 20 y 512 caracteres válidos.");
        invalid.code = "GITEA_TOKEN_INVALID";
        throw invalid;
      }
      const user = await request("/user", token);
      if (typeof user.login !== "string" || user.login.length < 1) {
        const invalid = new Error("Gitea devolvió un usuario inválido para este token.");
        invalid.code = "GITEA_INVALID_RESPONSE";
        throw invalid;
      }
      return { login: user.login };
    },
    async createRepository(token, input) {
      const repository = validateRepositoryInput(input);
      const result = await request("/user/repos", token, {
        method: "POST",
        body: JSON.stringify({
          name: repository.name,
          description: repository.description,
          private: true,
          auto_init: true,
        }),
      });
      if (typeof result.html_url !== "string"
        || typeof result.clone_url !== "string"
        || typeof result.ssh_url !== "string") {
        const invalid = new Error("Gitea devolvió datos incompletos del repositorio.");
        invalid.code = "GITEA_INVALID_RESPONSE";
        throw invalid;
      }
      const reference = validateRepositoryReference(result.full_name);
      if (reference.name !== repository.name) {
        const invalid = new Error("Gitea devolvió una referencia inconsistente para el repositorio.");
        invalid.code = "GITEA_INVALID_RESPONSE";
        throw invalid;
      }
      let htmlUrl;
      try {
        htmlUrl = new URL(result.html_url);
      } catch {
        const invalid = new Error("Gitea devolvió una URL inválida para el repositorio.");
        invalid.code = "GITEA_INVALID_RESPONSE";
        throw invalid;
      }
      if (htmlUrl.protocol !== "https:" || htmlUrl.hostname !== domain || htmlUrl.username || htmlUrl.password) {
        const invalid = new Error("Gitea devolvió una URL fuera de su dominio HTTPS.");
        invalid.code = "GITEA_INVALID_RESPONSE";
        throw invalid;
      }
      return {
        name: repository.name,
        fullName: reference.fullName,
        url: result.html_url,
        cloneUrl: result.clone_url,
        sshUrl: result.ssh_url,
      };
    },
    async listRepositories(token) {
      const repositories = [];
      const pageSize = 50;
      const maximumPages = 20;
      for (let page = 1; page <= maximumPages; page += 1) {
        const result = await request(`/user/repos?limit=${pageSize}&page=${page}`, token);
        if (!Array.isArray(result)) {
          const invalid = new Error("Gitea devolvió una lista de repositorios inválida.");
          invalid.code = "GITEA_INVALID_RESPONSE";
          throw invalid;
        }
        for (const repository of result) {
          if (typeof repository.full_name !== "string"
            || typeof repository.name !== "string"
            || typeof repository.default_branch !== "string") {
            const invalid = new Error("Gitea devolvió datos incompletos de un repositorio.");
            invalid.code = "GITEA_INVALID_RESPONSE";
            throw invalid;
          }
          const reference = validateRepositoryReference(repository.full_name);
          if (reference.name !== repository.name) {
            const invalid = new Error("Gitea devolvió una referencia de repositorio inconsistente.");
            invalid.code = "GITEA_INVALID_RESPONSE";
            throw invalid;
          }
          repositories.push({
            name: repository.name,
            fullName: repository.full_name,
            defaultBranch: repository.default_branch,
            canAdmin: repository.permissions?.admin === true,
          });
        }
        if (result.length < pageSize) return repositories;
      }
      const tooMany = new Error("La cuenta supera el límite de repositorios que permite consultar el panel.");
      tooMany.code = "GITEA_TOO_MANY_REPOSITORIES";
      throw tooMany;
    },
    listBranches,
    configurePushWebhook,
    async getCommit(token, repositoryReference, reference) {
      const repository = validateRepositoryReference(repositoryReference);
      validateBranchName(reference);
      const result = await request(
        `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/commits/${encodeURIComponent(reference)}`,
        token,
      );
      if (typeof result.sha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(result.sha)) {
        const invalid = new Error("Gitea devolvió un identificador de commit inválido.");
        invalid.code = "GITEA_INVALID_RESPONSE";
        throw invalid;
      }
      return result.sha.toLowerCase();
    },
    async downloadArchive(token, repositoryReference, commitSha) {
      const repository = validateRepositoryReference(repositoryReference);
      if (typeof commitSha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha)) {
        const invalid = new TypeError("El commit solicitado no es válido.");
        invalid.code = "INVALID_COMMIT";
        throw invalid;
      }
      return requestArchive(
        `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/archive/${encodeURIComponent(commitSha)}.zip`,
        token,
      );
    },
    async setDefaultBranch(token, repositoryReference, branchName) {
      const repository = validateRepositoryReference(repositoryReference);
      const branch = validateBranchName(branchName);
      const branches = await listBranches(token, repositoryReference);
      if (!branches.some((item) => item.name === branch)) {
        const missing = new Error("La rama seleccionada ya no existe en el repositorio.");
        missing.code = "GITEA_BRANCH_NOT_FOUND";
        throw missing;
      }
      const result = await request(
        `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ default_branch: branch }),
        },
      );
      if (typeof result.default_branch !== "string" || result.default_branch !== branch) {
        const invalid = new Error("Gitea no confirmó el cambio de rama predeterminada.");
        invalid.code = "GITEA_INVALID_RESPONSE";
        throw invalid;
      }
      return { repository: repositoryReference, defaultBranch: branch };
    },
  };
}
