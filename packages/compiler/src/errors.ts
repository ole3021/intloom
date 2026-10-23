import { failDiagnostics } from "./diagnostics.ts";
import type { SourceLocation } from "./source/types.ts";

export type CompilerErrorCode =
  | "SOURCE_READ_FAILED"
  | "SOURCE_PARSE_FAILED"
  | "INVALID_LOOM"
  | "INVALID_REFERENCE"
  | "INVALID_BUILD_CONFIG"
  | "TYPESCRIPT_FAILED"
  | "INVALID_OUTPUT"
  | "BUILD_FAILED";

export function fail(
  code: CompilerErrorCode,
  message: string,
  location?: SourceLocation,
  cause?: unknown,
): never {
  failDiagnostics(
    code,
    [{ severity: "error", code, message, ...(location ? { location } : {}) }],
    cause,
  );
}
