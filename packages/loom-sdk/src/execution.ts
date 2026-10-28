import * as z from "zod";
import type { JsonValue, ReadonlyValue } from "./json.ts";
import {
  userAskQuestionsSchema,
  userAnswerQuestionsSchema,
  userAskConfirmationSchema,
  userAnswerConfirmationSchema,
} from "./interaction.ts";
import type { StorageAccess, StorageReadAccess } from "./storage.ts";
import type { InteractionAccess } from "./interaction.ts";
import type { StateAccess } from "./state.ts";
import type { ProjectAccess } from "./project.ts";
import { interactionRequestSchema } from "./capability.ts";

export interface CodeExecutionAccess<State> {
  readonly run?: import("./capability.ts").LoomRunContext;
  readonly project?: ProjectAccess;
  readonly state: StateAccess<State>;
  readonly storage: StorageAccess;
  readonly interaction: InteractionAccess;
  /** Cooperative cancellation signal for this call; stopping does not undo existing external side effects. */
  readonly signal: AbortSignal;
}

export interface AgentExecutionAccess<State> {
  readonly run?: import("./capability.ts").LoomRunContext;
  readonly interaction?: Pick<InteractionAccess, "request">;
  readonly project?: ProjectAccess;
  readonly state: StateAccess<State>;
  readonly storage: StorageReadAccess;
  readonly signal: AbortSignal;
}

/** Contains only the routing outcome; all Stage business data is saved through StateAccess. */
export const stepResultSchema = z.strictObject({ outcome: z.string().min(1) });
export type StepResult = Readonly<z.infer<typeof stepResultSchema>>;

/** A persisted interaction and its accepted answer, delivered to an explicit recovery entry. */
export const codeRecoverySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    actionId: z.string().min(1),
    kind: z.literal("user_ask_interaction"),
    request: interactionRequestSchema,
    answer: z.json(),
  }),
  z.strictObject({
    actionId: z.string().min(1),
    kind: z.literal("user_ask_questions"),
    request: userAskQuestionsSchema,
    answer: userAnswerQuestionsSchema,
  }),
  z.strictObject({
    actionId: z.string().min(1),
    kind: z.literal("user_ask_confirmation"),
    request: userAskConfirmationSchema,
    answer: userAnswerConfirmationSchema,
  }),
]);
export type CodeRecovery = ReadonlyValue<z.infer<typeof codeRecoverySchema>>;

export interface ExecutableCode {
  (access: CodeExecutionAccess<JsonValue>): StepResult | Promise<StepResult>;
  /** Continues a saved interaction without repeating the original function or its earlier effects. */
  recover?(
    recovery: CodeRecovery,
    access: CodeExecutionAccess<JsonValue>,
  ): StepResult | Promise<StepResult>;
}
