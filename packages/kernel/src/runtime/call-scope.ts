import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import type { RunEntry } from "./run-entry.ts";

export function ownsCall(entry: RunEntry, call: object): boolean {
  return (
    entry.activeCall === call &&
    (entry.state.status === "running" || entry.state.status === "waiting")
  );
}

export function assertCallOwnership(entry: RunEntry, call: object): void {
  if (!ownsCall(entry, call))
    throw RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST");
}

export function beginCall(entry: RunEntry): AbortController {
  if (entry.activeCall) throw RUNTIME_ERRORS.create("RUN_STATE_INVALID");
  const call = new AbortController();
  entry.activeCall = call;
  return call;
}

export function endCall(entry: RunEntry, call: object): void {
  if (entry.activeCall !== call) {
    if (call instanceof AbortController)
      call.abort(RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
    return;
  }
  delete entry.activeCall;
  const agent = entry.agentCall;
  delete entry.agentCall;
  agent?.reject(RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
  const reply = entry.reply;
  delete entry.reply;
  reply?.reject(RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
  if (call instanceof AbortController)
    call.abort(RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
}
