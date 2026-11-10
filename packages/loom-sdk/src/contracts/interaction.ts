import type { JsonObject, JsonValue } from "./json.ts";
import type { ExecutionOrigin } from "./outcome.ts";
import { z } from "zod";

export const ApprovalAnswerSchema = z.strictObject({ approved: z.boolean() });

export interface ResponseSource {
  readonly kind: "human" | "agent" | "program" | "test" | "unknown";
  readonly via: "cli" | "mcp" | "api";
  readonly actorId?: string;
}
export type InteractionResponse =
  | { readonly action: "submit"; readonly value: JsonValue }
  | { readonly action: "decline" | "dismiss" };
export type InteractionResponseRecord = InteractionResponse & {
  readonly id: string;
  readonly requestId: string;
  readonly source: ResponseSource;
  readonly receivedAt: string;
};
export interface InteractionRequest {
  readonly kind: "ask" | "approval";
  readonly executionId: string;
  readonly id: string;
  readonly runId: string;
  readonly origin: ExecutionOrigin;
  readonly message: string;
  readonly context?: JsonValue;
  readonly answerSchema: JsonObject;
  readonly responsePolicy: "any" | "human";
  readonly status: "pending" | "answered" | "closed";
  readonly createdAt: string;
  readonly answerResponseId?: string;
  readonly closed?: { readonly at: string; readonly reason: "run_ended" };
}
export interface InteractionReceipt {
  readonly runId: string;
  readonly requestId: string;
  readonly responseId: string;
  readonly requestStatus: "pending" | "answered";
  readonly continuation:
    | { readonly status: "not_requested" | "requested" }
    | { readonly status: "needs_attention"; readonly message: string };
}
export type ResumeRunOptions =
  | {
      readonly runId: string;
      readonly requestId: string;
      readonly waitId?: never;
      readonly resumeData?: never;
    }
  | {
      readonly runId: string;
      readonly waitId: string;
      readonly requestId?: never;
      readonly resumeData?: JsonValue;
    };
