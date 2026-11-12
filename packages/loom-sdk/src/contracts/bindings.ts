import type { JsonObject } from "./json.ts";

export interface ModelBindingDescription {
  readonly provider: "openai" | "minimax-cn" | "alibaba";
  readonly model: string;
  readonly credentialRef: string;
  readonly options?: {
    readonly baseUrl?: string;
    readonly requestTimeoutMs?: number;
    readonly totalTimeoutMs?: number;
    readonly api?: "chat" | "responses";
    readonly reasoningEffort?: "none";
  };
}
export interface ToolBindingDescription {
  readonly implementation: string;
  readonly revision: string;
  readonly config?: JsonObject;
  readonly credentialRef?: string;
}
export interface RuntimeToolBinding extends ToolBindingDescription {
  readonly execute: (args: {
    readonly input: unknown;
    readonly signal: AbortSignal;
    readonly config: JsonObject;
    readonly credential?: string;
  }) => Promise<unknown> | unknown;
}
/** Keys are id@version; "*" is an explicit shared fallback, never implicit. */
export interface RuntimeBindings {
  readonly profiles?: Readonly<Record<string, ModelBindingDescription>>;
  readonly models?: Readonly<
    Record<string, Readonly<Record<string, ModelBindingDescription>>>
  >;
  readonly tools?: Readonly<
    Record<string, Readonly<Record<string, RuntimeToolBinding>>>
  >;
  readonly resolveCredential?: (reference: string) => Promise<string> | string;
}
export interface RunBindings {
  readonly models: Readonly<Record<string, ModelBindingDescription>>;
  readonly tools: Readonly<Record<string, ToolBindingDescription>>;
}
