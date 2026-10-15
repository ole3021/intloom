import { randomUUID } from "node:crypto";
import type { CompileResult } from "@intloom/compiler";
import type { CoreResult } from "@intloom/kernel/service/api-contracts";
import { errorView, failure } from "../errors.ts";

export interface BuildInput {
  readonly packagePath: string;
}
export type BuildResult = CompileResult;

/** Developer builds address source packages directly, independently of project services. */
export async function buildLoom(
  input: BuildInput,
): Promise<CoreResult<BuildResult>> {
  const meta = { requestId: randomUUID() };
  try {
    if (typeof input?.packagePath !== "string" || !input.packagePath.trim())
      throw failure("INVALID_REQUEST", "Provide a Loom source directory.");
    const { compileLoom } = await import("@intloom/compiler");
    const data = await compileLoom({ packageRoot: input.packagePath });
    return { ok: true, data, meta };
  } catch (error) {
    const safe = errorView(error);
    return {
      ok: false,
      error: safe,
      // Build finalization can fail after replacing dist; do not claim rollback in that case.
      outcome: ["BUILD_FAILED", "CLI_INTERNAL_ERROR"].includes(safe.code)
        ? "unknown"
        : "not_applied",
      meta,
    };
  }
}
