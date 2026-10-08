import { cursorSchema } from "../workflow/schemas/cursor.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { pendingUserActionSchema } from "./schemas/pending-user-action.ts";
import type { RunState } from "./run-state.ts";
import * as z from "zod";

const pendingAgentCallSchema = z.strictObject({
  id: z.string().min(1),
  agentId: z.string().min(1),
  phase: z.enum(["available", "claimed"]),
  createdAt: z.iso.datetime(),
});

/** Checks authoritative state invariants; resolveCurrentExecution validates Cursor references into the Blueprint. */
export function assertRunState(run: Readonly<RunState>): void {
  if (!cursorSchema.safeParse(run.cursor).success) {
    invalid("Run cursor must contain stageName and stepName.");
  }
  if (
    !(run.createdAt instanceof Date) ||
    !Number.isFinite(run.createdAt.getTime()) ||
    !(run.updatedAt instanceof Date) ||
    !Number.isFinite(run.updatedAt.getTime())
  ) {
    invalid("Run timestamps must be valid Dates.");
  }

  switch (run.status) {
    case "waiting": {
      if (run.pendingAgentCall !== undefined) {
        if (
          run.pendingAction !== undefined ||
          run.execution.agentExecutor !== "mcp_client" ||
          run.execution.source !== "agent_ide" ||
          !pendingAgentCallSchema.safeParse(run.pendingAgentCall).success
        )
          invalid(
            "A client Agent wait must contain exactly one valid Agent call.",
          );
        break;
      }
      const action = run.pendingAction;
      if (!action || !pendingUserActionSchema.safeParse(action).success) {
        invalid("A waiting Run must have one valid pending action.");
      }
      if (
        action.flowName !== run.flowName ||
        action.cursor.stageName !== run.cursor.stageName ||
        action.cursor.stepName !== run.cursor.stepName
      ) {
        invalid(
          "The pending action must belong to the current Workflow and cursor.",
        );
      }
      break;
    }
    case "running":
    case "completed":
    case "failed":
      if (
        run.pendingAction !== undefined ||
        run.pendingAgentCall !== undefined
      ) {
        invalid("Only a waiting Run may keep a pending action.");
      }
      break;
    default:
      invalid("Unknown Run status.");
  }

  if (run.status === "failed") {
    if (!RUNTIME_ERRORS.is(run.lastError)) {
      invalid("A failed Run must have a Runtime error.");
    }
  } else if (run.lastError !== undefined) {
    invalid("Only a failed Run may keep an error.");
  }
}

function invalid(message: string): never {
  throw RUNTIME_ERRORS.create("RUN_STATE_INVALID", { message });
}
