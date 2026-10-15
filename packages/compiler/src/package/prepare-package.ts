import { copyFile, lstat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SourcePackage } from "../source/schemas.ts";
import { fail } from "../errors.ts";
import { entryName } from "../emit/generate-entry.ts";
import { resolvePackageDependencies } from "./package-dependencies.ts";

/** Prepare the complete distribution in staging before replacing the previous dist. */
export async function preparePackage(
  root: string,
  output: string,
  source: SourcePackage,
): Promise<void> {
  const manifest: Record<string, unknown> = {};
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
  ]) {
    if (Object.hasOwn(source, key)) manifest[key] = source[key];
  }
  manifest.loom = {
    type: source.loom.type,
    version: source.loom.version,
  };
  manifest.exports = {
    ".": { types: `./${entryName}.d.ts`, default: `./${entryName}.js` },
    "./package.json": "./package.json",
  };
  manifest.files = ["**/*"];
  for (const category of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ] as const) {
    const entries = source[category];
    if (!entries) continue;
    try {
      manifest[category] = await resolvePackageDependencies(root, entries);
    } catch (cause) {
      fail(
        "INVALID_OUTPUT",
        cause instanceof Error ? cause.message : "Invalid package dependencies",
        { file: resolve(root, "package.json") },
        cause,
      );
    }
  }
  for (const name of ["README.md", "LICENSE"]) {
    const file = resolve(root, name);
    const info = await lstat(file).catch((cause: unknown) => {
      if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
        return undefined;
      throw cause;
    });
    if (!info) continue;
    if (!info.isFile())
      fail("INVALID_OUTPUT", "Package documentation must be an ordinary file", {
        file,
      });
    await copyFile(file, resolve(output, name));
  }
  await writeFile(
    resolve(output, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}
