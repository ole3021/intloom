import { cursorSchema } from "../workflow/schemas/cursor.ts";
import type { Blueprint, Cursor } from "../workflow/blueprint.ts";
import { assertRunState } from "./assert-run-state.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import type { Resolution } from "./routing.ts";
import type { RunState } from "./run-state.ts";

/** Resolves definitions without business execution; validates Cursor even in stable states so missing Steps cannot appear as normal completion. */
export function resolveCurrentExecution(
  blueprint: Blueprint,
  run: Readonly<RunState>,
): Resolution {
  const current = resolveCursor(blueprint, run.cursor);
  assertRunState(run);
  if (run.flowName !== blueprint.flowName) {
    throw RUNTIME_ERRORS.create("RUN_STATE_INVALID", {
      message: "The Run does not belong to this Blueprint Workflow.",
    });
  }
  return run.status === "running" ? current : { kind: "halt" };
}

/** Shared internal lookup: accepts only own properties and checks that definition names match their keys. */
export function resolveCursor(
  blueprint: Blueprint,
  cursor: Readonly<Cursor>,
): Extract<Resolution, { kind: "execute" }> {
  if (!cursorSchema.safeParse(cursor).success) {
    throw RUNTIME_ERRORS.create("INVALID_CURSOR");
  }
  const stage = Object.hasOwn(blueprint.stages, cursor.stageName)
    ? blueprint.stages[cursor.stageName]
    : undefined;
  const step =
    stage && Object.hasOwn(stage.steps, cursor.stepName)
      ? stage.steps[cursor.stepName]
      : undefined;
  if (
    !stage ||
    stage.stageName !== cursor.stageName ||
    !step ||
    step.stepName !== cursor.stepName
  ) {
    throw RUNTIME_ERRORS.create("INVALID_CURSOR", {
      message: `Cursor ${cursor.stageName}/${cursor.stepName} is not in the Blueprint.`,
    });
  }
  return { kind: "execute", stage, step };
}
