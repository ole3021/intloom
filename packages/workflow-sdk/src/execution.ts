import type { JsonValue, ReadonlyJsonValue } from "./json.ts";
import type { StorageAccess, StorageReadAccess } from "./storage-access.ts";
import type { InteractionAccess } from "./interaction.ts";
import type { StateAccess } from "./state-access.ts";
import type { ProjectAccess } from "./project-access.ts";

export interface CodeExecutionAccess<State> {
  readonly project?: ProjectAccess;
  readonly state: StateAccess<State>;
  readonly storage: StorageAccess;
  readonly interaction: InteractionAccess;
  /** Cooperative cancellation signal for this call; stopping does not undo existing external side effects. */
  readonly signal: AbortSignal;
}

export interface AgentExecutionAccess<State> {
  readonly project?: ProjectAccess;
  readonly state: StateAccess<State>;
  readonly storage: StorageReadAccess;
  readonly signal: AbortSignal;
}

/** Contains only the routing outcome; all Stage business data is saved through StateAccess. */
export interface StepResult {
  readonly outcome: string;
}

/** A persisted interaction and its accepted answer, delivered to an explicit recovery entry. */
export interface CodeRecovery {
  readonly action: {
    readonly id: string;
    readonly kind: "user_ask_questions" | "user_ask_confirmation";
    readonly request: ReadonlyJsonValue;
  };
  readonly answer: ReadonlyJsonValue;
}

export interface ExecutableCode {
  (
    input: ReadonlyJsonValue,
    access: CodeExecutionAccess<JsonValue>,
  ): StepResult | Promise<StepResult>;
  /** Continues a saved interaction without repeating the original function or its earlier effects. */
  recover?(
    recovery: CodeRecovery,
    access: CodeExecutionAccess<JsonValue>,
  ): StepResult | Promise<StepResult>;
}
