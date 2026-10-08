# Errors

Shared errors, type-safe catalogs, and runtime recognition. Consumers define their own codes and default messages. `retryable` describes an error; consumers decide whether and how to retry. See the [Utils overview](../../README.md) for installation.

## Minimal usage

Import from `@intloom/utils`. Definition keys are error codes; values specify a default message and optional retryability:

```ts
import { defineErrorCatalog } from "@intloom/utils";

const errors = defineErrorCatalog({
  NOT_FOUND: { message: "The requested resource was not found." },
  BUSY: { message: "The requested resource is busy.", retryable: true },
});

const error = errors.create("NOT_FOUND", {
  message: "Run run-1 was not found.",
}); // LoomError<"NOT_FOUND">

if (errors.is(error)) {
  console.log(error.code, error.message, error.retryable);
}
```

TypeScript infers valid codes from definition keys; `create`, `wrap`, and `throw` accept only those keys.

## API

`LoomError<Code extends string = string>` extends `Error` with `name = "LoomError"`, readonly `code: Code`, and readonly `retryable: boolean`. Retryability defaults to `false`. Standard `cause` retains any value and defaults to `undefined`.

| API | Behavior |
| --- | --- |
| `new LoomError(code, message, options?)` | Construct directly; options accept `retryable` and `cause` |
| `LoomError.from(cause, fallback)` | Convert an unknown cause; fallback contains `code`, `message`, and optional `retryable` |
| `LoomError.is(value)` / `isLoomError(value)` | Equivalent type guards narrowing to `LoomError` |
| `defineErrorCatalog(definitions)` | Create a catalog from consumer definitions |

| Catalog member | Behavior |
| --- | --- |
| `definitions` | Original definition-object reference; the catalog does not clone or freeze it |
| `create(code, overrides?)` | Create from defaults; override `message`, `retryable`, and `cause` |
| `wrap(code, cause, overrides?)` | Always create a new error with `cause`; override only `message` and `retryable` |
| `throw(code, overrides?)` | Construct and throw immediately; accepts the same overrides as `create`, returns `never` |
| `is(value)` | Check `LoomError` and catalog membership; narrow to the catalog's code union |

Import the public types `LoomErrorOptions`, `ErrorDefinition`, and `ErrorOverrides` from `@intloom/utils`. See [types.ts](./types.ts), [loom-error.ts](./loom-error.ts), and [error-catalog.ts](./error-catalog.ts) for complete signatures.

## Defaults and overrides

Call-site `message` and `retryable` take precedence over defaults. Explicit empty strings and `false` remain valid:

```ts
errors.throw("BUSY", {
  message: "Project example is locked.",
  retryable: false,
});
```

## Conversion and wrapping

`LoomError.from` preserves an existing same-code `LoomError` unchanged, including its original message, retryability, and cause. Different-code errors, values that cannot be safely inspected, and other values become new errors according to the fallback, with the original value retained as `cause`. Catalog `wrap` always creates a new error, even for matching codes.

```ts
import { LoomError } from "@intloom/utils";

const original = errors.create("BUSY");
const converted = LoomError.from(original, {
  code: "BUSY",
  message: "Fallback message.",
});
const wrapped = errors.wrap("BUSY", original, {
  message: "The project lock could not be acquired.",
});

converted === original; // true
wrapped === original; // false
wrapped.cause === original; // true
```

## Recognition boundaries

Use `instanceof LoomError` within one runtime copy. Use `LoomError.is` or `isLoomError` across bundled copies. Guards first accept `instanceof`; other non-null objects require the global Symbol brand, `name = "LoomError"`, string `code`/`message`, and boolean `retryable`. Failing Proxy traps or accessors during guard inspection return `false` instead of throwing. Brands do not survive JSON or process boundaries; cross-process errors need a separate protocol.

Catalog `is` also checks that `code` is an own definition key and returns `false` if this additional inspection fails. Matching codes from other catalogs or direct construction are accepted regardless of which module created the error.

## Unknown codes

TypeScript rejects undefined codes. Passing an unknown code through JavaScript, dynamic inputs, or bypassed type checks makes `create`/`wrap`/`throw` raise a standard `TypeError`:

```text
TypeError: [LoomError] Unknown error code: UNKNOWN
```

This indicates catalog API misuse. Keep it distinguishable from business errors such as `NOT_FOUND` or `INVALID_REQUEST`.
