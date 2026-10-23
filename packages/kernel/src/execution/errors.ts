import type * as z from "zod";
import { types } from "node:util";
import { ERRORS, type KernelError, type KernelErrorCode } from "../errors.ts";

function causeChain(cause: unknown): unknown[] {
  const chain: unknown[] = [];
  let current = cause;
  // The SDK may wrap errors; inspect only a bounded cause chain without expanding requests, responses, or arbitrary details.
  while (chain.length < 8 && !chain.includes(current)) {
    chain.push(current);
    if (!current || typeof current !== "object" || !("cause" in current)) break;
    current = current.cause;
  }
  return chain;
}

function classifiedError(chain: unknown[], cause: unknown) {
  const error = chain.find(
    (error): error is KernelError =>
      ERRORS.is(error) &&
      ![
        "INVALID_REQUEST",
        "NOT_FOUND",
        "CONFLICT",
        "BUSY",
        "STORAGE_ERROR",
        "KERNEL_UNAVAILABLE",
      ].includes(error.code),
  );
  if (!error) return undefined;
  return error === cause
    ? error
    : ERRORS.wrap(error.code, cause, {
        message: error.message,
        retryable: error.retryable,
      });
}

function withDetail(
  code: KernelErrorCode,
  cause: unknown,
  detail: string,
): KernelError {
  return ERRORS.wrap(code, cause, {
    message: `${detail}${ERRORS.definitions[code].message}`,
  });
}

/** Keeps a Tool's own external-service errors distinct from Kernel model request failures. */
export function toolError(cause: unknown, toolName?: string): KernelError {
  const chain = causeChain(cause);
  const classified = classifiedError(chain, cause);
  if (classified) return classified;
  const name =
    toolName && /^[a-zA-Z0-9_.:-]{1,128}$/u.test(toolName)
      ? `Tool "${toolName}". `
      : "";
  const dependency = chain.find(ERRORS.is);
  return withDetail(
    "TOOL_EXECUTION_FAILED",
    cause,
    `${name}${dependency ? `Dependency error: ${dependency.code}. ` : ""}`,
  );
}

/** Project before passing to any logger, including caller-supplied loggers. */
export function toolErrorDiagnostics(cause: unknown) {
  const errorCodes: string[] = [];
  const seen = new Set<object>();
  let current = cause;
  while (current && typeof current === "object" && seen.size < 8) {
    if (seen.has(current) || types.isProxy(current)) break;
    seen.add(current);
    const code = Object.getOwnPropertyDescriptor(current, "code")?.value;
    errorCodes.push(
      typeof code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/u.test(code)
        ? code
        : "UNKNOWN_ERROR",
    );
    current = Object.getOwnPropertyDescriptor(current, "cause")?.value;
  }
  return { errorCodes };
}

export function resultError(
  code: "AGENT_OUTPUT_INVALID" | "STEP_RESULT_INVALID",
  cause: z.ZodError,
): KernelError {
  const paths = cause.issues.slice(0, 3).map((issue) => {
    const path = issue.path;
    const printable =
      path.length <= 8 &&
      path.every(
        (part) =>
          (typeof part === "string" && /^[a-zA-Z0-9_-]{1,64}$/u.test(part)) ||
          (typeof part === "number" && Number.isSafeInteger(part) && part >= 0),
      );
    return `${printable && path.length ? path.join(".") : "root"} (${issue.code})`;
  });
  return withDetail(code, cause, `Validation path: ${paths.join(", ")}. `);
}
