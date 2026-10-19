import type {
  AgentWaitHandle,
  PendingAgentCall,
} from "../execution/delegated/contracts.ts";
import type { RuntimeCall } from "./call-scope.ts";
import type { RunEntry } from "./run-entry.ts";
import { ERRORS } from "../errors.ts";
import { notifyRunObservers } from "./run-entry.ts";
import { saveCheckpoint } from "./recovery/checkpoint.ts";

export function beginAgentWait(
  entry: RunEntry,
  call: RuntimeCall,
  pending: PendingAgentCall,
): AgentWaitHandle {
  call.assertCurrent();
  if (
    entry.state.status !== "running" ||
    entry.reply ||
    entry.state.pendingAgentCall
  )
    throw ERRORS.create("RUN_STATE_INVALID");
  call.assertSettled();
  entry.state.pendingAgentCall = structuredClone(pending);
  entry.state.status = "waiting";
  entry.state.updatedAt = new Date();
  entry.waitStartedAt = performance.now();
  saveCheckpoint(entry, "waiting");
  notifyRunObservers(entry);
  return {
    claimed() {
      call.assertCurrent();
      if (entry.state.pendingAgentCall?.id !== pending.id)
        throw ERRORS.create("CONFLICT");
      entry.state.pendingAgentCall = { ...pending, phase: "claimed" };
      entry.state.updatedAt = new Date();
      saveCheckpoint(entry, "waiting");
      notifyRunObservers(entry);
    },
    finish() {
      call.assertCurrent();
      if (entry.state.pendingAgentCall?.id !== pending.id)
        throw ERRORS.create("CONFLICT");
      delete entry.state.pendingAgentCall;
      entry.state.status = "running";
      entry.state.updatedAt = new Date();
      saveCheckpoint(entry, "executing");
      entry.waitDurationMs +=
        entry.waitStartedAt === undefined
          ? 0
          : Math.round(performance.now() - entry.waitStartedAt);
      delete entry.waitStartedAt;
      notifyRunObservers(entry);
    },
  };
}
