import type { LoomInvocationInput as LoomInput } from "@intloom/loom-sdk";
import {
  freezeRunExecution,
  resolveRunExecution,
  type RunExecution,
} from "./execution-policy.ts";
import { generateRunId } from "@intloom/utils";
import type { Blueprint } from "@intloom/loom-sdk";
import { validateLoomInput } from "./loom-input.ts";
import { ERRORS } from "../errors.ts";
import { resolveCursor } from "./resolve-current-execution.ts";
import type { RunState } from "./run-state.ts";

/** Validates the request and entry before creation; initialization and business execution start only after registration. */
export function createRun(
  blueprint: Blueprint,
  input: LoomInput,
  execution: RunExecution = resolveRunExecution("cli", false),
): RunState {
  const parsedInput = validateLoomInput(blueprint, input);
  if (!blueprint.loomName) throw ERRORS.create("RUN_STATE_INVALID");
  const stage = Object.hasOwn(blueprint.stages, blueprint.entryStageName)
    ? blueprint.stages[blueprint.entryStageName]
    : undefined;
  if (!stage) throw ERRORS.create("INVALID_CURSOR");
  const cursor = {
    stageName: blueprint.entryStageName,
    stepName: stage.entryStepName,
  };
  resolveCursor(blueprint, cursor);
  const now = new Date();
  return {
    id: generateRunId(now),
    loomName: blueprint.loomName,
    input: parsedInput,
    execution: freezeRunExecution(execution),
    cursor,
    status: "running",
    createdAt: now,
    updatedAt: new Date(now),
  };
}
