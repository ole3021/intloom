import type { LoomInput } from "@intloom/loom-sdk";
import type { RunExecution } from "./execution-policy.ts";
import type { Cursor } from "./cursor.ts";
import type { PendingUserAction, RunStatus } from "./run-view.ts";
import type { KernelError } from "../errors.ts";
import type { PendingAgentCall } from "../execution/delegated/contracts.ts";

/** Authoritative Run status, cursor, and pending action; excludes Stage business data and execution logs. */
export interface RunState {
  pauseRequested?: boolean;
  control?: import("../mirror/contracts.ts").MirrorControl;
  observation?: import("./run-observation.ts").RunObservationState;
  startedBy?: import("./contracts.ts").OperationRef | undefined;
  id: string;
  loomName: string;
  readonly execution: RunExecution;
  input: LoomInput;
  /** Terminal states retain the last cursor; status determines executability without an artificial final Step. */
  cursor: Cursor;
  status: RunStatus;
  pendingAction?: PendingUserAction;
  pendingAgentCall?: PendingAgentCall;
  lastError?: KernelError;
  createdAt: Date;
  updatedAt: Date;
}
