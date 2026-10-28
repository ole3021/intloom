import { randomUUID } from "node:crypto";
import type { CompileResult } from "@intloom/compiler";
import type { CoreResult } from "@intloom/kernel/operations";
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
      outcome: ["BUILD_FAILED", "KERNEL_INTERNAL_ERROR"].includes(safe.code)
        ? "unknown"
        : "not_applied",
      meta,
    };
  }
}

async function development<T>(
  operation: () => Promise<T>,
  mutates = false,
): Promise<CoreResult<T>> {
  const meta = { requestId: randomUUID() };
  try {
    return { ok: true, data: await operation(), meta };
  } catch (error) {
    const safe = errorView(error);
    return {
      ok: false,
      error: safe,
      outcome:
        mutates && !["INVALID_LOOM", "INVALID_BUILD_CONFIG"].includes(safe.code)
          ? "unknown"
          : "not_applied",
      meta,
    };
  }
}
export function checkLoom(input: BuildInput) {
  return development(async () =>
    (await import("@intloom/compiler")).checkLoom({
      packageRoot: input.packagePath,
    }),
  );
}
export function inspectLoom(input: BuildInput) {
  return development(async () =>
    (await import("@intloom/compiler")).inspectLoom(input.packagePath),
  );
}
export function scaffoldLoom(
  input: BuildInput & { template: "code" | "agent" },
) {
  return development(
    async () =>
      (await import("@intloom/compiler")).scaffoldLoom(
        input.packagePath,
        input.template,
      ),
    true,
  );
}
