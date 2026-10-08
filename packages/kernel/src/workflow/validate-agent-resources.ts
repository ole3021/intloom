import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parseDocument } from "yaml";
import type { LoadedWorkflow } from "./types.ts";
import { fail } from "./errors.ts";

/** Validates packaged Skill metadata without instantiating a model framework. */
export async function validateAgentResources(
  workflow: LoadedWorkflow,
): Promise<void> {
  for (const [agentId, agent] of Object.entries(workflow.agentSpecs)) {
    const names = new Set<string>();
    for (const skill of agent.skills) {
      if (names.has(skill.name))
        fail(
          "INVALID_WORKFLOW",
          `${agentId}: Duplicate Skill name: ${skill.name}`,
        );
      names.add(skill.name);
      const docs = skill.assets.filter(
        (asset) => basename(asset) === "SKILL.md",
      );
      if (docs.length > 1 || (!docs.length && skill.assets.length))
        fail(
          "INVALID_WORKFLOW",
          `${agentId}: Missing or ambiguous packaged SKILL.md: ${skill.name}`,
        );
      if (!docs[0]) continue;
      const text = await readFile(
        resolve(workflow.source.assetRoot, docs[0]),
        "utf8",
      );
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text);
      const metadataText = frontmatter?.[1];
      if (metadataText === undefined)
        fail(
          "INVALID_WORKFLOW",
          `${agentId}: Invalid Skill metadata: ${skill.name}`,
        );
      const document = parseDocument(metadataText, {
        uniqueKeys: true,
        prettyErrors: false,
      });
      if (document.errors.length || document.warnings.length)
        fail(
          "INVALID_WORKFLOW",
          `${agentId}: Invalid Skill metadata: ${skill.name}`,
        );
      const metadata: unknown = document.toJS({ maxAliasCount: 0 });
      if (
        !metadata ||
        typeof metadata !== "object" ||
        !("name" in metadata) ||
        !("description" in metadata) ||
        metadata.name !== skill.name ||
        metadata.description !== skill.description
      )
        fail(
          "INVALID_WORKFLOW",
          `${agentId}: Packaged Skill metadata does not match its declaration: ${skill.name}`,
        );
    }
  }
}
