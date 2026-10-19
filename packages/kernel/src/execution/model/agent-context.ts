import { RequestContext } from "@mastra/core/request-context";
import type { JsonValue } from "@intloom/loom-sdk";
import { guardAgentAccess, withAgentSignal } from "../../access/code.ts";
import type { AgentExecutionAccess } from "@intloom/loom-sdk";

import { agentExecutionContextKey } from "../agent-context.ts";
export const agentToolControlKey = "intloom.toolControl";
export interface AgentToolControl {
  closed: boolean;
}
export {
  agentExecutionContextKey,
  getAgentExecutionAccess,
} from "../agent-context.ts";

/** The new context references only the current call; access failures remain failures even if the SDK converts them to Tool results. */
export function bindAgentContext(
  access: AgentExecutionAccess<JsonValue>,
  onFailure: (cause: unknown) => void,
  toolControl?: AgentToolControl,
  signal: AbortSignal = access.signal,
): RequestContext {
  const context = new RequestContext();
  context.set(
    agentExecutionContextKey,
    guardAgentAccess(withAgentSignal(access, signal), onFailure),
  );
  if (toolControl) context.set(agentToolControlKey, toolControl);
  return context;
}
