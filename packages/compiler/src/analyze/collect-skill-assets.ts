import { readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fail } from "../errors.ts";
import type { ResourceAsset } from "./model.ts";

export async function collectSkillAssets(
  root: string,
  file: string,
): Promise<ResourceAsset[]> {
  const assets: ResourceAsset[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(directory, entry.name);
      if ([".git", "node_modules", ".DS_Store"].includes(entry.name)) continue;
      if (
        (entry.name.startsWith(".env") &&
          ![".env.example", ".env.encrypted"].includes(entry.name)) ||
        entry.name.startsWith(".dev.vars")
      ) {
        fail(
          "INVALID_REFERENCE",
          "Private environment files must not be packaged as Skill resources",
          { file: path },
        );
      }
      if (entry.isSymbolicLink())
        fail("INVALID_REFERENCE", "Skill resource symlinks are not supported", {
          file: path,
        });
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile())
        assets.push({
          sourceFile: path,
          outputPath: relative(root, path).replaceAll("\\", "/"),
        });
    }
  }
  await walk(dirname(file));
  return assets;
}
