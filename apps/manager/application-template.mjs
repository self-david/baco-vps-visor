const templateFields = new Set([
  "id",
  "version",
  "name",
  "description",
  "category",
  "image",
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
  assertExactFields(input, templateFields, "Application template");
  if (typeof input.id !== "string" || !idPattern.test(input.id)) {
    throw new TypeError("Application template id is invalid.");
  }
  if (typeof input.version !== "string" || !versionPattern.test(input.version)) {
    throw new TypeError("Application template version must use semantic versioning.");
  }
  assertText(input.name, "Application template name", 100);
  assertText(input.description, "Application template description", 1000);
  assertText(input.category, "Application template category", 100);
  if (typeof input.image !== "string" || !imagePattern.test(input.image)) {
    throw new TypeError("Application template image must include a valid tag or sha256 digest.");
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
