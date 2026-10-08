import { executeServiceAgent } from "./execute-agent.ts";
import { Agent } from "@mastra/core/agent";
import type { Tool } from "@mastra/core/tools";
import { fail, workflowError } from "../../workflow/errors.ts";
import type { AgentSpec } from "../../workflow/module.ts";
import type { CreateAgentOptions, InitializedAgent } from "./types.ts";
import { resolveModelConfig, createModelOptions } from "./agent-model.ts";
import { createAgentSkills } from "./agent-skills.ts";
import { serviceTool } from "./agent-tools.ts";

/** Assembles the actual Agent without calling the model; the execution layer binds access for each Run. */
export async function createAgent(
  spec: AgentSpec,
  options: CreateAgentOptions,
): Promise<InitializedAgent> {
  const label = `${options.source.packageName}/${options.agentId}`;
  try {
    const { config, apiKey } = resolveModelConfig(
      spec.llm,
      options.config,
      label,
    );
    const tools: Record<string, Tool> = Object.create(null);
    for (const tool of spec.tools) {
      if (Object.hasOwn(tools, tool.id))
        fail(
          "WORKFLOW_AGENT_FAILED",
          `${label}: Duplicate Tool ID: ${tool.id}`,
        );
      tools[tool.id] = serviceTool(tool);
    }
    const skills = createAgentSkills(
      spec.skills,
      options.source.assetRoot,
      label,
    );
    const modelOptions = createModelOptions(config, apiKey, label);
    const agent = new Agent({
      id: options.agentId,
      name: spec.name,
      description: spec.description,
      instructions: spec.instructions,
      ...modelOptions,
      tools,
      skills,
    });
    // The SDK loads directory skills lazily; verify during initialization that no Skill was skipped or overwritten.
    const loadedSkills = await agent.listSkills();
    if (
      loadedSkills.length !== spec.skills.length ||
      spec.skills.some(
        (skill) =>
          !loadedSkills.some(
            (loaded) =>
              loaded.name === skill.name &&
              loaded.description === skill.description,
          ),
      )
    ) {
      fail("WORKFLOW_AGENT_FAILED", `${label}: Incomplete Skill assembly`);
    }
    return {
      agentId: options.agentId,
      executable: {
        agent,
        outputSchema: spec.outputSchema,
        execute(input, access, maxSteps) {
          return executeServiceAgent(this, input, access, maxSteps);
        },
      },
    };
  } catch (cause) {
    throw workflowError(
      cause,
      "WORKFLOW_AGENT_FAILED",
      `Cannot assemble Agent: ${label}`,
    );
  }
}
