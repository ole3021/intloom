import { runResultSchema } from "../schemas/run-result.ts";
import { loomInputSchema, stepResultSchema } from "@intloom/loom-sdk";
import * as z from "zod";
import { controlSchema } from "../../mirror/contracts.ts";
import { pendingUserActionSchema } from "../schemas/pending-user-action.ts";
import { cursorSchema } from "../../loom/schemas/cursor.ts";

const savedStageSchema = z.strictObject({
  stageName: z.string().optional(),
  stageVisitId: z.number().int().nonnegative().optional(),
  role: z.enum(["current", "exited"]).optional(),
  exists: z.boolean().optional(),
  input: z.json().optional(),
  value: z.json().optional(),
});
export type SavedStage = z.infer<typeof savedStageSchema>;
export const checkpointSnapshotSchema = z.strictObject({
  version: z.literal(3),
  observationBaseline: z.json().optional(),
  schemaVersion: z.literal(3).optional(),
  control: controlSchema.optional(),
  validatedRoute: z
    .strictObject({
      kind: z.enum(["move_step", "enter_stage", "complete"]),
      cursor: cursorSchema,
      status: z.enum(["running", "completed"]),
    })
    .optional(),
  pauseRequested: z.boolean().optional(),
  callId: z.string().optional(),
  stageVisitId: z.number().int().nonnegative().default(0),
  acceptedAt: z.iso.datetime().optional(),
  answerOperation: z
    .strictObject({ serviceInstanceId: z.uuid(), operationId: z.uuid() })
    .optional(),
  loomIdentity: z.string().min(1),
  sourceLoomIdentity: z.string().min(1).optional(),
  phase: z.enum([
    "stage_pending",
    "step_ready",
    "executing",
    "step_result",
    "waiting",
    "answered",
    "terminal",
  ]),
  run: z.strictObject({
    results: z.array(runResultSchema).optional(),
    startedBy: z
      .strictObject({ serviceInstanceId: z.uuid(), operationId: z.uuid() })
      .optional(),
    id: z.string().min(1),
    loomName: z.string().min(1),
    input: loomInputSchema,
    execution: z.strictObject({
      source: z.enum(["cli", "studio", "agent_ide"]),
      agentExecutor: z.enum(["service", "mcp_client"]),
    }),
    cursor: cursorSchema,
    status: z.enum(["running", "waiting", "paused", "completed", "failed"]),
    pendingAction: pendingUserActionSchema.optional(),
    pendingAgentCall: z
      .strictObject({
        id: z.string().min(1),
        agentId: z.string().min(1),
        phase: z.enum(["available", "claimed"]),
        createdAt: z.iso.datetime(),
      })
      .optional(),
    lastError: z
      .strictObject({
        code: z.string(),
        message: z.string(),
        retryable: z.boolean(),
      })
      .optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
  stage: savedStageSchema.optional(),
  result: stepResultSchema.optional(),
  answer: z.json().optional(),
  answeredAction: pendingUserActionSchema.optional(),
});
export type CheckpointSnapshot = z.infer<typeof checkpointSnapshotSchema>;
export type CheckpointPhase = CheckpointSnapshot["phase"];

export interface RunCheckpointStore {
  read(): CheckpointSnapshot[];
  write(snapshot: unknown): void;
}
