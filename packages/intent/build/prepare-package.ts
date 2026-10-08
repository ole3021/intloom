import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as z from "zod";

const manifestSchema = z.looseObject({
  name: z.string().min(1),
  version: z.string().min(1),
  type: z.literal("module"),
  intloom: z.strictObject({
    type: z.literal("workflow"),
    version: z.string().min(1),
  }),
  exports: z.object({
    ".": z.record(z.string(), z.string()),
    "./package.json": z.literal("./package.json"),
  }),
  dependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
});

/** Derives the publish configuration from the development manifest; Compiler still only builds Workflows. */
export async function preparePackage(packageRoot: string): Promise<void> {
  const manifestFile = resolve(packageRoot, "package.json");
  const source = manifestSchema.parse(
    JSON.parse(await readFile(manifestFile, "utf8")),
  );
  const destination = resolve(packageRoot, "dist");
  const exports: Record<string, string> = {};
  for (const [condition, target] of Object.entries(source.exports["."])) {
    if (
      !target.startsWith("./dist/") ||
      target.slice(7).split("/").includes("..")
    ) {
      throw new Error(`Package entry must be inside dist: ${target}`);
    }
    await access(resolve(packageRoot, target));
    exports[condition] = `./${target.slice(7)}`;
  }

  async function dependencies(values: Record<string, string> | undefined) {
    if (!values) return undefined;
    const result: Record<string, string> = {};
    for (const [name, range] of Object.entries(values)) {
      if (range.startsWith("workspace:")) {
        const prefix = range.slice(10);
        if (!["*", "^", "~"].includes(prefix)) {
          throw new Error(`Unsupported workspace range: ${name}@${range}`);
        }
        const file = findPackageJSON(name, pathToFileURL(manifestFile));
        if (!file)
          throw new Error(`Workspace dependency is not installed: ${name}`);
        const dependency = z
          .object({ name: z.string(), version: z.string().min(1) })
          .parse(JSON.parse(await readFile(file, "utf8")));
        if (dependency.name !== name)
          throw new Error(`Workspace dependency name mismatch: ${name}`);
        result[name] = `${prefix === "*" ? "" : prefix}${dependency.version}`;
      } else {
        if (/^(?:file|link|catalog):/.test(range)) {
          throw new Error(
            `Local dependency cannot be published: ${name}@${range}`,
          );
        }
        result[name] = range;
      }
    }
    return result;
  }

  // Allowlist package descriptions and installation metadata; exclude development scripts, private, and devDependencies from publish configuration.
  const output: Record<string, unknown> = {};
  for (const key of [
    "name",
    "version",
    "type",
    "description",
    "license",
    "author",
    "contributors",
    "keywords",
    "homepage",
    "repository",
    "bugs",
    "engines",
    "publishConfig",
    "peerDependenciesMeta",
    "sideEffects",
    "intloom",
  ]) {
    if (Object.hasOwn(source, key)) output[key] = source[key];
  }
  output.exports = { ".": exports, "./package.json": "./package.json" };
  output.files = ["**/*"];
  for (const key of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ] as const) {
    const values = await dependencies(source[key]);
    if (values) output[key] = values;
  }
  // The package already has a README; copy a license only when supplied by the author, without generating a placeholder claim.
  await copyFile(
    resolve(packageRoot, "README.md"),
    resolve(destination, "README.md"),
  );
  try {
    await copyFile(
      resolve(packageRoot, "LICENSE"),
      resolve(destination, "LICENSE"),
    );
  } catch (cause) {
    if (
      !(
        cause &&
        typeof cause === "object" &&
        "code" in cause &&
        cause.code === "ENOENT"
      )
    )
      throw cause;
  }
  await writeFile(
    resolve(destination, "package.json"),
    `${JSON.stringify(output, null, 2)}\n`,
  );
}
