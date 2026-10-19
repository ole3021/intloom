import { ERRORS } from "../errors.ts";
import { failRun, type RunEntry } from "./run-entry.ts";

/** Logical cancellation publishes the terminal state immediately without waiting for or rolling back started external operations. */
export function cancelRun(entry: RunEntry, budgetReason?: string): void {
  if (entry.state.status === "completed" || entry.state.status === "failed")
    return;
  const error = ERRORS.create(
    "RUN_STOPPED",
    budgetReason
      ? { message: `Run stopped by execution limit (${budgetReason}).` }
      : {},
  );
  const reply = entry.reply;
  const call = entry.activeCall;

  delete entry.reply;
  delete entry.activeCall;
  try {
    failRun(entry, error);
  } finally {
    reply?.reject(error);

    // Cancellation still revokes the call when saving its terminal checkpoint fails.
    if (call instanceof AbortController) call.abort(error);
  }
}
