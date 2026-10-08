import type { Blueprint } from "../workflow/blueprint.ts";
import { silentLogger, type Logger } from "@intloom/utils";
import type { PendingUserAction, RunView } from "./run-view.ts";
import type { ReadonlyJsonValue } from "../shared/json.ts";
import type { RuntimeError } from "../errors/runtime.ts";
import {
  saveCheckpoint,
  type RunRecoveryControl,
} from "./recovery/checkpoint.ts";
import type { StepResult } from "../effector/execution.ts";
import { createStageState, type StageStateController } from "./stage-state.ts";
import { toRunView } from "./to-run-view.ts";
import type { RunState } from "./run-state.ts";
import type { AgentCallControl, AgentCompletionReceipt } from "./agent-call.ts";

/** Validation precedes consumption; the returned delivery function resolves parsed answers without repeating validation. */
export interface ReplyContinuation {
  prepare(action: PendingUserAction, answer: ReadonlyJsonValue): () => void;
  reject(cause: unknown): void;
}

/** In-process execution control without duplicate status, cursor, pendingAction, or business values. */
export interface RunEntry {
  readonly logger: Logger;
  executionCount: number;
  activeLog?: Logger;
  waitStartedAt?: number;
  waitDurationMs: number;
  readonly blueprint: Blueprint;
  readonly state: RunState;
  readonly stageState: StageStateController;
  readonly observers: Set<() => void>;
  task?: Promise<void>;
  activeCall?: AbortController;
  reply?: ReplyContinuation;
  recovery?: RunRecoveryControl;
  recoveredAnswer?: { action: PendingUserAction; answer: ReadonlyJsonValue };
  savedResult?: StepResult;
  agentCall?: AgentCallControl;
  agentReceipt?: AgentCompletionReceipt;
}

export function createRunEntry(
  blueprint: Blueprint,
  state: RunState,
  logger: Logger = silentLogger,
): RunEntry {
  const entry: RunEntry = {
    logger: logger.child({ runId: state.id }),
    executionCount: 0,
    waitDurationMs: 0,
    blueprint,
    state,
    stageState: createStageState(state, () => {
      if (entry.recovery) saveCheckpoint(entry, entry.recovery.phase);
    }),
    observers: new Set(),
  };
  return entry;
}

/** Requests and execution tasks complete independently; check immediately after subscribing to catch an existing stable state. */
export function waitUntilStable(entry: RunEntry): Promise<RunView> {
  return new Promise((resolve, reject) => {
    const observe = () => {
      if (entry.state.status === "running") return;
      entry.observers.delete(observe);
      try {
        resolve(toRunView(entry.state));
      } catch (cause) {
        reject(cause);
      }
    };
    entry.observers.add(observe);
    observe();
  });
}

export function notifyRunObservers(entry: RunEntry): void {
  for (const observe of entry.observers) observe();
}

/** The caller checks ownership first; late errors cannot overwrite terminal states. */
export function failRun(entry: RunEntry, error: RuntimeError): void {
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
