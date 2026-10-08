import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { failRun, type RunEntry } from "./run-entry.ts";

/** Logical cancellation publishes the terminal state immediately without waiting for or rolling back started external operations. */
export function cancelRun(entry: RunEntry): void {
  if (entry.state.status === "completed" || entry.state.status === "failed")
    return;
  const error = RUNTIME_ERRORS.create("RUN_STOPPED");
  const reply = entry.reply;
  const call = entry.activeCall;
  const agent = entry.agentCall;
  delete entry.agentCall;
  delete entry.agentReceipt;
  delete entry.reply;
  delete entry.activeCall;
  try {
    failRun(entry, error);
  } finally {
    reply?.reject(error);
    agent?.reject(error);
    // Cancellation still revokes the call when saving its terminal checkpoint fails.
    if (call instanceof AbortController) call.abort(error);
  }
}
