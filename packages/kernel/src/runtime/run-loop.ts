import {
  captureBoundary,
  scopeEnded,
  validateResult,
} from "../mirror/runtime.ts";
import { sampleRunObservation } from "./run-observation.ts";
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
  if (entry.state.observation) entry.state.observation.inFlight++;
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
      if (entry.state.observation) {
        entry.state.observation.inFlight--;
        sampleRunObservation(entry.state);
      }
    });
  entry.task = task;
  // Handle background rejections immediately; the loop converts ordinary execution errors according to current call ownership.
  void task.catch(() => {});
}

async function enterStage(
  entry: RunEntry,
  stage: BlueprintStage,
  options: RuntimeOptions,
): Promise<boolean> {
  const control = entry.state.control;
  if (control && !control.stagePendingVisit) {
    control.stageVisitId++;
    control.stagePendingVisit = true;
    if (
      control.scope.kind === "stage" &&
      control.scope.stageVisitId === undefined
    )
      control.scope.stageVisitId = control.stageVisitId;
  }
  delete entry.exitedStage;
  saveCheckpoint(entry, "stage_pending");
  if (!(await captureBoundary(entry, options, "stage_before_init")))
    return false;
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
    if (control) delete control.stagePendingVisit;
    endCall(entry, call);
    return captureBoundary(entry, options, "stage_start");
  } catch (cause) {
    if (ownsCall(entry, call)) {
      log.error("stage_initialization_failed", { err: cause });
      failRun(entry, runtimeError(cause, "RUN_INITIALIZATION_FAILED"));
      endCall(entry, call);
      await captureBoundary(entry, options, "workflow_end");
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
  const control = entry.state.control;
  if (control?.capturePending) {
    const boundary = control.capturePending.boundary;
    if (
      !(await captureBoundary(
        entry,
        options,
        boundary.kind,
        boundary.stageName,
      ))
    )
      return;
    if (
      (boundary.kind === "step_after" || boundary.kind === "stage_end") &&
      scopeEnded(entry, boundary.kind)
    )
      return;
  }
  if (control && !control.boundary) {
    if (!(await captureBoundary(entry, options, "workflow_start"))) return;
  }
  if (entry.exitedStage) {
    entry.stageState.leave();
    delete entry.exitedStage;
  }
  const initial = resolveCurrentExecution(entry.blueprint, entry.state);
  if (
    initial.kind === "halt" ||
    (!entry.stageState.access &&
      !(await enterStage(entry, initial.stage, options)))
  )
    return;
  while (entry.state.status === "running") {
    const executed = resolveCurrentExecution(entry.blueprint, entry.state);
    if (executed.kind === "halt") return;
    if (!entry.savedResult) {
      if (control && !control.stepPendingVisit) {
        control.stepVisitId++;
        control.stepPendingVisit = true;
      }
      saveCheckpoint(entry, "step_ready");
      if (!(await captureBoundary(entry, options, "step_before"))) return;
    }
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
          options.observation
            ? options.observation.execute(
                entry,
                executed.step.execution.kind,
                executed.step.execution.kind === "agent"
                  ? executed.step.execution.agentId
                  : undefined,
                () => executeStep(options, entry, executed, call),
              )
            : executeStep(options, entry, executed, call),
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
      validateResult(entry);
      saveCheckpoint(entry, "step_result");
      endCall(entry, call);
      if (!(await captureBoundary(entry, options, "step_after"))) return;
      if (scopeEnded(entry, "step_after")) return;
      transition = applyStepResult(
        entry.blueprint,
        entry.state,
        executed,
        result,
      );
      if (control && transition.kind === "complete")
        control.scope.completed = true;
      delete entry.savedResult;
      delete entry.savedRoute;
      if (control) delete control.stepPendingVisit;
      if (transition.kind === "enter_stage" || transition.kind === "complete") {
        const state = entry.stageState.checkpoint();
        if (control && state)
          entry.exitedStage = {
            ...state,
            role: "exited",
            stageName: executed.stage.stageName,
            stageVisitId: control?.stageVisitId ?? 0,
            exists: "value" in state,
          };
      }
      if (!control && transition.kind === "enter_stage")
        entry.stageState.leave();
      saveCheckpoint(
        entry,
        transition.kind === "complete"
          ? "terminal"
          : transition.kind === "enter_stage"
            ? "stage_pending"
            : "step_ready",
      );
      if (transition.kind === "enter_stage" || transition.kind === "complete") {
        if (
          !(await captureBoundary(
            entry,
            options,
            "stage_end",
            executed.stage.stageName,
          ))
        )
          return;
        if (transition.kind === "enter_stage") entry.stageState.leave();
        if (scopeEnded(entry, "stage_end")) return;
        if (transition.kind === "enter_stage") delete entry.exitedStage;
      }
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
      if (
        ownsCall(entry, call) ||
        (entry.state.status === "running" && entry.savedResult)
      ) {
        log.error("step_failed", {
          err: runtimeError(cause),
          durationMs: Math.max(
            0,
            Math.round(performance.now() - started) -
              (entry.waitDurationMs - previousWaitMs),
          ),
        });
        failRun(entry, runtimeError(cause));
        endCall(entry, call);
        await captureBoundary(entry, options, "workflow_end");
      } else log.debug("late_error_ignored");
      return;
    } finally {
      endCall(entry, call);
      if (entry.activeLog === log) delete entry.activeLog;
    }
    notifyRunObservers(entry);
    if (transition.kind === "complete") {
      entry.logger.info("run_completed");
      await captureBoundary(entry, options, "workflow_end");
      return;
    }
    if (
      transition.kind === "enter_stage" &&
      !(await enterStage(entry, transition.stage, options))
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
