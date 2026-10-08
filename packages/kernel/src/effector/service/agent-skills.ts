import { createSkill, type SkillInput } from "@mastra/core/skills";
import { basename, dirname, resolve } from "node:path";
import type { SkillSpec } from "../../workflow/module.ts";
import { fail } from "../../workflow/errors.ts";

export function createAgentSkills(
  specs: readonly SkillSpec[],
  assetRoot: string,
  label: string,
): SkillInput[] {
  const skills: SkillInput[] = [];
  const names = new Set<string>();
  for (const skill of specs) {
    if (names.has(skill.name))
      fail(
        "WORKFLOW_AGENT_FAILED",
        `${label}: Duplicate Skill name: ${skill.name}`,
      );
    names.add(skill.name);
    const documents = skill.assets.filter(
      (asset) => basename(asset) === "SKILL.md",
    );
    if (
      documents.length > 1 ||
      (documents.length === 0 && skill.assets.length > 0)
    ) {
      fail(
        "WORKFLOW_AGENT_FAILED",
        `${label}: Missing or ambiguous packaged SKILL.md: ${skill.name}`,
      );
    }
    // Compiler-delivered directory skills retain assets and relative paths; definitions without assets use inline skills.
    skills.push(
      documents[0]
        ? dirname(resolve(assetRoot, documents[0]))
        : createSkill({
            name: skill.name,
            description: skill.description,
            instructions: skill.content,
          }),
    );
  }

  return skills;
}
