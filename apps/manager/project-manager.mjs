const projectNamePattern = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,99}$/;
const projectIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const repositoryPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export function validateProjectInput(body) {
  const allowedKeys = [
    "name",
    "description",
    "sourceType",
    "githubInstallationId",
    "repository",
    "productionBranch",
    "deploymentType",
    "buildStrategy",
    "buildContext",
    "dockerfilePath",
    "buildCommand",
    "buildOutputDirectory",
    "internalPort",
    "framework",
    "autoDeploy",
  ];
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some((key) => !allowedKeys.includes(key))
    || typeof body.name !== "string"
    || (body.description !== undefined
      && (typeof body.description !== "string" || body.description.length > 500))
    || (body.sourceType !== undefined && !["github", "upload"].includes(body.sourceType))
    || (body.githubInstallationId !== undefined
      && (!Number.isSafeInteger(body.githubInstallationId) || body.githubInstallationId < 1))
    || (body.repository !== undefined && typeof body.repository !== "string")
    || (body.productionBranch !== undefined
      && (typeof body.productionBranch !== "string" || /[\u0000-\u001f\u007f]/.test(body.productionBranch)))
    || (body.deploymentType !== undefined && !["static", "dynamic", "build"].includes(body.deploymentType))
    || (body.buildStrategy !== undefined && !["dockerfile", "railpack"].includes(body.buildStrategy))
    || (body.buildContext !== undefined && typeof body.buildContext !== "string")
    || (body.dockerfilePath !== undefined && typeof body.dockerfilePath !== "string")
    || (body.buildCommand !== undefined
      && (typeof body.buildCommand !== "string"
        || body.buildCommand.length > 255
        || !/^[A-Za-z0-9._:/@+-]+(?: [A-Za-z0-9._:/@+-]+)*$/.test(body.buildCommand)))
    || (body.buildOutputDirectory !== undefined && typeof body.buildOutputDirectory !== "string")
    || (body.internalPort !== undefined
      && (!Number.isInteger(body.internalPort) || body.internalPort < 1 || body.internalPort > 65535))
    || (body.framework !== undefined
      && (typeof body.framework !== "string" || body.framework.length > 80
        || /[\u0000-\u001f\u007f]/.test(body.framework)))
    || (body.autoDeploy !== undefined && typeof body.autoDeploy !== "boolean")) {
    const invalid = new TypeError("Proporciona una configuración de proyecto válida y una descripción de hasta 500 caracteres.");
    invalid.code = "INVALID_PROJECT";
    throw invalid;
  }
  const name = body.name.trim();
  const description = body.description?.trim() ?? "";
  const sourceType = body.sourceType ?? "github";
  const githubInstallationId = body.githubInstallationId ?? null;
  const repository = body.repository?.trim() ?? "";
  const productionBranch = body.productionBranch?.trim() || "main";
  const deploymentType = body.deploymentType ?? "dynamic";
  const buildStrategy = deploymentType === "static"
    ? "dockerfile"
    : deploymentType === "build" ? "dockerfile" : body.buildStrategy ?? "dockerfile";
  const buildContext = body.buildContext?.trim() || ".";
  const dockerfilePath = body.dockerfilePath?.trim() || "Dockerfile";
  const buildCommand = body.buildCommand?.trim() || "npm run build";
  const buildOutputDirectory = body.buildOutputDirectory?.trim() || "dist";
  const framework = body.framework?.trim() || "Desconocido";
  if ((sourceType === "github" && (!repositoryPattern.test(repository) || githubInstallationId === null))
    || (sourceType === "upload" && repository)
    || (sourceType === "upload" && githubInstallationId !== null)
    || !/^[A-Za-z0-9._/-]{1,255}$/.test(buildContext)
    || buildContext.startsWith("/")
    || buildContext.split("/").some((part) => part === ".." || part === "")
    || !/^[A-Za-z0-9._/-]{1,255}$/.test(dockerfilePath)
    || dockerfilePath.startsWith("/")
    || dockerfilePath.split("/").some((part) => part === ".." || part === "")
    || !/^[A-Za-z0-9._/-]{1,255}$/.test(buildOutputDirectory)
    || buildOutputDirectory.startsWith("/")
    || buildOutputDirectory.split("/").some((part) => part === ".." || part === "")
    || framework.length > 80
    || (productionBranch.length > 255 || /[\u0000-\u001f\u007f]/.test(productionBranch))) {
    const invalid = new TypeError("Selecciona una fuente y rutas de build válidas.");
    invalid.code = "INVALID_PROJECT";
    throw invalid;
  }
  if (!projectNamePattern.test(name) || name.includes("..")) {
    const invalid = new TypeError("El nombre admite hasta 100 caracteres seguros.");
    invalid.code = "INVALID_PROJECT";
    throw invalid;
  }
  return {
    name,
    description,
    sourceType,
    githubInstallationId,
    repository: repository || null,
    productionBranch,
    deploymentType,
    buildStrategy,
    buildContext,
    dockerfilePath,
    buildCommand,
    buildOutputDirectory,
    internalPort: deploymentType === "static" || deploymentType === "build" ? 80 : body.internalPort ?? 3000,
    framework,
    autoDeploy: body.autoDeploy ?? true,
  };
}

export function validateProjectId(id) {
  if (typeof id !== "string" || !projectIdPattern.test(id)) {
    const invalid = new TypeError("El identificador del proyecto no es válido.");
    invalid.code = "INVALID_PROJECT_ID";
    throw invalid;
  }
  return id.toLowerCase();
}
