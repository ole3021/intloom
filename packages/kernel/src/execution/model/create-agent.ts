import { executeServiceAgent } from "./execute-agent.ts";
import { Agent } from "@mastra/core/agent";
import { noopLogger } from "@mastra/core/logger";
import { Mastra } from "@mastra/core/mastra";
import type { Tool } from "@mastra/core/tools";
import { fail, loomError } from "../../loom/errors.ts";
import type { RunnableAgentSpec } from "../../loom/types.ts";
import type { CreateAgentOptions, InitializedAgent } from "./types.ts";
import { resolveAgentModel, createModelOptions } from "./agent-model.ts";
import { createAgentSkills } from "./agent-skills.ts";
import { serviceTool } from "./agent-tools.ts";

/** Assembles the actual Agent without calling the model; the execution layer binds access for each Run. */
export async function createAgent(
  spec: RunnableAgentSpec,
  options: CreateAgentOptions,
): Promise<InitializedAgent> {
  const label = `${options.source.packageName}/${options.agentId}`;
  try {
    const { config, apiKey } = resolveAgentModel(
      spec,
      options.config,
      label,
      options.credentials,
    );
    const tools: Record<string, Tool> = Object.create(null);
    for (const tool of spec.tools) {
      if (Object.hasOwn(tools, tool.id))
        fail("LOOM_AGENT_FAILED", `${label}: Duplicate Tool ID: ${tool.id}`);
      tools[tool.id] = serviceTool(tool);
    }
    const skills = createAgentSkills(
      spec.skills,
      options.source.assetRoot,
      label,
    );
    const modelOptions = createModelOptions(config, apiKey, label);
    // Pinned Mastra 1.67 uses its attached instance for internal stream Loom logging.
    // Match its private standalone context; ephemeral skips global scorer-hook retention.
    const mastra = new Mastra({ logger: false, __ephemeral: true });
    const agent = new Agent({
      mastra,
      id: options.agentId,
      name: spec.name,
      description: spec.description,
      instructions: spec.instructions,
      ...modelOptions,
      tools,
      skills,
    });
    // SDK stream failures can include raw model output in their default console logger.
    // IntLoom records only classified, bounded diagnostics at the execution boundary.
    agent.__setLogger(noopLogger);
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
      fail("LOOM_AGENT_FAILED", `${label}: Incomplete Skill assembly`);
    }
    return {
      agentId: options.agentId,
      executable: {
        agent,
        capability: "modelProfile" in spec,
        outputSchema: spec.outputSchema,
        ...(config.baseURL && new URL(config.baseURL).hostname === "opencode.ai"
          ? { zen: true }
          : {}),
        execute(input, access, maxSteps, observer) {
          return executeServiceAgent(this, input, access, maxSteps, observer);
        },
      },
    };
  } catch (cause) {
    throw loomError(
      cause,
      "LOOM_AGENT_FAILED",
      `Cannot assemble Agent: ${label}`,
    );
  }
}
