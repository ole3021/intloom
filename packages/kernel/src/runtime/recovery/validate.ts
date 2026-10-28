import { runFacts } from "../run-facts.ts";
import { validateLoomInput } from "../loom-input.ts";
import { jsonCopy } from "../../shared/json.ts";
import { validateResult } from "../boundaries.ts";
import { isDeepStrictEqual } from "node:util";
import { silentLogger } from "@intloom/utils";
import type { RuntimeOptions } from "../contracts.ts";
import type { CheckpointSnapshot } from "./contracts.ts";
import { createRunEntry } from "../run-entry.ts";
import { ERRORS } from "../../errors.ts";
import type { RunState } from "../run-state.ts";
import { freezeRunExecution } from "../execution-policy.ts";
import { assertRunState } from "../assert-run-state.ts";
import { resolveCursor } from "../resolve-current-execution.ts";
import { validateSavedAction, validateSavedAnswer } from "../interaction.ts";

export type RecoveryValidationOptions = Pick<
  RuntimeOptions,
  "codes" | "validateExecution" | "logger"
> &
  Pick<
    NonNullable<RuntimeOptions["recovery"]>,
    "blueprints" | "loomIdentities"
  >;

/** Builds detached recovery state without a store, executor, live Call or business execution. */
export async function validateRecovery(
  saved: CheckpointSnapshot,
  options: RecoveryValidationOptions,
) {
  if (saved.phase === "terminal")
    throw new Error("Terminal history is not resumable.");
  const { blueprints, loomIdentities } = options;
  const blueprint = blueprints[saved.run.loomName];
  if (
    !blueprint ||
    (!saved.control?.sourceMirrorId &&
      loomIdentities[saved.run.loomName] !== saved.loomIdentity)
  )
    throw ERRORS.create("RECOVERY_INCOMPATIBLE", {
      message: `Cannot restore Run ${saved.run.id}: its exact Loom resources are unavailable. Recovery files were retained.`,
    });
  if (!!blueprint.capability !== (saved.version === 4))
    throw ERRORS.create("RECOVERY_INCOMPATIBLE", {
      message: "Checkpoint version does not match the Loom protocol.",
    });
  const {
    lastError,
    pendingAction,
    pendingAgentCall,
    output,
    hostContext,
    interactionReceipts,
    ...data
  } = saved.run;
  if (output !== undefined)
    throw new Error("Nonterminal checkpoint contains a delivery.");
  if (lastError)
    throw new Error("Nonterminal checkpoint contains a terminal error.");
  const state: RunState = {
    ...data,
    ...(hostContext ? { hostContext } : {}),
    ...(interactionReceipts ? { interactionReceipts } : {}),
    input: validateLoomInput(blueprint, data.input),
    ...(saved.control ? { control: jsonCopy(saved.control) } : {}),
    execution: freezeRunExecution(data.execution),
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    ...(pendingAction ? { pendingAction } : {}),
    ...(pendingAgentCall ? { pendingAgentCall } : {}),
  };
  assertRunState(state);
  if (state.pendingAction) validateSavedAction(state.pendingAction);
  const current = resolveCursor(blueprint, state.cursor);
  if ((saved.phase === "waiting") !== (state.status === "waiting"))
    throw new Error("Checkpoint phase does not match its Run status.");
  if (
    saved.phase !== "waiting" &&
    state.status !== "running" &&
    state.status !== "paused"
  )
    throw new Error(
      "A nonterminal recovery checkpoint must be running or waiting.",
    );
  if (
    saved.phase !== "executing" &&
    saved.phase !== "stage_pending" &&
    !saved.stage
  )
    throw new Error("The recovery checkpoint is missing Stage State.");
  if (
    saved.phase === "stage_pending" &&
    saved.stage &&
    !(saved.control && saved.stage.role === "exited")
  )
    throw new Error(
      "A pending Stage must not contain the previous Stage's State.",
    );
  const entry = createRunEntry(
    blueprint,
    state,
    options.logger ?? silentLogger,
  );
  runFacts(state).results.push(...(saved.run.results ?? []));
  entry.stageVisitId = saved.stageVisitId;
  if (saved.pauseRequested) entry.state.pauseRequested = true;
  if (saved.observationBaseline)
    entry.observationBaseline = saved.observationBaseline;
  if (
    saved.phase === "stage_pending" &&
    state.cursor.stepName !== current.stage.entryStepName
  )
    throw new Error(
      "Saved pending Stage entry Step differs from the current entry.",
    );
  if (saved.stage?.role === "exited") entry.exitedStage = saved.stage;
  else if (saved.stage) {
    if (
      saved.stage.stageName &&
      saved.stage.stageName !== current.stage.stageName
    )
      throw new Error(
        "Saved current Stage State belongs to a different Stage.",
      );
    await entry.stageState.restore(current.stage, saved.stage);
  }
  if (saved.phase === "answered") {
    if (
      saved.answer === undefined ||
      !saved.answeredAction ||
      saved.answeredAction.loomName !== state.loomName ||
      !isDeepStrictEqual(saved.answeredAction.cursor, state.cursor)
    )
      throw new Error("The accepted answer checkpoint is incomplete.");
    entry.recoveredAnswer = {
      action: saved.answeredAction,
      answer: saved.answer,
      ...(saved.acceptedAt ? { acceptedAt: saved.acceptedAt } : {}),
      ...(saved.answerOperation ? { operation: saved.answerOperation } : {}),
    };
    validateSavedAnswer(saved.answeredAction, saved.answer);
  }
  if (saved.phase === "step_result") {
    if (!saved.result)
      throw new Error("The completed Step checkpoint is missing its result.");
    entry.savedResult = saved.result;
    if (saved.validatedRoute) entry.savedRoute = saved.validatedRoute;
    validateResult(entry);
  }
  const recoveryId =
    current.step.execution.kind === "code"
      ? current.step.execution.codeId
      : current.step.execution.recoveryCodeId;
  const recoverableInteraction =
    recoveryId !== undefined &&
    typeof options.codes[recoveryId]?.recover === "function";
  const uncertain =
    saved.phase === "executing" ||
    !!state.pendingAgentCall ||
    ((saved.phase === "waiting" || saved.phase === "answered") &&
      !recoverableInteraction);
  if (uncertain) {
    // Keep the original evidence on disk; expose a terminal diagnostic without executing anything.
    state.status = "failed";
    state.lastError = ERRORS.create("RUN_INTERRUPTED");
    delete state.pendingAction;
    delete state.pendingAgentCall;
  } else {
    await options.validateExecution?.(blueprint, state.execution);
  }

  return { entry, interrupted: uncertain };
}
