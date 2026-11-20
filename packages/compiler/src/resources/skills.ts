import { readFile, realpath } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import {
  type Diagnostic,
  type SkillMetadata,
  skillMetadataSchema,
} from "@intloom/loom-sdk";
import { parseDocument } from "yaml";
import type { Inspection } from "../code/inspect.ts";
import { schemaDiagnostics } from "../project/read.ts";
import { isWithin, packagePath } from "../project/resolve.ts";

export async function collectSkills(
  root: string,
  groups: Inspection["skillGroups"],
  diagnostics: Diagnostic[],
): Promise<{ path: string; metadata: SkillMetadata }[]> {
  const skills = new Map<string, { path: string; metadata: SkillMetadata }>();
  for (const group of groups) {
    const names = new Set<string>();
    for (const path of group.paths) {
      const directory = resolve(root, path);
      const file = join(directory, "SKILL.md");
      try {
        if (!isWithin(await realpath(root), await realpath(file)))
          throw new Error("Skill must be inside the Loom package");
        let skill = skills.get(directory);
        if (!skill) {
          const text = await readFile(file, "utf8");
          const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
          if (!match)
            throw new Error(
              "SKILL.md must start with YAML frontmatter between --- lines",
            );
          const document = parseDocument(match[1] ?? "");
          if (document.errors.length)
            throw new Error(
              document.errors.map((error) => error.message).join("\n"),
            );
          const metadata = skillMetadataSchema.safeParse(document.toJS());
          if (!metadata.success) {
            diagnostics.push(...schemaDiagnostics(metadata.error, file));
            continue;
          }
          if (metadata.data.name !== basename(directory))
            throw new Error("Skill name must match its directory name");
          skill = {
            path: `./${packagePath(relative(root, directory))}`,
            metadata: metadata.data,
          };
          skills.set(directory, skill);
        }
        if (names.has(skill.metadata.name))
          diagnostics.push({
            code: "DUPLICATE_SKILL",
            file: group.file,
            message: `Agent has duplicate Skill name '${skill.metadata.name}'`,
          });
        names.add(skill.metadata.name);
      } catch (error) {
        diagnostics.push({
          code: "INVALID_SKILL",
          file,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return [...skills.values()];
}
