export type DefinitionErrorCode =
  | "DEFINITION_INVALID"
  | "ENTRY_INVALID"
  | "SCHEMA_UNSUPPORTED"
  | "DEFAULT_INVALID"
  | "STEP_ID_DUPLICATE"
  | "TARGET_UNSUPPORTED";

export class DefinitionError extends Error {
  readonly code: DefinitionErrorCode;
  readonly path: string;

  constructor(code: DefinitionErrorCode, path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "DefinitionError";
    this.code = code;
    this.path = path;
  }
}

export function checkId(id: string, path = "id"): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    throw new DefinitionError(
      "DEFINITION_INVALID",
      path,
      "Expected a nonempty stable identifier (letters, digits, ., _, -).",
    );
  }
}
