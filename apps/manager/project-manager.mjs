import { validateRepositoryReference } from "./gitea-client.mjs";

const projectNamePattern = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,99}$/;
const projectIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function validateProjectInput(body) {
  const allowedKeys = ["name", "description", "repository", "productionBranch"];
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some((key) => !allowedKeys.includes(key))
    || typeof body.name !== "string"
    || typeof body.repository !== "string"
    || typeof body.productionBranch !== "string"
    || (body.description !== undefined
      && (typeof body.description !== "string" || body.description.length > 500))) {
    const invalid = new TypeError("Proporciona un nombre, repositorio, rama y una descripción de hasta 500 caracteres.");
    invalid.code = "INVALID_PROJECT";
    throw invalid;
  }
  const name = body.name.trim();
  const description = body.description?.trim() ?? "";
  let repository;
  try {
    repository = validateRepositoryReference(body.repository);
  } catch {
    const invalid = new TypeError("Selecciona un repositorio válido de Gitea.");
    invalid.code = "INVALID_PROJECT";
    throw invalid;
  }
  if (!projectNamePattern.test(name) || name.includes("..")
    || typeof body.productionBranch !== "string"
    || body.productionBranch.length < 1 || body.productionBranch.length > 255
    || /[\u0000-\u001f\u007f]/.test(body.productionBranch)) {
    const invalid = new TypeError("El nombre admite hasta 100 caracteres seguros y la rama debe ser válida.");
    invalid.code = "INVALID_PROJECT";
    throw invalid;
  }
  return {
    name,
    description,
    repository: repository.fullName,
    productionBranch: body.productionBranch,
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
