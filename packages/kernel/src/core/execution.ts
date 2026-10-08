import type { RunSource } from "../runtime/execution-policy.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import type { ProjectExecution, WorkflowView } from "./contracts.ts";
import type { ReadonlyJsonValue } from "../shared/json.ts";
import type { RunView } from "../runtime/run-view.ts";

/** Successful registrations take precedence; a failed package with the same name cannot shadow a registered Workflow. */
export async function flow(
  execution: ProjectExecution,
  flowName: string,
  intent: string,
  source: RunSource = "cli",
): Promise<RunView> {
  if (typeof flowName !== "string" || !flowName.trim())
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "A Workflow name must contain non-whitespace text.",
    });
  const blueprints = execution.registries.blueprints;
  const blueprint = Object.hasOwn(blueprints, flowName)
    ? blueprints[flowName]
    : undefined;
  if (blueprint) return execution.runtime.flow(blueprint, intent, source);
  const failure = execution.workflows.find(
    (workflow) => !workflow.isAvailable && workflow.flowName === flowName,
  );
  if (failure && !failure.isAvailable)
    throw KERNEL_ERRORS.wrap("KERNEL_UNAVAILABLE", failure.error, {
      message: `Workflow ${flowName} is unavailable.`,
      retryable: false,
    });
  throw KERNEL_ERRORS.create("NOT_FOUND", {
    message: `Workflow ${flowName} is not registered.`,
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
  flowName?: string,
): Promise<RunView[]> {
  return execution.runtime.listRuns(flowName);
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
export async function listWorkflows(
  execution: ProjectExecution,
  source: RunSource = "cli",
): Promise<WorkflowView[]> {
  return execution.workflows.map((workflow): WorkflowView => {
    if (workflow.isAvailable) {
      const blueprint = execution.registries.blueprints[workflow.flowName];
      if (!blueprint)
        throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE", {
          message: "Registered Workflow resources are missing.",
          retryable: false,
        });
      return {
        packageName: workflow.packageName,
        flowName: workflow.flowName,
        isAvailable: true,
        readiness: execution.executionReadiness(blueprint, source),
      };
    }
    return {
      packageName: workflow.packageName,
      ...(workflow.flowName === undefined
        ? {}
        : { flowName: workflow.flowName }),
      isAvailable: false,
      phase: workflow.phase,
      error: {
        code: workflow.error.code,
        message: workflow.error.message,
        retryable: workflow.error.retryable,
      },
    };
  });
}
