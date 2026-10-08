import { readFile, writeFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
export const publications = [
  { name: "@intloom/utils", directory: "packages/utils", entry: "." },
  {
    name: "@intloom/workflow-sdk",
    directory: "packages/workflow-sdk",
    entry: ".",
  },
  { name: "@intloom/compiler", directory: "packages/compiler", entry: "." },
  {
    name: "@intloom/workflow-intent",
    directory: "packages/intent",
    entry: "dist",
  },
  { name: "@intloom/cli", directory: "apps/cli", entry: ".publish" },
  { name: "intloom", directory: "apps/cli", entry: ".publish-intloom" },
] as const;

export type PublicationName = (typeof publications)[number]["name"];

export interface PackageManifest {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  bundleDependencies?: string[];
  devDependencies?: unknown;
  scripts?: unknown;
  license?: string;
  repository?: string | { url?: string };
  engines?: Record<string, string>;
  publishConfig?: { access?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export async function readManifest(root: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
}

/** Resolve workspace ranges before staging; a prepared directory is not itself a Bun workspace. */
export async function distributionManifest(
  root: string,
): Promise<PackageManifest> {
  const manifest = await readManifest(root);
  for (const category of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ] as const) {
    const entries = manifest[category];
    if (!entries) continue;
    for (const [name, range] of Object.entries(entries)) {
      if (/^(file|link|catalog):/.test(range))
        throw new Error(`Unpublishable dependency: ${name}@${range}`);
      if (!range.startsWith("workspace:")) continue;
      const prefix = range.slice(10);
      if (!["*", "^", "~"].includes(prefix))
        throw new Error(`Unsupported workspace range: ${range}`);
      const file = findPackageJSON(
        name,
        pathToFileURL(resolve(root, "package.json")),
      );
      if (!file) throw new Error(`Missing workspace dependency: ${name}`);
      const dependency = await readManifest(dirname(file));
      if (dependency.name !== name)
        throw new Error(`Dependency name mismatch: ${name}`);
      entries[name] = `${prefix === "*" ? "" : prefix}${dependency.version}`;
    }
  }
  delete manifest.devDependencies;
  delete manifest.scripts;
  return manifest;
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
