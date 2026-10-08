import type { ErrorDefinition, LoomErrorOptions } from "./types.ts";

const LOOM_ERROR_BRAND = Symbol.for("@intloom/LoomError");

/** Stable error type shared by IntLoom modules. */
export class LoomError<Code extends string = string> extends Error {
  readonly code: Code;
  readonly retryable: boolean;

  constructor(code: Code, message: string, options: LoomErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "LoomError";
    this.code = code;
    this.retryable = options.retryable ?? false;

    Object.defineProperty(this, LOOM_ERROR_BRAND, {
      value: true,
      enumerable: false,
    });
  }

  /**
   * Normalizes unknown causes to LoomError. An existing LoomError with the same code retains its identity;
   * other values are preserved unchanged as the new error's cause.
   */
  static from<Code extends string>(
    cause: unknown,
    fallback: ErrorDefinition & { readonly code: Code },
  ): LoomError<Code> {
    try {
      if (LoomError.is(cause) && cause.code === fallback.code) {
        return cause as LoomError<Code>;
      }
    } catch {
      // A Proxy or accessor may fail after recognition; preserve it as the cause.
    }

    return new LoomError(fallback.code, fallback.message, {
      retryable: fallback.retryable ?? false,
      cause,
    });
  }

  /** Supports runtime recognition within the same instance and across bundled copies. */
  static is(value: unknown): value is LoomError {
    try {
      if (value instanceof LoomError) {
        return true;
      }
      if (typeof value !== "object" || value === null) {
        return false;
      }

      const candidate = value as Record<PropertyKey, unknown>;
      return (
        candidate[LOOM_ERROR_BRAND] === true &&
        candidate.name === "LoomError" &&
        typeof candidate.code === "string" &&
        typeof candidate.message === "string" &&
        typeof candidate.retryable === "boolean"
      );
    } catch {
      return false;
    }
  }
}

export function isLoomError(value: unknown): value is LoomError {
  return LoomError.is(value);
}
