import { rm } from "node:fs/promises";
import { LoomError } from "@intloom/utils";
import { fail } from "../errors.ts";
import type { SourceLocation } from "../source/types.ts";

interface BuildCleanup {
  readonly entry: string;
  readonly temporary?: string | undefined;
  readonly preserveRecovery: boolean;
  readonly failure?: { readonly cause: unknown } | undefined;
}

export async function cleanupBuild({
  entry,
  temporary,
  preserveRecovery,
  failure,
}: BuildCleanup): Promise<void> {
  const errors: unknown[] = [];
  if (temporary && !preserveRecovery) {
    try {
      await rm(temporary, { recursive: true, force: true });
    } catch (cause) {
      errors.push(cause);
    }
  }
  try {
    await rm(entry, { force: true });
  } catch (cause) {
    errors.push(cause);
  }
  if (errors.length) {
    const causes = failure ? [failure.cause, ...errors] : errors;
    const aggregate = new AggregateError(causes, "Build cleanup failed");
    if (failure && LoomError.is(failure.cause)) {
      const original = failure.cause;
      const location =
        original.cause &&
        typeof original.cause === "object" &&
        "location" in original.cause
          ? (original.cause.location as SourceLocation | undefined)
          : undefined;
      throw new LoomError(original.code, original.message, {
        retryable: original.retryable,
        cause: { location, cause: aggregate },
      });
    }
    fail(
      "BUILD_FAILED",
      failure
        ? "Workflow build and cleanup failed"
        : "Workflow output was updated, but build cleanup failed",
      undefined,
      aggregate,
    );
  }
  if (failure) throw failure.cause;
}
