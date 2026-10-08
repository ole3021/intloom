import type { Blueprint, Cursor } from "../workflow/blueprint.ts";
import { stepResultSchema } from "../effector/schemas/step-result.ts";
import type { StepResult } from "../effector/execution.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import {
  resolveCursor,
  resolveCurrentExecution,
} from "./resolve-current-execution.ts";
import type { Resolution, Transition } from "./routing.ts";
import type { RunState } from "./run-state.ts";

/** Advances the Run synchronously after validation; the loop handles Stage initialization, error ownership, and active task identity. */
export function applyStepResult(
  blueprint: Blueprint,
  run: RunState,
  executed: Extract<Resolution, { kind: "execute" }>,
  result: StepResult,
  now: Date = new Date(),
): Transition {
  const current = resolveCurrentExecution(blueprint, run);
  if (
    current.kind !== "execute" ||
    current.stage !== executed.stage ||
    current.step !== executed.step
  ) {
    throw RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST");
  }
  // Definition and Cursor checks cannot detect duplicate results after a loop; validate active task identity before calling.
  const parsed = stepResultSchema.safeParse(result);
  if (!parsed.success) {
    throw RUNTIME_ERRORS.wrap("STEP_RESULT_INVALID", parsed.error);
  }
  const { outcome } = parsed.data;
  const next = Object.hasOwn(current.step.on, outcome)
    ? current.step.on[outcome]
    : undefined;
  if (!next) {
    throw RUNTIME_ERRORS.create("STEP_OUTCOME_NOT_HANDLED", {
      message: `Step ${current.stage.stageName}/${current.step.stepName} does not handle outcome ${outcome}.`,
    });
  }

  let cursor: Cursor | undefined;
  let transition: Transition;
  switch (next.kind) {
    case "step":
      cursor = { stageName: current.stage.stageName, stepName: next.stepName };
      validateTarget(blueprint, cursor);
      transition = { kind: "move_step" };
      break;
    case "stage_end": {
      // Stage routing reuses the ending Step's outcome without creating an intermediate result.
      const stageNext = Object.hasOwn(current.stage.on, outcome)
        ? current.stage.on[outcome]
        : undefined;
      if (!stageNext) {
        throw RUNTIME_ERRORS.create("STEP_OUTCOME_NOT_HANDLED", {
          message: `Stage ${current.stage.stageName} does not handle outcome ${outcome}.`,
        });
      }
      switch (stageNext.kind) {
        case "stage": {
          const stage = Object.hasOwn(blueprint.stages, stageNext.stageName)
            ? blueprint.stages[stageNext.stageName]
            : undefined;
          if (!stage) {
            throw RUNTIME_ERRORS.create("INVALID_TRANSITION");
          }
          cursor = {
            stageName: stageNext.stageName,
            stepName: stage.entryStepName,
          };
          validateTarget(blueprint, cursor);
          transition = { kind: "enter_stage", stage };
          break;
        }
        case "workflow_end":
          transition = { kind: "complete" };
          break;
        default:
          throw RUNTIME_ERRORS.create("INVALID_TRANSITION");
      }
      break;
    }
    default:
      throw RUNTIME_ERRORS.create("INVALID_TRANSITION");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw RUNTIME_ERRORS.create("RUN_STATE_INVALID", {
      message: "The transition timestamp must be a valid Date.",
    });
  }
  const updatedAt = new Date(now.getTime());

  // The Run remains unchanged until this point; synchronous publication prevents partial transitions.
  if (cursor) run.cursor = cursor;
  if (transition.kind === "complete") run.status = "completed";
  run.updatedAt = updatedAt;
  return transition;
}

function validateTarget(blueprint: Blueprint, cursor: Cursor): void {
  try {
    resolveCursor(blueprint, cursor);
  } catch (cause) {
    throw RUNTIME_ERRORS.wrap("INVALID_TRANSITION", cause);
  }
}
