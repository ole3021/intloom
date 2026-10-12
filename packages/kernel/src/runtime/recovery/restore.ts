import { jsonCopy } from "../../mirror/contracts.ts";
import { validateResult } from "../../mirror/runtime.ts";
import { isDeepStrictEqual } from "node:util";
import { silentLogger } from "@intloom/utils";
import type { RuntimeOptions } from "../contracts.ts";
import { createRunEntry, failRun, type RunEntry } from "../run-entry.ts";
import { RUNTIME_ERRORS } from "../../errors/runtime.ts";
import type { RunState } from "../run-state.ts";
import { KERNEL_ERRORS } from "../../errors/kernel.ts";
import { freezeRunExecution } from "../execution-policy.ts";
import { assertRunState } from "../assert-run-state.ts";
import { resolveCursor } from "../resolve-current-execution.ts";
import { beginCall, endCall } from "../call-scope.ts";
import {
  restoreInteraction,
  validateSavedAction,
  validateSavedAnswer,
} from "../interaction.ts";
import { launchRunLoop } from "../run-loop.ts";

/** Validate every recovery copy before any restored business execution starts. */
export async function restoreRuns(
  options: RuntimeOptions,
): Promise<RunEntry[]> {
  if (!options.recovery) return [];
  const { store, blueprints, workflowIdentities } = options.recovery;
  const entries: RunEntry[] = [];
  for (const saved of store.read()) {
    if (saved.phase === "terminal") continue;
    const blueprint = blueprints[saved.run.flowName];
    if (
      !blueprint ||
      (!saved.control?.sourceMirrorId &&
        workflowIdentities[saved.run.flowName] !== saved.workflowIdentity)
    )
      throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE", {
        message: `Cannot restore Run ${saved.run.id}: its exact Workflow resources are unavailable. Recovery files were retained.`,
      });
    const { lastError, pendingAction, pendingAgentCall, ...data } = saved.run;
    if (lastError)
      throw new Error("Nonterminal checkpoint contains a terminal error.");
    const state: RunState = {
      ...data,
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
      !(state.status === "paused" && saved.control)
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
    if (saved.observationBaseline)
      entry.observationBaseline = saved.observationBaseline;
    entry.recovery = {
      store,
      workflowIdentity: saved.control?.sourceMirrorId
        ? (workflowIdentities[saved.run.flowName] ?? saved.workflowIdentity)
        : saved.workflowIdentity,
      ...(saved.control?.sourceMirrorId
        ? {
            sourceWorkflowIdentity:
              saved.sourceWorkflowIdentity ?? saved.workflowIdentity,
          }
        : {}),
      phase: saved.phase,
    };
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
        saved.answeredAction.flowName !== state.flowName ||
        !isDeepStrictEqual(saved.answeredAction.cursor, state.cursor)
      )
        throw new Error("The accepted answer checkpoint is incomplete.");
      entry.recoveredAnswer = {
        action: saved.answeredAction,
        answer: saved.answer,
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
    const recoverableInteraction =
      current.step.execution.kind === "code" &&
      typeof options.codes[current.step.execution.codeId]?.recover ===
        "function";
    const uncertain =
      saved.phase === "executing" ||
      !!state.pendingAgentCall ||
      ((saved.phase === "waiting" || saved.phase === "answered") &&
        !recoverableInteraction);
    if (uncertain) {
      // Keep the original evidence on disk; expose a terminal diagnostic without executing anything.
      entry.recovery.suspended = true;
      state.status = "failed";
      state.lastError = RUNTIME_ERRORS.create("RUN_INTERRUPTED");
      delete state.pendingAction;
      delete state.pendingAgentCall;
    } else if (options.prepareExecution) {
      const execution = await options.prepareExecution(
        blueprint,
        state.execution.source,
      );
      if (!isDeepStrictEqual(execution, state.execution))
        throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE", {
          message: `Run ${state.id} cannot change its saved executor during recovery.`,
        });
    }
    entries.push(entry);
  }
  return entries;
}

export function startRecoveredRun(entry: RunEntry, options: RuntimeOptions) {
  if (entry.state.status === "failed" || entry.state.status === "paused")
    return;
  if (entry.state.status === "waiting") {
    const call = beginCall(entry);
    restoreInteraction(entry, () => {
      endCall(entry, call);
      launchRunLoop(entry, options);
    });
  } else launchRunLoop(entry, options);
}

/** Host shutdown keeps checkpoints; explicit cancelRun remains a terminal cancellation. */
export function suspendRun(entry: RunEntry): void {
  if (entry.state.status === "paused") return;
  if (!entry.recovery) {
    failRun(entry, RUNTIME_ERRORS.create("RUN_STOPPED"));
  } else entry.recovery.suspended = true;
  const call = entry.activeCall;
  if (call) endCall(entry, call);
  const error = RUNTIME_ERRORS.create("RUN_INTERRUPTED");
  entry.state.status = "failed";
  entry.state.lastError = error;
  delete entry.state.pendingAction;
  delete entry.state.pendingAgentCall;
  for (const observe of entry.observers) observe();
}
