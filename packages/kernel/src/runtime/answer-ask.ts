import {
  interactionRequestSchema,
  interactionReceiptSchema,
} from "@intloom/loom-sdk";
import type { ReadonlyJsonValue } from "@intloom/loom-sdk";
import { getLogger } from "@intloom/utils";
import type { RunView } from "./run-view.ts";
import { toRunView } from "./to-run-view.ts";
import { ERRORS } from "../errors.ts";
import { assertRunState } from "./assert-run-state.ts";
import { failRun, notifyRunObservers, type RunEntry } from "./run-entry.ts";
import { ownsCall } from "./call-scope.ts";
import { saveCheckpoint } from "./recovery/checkpoint.ts";

/** Validates and consumes synchronously; observing the continuation belongs to Operations. */
export function submitAnswer(
  entry: RunEntry,
  actionId: string,
  answer: ReadonlyJsonValue,
  operation?: import("./contracts.ts").OperationRef,
  effect: () => void = () => {},
): RunView {
  if (typeof actionId !== "string" || !actionId.trim())
    throw ERRORS.create("INVALID_REQUEST", {
      message: "An answer must identify its pending action.",
    });
  const action = entry.state.pendingAction;
  if (entry.state.status !== "waiting" || action?.id !== actionId)
    throw conflict();
  assertRunState(entry.state);
  const reply = entry.reply;
  const call = entry.activeCall;
  if (!reply || !call) {
    effect();
    const error = ERRORS.create("RUN_STATE_INVALID", {
      message: "A waiting Run must retain its original execution and reply.",
    });
    delete entry.reply;
    delete entry.activeCall;
    failRun(entry, error);
    reply?.reject(error);
    throw ERRORS.wrap("KERNEL_UNAVAILABLE", error);
  }
  let deliver: () => void;
  try {
    deliver = reply.prepare(action, answer);
  } catch (cause) {
    throw ERRORS.wrap("INVALID_REQUEST", cause, {
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

  effect();
  entry.recoveredAnswer = {
    action,
    answer: structuredClone(answer),
    acceptedAt: new Date().toISOString(),
    ...(operation ? { operation } : {}),
  };
  if (action.kind === "user_ask_interaction") {
    const host = entry.state.hostContext;
    entry.state.interactionReceipts ??= [];
    entry.state.interactionReceipts.push(
      interactionReceiptSchema.parse({
        id: action.id,
        runId: entry.state.id,
        request: interactionRequestSchema.parse(
          structuredClone(action.request),
        ),
        answer: structuredClone(answer),
        acceptedAt:
          entry.recoveredAnswer.acceptedAt ?? new Date().toISOString(),
        actor: {
          userId: host?.userId ?? "local",
          source: host?.answerSource ?? "human",
        },
      }),
    );
  }
  delete entry.state.pendingAction;
  delete entry.reply;
  entry.state.status = "running";
  entry.state.updatedAt = new Date();
  try {
    saveCheckpoint(entry, "answered");
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
  // Notify admission before delivering the answer to the original Promise.
  notifyRunObservers(entry);
  queueMicrotask(() => {
    if (!ownsCall(entry, call)) {
      reply.reject(
        call.signal.reason ?? ERRORS.create("EXECUTION_OWNERSHIP_LOST"),
      );
      return;
    }
    try {
      saveCheckpoint(entry, "executing");
      deliver();
    } catch (cause) {
      reply.reject(cause);
      call.abort(cause);
    }
  });
  return toRunView(entry.state);
}

function conflict() {
  return ERRORS.create("CONFLICT", {
    message: "The action is no longer the Run's current unanswered action.",
  });
}
