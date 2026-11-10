import type { JsonObject, JsonValue } from "../contracts/json.ts";
import type {
  AcceptanceRef,
  AcceptanceResult,
  ArtifactRef,
} from "../contracts/outcome.ts";
import type {
  DefinitionIO,
  NormalizedInputOf,
  OutputOf,
} from "../definitions/io.ts";
import type { LoomIdentity } from "../definitions/loom.ts";
import type { ResourceRef } from "../definitions/resources.ts";

export interface AgentRef extends DefinitionIO {
  readonly kind: "agent";
  readonly id: string;
}
export interface ToolRef extends DefinitionIO {
  readonly kind: "tool";
  readonly id: string;
}
export interface ComponentUses {
  readonly agents?: readonly AgentRef[];
  readonly tools?: readonly ToolRef[];
  readonly resources?: readonly ResourceRef[];
}
type Declared<U, K extends PropertyKey> = U extends {
  readonly [P in K]?: readonly (infer D)[];
}
  ? D
  : never;
export interface RunContext {
  readonly location: import("../contracts/run.ts").RunLocation;
  readonly runId: string;
  readonly loom: LoomIdentity;
  readonly parentRunId?: string;
}
export interface ResourceReader<R extends ResourceRef = ResourceRef> {
  readText(ref: R): Promise<string>;
  readBytes(ref: R): Promise<Uint8Array>;
}
export interface PromptContext<R extends ResourceRef = ResourceRef> {
  readonly run: RunContext;
  readonly resources: ResourceReader<R>;
}
export interface RuntimeContext<U extends ComponentUses = ComponentUses>
  extends PromptContext<Extract<Declared<U, "resources">, ResourceRef>> {
  readonly signal: AbortSignal;
  fail(businessCode: string): never;
  readonly logger: {
    info(message: string, details?: JsonObject): void;
    warn(message: string, details?: JsonObject): void;
    error(message: string, details?: JsonObject): void;
  };
  readonly agents: {
    generate<D extends Extract<Declared<U, "agents">, AgentRef>>(
      ref: D,
      input: NoInfer<NormalizedInputOf<D>>,
    ): Promise<OutputOf<D>>;
  };
  readonly tools: {
    call<D extends Extract<Declared<U, "tools">, ToolRef>>(
      ref: D,
      input: NoInfer<NormalizedInputOf<D>>,
    ): Promise<OutputOf<D>>;
  };
  readonly artifacts: {
    write(value: {
      name: string;
      mediaType: string;
      data: string | Uint8Array;
    }): Promise<ArtifactRef>;
    readText(ref: ArtifactRef): Promise<string>;
    readBytes(ref: ArtifactRef): Promise<Uint8Array>;
  };
  readonly acceptance: {
    record(value: {
      subject: JsonValue;
      result: AcceptanceResult;
    }): Promise<AcceptanceRef>;
  };
}
