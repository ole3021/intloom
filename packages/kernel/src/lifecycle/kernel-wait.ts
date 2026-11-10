import { createHash } from "node:crypto";
import {
  ApprovalAnswerSchema,
  type InteractionRequest,
  type JsonObject,
} from "@intloom/loom-sdk";
import { stableJson } from "@intloom/loom-sdk/json";
import { z } from "zod";
import type { ExecutionBoundary, RunRecord } from "./run-contracts.ts";

export const questionAnswer = z.string().trim().min(1);
export const deliveryAnswer = ApprovalAnswerSchema.extend({
  reason: z.string().optional(),
});
export function kernelWait(
  record: RunRecord,
  request: Pick<
    InteractionRequest,
    "message" | "origin" | "executionId" | "context"
  >,
  state: JsonObject,
  id: () => string,
  now: () => string,
): Extract<ExecutionBoundary, { kind: "waiting" }> {
  const approval = state.kind === "delivery";
  const waitId = id(),
    requestId = id(),
    createdAt = now();
  return {
    kind: "waiting",
    checkpoint: {
      id: id(),
      engineRef: state,
      snapshotFingerprint: createHash("sha256")
        .update(stableJson(state))
        .digest("hex"),
      waitIds: [waitId],
      createdAt,
    },
    waits: [
      {
        executions: [],
        definitionPath: [],
        locator: {},
        view: {
          kind: "interaction",
          origin: request.origin,
          requestId,
          waitId,
        },
        request: {
          ...request,
          id: requestId,
          runId: record.view.id,
          kind: approval ? "approval" : "ask",
          responsePolicy: approval ? "human" : "any",
          status: "pending",
          createdAt,
          answerSchema: z.toJSONSchema(
            approval ? deliveryAnswer : questionAnswer,
          ) as JsonObject,
        },
      },
    ],
  };
}
export function kernelCheckpoint(record: RunRecord) {
  const kind = record.checkpoint?.engineRef.kind;
  return kind === "agent-question" || kind === "delivery"
    ? record.checkpoint
    : undefined;
}
