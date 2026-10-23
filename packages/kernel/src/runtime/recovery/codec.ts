import * as z from "zod";
import { ERRORS } from "../../errors.ts";
import {
  checkpointSnapshotSchema,
  type CheckpointSnapshot,
} from "./contracts.ts";
import { pendingUserActionSchema } from "../schemas/pending-user-action.ts";

const operation = z.strictObject({
  serviceInstanceId: z.uuid(),
  operationId: z.uuid(),
});
const boundarySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.enum(["stage_pending", "step_ready", "step_result", "terminal"]),
  }),
  z.strictObject({ kind: z.literal("executing"), callId: z.string().min(1) }),
  z.strictObject({
    kind: z.literal("user_waiting"),
    callId: z.string().min(1),
    action: pendingUserActionSchema,
  }),
  z.strictObject({
    kind: z.literal("answer_ready"),
    callId: z.string().min(1),
    action: pendingUserActionSchema,
    accepted: z.strictObject({
      answer: z.json(),
      acceptedAt: z.iso.datetime(),
      operation: operation.optional(),
    }),
  }),
  z.strictObject({
    kind: z.literal("agent_waiting"),
    callId: z.string().min(1),
    agentId: z.string().min(1),
    waitingSince: z.iso.datetime(),
  }),
]);

/** The disk contract has exactly one boundary; phase and live continuations are derived on read. */
export const checkpointSchema = checkpointSnapshotSchema
  .omit({
    phase: true,
    callId: true,
    acceptedAt: true,
    answerOperation: true,
    answer: true,
    answeredAction: true,
    run: true,
  })
  .extend({
    run: checkpointSnapshotSchema.shape.run.omit({
      pendingAction: true,
      pendingAgentCall: true,
    }),
    boundary: boundarySchema,
  });
export type RunCheckpoint = z.infer<typeof checkpointSchema>;

export function encodeCheckpoint(snapshot: CheckpointSnapshot): RunCheckpoint {
  const {
    phase,
    callId,
    acceptedAt,
    answerOperation,
    answer,
    answeredAction,
    run,
    ...base
  } = snapshot;
  const { pendingAction, pendingAgentCall, ...savedRun } = run;
  let boundary: RunCheckpoint["boundary"];
  if (phase === "waiting") {
    if (pendingAction && !pendingAgentCall && callId)
      boundary = { kind: "user_waiting", callId, action: pendingAction };
    else if (pendingAgentCall && !pendingAction)
      boundary = {
        kind: "agent_waiting",
        callId: pendingAgentCall.id,
        agentId: pendingAgentCall.agentId,
        waitingSince: pendingAgentCall.createdAt,
      };
    else throw ERRORS.create("CHECKPOINT_INVALID");
  } else if (phase === "answered") {
    if (!callId || !answeredAction || answer === undefined || !acceptedAt)
      throw ERRORS.create("CHECKPOINT_INVALID");
    boundary = {
      kind: "answer_ready",
      callId,
      action: answeredAction,
      accepted: {
        answer,
        acceptedAt,
        ...(answerOperation ? { operation: answerOperation } : {}),
      },
    };
  } else if (phase === "executing") {
    if (!callId) throw ERRORS.create("CHECKPOINT_INVALID");
    boundary = { kind: "executing", callId };
  } else boundary = { kind: phase };
  return checkpointSchema.parse({ ...base, run: savedRun, boundary });
}

export function decodeCheckpoint(value: unknown): CheckpointSnapshot {
  try {
    const { boundary, run, ...base } = checkpointSchema.parse(value);
    const phase =
      boundary.kind === "user_waiting" || boundary.kind === "agent_waiting"
        ? "waiting"
        : boundary.kind === "answer_ready"
          ? "answered"
          : boundary.kind;
    if ((phase === "waiting") !== (run.status === "waiting"))
      throw new Error("Boundary and Run status differ.");
    if (
      (phase === "terminal") !==
      (run.status === "completed" || run.status === "failed")
    )
      throw new Error("Terminal boundary and Run status differ.");
    if (
      phase !== "waiting" &&
      run.status !== "running" &&
      run.status !== "paused" &&
      phase !== "terminal"
    )
      throw new Error("Invalid active boundary.");
    return checkpointSnapshotSchema.parse({
      ...base,
      phase,
      ...("callId" in boundary ? { callId: boundary.callId } : {}),
      ...(boundary.kind === "answer_ready"
        ? {
            answer: boundary.accepted.answer,
            answeredAction: boundary.action,
            acceptedAt: boundary.accepted.acceptedAt,
            answerOperation: boundary.accepted.operation,
          }
        : {}),
      run: {
        ...run,
        ...(boundary.kind === "user_waiting"
          ? { pendingAction: boundary.action }
          : {}),
        ...(boundary.kind === "agent_waiting"
          ? {
              pendingAgentCall: {
                id: boundary.callId,
                agentId: boundary.agentId,
                phase: "available",
                createdAt: boundary.waitingSince,
              },
            }
          : {}),
      },
    });
  } catch (cause) {
    throw ERRORS.wrap("CHECKPOINT_INVALID", cause);
  }
}
