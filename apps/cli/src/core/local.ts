import { randomUUID } from "node:crypto";
import { projectRoot } from "@intloom/kernel/host";
import type { CoreResult, CoreMeta } from "@intloom/kernel/operations";
import { errorView } from "../errors.ts";
import { projectInputSchema, type ProjectInput } from "../client/contracts.ts";
export async function local<T>(
  input: ProjectInput,
  action: (meta: CoreMeta & { projectRoot: string }) => Promise<T>,
): Promise<CoreResult<T>> {
  const meta: CoreMeta = {
    requestId: randomUUID(),
    ...(input?.serviceInstanceId
      ? { serviceInstanceId: input.serviceInstanceId }
      : {}),
  };
  try {
    projectInputSchema.parse(input);
    const resolvedMeta = Object.assign(meta, {
      projectRoot: await projectRoot(input.projectPath),
    });
    return { ok: true, data: await action(resolvedMeta), meta };
  } catch (error) {
    return {
      ok: false,
      error: errorView(error),
      outcome: "not_applied",
      meta,
    };
  }
}
