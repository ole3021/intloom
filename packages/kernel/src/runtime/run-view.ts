import type { RunExecution } from "./execution-policy.ts";
import type { Cursor } from "../workflow/blueprint.ts";
import type { ReadonlyJsonValue } from "../shared/json.ts";
import type { PendingAgentCall } from "./agent-call-types.ts";

export type RunStatus = "running" | "waiting" | "completed" | "failed";

export type PendingUserActionKind =
  | "user_ask_questions"
  | "user_ask_confirmation";

/** Public shape of RunState's single pending action; business requests do not duplicate the cursor. */
export interface PendingUserAction {
  /** Generated for each new question, retained during presentation and reconnection, and submitted as actionId. */
  readonly id: string;
  readonly flowName: string;
  readonly cursor: Readonly<Cursor>;
  readonly kind: PendingUserActionKind;
  readonly request: ReadonlyJsonValue;
  readonly createdAt: string;
}

/** Projects only error fields safe to transmit across channels; cause and stack remain in process. */
export interface RunErrorView {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

/** A RunState snapshot, not an independent state record; timestamps are converted to ISO strings. */
export interface RunView {
  readonly runId: string;
  readonly flowName: string;
  readonly execution: RunExecution;

  /** The current cursor for running/waiting, or the last reached cursor for completed/failed. */
  readonly cursor: Readonly<Cursor>;
  readonly status: RunStatus;
  readonly pendingAction?: PendingUserAction;
  readonly pendingAgentCall?: PendingAgentCall;

  readonly lastError?: RunErrorView;

  readonly createdAt: string;
  readonly updatedAt: string;
}
