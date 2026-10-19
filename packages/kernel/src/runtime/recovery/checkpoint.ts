import { runFacts } from "../run-facts.ts";
import { checkpointSnapshotSchema } from "./contracts.ts";
import { jsonCopy } from "../../shared/json.ts";
import type { RunEntry } from "../run-entry.ts";
import { ERRORS } from "../../errors.ts";
import type { CheckpointPhase, RunCheckpointStore } from "./contracts.ts";

export interface RunRecoveryControl {
  readonly store: RunCheckpointStore;
  readonly loomIdentity: string;
  readonly sourceLoomIdentity?: string;
  phase: CheckpointPhase;
  error?: Error;
  suspended?: boolean;
}

export function checkpointData(
  entry: RunEntry,
  phase: CheckpointPhase,
): import("./contracts.ts").CheckpointSnapshot {
  const state = entry.state;
  const stage = entry.exitedStage ?? entry.stageState.checkpoint();
  return checkpointSnapshotSchema.parse(
    jsonCopy({
      version: 3,
      schemaVersion: 3,
      loomIdentity: entry.recovery?.loomIdentity ?? "untracked",
      ...(entry.recovery?.sourceLoomIdentity
        ? { sourceLoomIdentity: entry.recovery.sourceLoomIdentity }
        : {}),
      stageVisitId: entry.stageVisitId,
      ...(entry.state.pauseRequested ? { pauseRequested: true } : {}),
      ...(entry.activeCall ? { callId: entry.activeCall.callId } : {}),
      phase,
      run: {
        results: runFacts(state).results,
        ...(state.startedBy ? { startedBy: state.startedBy } : {}),
        id: state.id,
        loomName: state.loomName,
        execution: state.execution,
        input: state.input,
        cursor: { ...state.cursor },
        status: state.status,
        ...(state.pendingAction ? { pendingAction: state.pendingAction } : {}),
        ...(state.pendingAgentCall
          ? { pendingAgentCall: state.pendingAgentCall }
          : {}),
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
      ...(stage
        ? {
            stage: {
              ...stage,
              stageName: stage.stageName ?? state.cursor.stageName,
              stageVisitId:
                stage.stageVisitId ?? state.control?.stageVisitId ?? 0,
              role: stage.role ?? "current",
              exists: stage.exists ?? "value" in stage,
            },
          }
        : {}),
      ...(entry.observationBaseline
        ? { observationBaseline: entry.observationBaseline }
        : {}),
      ...(state.control ? { control: structuredClone(state.control) } : {}),
      ...(entry.savedRoute ? { validatedRoute: entry.savedRoute } : {}),
      ...(entry.recoveredAnswer
        ? {
            ...(entry.recoveredAnswer.acceptedAt
              ? { acceptedAt: entry.recoveredAnswer.acceptedAt }
              : {}),
            ...(entry.recoveredAnswer.operation
              ? { answerOperation: entry.recoveredAnswer.operation }
              : {}),
            answer: entry.recoveredAnswer.answer,
            answeredAction: entry.recoveredAnswer.action,
          }
        : {}),
      ...(entry.savedResult ? { result: entry.savedResult } : {}),
    }),
  );
}

export function saveCheckpoint(entry: RunEntry, phase: CheckpointPhase): void {
  const recovery = entry.recovery;
  if (!recovery || recovery.suspended) return;
  if (recovery.error) throw recovery.error;
  recovery.phase = phase;
  const state = entry.state;
  try {
    recovery.store.write(checkpointData(entry, phase));
  } catch (cause) {
    const error = ERRORS.wrap("RUN_CHECKPOINT_FAILED", cause);
    recovery.error = error;
    state.status = "failed";
    state.lastError = error;
    delete state.pendingAction;
    delete state.pendingAgentCall;
    const call = entry.activeCall;
    const reply = entry.reply;

    delete entry.activeCall;
    delete entry.reply;

    reply?.reject(error);

    call?.abort(error);
    for (const observe of entry.observers) {
      try {
        observe();
      } catch {
        entry.observers.delete(observe);
      }
    }
    throw error;
  }
}
