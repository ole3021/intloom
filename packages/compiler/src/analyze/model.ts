import type { AgentModelType, LoomInputKind } from "@intloom/loom-sdk";
import type { CompileOptions } from "../types.ts";
import type { ResourceAsset, SourceLocation } from "../source/types.ts";
export type { ResourceAsset } from "../source/types.ts";
import type { CompilerDiagnostic } from "../diagnostics.ts";
import type { SourcePackage } from "../source/schemas.ts";

export type StepTarget =
  | { readonly kind: "step"; readonly stepName: string }
  | { readonly kind: "stage_end" };

export interface StepModel {
  readonly stepName: string;
  readonly location: SourceLocation;
  readonly execution:
    | { readonly kind: "code"; readonly resourceKey: string }
    | { readonly kind: "agent"; readonly resourceKey: string };
  readonly on: Readonly<Record<string, StepTarget>>;
}

export type StageTarget =
  | { readonly kind: "stage"; readonly stageName: string }
  | { readonly kind: "loom_end" };

export interface StageModel {
  readonly stageName: string;
  readonly location: SourceLocation;
  readonly stateSchema: ModuleReference;
  readonly initializeState: ModuleReference;
  readonly entryStepName: string;
  readonly steps: Readonly<Record<string, StepModel>>;
  readonly on: Readonly<Record<string, StageTarget>>;
}

export interface ModuleReference {
  readonly location?: SourceLocation;
  readonly sourceFile: string;
  readonly exportName: string;
}

export interface CodeModel {
  readonly resourceKey: string;
  readonly location: SourceLocation;
  readonly module: ModuleReference;
}

export interface SkillModel {
  readonly location: SourceLocation;
  readonly name: string;
  readonly description: string;
  readonly content: string;
  readonly assets: readonly ResourceAsset[];
}

export interface AgentModel {
  readonly resourceKey: string;
  readonly location: SourceLocation;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  /** Configuration role name; Compiler does not read consumer model configuration. */
  readonly llm: AgentModelType;
  readonly outputSchema: ModuleReference;
  readonly skills: readonly SkillModel[];
  readonly tools: readonly ModuleReference[];
}

export interface LoomModel {
  readonly manifest: SourcePackage;
  readonly exclusive?: boolean;
  readonly options: CompileOptions;
  readonly loomName: string;
  readonly inputs: readonly LoomInputKind[];
  readonly version: string;
  readonly entryStageName: string;
  readonly stages: Readonly<Record<string, StageModel>>;
  readonly codes: Readonly<Record<string, CodeModel>>;
  readonly agents: Readonly<Record<string, AgentModel>>;
  readonly assets: readonly ResourceAsset[];
}

export interface LinkedLoom {
  readonly model: LoomModel;
  readonly codeIds: Readonly<Record<string, string>>;
  readonly agentIds: Readonly<Record<string, string>>;
  readonly diagnostics: readonly CompilerDiagnostic[];
}
