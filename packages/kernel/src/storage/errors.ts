import { LoomError } from "@intloom/utils";
import { KERNEL_ERRORS } from "../errors/kernel.ts";

export function storageError(cause: unknown): Error {
  if (LoomError.is(cause)) return cause;
  // BUSY is only returned for known SQLite lock failures, not ambiguous IO errors.
  let current = cause;
  for (
    let depth = 0;
    depth < 8 && current && typeof current === "object";
    depth++
  ) {
    const code = "code" in current ? current.code : undefined;
    if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED")
      return KERNEL_ERRORS.wrap("BUSY", cause);
    if (
      code === "SQLITE_CONSTRAINT_UNIQUE" ||
      code === "SQLITE_CONSTRAINT_PRIMARYKEY"
    )
      return KERNEL_ERRORS.wrap("CONFLICT", cause);
    current = "cause" in current ? current.cause : undefined;
  }
  return KERNEL_ERRORS.wrap("STORAGE_ERROR", cause, { retryable: false });
}

export function invalid(message: string): never {
  throw KERNEL_ERRORS.create("INVALID_REQUEST", { message });
}

export function conflict(message: string): never {
  throw KERNEL_ERRORS.create("CONFLICT", { message });
}

export function missing(id: string): never {
  throw KERNEL_ERRORS.create("NOT_FOUND", {
    message: `Storage entry does not exist: ${id}`,
  });
}
