import { setImmediate } from "node:timers/promises";
import { withLogger } from "@intloom/utils";
import type { BlueprintStage } from "../workflow/blueprint.ts";
import { applyStepResult } from "./apply-step-result.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { executeStep } from "./execute-step.ts";
import {
  assertCallOwnership,
  beginCall,
  endCall,
  ownsCall,
} from "./call-scope.ts";
import { failRun, notifyRunObservers, type RunEntry } from "./run-entry.ts";
import { resolveCurrentExecution } from "./resolve-current-execution.ts";
import type { RuntimeOptions } from "./contracts.ts";
import type { Transition } from "./routing.ts";
import { saveCheckpoint } from "./recovery/checkpoint.ts";

/** The task owns the entire loop; API observers return independently through notifications without awaiting the task. */
export function launchRunLoop(entry: RunEntry, options: RuntimeOptions): void {
  if (entry.task) throw RUNTIME_ERRORS.create("RUN_STATE_INVALID");
  const task = Promise.resolve()
    .then(() => runLoop(entry, options))
    .catch((cause) => {
      if (entry.task === task) {
        entry.logger.error("execution_failed", { err: cause });
        failRun(entry, runtimeError(cause));
      }
    })
    .finally(() => {
      if (entry.task === task) delete entry.task;
    });
  entry.task = task;
  // Handle background rejections immediately; the loop converts ordinary execution errors according to current call ownership.
  void task.catch(() => {});
}

async function enterStage(
  entry: RunEntry,
  stage: BlueprintStage,
): Promise<boolean> {
  const call = beginCall(entry);
  const log = entry.logger.child({ stageName: stage.stageName });
  const started = performance.now();
  log.info("stage_started");
  try {
    saveCheckpoint(entry, "executing");
    log.assertHealthy();
    assertCallOwnership(entry, call);
    await withLogger(log, () =>
      entry.stageState.enter(stage, () => assertCallOwnership(entry, call)),
    );
    assertCallOwnership(entry, call);
    saveCheckpoint(entry, "step_ready");
    log.debug("stage_initialized", {
      durationMs: Math.round(performance.now() - started),
    });
    return true;
  } catch (cause) {
    if (ownsCall(entry, call)) {
      log.error("stage_initialization_failed", { err: cause });
      failRun(entry, runtimeError(cause, "RUN_INITIALIZATION_FAILED"));
    }
    return false;
  } finally {
    endCall(entry, call);
  }
}

async function runLoop(
  entry: RunEntry,
  options: RuntimeOptions,
): Promise<void> {
  const initial = resolveCurrentExecution(entry.blueprint, entry.state);
  if (
    initial.kind === "halt" ||
    (!entry.stageState.access && !(await enterStage(entry, initial.stage)))
  )
    return;
  while (entry.state.status === "running") {
    const executed = resolveCurrentExecution(entry.blueprint, entry.state);
    if (executed.kind === "halt") return;
    const call = beginCall(entry);
    const log = entry.logger.child({
      ...entry.state.cursor,
      executionId: ++entry.executionCount,
    });
    entry.activeLog = log;
    const started = performance.now();
    const previousWaitMs = entry.waitDurationMs;
    log.info("step_started", { kind: executed.step.execution.kind });
    let transition: Transition;
    try {
      log.assertHealthy();
      assertCallOwnership(entry, call);
      let result = entry.savedResult;
      if (!result) {
        saveCheckpoint(entry, "executing");
        result = await withLogger(log, () =>
          executeStep(options, entry, executed, call),
        );
      }
      if (!ownsCall(entry, call)) {
        log.debug("late_result_ignored");
        return;
      }
      // Code must await interaction; returning an outcome while an action is pending violates the protocol.
      if (hasPendingInteraction(entry))
        throw RUNTIME_ERRORS.create("STEP_INTERACTION_INVALID");
      entry.savedResult = result;
      delete entry.recoveredAnswer;
      saveCheckpoint(entry, "step_result");
      transition = applyStepResult(
        entry.blueprint,
        entry.state,
        executed,
        result,
      );
      delete entry.savedResult;
      if (transition.kind === "enter_stage") entry.stageState.leave();
      saveCheckpoint(
        entry,
        transition.kind === "complete"
          ? "terminal"
          : transition.kind === "enter_stage"
            ? "stage_pending"
            : "step_ready",
      );
      log.info("step_completed", {
        durationMs: Math.max(
          0,
          Math.round(performance.now() - started) -
            (entry.waitDurationMs - previousWaitMs),
        ),
        outcome: result.outcome,
      });
      if (transition.kind !== "complete")
        log.debug("step_routed", {
          nextStage: entry.state.cursor.stageName,
          nextStep: entry.state.cursor.stepName,
        });
    } catch (cause) {
      if (ownsCall(entry, call)) {
        log.error("step_failed", {
          err: runtimeError(cause),
          durationMs: Math.max(
            0,
            Math.round(performance.now() - started) -
              (entry.waitDurationMs - previousWaitMs),
          ),
        });
        failRun(entry, runtimeError(cause));
      } else log.debug("late_error_ignored");
      return;
    } finally {
      endCall(entry, call);
      if (entry.activeLog === log) delete entry.activeLog;
    }
    notifyRunObservers(entry);
    if (transition.kind === "complete") {
      entry.logger.info("run_completed");
      return;
    }
    if (
      transition.kind === "enter_stage" &&
      !(await enterStage(entry, transition.stage))
    )
      return;
    // Yield even for synchronous Code loops so queries and cancellation can run.
    await setImmediate();
  }
}

function hasPendingInteraction(entry: RunEntry): boolean {
  return entry.state.status === "waiting" || entry.reply !== undefined;
}

function runtimeError(
  cause: unknown,
  code:
    | "STEP_EXECUTION_FAILED"
    | "RUN_INITIALIZATION_FAILED" = "STEP_EXECUTION_FAILED",
) {
  return RUNTIME_ERRORS.is(cause) ? cause : RUNTIME_ERRORS.wrap(code, cause);
}
