const templateFields = new Set([
  "id",
  "version",
  "name",
  "description",
  "category",
  "image",
  "port",
  "volumeTarget",
  "cpus",
  "memoryMb",
  "environment",
]);
const environmentFields = new Set([
  "name",
  "label",
  "description",
  "required",
  "secret",
  "defaultValue",
]);
const idPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const imagePattern = /^(?:[a-z0-9]+(?:[.-][a-z0-9]+)*(?::[1-9]\d{0,4})?\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}|@sha256:[a-f0-9]{64})$/;
const environmentNamePattern = /^[A-Z_][A-Z0-9_]{0,127}$/;
const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const swarmIdPattern = /^[a-z0-9]{25,64}$/i;

function assertExactFields(value, fields, label, requiredFields = fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some((key) => !fields.has(key))
    || [...requiredFields].some((field) => !Object.hasOwn(value, field))) {
    throw new TypeError(`${label} fields are invalid.`);
  }
}

function assertText(value, label, maximumLength) {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1
    || value.length > maximumLength) {
    throw new TypeError(`${label} is invalid.`);
  }
}

export function validateApplicationTemplate(input) {
  assertExactFields(input, templateFields, "Application template", ["id", "version", "name", "description", "category", "image", "environment"]);
  if (typeof input.id !== "string" || !idPattern.test(input.id)) {
    throw new TypeError("Application template id is invalid.");
  }
  if (typeof input.version !== "string"
    || (!versionPattern.test(input.version) && !(input.id === "n8n-instance" && input.version === "latest"))) {
    throw new TypeError("Application template version must use semantic versioning.");
  }
  assertText(input.name, "Application template name", 100);
  assertText(input.description, "Application template description", 1000);
  assertText(input.category, "Application template category", 100);
  if (typeof input.image !== "string" || !imagePattern.test(input.image)) {
    throw new TypeError("Application template image must include a valid tag or sha256 digest.");
  }
  if (input.port !== undefined
    && (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)) {
    throw new TypeError("Application template port is invalid.");
  }
  if (input.volumeTarget !== undefined
    && (typeof input.volumeTarget !== "string" || input.volumeTarget.length > 255
      || !/^\/(?:[A-Za-z0-9._-]+\/?)*$/.test(input.volumeTarget)
      || input.volumeTarget.includes(".."))) {
    throw new TypeError("Application template volume target is invalid.");
  }
  if (input.cpus !== undefined
    && (typeof input.cpus !== "number" || !Number.isFinite(input.cpus)
      || input.cpus < 0.25 || input.cpus > 8)) {
    throw new RangeError("Application CPU limit must be between 0.25 and 8.");
  }
  if (input.memoryMb !== undefined
    && (!Number.isInteger(input.memoryMb) || input.memoryMb < 256 || input.memoryMb > 16384)) {
    throw new RangeError("Application memory limit must be between 256 and 16384 MB.");
  }
  if (!Array.isArray(input.environment) || input.environment.length > 128) {
    throw new TypeError("Application template environment declarations are invalid.");
  }

  const names = new Set();
  const environment = input.environment.map((variable) => {
    assertExactFields(
      variable,
      environmentFields,
      "Application environment variable",
      [...environmentFields].filter((field) => field !== "defaultValue"),
    );
    if (typeof variable.name !== "string" || !environmentNamePattern.test(variable.name)
      || names.has(variable.name)) {
      throw new TypeError("Application environment variable names must be unique valid identifiers.");
    }
    names.add(variable.name);
    assertText(variable.label, "Application environment variable label", 100);
    assertText(variable.description, "Application environment variable description", 500);
    if (typeof variable.required !== "boolean" || typeof variable.secret !== "boolean") {
      throw new TypeError("Application environment variable flags must be boolean.");
    }
    if (variable.defaultValue !== undefined
      && (typeof variable.defaultValue !== "string" || variable.defaultValue.length > 4096
        || variable.secret)) {
      throw new TypeError("Application environment variable defaults are invalid.");
    }
    return { ...variable };
  });

  return { ...input, environment };
}

export function validateManualApplicationInput(input) {
  const allowedFields = new Set([
    ...templateFields,
    "domain",
    "serverNodeId",
    "environmentValues",
    "secretValues",
  ]);
  assertExactFields(input, allowedFields, "Manual application", [
    "id", "version", "name", "description", "category", "image", "port",
    "domain", "serverNodeId", "environmentValues", "secretValues",
  ]);
  const template = validateApplicationTemplate({
    id: input.id,
    version: input.version,
    name: input.name,
    description: input.description,
    category: input.category,
    image: input.image,
    port: input.port,
    volumeTarget: input.volumeTarget || undefined,
    cpus: input.cpus,
    memoryMb: input.memoryMb,
    environment: [],
  });
  if (!isPublicHostname(input.domain)) {
    throw new TypeError("Application domain must be a public hostname.");
  }
  if (typeof input.serverNodeId !== "string" || !swarmIdPattern.test(input.serverNodeId)) {
    throw new TypeError("Application server node identifier is invalid.");
  }

  function validateValues(values, label) {
    if (!values || typeof values !== "object" || Array.isArray(values)
      || Object.keys(values).length > 100) {
      throw new TypeError(`${label} must be an object with at most 100 entries.`);
    }
    let totalBytes = 0;
    for (const [name, value] of Object.entries(values)) {
      if (!environmentNamePattern.test(name) || typeof value !== "string"
        || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) || value.length > 8192) {
        throw new TypeError(`${label} contains an invalid variable.`);
      }
      totalBytes += Buffer.byteLength(name) + Buffer.byteLength(value);
    }
    if (totalBytes > 24576) throw new TypeError(`${label} is too large.`);
    return { ...values };
  }

  const environmentValues = validateValues(input.environmentValues, "Application environment");
  const secretValues = validateValues(input.secretValues, "Application secrets");
  if (Object.keys(environmentValues).some((name) => Object.hasOwn(secretValues, name))) {
    throw new TypeError("Application variable names must not overlap between values and secrets.");
  }

  return {
    ...template,
    volumeTarget: template.volumeTarget ?? "",
    cpus: template.cpus ?? 1,
    memoryMb: template.memoryMb ?? 1024,
    domain: input.domain.toLowerCase(),
    serverNodeId: input.serverNodeId.toLowerCase(),
    environmentValues,
    secretValues,
  };
}

function isPublicHostname(value) {
  return typeof value === "string" && domainPattern.test(value)
    && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)
    && !/\.(?:localhost|local|internal|test|example|invalid|onion|home|lan)$/i.test(value);
}
