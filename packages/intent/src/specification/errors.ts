import { LoomError } from "@intloom/utils";

export function fail(message: string, code = "INVALID_SPECIFICATION"): never {
  throw new LoomError(code, message);
}
