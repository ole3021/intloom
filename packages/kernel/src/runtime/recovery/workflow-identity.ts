import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorkflowPackage } from "../../workflow/types.ts";

/** Hash executable resources as well as package/protocol versions; equal version labels alone are insufficient. */
export async function workflowIdentity(
  source: WorkflowPackage,
): Promise<string> {
  const hash = createHash("sha256");
  hash.update(
    JSON.stringify([
      source.packageName,
      source.packageVersion,
      source.protocolVersion,
    ]),
  );
  async function visit(directory: string, prefix: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (["node_modules", ".git", ".intloom"].includes(entry.name)) continue;
      const relative = `${prefix}${entry.name}`;
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(
          "Recovery requires materialized Workflow resources, not symbolic links.",
        );
      if (entry.isDirectory()) await visit(path, `${relative}/`);
      else if (entry.isFile()) {
        const bytes = await readFile(path);
        hash.update(JSON.stringify([relative, bytes.length]));
        hash.update(bytes);
      }
    }
  }
  await visit(source.assetRoot, "");
  return hash.digest("hex");
}
