import { createTool } from "@mastra/core/tools";
import { toStandardSchema, type PublicSchema } from "@mastra/core/schema";
import type { AgentTool } from "@intloom/workflow-sdk";
import { getAgentExecutionAccess } from "../agent-context.ts";
import {
  agentJsonSchema,
  executeAgentTool,
  agentToolEndsCall,
} from "../agent-tool.ts";
import { agentToolControlKey, type AgentToolControl } from "./agent-context.ts";
import { KERNEL_ERRORS } from "../../errors/kernel.ts";
import { getLogger } from "@intloom/utils";

export function serviceTool(tool: AgentTool) {
  return createTool({
    id: tool.id,
    description: tool.description,
    // Provider strict-mode rewriting forbids dictionary fields in JSON Patch values.
    // Keep the transport Schema intact; executeAgentTool owns original Zod parsing.
    inputSchema: toStandardSchema(
      agentJsonSchema(tool.inputSchema) as PublicSchema,
    ),
    strict: false,
    // Output transforms belong to executeAgentTool, not the framework.
    execute: async (input, context) => {
      const control = context.requestContext?.get(agentToolControlKey) as
        | AgentToolControl
        | undefined;
      if (control?.closed)
        throw KERNEL_ERRORS.create("INVALID_REQUEST", {
          message:
            "This Agent has saved its final submission. Return the required outcome without more Tools.",
        });
      const result = await executeAgentTool(
        tool,
        input,
        getAgentExecutionAccess(context.requestContext),
      );
      if (control && agentToolEndsCall(tool, result)) {
        control.closed = true;
        getLogger().debug("agent_tools_closed", { toolName: tool.id });
      }
      return result;
    },
  });
}
