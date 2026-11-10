import type { JsonObject, JsonValue } from "./json.ts";
import type { InstalledLoomRef } from "../definitions/loom.ts";
import type { OutcomeContract } from "./outcome.ts";

export const nodeRequirements = {
  node22: "^22.22.0 || ^24.0.0 || ^26.0.0",
  node26: ">=26.13.0 <27",
} as const;

export interface LoomContracts {
  readonly input: JsonObject;
  readonly normalizedInput: JsonObject;
  readonly output: JsonObject;
}
export interface ComponentManifest {
  readonly kind: "code" | "agent" | "tool" | "skill" | "workflow";
  readonly description?: string;
  readonly contracts?: LoomContracts;
  readonly uses?: {
    readonly agents?: readonly string[];
    readonly tools?: readonly string[];
    readonly resources?: readonly string[];
  };
  readonly model?: {
    readonly slot: string;
    readonly profile?: string;
    readonly capabilities: readonly ("tool_use" | "structured_output")[];
  };
  readonly binding?: string;
  readonly instructions?:
    | { readonly text: string }
    | { readonly resource: string };
  readonly tools?: readonly string[];
  readonly skills?: readonly string[];
  readonly resources?: readonly string[];
  readonly resultTool?: string;
  readonly outputMode?: "text" | "structured";
  readonly generation?: {
    readonly maxSteps: number;
    readonly temperature?: number;
    readonly maxOutputTokens?: number;
  };
  readonly workflowType?: "mastra";
  /** Static relationships for inspection and definition matching, never an execution program. */
  readonly structure?: readonly JsonValue[];
}
export interface LoomManifest {
  readonly formatVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly storage: "global" | "project";
  readonly entry: {
    readonly kind: "code" | "agent" | "workflow";
    readonly id: string;
    readonly workflowType?: "mastra";
  };
  readonly module: {
    readonly path: "./runtime.mjs";
    readonly export: "default";
  };
  readonly contracts: LoomContracts;
  readonly components: Readonly<Record<string, ComponentManifest>>;
  readonly dependencies: Readonly<Record<string, InstalledLoomRef>>;
  readonly resources: Readonly<Record<string, { readonly path: string }>>;
  readonly requirements: {
    readonly node: string;
    readonly workflowTypes: readonly "mastra"[];
    readonly models: Readonly<
      Record<string, readonly ("tool_use" | "structured_output")[]>
    >;
    readonly tools: readonly string[];
  };
  readonly outcome?: OutcomeContract;
  readonly build: {
    readonly compilerVersion: string;
    readonly target: keyof typeof nodeRequirements;
  };
}
export interface ArtifactIntegrity {
  readonly formatVersion: 1;
  readonly artifactDigest: string;
  readonly files: readonly (readonly [path: string, digest: string])[];
}
/** A read-only local catalog snapshot. Local paths never enter a Manifest or lock. */
export interface LoomCatalogEntry {
  readonly ref: InstalledLoomRef;
  readonly manifest: LoomManifest;
  readonly artifactDir: string;
}
