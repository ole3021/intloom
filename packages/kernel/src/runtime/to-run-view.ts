import { runFacts, isRunSettled } from "./run-facts.ts";
import { sampleRunObservation } from "./run-observation.ts";
import type { RunView } from "./run-view.ts";
import { assertRunState } from "./assert-run-state.ts";
import type { RunState } from "./run-state.ts";

/** Produces an independent snapshot; queries preserve authoritative state and timestamps and expose no internal Error or JSON references. */
export function toRunView(run: RunState): RunView {
  assertRunState(run);
  sampleRunObservation(run);
  return {
    ...(run.loomIdentity ? { loomIdentity: run.loomIdentity } : {}),
    ...(run.pauseRequested ? { pauseRequested: true } : {}),
    results: structuredClone(runFacts(run).results),
    settled: isRunSettled(run),
    ...(run.startedBy ? { startedBy: { ...run.startedBy } } : {}),
    ...(run.observation
      ? {
          serviceInstanceId: run.observation.serviceInstanceId,
          revision: run.observation.revision,
          metrics: structuredClone(run.observation.metrics),
          limits: structuredClone(run.observation.limits),
          activity: structuredClone(run.observation.activity),
          ...(run.observation.stopReason
            ? { stopReason: run.observation.stopReason }
            : {}),
        }
      : {}),
    ...(run.control ? { control: structuredClone(run.control) } : {}),
    ...(run.interactionReceipts
      ? { interactionReceipts: structuredClone(run.interactionReceipts) }
      : {}),
    runId: run.id,
    loomName: run.loomName,
    execution: { ...run.execution },
    cursor: { ...run.cursor },
    status: run.status,
    ...(run.status === "completed" && run.output !== undefined
      ? { output: structuredClone(run.output) }
      : {}),
    ...(run.pendingAgentCall === undefined
      ? {}
      : { pendingAgentCall: structuredClone(run.pendingAgentCall) }),
    ...(run.pendingAction === undefined
      ? {}
      : { pendingAction: structuredClone(run.pendingAction) }),
    ...(run.lastError === undefined
      ? {}
      : {
          lastError: {
            code: run.lastError.code,
            message: run.lastError.message,
            retryable: run.lastError.retryable,
          },
        }),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}
