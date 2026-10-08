import type { RunView } from "./run-view.ts";
import { assertRunState } from "./assert-run-state.ts";
import type { RunState } from "./run-state.ts";

/** Produces an independent snapshot; queries preserve authoritative state and timestamps and expose no internal Error or JSON references. */
export function toRunView(run: RunState): RunView {
  assertRunState(run);
  return {
    runId: run.id,
    flowName: run.flowName,
    execution: { ...run.execution },
    cursor: { ...run.cursor },
    status: run.status,
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
