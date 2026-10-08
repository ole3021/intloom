import { isLoomError, LoomError, type RunErrorView } from "@intloom/kernel";
import { ZodError } from "zod";

export function failure(
  code: string,
  message: string,
  cause?: unknown,
  retryable = false,
) {
  return new LoomError(code, message, {
    retryable,
    ...(cause === undefined ? {} : { cause }),
  });
}

/** Transport and terminal use flat error projections without exposing in-process causes, stacks, or credentials. */
export function errorView(error: unknown): RunErrorView {
  if (error instanceof ZodError)
    return {
      code: "INVALID_REQUEST",
      message: "The request or response has an invalid shape.",
      retryable: false,
    };
  return isLoomError(error)
    ? { code: error.code, message: error.message, retryable: error.retryable }
    : {
        code: "CLI_INTERNAL_ERROR",
        message: "The local operation failed.",
        retryable: false,
      };
}
