import { createTool } from "@mastra/core/tools";
import type { PublicSchema } from "@mastra/core/schema";
import type { AgentTool } from "@intloom/workflow-sdk";
import { getAgentExecutionAccess } from "../agent-context.ts";
import { agentJsonSchema, executeAgentTool } from "../agent-tool.ts";

export function serviceTool(tool: AgentTool) {
  return createTool({
    id: tool.id,
    description: tool.description,
    inputSchema: agentJsonSchema(tool.inputSchema) as PublicSchema,
    // Output transforms belong to executeAgentTool, not the framework.
    execute: (input, context) =>
      executeAgentTool(
        tool,
        input,
        getAgentExecutionAccess(context.requestContext),
      ),
  });
}
