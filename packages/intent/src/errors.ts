import { LoomError } from "@intloom/utils";
export function fail(message: string, code = "INVALID_INTENT_STAGE"): never {
  throw new LoomError(code, message, { retryable: false });
}
