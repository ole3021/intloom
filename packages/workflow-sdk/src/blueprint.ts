import type { ZodType } from "zod";
import type { JsonValue } from "./json.ts";

export interface Cursor {
  stageName: string;
  stepName: string;
}

/** Initialization arguments supplied by the current Run, including its identity and original intent; not a separate state record. */
export interface StageStateContext {
  readonly runId: string;
  readonly flowName: string;
  readonly stageName: string;
  readonly intent: string;
}

/** Constructs Schema input; shipped with the Blueprint and called only when entering a Stage. */
export type StageStateInitializer = (
  context: StageStateContext,
) => JsonValue | Promise<JsonValue>;

export type CodeId = string;
export type AgentId = string;

export type BlueprintStepExecution =
  | {
      readonly kind: "code";
      readonly codeId: CodeId;
    }
  | {
      readonly kind: "agent";
      readonly agentId: AgentId;
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
  | { readonly kind: "workflow_end" };

export interface Blueprint {
  /** Serializes project-writing Workflows against every other active Run in this host. */
  readonly exclusive?: boolean | undefined;
  readonly flowName: string;
  readonly entryStageName: string;
  readonly stages: {
    readonly [stageName: string]: BlueprintStage;
  };
}
