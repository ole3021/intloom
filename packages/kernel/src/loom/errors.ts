import { LoomError } from "@intloom/utils";

export type LoomInitializationErrorCode =
  | "INVALID_LOOM_PACKAGE"
  | "UNSUPPORTED_LOOM_PROTOCOL"
  | "INVALID_LOOM"
  | "LOOM_LOAD_FAILED"
  | "LOOM_AGENT_FAILED"
  | "LOOM_REGISTRATION_FAILED"
  | "LOOM_CONFLICT";

/** Preserves the underlying cause; diagnostics contain package locations and definition paths, never model credentials. */
export function fail(
  code: LoomInitializationErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new LoomError(code, message, { cause });
}

/** Normalizes unknown errors while preserving an existing LoomError's code, message, and cause. */
export function loomError(
  cause: unknown,
  code: LoomInitializationErrorCode,
  message: string,
): LoomError {
  return LoomError.is(cause) ? cause : new LoomError(code, message, { cause });
}
