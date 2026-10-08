import { LoomError } from "./loom-error.ts";
import type { ErrorDefinition, ErrorOverrides } from "./types.ts";

type Definitions = Readonly<Record<string, ErrorDefinition>>;
type CodeOf<Value extends Definitions> = keyof Value & string;
type WrapOverrides = Omit<ErrorOverrides, "cause">;

/** Creates type-safe construction, wrapping, throwing, and recognition helpers for module error definitions. */
export function defineErrorCatalog<const Value extends Definitions>(
  definitions: Value,
) {
  function create<Code extends CodeOf<Value>>(
    code: Code,
    overrides: ErrorOverrides = {},
  ): LoomError<Code> {
    const definition = Object.hasOwn(definitions, code)
      ? definitions[code]
      : undefined;
    if (definition === undefined) {
      throw new TypeError(`[LoomError] Unknown error code: ${code}`);
    }

    return new LoomError(code, overrides.message ?? definition.message, {
      retryable: overrides.retryable ?? definition.retryable ?? false,
      cause: overrides.cause,
    });
  }

  function wrap<Code extends CodeOf<Value>>(
    code: Code,
    cause: unknown,
    overrides: WrapOverrides = {},
  ): LoomError<Code> {
    return create(code, { ...overrides, cause });
  }

  function throwError<Code extends CodeOf<Value>>(
    code: Code,
    overrides?: ErrorOverrides,
  ): never {
    throw create(code, overrides);
  }

  function is(value: unknown): value is LoomError<CodeOf<Value>> {
    try {
      return LoomError.is(value) && Object.hasOwn(definitions, value.code);
    } catch {
      return false;
    }
  }

  return {
    definitions,
    create,
    wrap,
    throw: throwError,
    is,
  };
}
