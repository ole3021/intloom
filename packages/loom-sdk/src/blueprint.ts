import type { CodeId, AgentId } from "./protocol.ts";
import type { ZodType } from "zod";
import type { JsonValue } from "./json.ts";
import type { LoomInput, LoomInputKind } from "./inputs.ts";
import type { CompiledDefinition, ExecutionPlan } from "./compiled.ts";
import type { ReadonlyJsonValue } from "./json.ts";

/** Initialization arguments supplied by the current Run, including its identity and detached input. */
export interface StageStateContext {
  readonly runId: string;
  readonly loomName: string;
  readonly stageName: string;
  readonly input: LoomInput;
  /** Full capability input. Legacy initializers continue receiving the fixed input projection. */
  readonly invocationInput?: ReadonlyJsonValue;
}

/** Constructs Schema input; shipped with the Blueprint and called only when entering a Stage. */
export type StageStateInitializer = (
  context: StageStateContext,
) => JsonValue | Promise<JsonValue>;

export type BlueprintStepExecution =
  | {
      readonly kind: "code";
      readonly codeId: CodeId;
    }
  | {
      readonly kind: "agent";
      readonly agentId: AgentId;
      readonly recoveryCodeId?: CodeId;
    };

export interface BlueprintStep {
  readonly stepName: string;
  readonly execution: BlueprintStepExecution;
  readonly on: {
    readonly [outcome: string]: BlueprintStepNext;
  };
}
export type BlueprintStepNext =
  | {
      readonly kind: "step";
      readonly stepName: string;
    }
  | { readonly kind: "stage_end" };

export interface BlueprintStage {
  readonly stageName: string;
  readonly stateSchema: ZodType<JsonValue>;
  readonly initializeState: StageStateInitializer;
  readonly entryStepName: string;
  readonly steps: {
    readonly [stepName: string]: BlueprintStep;
  };
  readonly on: {
    readonly [outcome: string]: BlueprintStageNext;
  };
}
export type BlueprintStageNext =
  | {
      readonly kind: "stage";
      readonly stageName: string;
    }
  | { readonly kind: "loom_end" };

export interface Blueprint {
  readonly capability?: {
    readonly definition: CompiledDefinition;
    readonly plan: ExecutionPlan;
    readonly validators?: Readonly<
      Record<string, import("./capability.ts").InteractionValidator>
    >;
  };
  readonly inputs: readonly LoomInputKind[];
  /** Serializes project-writing Looms against every other active Run in this host. */
  readonly exclusive?: boolean | undefined;
  readonly loomName: string;
  readonly entryStageName: string;
  readonly stages: {
    readonly [stageName: string]: BlueprintStage;
  };
}
