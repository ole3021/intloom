import { LoomError } from "@intloom/utils";
import type { SourceLocation } from "./source/types.ts";

export type CompilerErrorCode =
  | "SOURCE_READ_FAILED"
  | "SOURCE_PARSE_FAILED"
  | "INVALID_WORKFLOW"
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
  const where = location
    ? `${location.file}${location.line ? `:${location.line}:${location.column ?? 1}` : ""}: `
    : "";
  throw new LoomError(code, `${where}${message}`, {
    cause: { location, cause },
  });
}
