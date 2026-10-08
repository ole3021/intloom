import type { RunEntry } from "../run-entry.ts";
import { RUNTIME_ERRORS } from "../../errors/runtime.ts";
import type { CheckpointPhase, RunCheckpointStore } from "./store.ts";

export interface RunRecoveryControl {
  readonly store: RunCheckpointStore;
  readonly workflowIdentity: string;
  phase: CheckpointPhase;
  error?: Error;
  suspended?: boolean;
}

export function saveCheckpoint(entry: RunEntry, phase: CheckpointPhase): void {
  const recovery = entry.recovery;
  if (!recovery || recovery.suspended) return;
  if (recovery.error) throw recovery.error;
  recovery.phase = phase;
  const state = entry.state;
  try {
    recovery.store.write({
      version: 1,
      workflowIdentity: recovery.workflowIdentity,
      phase,
      run: {
        ...state,
        createdAt: state.createdAt.toISOString(),
        updatedAt: state.updatedAt.toISOString(),
        ...(state.lastError
          ? {
              lastError: {
                code: state.lastError.code,
                message: state.lastError.message,
                retryable: state.lastError.retryable,
              },
            }
          : {}),
      },
      ...(entry.stageState.checkpoint()
        ? { stage: entry.stageState.checkpoint() }
        : {}),
      ...(entry.recoveredAnswer
        ? {
            answer: entry.recoveredAnswer.answer,
            answeredAction: entry.recoveredAnswer.action,
          }
        : {}),
      ...(entry.savedResult ? { result: entry.savedResult } : {}),
    });
  } catch (cause) {
    const error = RUNTIME_ERRORS.wrap("RUN_CHECKPOINT_FAILED", cause);
    recovery.error = error;
    state.status = "failed";
    state.lastError = error;
    delete state.pendingAction;
    delete state.pendingAgentCall;
    const call = entry.activeCall;
    const reply = entry.reply;
    const agent = entry.agentCall;
    delete entry.activeCall;
    delete entry.reply;
    delete entry.agentCall;
    reply?.reject(error);
    agent?.reject(error);
    call?.abort(error);
    for (const observe of entry.observers) observe();
    throw error;
  }
}
