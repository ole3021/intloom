import { createTool } from "@mastra/core/tools";
import { toStandardSchema, type PublicSchema } from "@mastra/core/schema";
import type { AgentTool } from "@intloom/workflow-sdk";
import { getAgentExecutionAccess } from "../agent-context.ts";
import { agentJsonSchema, executeAgentTool } from "../agent-tool.ts";

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
    execute: (input, context) =>
      executeAgentTool(
        tool,
        input,
        getAgentExecutionAccess(context.requestContext),
      ),
  });
}
