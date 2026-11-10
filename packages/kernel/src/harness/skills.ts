import {
  defineTool,
  type AgentDefinition,
  type PromptContext,
} from "@intloom/loom-sdk";
import { z } from "zod";

/** Both official harnesses receive the same skill catalogue and on-demand reader. */
export async function withSkillReader(
  agent: AgentDefinition,
  context: PromptContext,
): Promise<AgentDefinition> {
  if (!agent.skills?.length) return agent;
  if (agent.tools?.some((t) => t.id === "readLoomSkill"))
    throw new Error("readLoomSkill is reserved on Agents with Skills");
  const skills = agent.skills;
  const read = defineTool({
    id: "readLoomSkill",
    description:
      "Read the named skill when its guidance is relevant to the current task.",
    inputSchema: z.strictObject({ name: z.string() }),
    outputSchema: z.string(),
    async execute({ inputData }) {
      const skill = skills.find((s) => s.id === inputData.name);
      if (!skill) throw new Error(`Unknown skill: ${inputData.name}`);
      const document = await context.resources.readText(skill.instructions);
      return skill.instructions.packagePath
        ? document.replace(/^---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*\r?\n/, "")
        : document;
    },
  });
  const instructions =
    typeof agent.instructions === "string"
      ? agent.instructions
      : await context.resources.readText(agent.instructions);
  return {
    ...agent,
    skills: [],
    instructions:
      instructions +
      "\nAvailable skills (use readLoomSkill to read):\n" +
      skills.map((s) => `${s.id} — ${s.description}`).join("\n"),
    tools: [...(agent.tools ?? []), read],
  };
}
