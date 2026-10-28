import { validateRecovery } from "./validate.ts";
import type { RuntimeOptions } from "../contracts.ts";
import { failRun, type RunEntry } from "../run-entry.ts";
import { ERRORS } from "../../errors.ts";
import { beginCall, endCall } from "../call-scope.ts";
import { restoreInteraction } from "../interaction.ts";
import { launchRunLoop } from "../run-loop.ts";

/** Validate every recovery copy before any restored business execution starts. */
export async function restoreRuns(
  options: RuntimeOptions,
): Promise<RunEntry[]> {
  if (!options.recovery) return [];
  const { store, blueprints, loomIdentities } = options.recovery;
  const entries: RunEntry[] = [];
  for (const saved of store.read()) {
    if (saved.phase === "terminal") continue;
    const { entry, interrupted } = await validateRecovery(saved, {
      codes: options.codes,
      ...(options.logger ? { logger: options.logger } : {}),
      ...(options.validateExecution
        ? { validateExecution: options.validateExecution }
        : {}),
      blueprints,
      loomIdentities,
    });
    entry.recovery = {
      store,
      loomIdentity: saved.control?.sourceMirrorId
        ? (loomIdentities[saved.run.loomName] ?? saved.loomIdentity)
        : saved.loomIdentity,
      ...(saved.control?.sourceMirrorId
        ? {
            sourceLoomIdentity: saved.sourceLoomIdentity ?? saved.loomIdentity,
          }
        : {}),
      phase: saved.phase,
    };
    if (interrupted) entry.recovery.suspended = true;
    entry.state.loomIdentity = entry.recovery.loomIdentity;
    entries.push(entry);
  }
  return entries;
}

export function startRecoveredRun(entry: RunEntry, options: RuntimeOptions) {
  if (entry.state.status === "failed" || entry.state.status === "paused")
    return;
  if (entry.state.status === "waiting") {
    const call = beginCall(entry);
    restoreInteraction(entry, () => {
      endCall(entry, call);
      launchRunLoop(entry, options);
    });
  } else launchRunLoop(entry, options);
}

/** Host shutdown keeps checkpoints; explicit cancelRun remains a terminal cancellation. */
export function suspendRun(entry: RunEntry): void {
  if (entry.state.status === "paused") return;
  if (!entry.recovery) {
    failRun(entry, ERRORS.create("RUN_STOPPED"));
  } else entry.recovery.suspended = true;
  const call = entry.activeCall;
  if (call) endCall(entry, call);
  const error = ERRORS.create("RUN_INTERRUPTED");
  entry.state.status = "failed";
  entry.state.lastError = error;
  delete entry.state.pendingAction;
  delete entry.state.pendingAgentCall;
  for (const observe of entry.observers) observe();
}
