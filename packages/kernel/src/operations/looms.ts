import type { ProjectExecution, LoomView } from "../host/project-contracts.ts";
import type { RunSource } from "../runtime/execution-policy.ts";
import { ERRORS } from "../errors.ts";
/** Returns independent diagnostic snapshots by package without exposing internal Error cause or stack to clients. */
export async function listLooms(
  execution: Pick<
    ProjectExecution,
    "looms" | "registries" | "executionReadiness"
  >,
  source: RunSource = "cli",
): Promise<LoomView[]> {
  return execution.looms.map((loom): LoomView => {
    if (loom.isAvailable) {
      const blueprint = execution.registries.blueprints[loom.loomName];
      if (!blueprint)
        throw ERRORS.create("KERNEL_UNAVAILABLE", {
          message: "Registered Loom resources are missing.",
          retryable: false,
        });
      return {
        packageName: loom.packageName,
        loomName: loom.loomName,
        isAvailable: true,
        inputs: [...blueprint.inputs],
        readiness: execution.executionReadiness(blueprint, source),
      };
    }
    return {
      packageName: loom.packageName,
      ...(loom.loomName === undefined ? {} : { loomName: loom.loomName }),
      isAvailable: false,
      phase: loom.phase,
      error: {
        code: loom.error.code,
        message: loom.error.message,
        retryable: loom.error.retryable,
      },
    };
  });
}
