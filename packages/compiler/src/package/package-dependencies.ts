import { readFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Prepared packages must resolve outside the author's workspace. */
export async function resolvePackageDependencies(
  root: string,
  dependencies: Readonly<Record<string, string>>,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [name, range] of Object.entries(dependencies)) {
    if (/^(?:file|link|catalog):/.test(range))
      throw new Error(`Unpublishable dependency: ${name}@${range}`);
    if (!range.startsWith("workspace:")) {
      result[name] = range;
      continue;
    }
    const prefix = range.slice(10);
    if (!["*", "^", "~"].includes(prefix))
      throw new Error(`Unsupported workspace range: ${name}@${range}`);
    const file = findPackageJSON(
      name,
      pathToFileURL(resolve(root, "package.json")),
    );
    if (!file) throw new Error(`Missing workspace dependency: ${name}`);
    const dependency: unknown = JSON.parse(await readFile(file, "utf8"));
    if (
      !dependency ||
      typeof dependency !== "object" ||
      !("name" in dependency) ||
      dependency.name !== name ||
      !("version" in dependency) ||
      typeof dependency.version !== "string" ||
      !dependency.version.trim()
    )
      throw new Error(`Invalid workspace dependency metadata: ${name}`);
    result[name] = `${prefix === "*" ? "" : prefix}${dependency.version}`;
  }
  return result;
}
