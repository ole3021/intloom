import {
  IntloomError,
  type RunView,
  type ExecutionError,
} from "@intloom/loom-sdk";
export const terminal = (status: RunView["status"]) =>
  ["succeeded", "failed", "cancelled", "interrupted"].includes(status);
export const diagnostic = (error: unknown): ExecutionError =>
  error instanceof IntloomError
    ? error.toJSON()
    : {
        code: "RECOVERY_UNAVAILABLE",
        message: "The original execution environment is unavailable.",
      };
