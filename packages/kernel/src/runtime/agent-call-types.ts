import type { JsonValue, ReadonlyJsonValue } from "../shared/json.ts";
import type { Cursor } from "../workflow/blueprint.ts";
import type { RunView } from "./run-view.ts";

export interface PendingAgentCall {
  readonly id: string;
  readonly agentId: string;
  readonly phase: "available" | "claimed";
  readonly createdAt: string;
}
export interface AgentTask {
  readonly runId: string;
  readonly callId: string;
  readonly agentId: string;
  readonly cursor: Readonly<Cursor>;
  readonly instructions: string;
  readonly skills: readonly {
    readonly name: string;
    readonly description: string;
    readonly content: string;
    readonly assets: readonly { readonly id: string; readonly name: string }[];
  }[];
  readonly tools: readonly {
    readonly id: string;
    readonly description: string;
    readonly inputSchema: ReadonlyJsonValue;
    readonly outputSchema: ReadonlyJsonValue;
  }[];
  readonly outputSchema: ReadonlyJsonValue;
}
export interface AgentCallRef {
  readonly runId: string;
  readonly callId: string;
}
export interface AgentCallOwner extends AgentCallRef {
  readonly ownerToken: string;
}
export interface AgentCallClaim extends AgentCallRef {
  readonly claimId: string;
}
export interface AgentToolCall extends AgentCallOwner {
  readonly toolCallId: string;
  readonly toolId: string;
  readonly input: ReadonlyJsonValue;
}
export interface AgentCallCompletion extends AgentCallOwner {
  readonly result: ReadonlyJsonValue;
}
export interface AgentCallFailure extends AgentCallOwner {
  readonly message: string;
}
export interface AgentAssetRequest extends AgentCallOwner {
  readonly assetId: string;
}
export interface AgentCallView {
  readonly pending: PendingAgentCall;
  readonly task: AgentTask;
  readonly receipts: readonly {
    readonly toolCallId: string;
    readonly toolId: string;
    readonly status: "running" | "completed" | "failed";
  }[];
}
export interface AgentCallApi {
  getAgentCall(request: AgentCallRef): Promise<AgentCallView>;
  claimAgentCall(
    request: AgentCallClaim,
  ): Promise<{ readonly task: AgentTask; readonly ownerToken: string }>;
  callAgentTool(request: AgentToolCall): Promise<JsonValue>;
  readAgentAsset(request: AgentAssetRequest): Promise<{
    readonly content: string;
    readonly encoding: "utf8" | "base64";
  }>;
  completeAgentCall(request: AgentCallCompletion): Promise<RunView>;
  failAgentCall(request: AgentCallFailure): Promise<RunView>;
}
