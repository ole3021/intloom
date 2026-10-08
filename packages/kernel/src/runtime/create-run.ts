import {
  freezeRunExecution,
  resolveRunExecution,
  type RunExecution,
} from "./execution-policy.ts";
import { generateRunId } from "@intloom/utils";
import type { Blueprint } from "../workflow/blueprint.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { resolveCursor } from "./resolve-current-execution.ts";
import type { RunState } from "./run-state.ts";

/** Validates the request and entry before creation; initialization and business execution start only after registration. */
export function createRun(
  blueprint: Blueprint,
  intent: string,
  execution: RunExecution = resolveRunExecution("cli", false),
): RunState {
  if (typeof intent !== "string" || intent.trim().length === 0) {
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "Workflow intent must be nonblank text.",
    });
  }
  if (!blueprint.flowName) throw RUNTIME_ERRORS.create("RUN_STATE_INVALID");
  const stage = Object.hasOwn(blueprint.stages, blueprint.entryStageName)
    ? blueprint.stages[blueprint.entryStageName]
    : undefined;
  if (!stage) throw RUNTIME_ERRORS.create("INVALID_CURSOR");
  const cursor = {
    stageName: blueprint.entryStageName,
    stepName: stage.entryStepName,
  };
  resolveCursor(blueprint, cursor);
  const now = new Date();
  return {
    id: generateRunId(now),
    flowName: blueprint.flowName,
    intent,
    execution: freezeRunExecution(execution),
    cursor,
    status: "running",
    createdAt: now,
    updatedAt: new Date(now),
  };
}
