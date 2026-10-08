import type { ReadonlyJsonValue } from "../shared/json.ts";
import { getLogger } from "@intloom/utils";
import type { RunView } from "./run-view.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import { assertRunState } from "./assert-run-state.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import {
  failRun,
  notifyRunObservers,
  type RunEntry,
  waitUntilStable,
} from "./run-entry.ts";
import { ownsCall } from "./call-scope.ts";
import { saveCheckpoint } from "./recovery/checkpoint.ts";

/** Validates and consumes synchronously; only the first valid submission for an action is delivered. */
export function answerAsk(
  entry: RunEntry,
  actionId: string,
  answer: ReadonlyJsonValue,
): Promise<RunView> {
  if (typeof actionId !== "string" || !actionId.trim())
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "An answer must identify its pending action.",
    });
  const action = entry.state.pendingAction;
  if (entry.state.status !== "waiting" || action?.id !== actionId)
    throw conflict();
  assertRunState(entry.state);
  const reply = entry.reply;
  const call = entry.activeCall;
  if (!reply || !call) {
    const error = RUNTIME_ERRORS.create("RUN_STATE_INVALID", {
      message: "A waiting Run must retain its original execution and reply.",
    });
    delete entry.reply;
    delete entry.activeCall;
    failRun(entry, error);
    reply?.reject(error);
    throw KERNEL_ERRORS.wrap("KERNEL_UNAVAILABLE", error);
  }
  let deliver: () => void;
  try {
    deliver = reply.prepare(action, answer);
  } catch (cause) {
    throw KERNEL_ERRORS.wrap("INVALID_REQUEST", cause, {
      message: "The answer does not satisfy the pending request.",
    });
  }
  // Synchronous parsing may invoke caller getters; recheck before submission to prevent reentrant consumption or stopping.
  if (
    !ownsCall(entry, call) ||
    entry.state.status !== "waiting" ||
    entry.state.pendingAction !== action ||
    entry.reply !== reply
  )
    throw conflict();

  entry.recoveredAnswer = { action, answer: structuredClone(answer) };
  delete entry.state.pendingAction;
  delete entry.reply;
  entry.state.status = "running";
  entry.state.updatedAt = new Date();
  try {
    saveCheckpoint(entry, "answered");
    saveCheckpoint(entry, "executing");
  } catch (cause) {
    delete entry.activeCall;
    reply.reject(cause);
    call.abort(cause);
    throw cause;
  }
  const waitDurationMs =
    entry.waitStartedAt === undefined
      ? 0
      : Math.round(performance.now() - entry.waitStartedAt);
  entry.waitDurationMs += waitDurationMs;
  delete entry.waitStartedAt;
  getLogger().debug("answer_accepted", { runId: entry.state.id, actionId });
  (entry.activeLog ?? entry.logger).info("run_resumed", {
    actionId,
    waitDurationMs,
  });
  // Leave the old waiting state, subscribe to the next stable state, then deliver the answer to the original Promise.
  const stable = waitUntilStable(entry);
  notifyRunObservers(entry);
  deliver();
  return stable;
}

function conflict() {
  return KERNEL_ERRORS.create("CONFLICT", {
    message: "The action is no longer the Run's current unanswered action.",
  });
}
