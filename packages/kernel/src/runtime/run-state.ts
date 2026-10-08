import type { RunExecution } from "./execution-policy.ts";
import type { Cursor } from "../workflow/blueprint.ts";
import type { PendingUserAction, RunStatus } from "./run-view.ts";
import type { RuntimeError } from "../errors/runtime.ts";
import type { PendingAgentCall } from "./agent-call-types.ts";

/** Authoritative Run status, cursor, and pending action; excludes Stage business data and execution logs. */
export interface RunState {
  id: string;
  flowName: string;
  readonly execution: RunExecution;
  intent: string;
  /** Terminal states retain the last cursor; status determines executability without an artificial final Step. */
  cursor: Cursor;
  status: RunStatus;
  pendingAction?: PendingUserAction;
  pendingAgentCall?: PendingAgentCall;
  lastError?: RuntimeError;
  createdAt: Date;
  updatedAt: Date;
}
