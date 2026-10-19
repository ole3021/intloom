import type { LoomInput } from "@intloom/loom-sdk";
import type { ProjectExecution } from "./project-contracts.ts";
import type { RunSource } from "../runtime/execution-policy.ts";
import type { OperationRef } from "../runtime/contracts.ts";
import { ERRORS } from "../errors.ts";

/** Host resource preparation precedes Runtime admission; recheck shutdown after asynchronous preparation. */
export async function prepareRun(
  execution: Pick<
    ProjectExecution,
    "registries" | "runtime" | "prepareExecution" | "looms"
  >,
  loomName: string,
  input: LoomInput,
  source: RunSource,
  operation: OperationRef,
  assertOpen: () => void,
) {
  try {
    assertOpen();
    if (typeof loomName !== "string" || !loomName.trim())
      throw ERRORS.create("INVALID_REQUEST", {
        message: "A Loom name must contain non-whitespace text.",
      });
    const blueprints = execution.registries.blueprints;
    const blueprint = Object.hasOwn(blueprints, loomName)
      ? blueprints[loomName]
      : undefined;
    if (blueprint) {
      const policy = await execution.prepareExecution(blueprint, source);
      assertOpen();
      return execution.runtime.startRun(blueprint, input, policy, operation);
    }
    const failure = execution.looms.find(
      (loom) => !loom.isAvailable && loom.loomName === loomName,
    );
    if (failure && !failure.isAvailable)
      throw ERRORS.wrap("KERNEL_UNAVAILABLE", failure.error, {
        message: `Loom ${loomName} is unavailable.`,
        retryable: false,
      });
    throw ERRORS.create("NOT_FOUND", {
      message: `Loom ${loomName} is not registered.`,
    });
  } catch (error) {
    return { status: "not_applied", error } as const;
  }
}
