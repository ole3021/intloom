import type { Blueprint } from "@intloom/loom-sdk";
import { silentLogger, type Logger } from "@intloom/utils";
import type { PendingUserAction } from "./run-view.ts";
import type { ReadonlyJsonValue } from "@intloom/loom-sdk";
import type { KernelError } from "../errors.ts";
import {
  saveCheckpoint,
  type RunRecoveryControl,
} from "./recovery/checkpoint.ts";
import type { StepResult } from "@intloom/loom-sdk";
import { createStageState, type StageStateController } from "./stage-state.ts";
import type { RunState } from "./run-state.ts";

/** Validation precedes consumption; the returned delivery function resolves parsed answers without repeating validation. */
export interface ReplyContinuation {
  prepare(action: PendingUserAction, answer: ReadonlyJsonValue): () => void;
  reject(cause: unknown): void;
}

/** In-process execution control without duplicate status, cursor, pendingAction, or business values. */
export interface RunEntry {
  readonly logger: Logger;
  stageVisitId: number;
  executionCount: number;
  activeLog?: Logger;
  waitStartedAt?: number;
  waitDurationMs: number;
  readonly blueprint: Blueprint;
  readonly state: RunState;
  readonly stageState: StageStateController;
  readonly observers: Set<() => void>;
  task?: Promise<void>;
  activeCall?: import("./call-scope.ts").RuntimeCall;
  reply?: ReplyContinuation;
  recovery?: RunRecoveryControl;
  recoveredAnswer?: {
    action: PendingUserAction;
    answer: ReadonlyJsonValue;
    acceptedAt?: string;
    operation?: import("./contracts.ts").OperationRef;
  };
  savedResult?: StepResult;
  savedRoute?: import("./recovery/contracts.ts").CheckpointSnapshot["validatedRoute"];
  observationBaseline?: import("@intloom/loom-sdk").JsonValue;
  exitedStage?: import("./recovery/contracts.ts").SavedStage;
}

export function createRunEntry(
  blueprint: Blueprint,
  state: RunState,
  logger: Logger = silentLogger,
): RunEntry {
  const entry: RunEntry = {
    logger: logger.child({ runId: state.id }),
    stageVisitId: 0,
    executionCount: 0,
    waitDurationMs: 0,
    blueprint,
    state,
    stageState: createStageState(
      state,
      () => {
        if (entry.recovery) saveCheckpoint(entry, entry.recovery.phase);
      },
      !!blueprint.capability,
    ),
    observers: new Set(),
  };
  return entry;
}

export function notifyRunObservers(entry: RunEntry): void {
  for (const observe of entry.observers) {
    try {
      observe();
    } catch {
      entry.observers.delete(observe);
      entry.logger.warn("run_observer_failed");
    }
  }
}

/** The caller checks ownership first; late errors cannot overwrite terminal states. */
export function failRun(entry: RunEntry, error: KernelError): void {
  if (entry.recovery?.suspended) return;
  if (entry.state.status === "completed" || entry.state.status === "failed")
    return;
  entry.state.status = "failed";
  entry.state.lastError = error;
  delete entry.state.pendingAction;
  delete entry.state.pendingAgentCall;
  entry.state.updatedAt = new Date();
  if (error.code === "RUN_STOPPED") entry.logger.info("run_stopped");
  else entry.logger.error("run_failed", { errorCode: error.code });
  if (!entry.recovery?.error) saveCheckpoint(entry, "terminal");
  notifyRunObservers(entry);
}
