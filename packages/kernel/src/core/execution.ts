import type { LoomInput } from "@intloom/loom-sdk";
import type { RunSource } from "../runtime/execution-policy.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import type { ProjectExecution, LoomView } from "./contracts.ts";
import type { ReadonlyJsonValue } from "../shared/json.ts";
import type { RunView } from "../runtime/run-view.ts";

/** Successful registrations take precedence; a failed package with the same name cannot shadow a registered Loom. */
export async function run(
  execution: ProjectExecution,
  loomName: string,
  input: LoomInput,
  source: RunSource = "cli",
): Promise<RunView> {
  if (typeof loomName !== "string" || !loomName.trim())
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "A Loom name must contain non-whitespace text.",
    });
  const blueprints = execution.registries.blueprints;
  const blueprint = Object.hasOwn(blueprints, loomName)
    ? blueprints[loomName]
    : undefined;
  if (blueprint) return execution.runtime.run(blueprint, input, source);
  const failure = execution.looms.find(
    (loom) => !loom.isAvailable && loom.loomName === loomName,
  );
  if (failure && !failure.isAvailable)
    throw KERNEL_ERRORS.wrap("KERNEL_UNAVAILABLE", failure.error, {
      message: `Loom ${loomName} is unavailable.`,
      retryable: false,
    });
  throw KERNEL_ERRORS.create("NOT_FOUND", {
    message: `Loom ${loomName} is not registered.`,
  });
}

export async function getRun(
  execution: ProjectExecution,
  runId: string,
): Promise<RunView> {
  return execution.runtime.getRun(runId);
}

export async function listRuns(
  execution: ProjectExecution,
  loomName?: string,
): Promise<RunView[]> {
  return execution.runtime.listRuns(loomName);
}

export async function answerAsk(
  execution: ProjectExecution,
  runId: string,
  actionId: string,
  answer: ReadonlyJsonValue,
): Promise<RunView> {
  return execution.runtime.answerAsk(runId, actionId, answer);
}

/** Cancels execution only; the host still releases Storage and Effector resources. */
export async function cancelRun(
  execution: ProjectExecution,
  runId: string,
): Promise<void> {
  return execution.runtime.cancelRun(runId);
}

export async function cancelAllRuns(
  execution: ProjectExecution,
): Promise<void> {
  return execution.runtime.cancelAllRuns();
}

/** Returns independent diagnostic snapshots by package without exposing internal Error cause or stack to clients. */
export async function listLooms(
  execution: ProjectExecution,
  source: RunSource = "cli",
): Promise<LoomView[]> {
  return execution.looms.map((loom): LoomView => {
    if (loom.isAvailable) {
      const blueprint = execution.registries.blueprints[loom.loomName];
      if (!blueprint)
        throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE", {
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
