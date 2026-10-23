import type { LoomInput } from "@intloom/loom-sdk";
import type { ServiceRunView } from "@intloom/kernel/operations";
import type { ProjectInput } from "../client/contracts.ts";
export type { ProjectInput, ObserveOptions } from "../client/contracts.ts";
export type {
  CoreResult,
  CoreMeta,
  ServiceRunView,
  ProjectEvent,
} from "@intloom/kernel/operations";
export interface RunInput extends ProjectInput {
  readonly runId: string;
}
export interface StartRunInput extends ProjectInput {
  readonly serviceInstanceId: string;
  readonly operationId: string;
  readonly loomName: string;
  readonly input: LoomInput;
}
export interface AnswerInput extends RunInput {
  readonly serviceInstanceId: string;
  readonly operationId: string;
  readonly actionId: string;
  readonly answer: import("@intloom/loom-sdk").ReadonlyJsonValue;
}
export interface WaitRunInput extends RunInput {
  readonly until?: "action_or_terminal" | "terminal";
  readonly timeoutMs?: number;
}
export interface WaitRunResult {
  readonly run: ServiceRunView;
  readonly reason?: "human_action" | "agent_action" | "paused" | "terminal";
}
