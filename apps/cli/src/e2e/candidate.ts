import {
  cp,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import * as z from "zod";
import { E2eError } from "./contracts.ts";

import { processResult } from "./process.ts";
import { digest } from "./cases.ts";
import type { Evidence } from "./evidence.ts";

const manifestSchema = z.looseObject({
  name: z.string(),
  version: z.string(),
  dependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  peerDependenciesMeta: z
    .record(z.string(), z.object({ optional: z.boolean().optional() }))
    .optional(),
  files: z.array(z.string()).optional(),
});
type Manifest = z.infer<typeof manifestSchema>;
interface CandidatePackage {
  source: string;
  content: string;
  directory: string;
  archive: string;
  manifest: Manifest;
  dependencies: Record<string, CandidatePackage>;
  optional: Set<string>;
}

/** Preserve the built Loom and its installed runtime graph without registry resolution. */
export async function snapshotCandidate(
  sourceManifest: string,
  compiledDirectory: string,
  directory: string,
  evidence: Evidence,
  signal?: AbortSignal,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const root = join(directory, "candidate");
  const archives = join(root, "archives");
  await mkdir(archives, { recursive: true, mode: 0o700 });
  const packages = new Map<string, CandidatePackage>();

  const original = await realpath(sourceManifest);
  async function visit(source: string): Promise<CandidatePackage> {
    signal?.throwIfAborted();
    source = await realpath(source);
    const existing = packages.get(source);
    if (existing) return existing;
    const isRoot = source === original;
    const manifest = manifestSchema.parse(
      JSON.parse(
        await readFile(
          isRoot ? join(compiledDirectory, "package.json") : source,
          "utf8",
        ),
      ),
    );
    const id = `package-${String(packages.size).padStart(3, "0")}`;
    const item: CandidatePackage = {
      source,
      content: isRoot ? compiledDirectory : dirname(source),
      directory: join(root, "packages", id),
      archive: join(archives, `${id}.tgz`),
      manifest,
      dependencies: {},
      optional: new Set(),
    };
    packages.set(source, item);
    const required = { ...manifest.dependencies, ...manifest.peerDependencies };
    for (const [name, range] of Object.entries({
      ...required,
      ...manifest.optionalDependencies,
    })) {
      const optional =
        Object.hasOwn(manifest.optionalDependencies ?? {}, name) ||
        (!Object.hasOwn(manifest.dependencies ?? {}, name) &&
          manifest.peerDependenciesMeta?.[name]?.optional === true);
      let resolved: string | undefined;
      try {
        resolved = findPackageJSON(name, pathToFileURL(source));
      } catch {
        /* Missing optional packages stay absent, as in this installed workspace. */
      }
      if (!resolved) {
        if (optional) continue;
        throw new E2eError(
          "CANDIDATE_DEPENDENCY_MISSING",
          `The installed runtime dependency ${name}@${range} is missing. Install and build the local Loom dependencies before E2E.`,
          "environment",
          "blocked",
        );
      }
      item.dependencies[name] = await visit(resolved);
      if (optional) item.optional.add(name);
    }
    return item;
  }
  const loom = await visit(original);
  const identities = [];
  for (const item of packages.values()) {
    signal?.throwIfAborted();
    await mkdir(item.directory, { recursive: true, mode: 0o700 });
    // Let npm apply each installed package's own files/main/exports rules.
    // A dist directory alone does not imply that its other runtime files can be omitted.
    await cp(item.content, item.directory, {
      recursive: true,
      dereference: true,
      filter: (path) =>
        !["node_modules", ".git", ".npmrc"].includes(basename(path)) &&
        !/^\.env(?:\.|$)/u.test(basename(path)),
    });
    const manifest: Record<string, unknown> = { ...item.manifest };
    for (const key of [
      "scripts",
      "devDependencies",
      "peerDependencies",
      "peerDependenciesMeta",
      "bundledDependencies",
      "bundleDependencies",
      "publishConfig",
    ])
      delete manifest[key];
    manifest.dependencies = {};
    manifest.optionalDependencies = {};
    for (const [name, dependency] of Object.entries(item.dependencies))
      (
        manifest[
          item.optional.has(name) ? "optionalDependencies" : "dependencies"
        ] as Record<string, string>
      )[name] = `file:${dependency.archive}`;
    await writeFile(
      join(item.directory, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { mode: 0o600 },
    );
    const packed = await processResult(
      "npm",
      [
        "pack",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        archives,
        "--cache",
        join(directory, ".npm-cache"),
      ],
      item.directory,
      30000,
      signal,
      environment,
    );
    await evidence.event("candidate_package", {
      name: item.manifest.name,
      version: item.manifest.version,
      code: packed.code,
      stderr: packed.stderr,
    });
    if (packed.code)
      throw new E2eError(
        "CANDIDATE_PACK_FAILED",
        `Cannot prepare the local ${item.manifest.name} runtime package. See candidate-package evidence.`,
        "environment",
        "blocked",
      );
    const filename = z
      .array(z.object({ filename: z.string() }))
      .parse(JSON.parse(packed.stdout))[0]?.filename;
    if (!filename || basename(filename) !== filename)
      throw new E2eError(
        "CANDIDATE_PACK_FAILED",
        "npm did not return a valid local package archive.",
        "environment",
        "blocked",
      );
    await rename(join(archives, filename), item.archive);
    identities.push({
      name: item.manifest.name,
      version: item.manifest.version,
      source: item.source,
      archive: item.archive,
      digest: digest(await readFile(item.archive)),
      dependencies: Object.fromEntries(
        Object.entries(item.dependencies).map(([name, dependency]) => [
          name,
          dependency.archive,
        ]),
      ),
    });
  }
  const candidate = {
    source: "built_local",
    archive: loom.archive,
    packages: identities,
  };
  await evidence.save("candidate.json", candidate);
  await rm(join(root, "packages"), { recursive: true, force: true });
  return candidate;
}
