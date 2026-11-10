import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { InstalledLoomRef } from "@intloom/loom-sdk";
import {
  dependencyClosure,
  PackageError,
} from "@intloom/loom-sdk/package-format";
import { stableJson } from "@intloom/loom-sdk/json";
import { rcompare, satisfies, validRange } from "semver";
import { z } from "zod";
import { readDependencyDeclaration } from "./dependency-declaration.ts";
import { schemaType } from "./schema.ts";
import type {
  LoomLock,
  ResolvedLoomDependencies,
  ResolveLoomDependenciesOptions,
} from "./types.ts";

const identity = z.strictObject({
  id: z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
  version: z.string(),
});
const ref = identity.extend({
  artifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
const aliases = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const declarationsSchema = z.record(aliases, identity);
const lockSchema = z.strictObject({
  formatVersion: z.literal(1),
  declarations: declarationsSchema,
  dependencies: z.record(aliases, ref),
  packages: z.array(
    z.strictObject({ ref, dependencies: z.record(aliases, ref) }),
  ),
});

export async function resolveLoomDependencies(
  options: ResolveLoomDependenciesOptions,
): Promise<ResolvedLoomDependencies> {
  return prepareDependencies(options, true);
}

export async function prepareDependencies(
  options: ResolveLoomDependenciesOptions,
  explicit: boolean,
  expectedLock?: LoomLock,
): Promise<ResolvedLoomDependencies> {
  const project = resolve(options.projectDir);
  const parsed = declarationsSchema.safeParse(
    await readDependencyDeclaration(project),
  );
  if (!parsed.success)
    throw new PackageError(
      "DEPENDENCY_DECLARATION_INVALID",
      parsed.error.message,
    );
  const declarations = parsed.data;
  for (const [alias, spec] of Object.entries(declarations))
    if (!spec.version.trim() || !validRange(spec.version))
      throw new PackageError("DEPENDENCY_RANGE_INVALID", alias);
  for (const alias of Object.keys(options.selections ?? {}))
    if (!declarations[alias])
      throw new PackageError("DEPENDENCY_SELECTION_INVALID", alias);
  const lockFile = join(project, "loom.lock.json");
  const previous = await readFile(lockFile, "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return undefined;
    },
  );
  let old: LoomLock | undefined;
  if (previous) {
    const parsed = lockSchema.safeParse(JSON.parse(previous));
    if (!parsed.success)
      throw new PackageError("LOCK_INVALID", parsed.error.message);
    old = parsed.data;
  }
  const dependencies: Record<string, InstalledLoomRef> = {};
  if (
    old &&
    !options.update &&
    stableJson(old.declarations) !== stableJson(declarations)
  )
    throw new PackageError(
      "LOCK_OUTDATED",
      "Declarations changed; explicitly update the lock.",
    );
  if (expectedLock && (!old || stableJson(old) !== stableJson(expectedLock)))
    throw new PackageError(
      "LOCK_OUTDATED",
      "The supplied dependency snapshot no longer matches loom.lock.json.",
    );
  const available = Object.keys(declarations).length
    ? typeof options.catalog === "function"
      ? await options.catalog(
          old && !options.update ? Object.values(old.dependencies) : undefined,
        )
      : options.catalog
    : [];
  for (const [alias, spec] of Object.entries(declarations).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const selection = options.selections?.[alias];
    const locked = old?.dependencies[alias];
    if (old && !options.update) {
      if (
        !locked ||
        locked.id !== spec.id ||
        !satisfies(locked.version, spec.version) ||
        (selection && selection !== locked.artifactDigest)
      )
        throw new PackageError("LOCK_OUTDATED", alias);
      dependencies[alias] = locked;
      continue;
    }
    let candidates = available.filter(
      (entry) =>
        entry.ref.id === spec.id && satisfies(entry.ref.version, spec.version),
    );
    if (selection)
      candidates = candidates.filter(
        (entry) => entry.ref.artifactDigest === selection,
      );
    candidates.sort((a, b) => rcompare(a.ref.version, b.ref.version));
    const highest = candidates[0]?.ref.version;
    candidates = [
      ...new Map(
        candidates
          .filter((entry) => entry.ref.version === highest)
          .map((entry) => [entry.ref.artifactDigest, entry]),
      ).values(),
    ];
    const selected = candidates[0];
    if (!selected)
      throw new PackageError(
        "DEPENDENCY_MISSING",
        `${alias}: ${spec.id}@${spec.version}`,
      );
    if (candidates.length !== 1)
      throw new PackageError(
        "DEPENDENCY_AMBIGUOUS",
        `${alias}: select an exact artifact digest.`,
      );
    dependencies[alias] = selected.ref;
  }
  const catalog = dependencyClosure(Object.values(dependencies), available);
  const lock: LoomLock = {
    formatVersion: 1,
    declarations,
    dependencies,
    packages: catalog.map(({ ref, manifest }) => ({
      ref,
      dependencies: manifest.dependencies,
    })),
  };
  if (old && !options.update && stableJson(old) !== stableJson(lock))
    throw new PackageError(
      "LOCK_INVALID",
      "Locked dependency graph does not match installed manifests.",
    );
  const lines = [
    "// Generated by Intloom. Resolve dependencies to regenerate.",
    'import type { JsonValue, LoomRef } from "@intloom/loom-sdk";',
  ];
  let index = 0;
  for (const [alias, ref] of Object.entries(dependencies)) {
    // dependencyClosure has already established that every root is present.
    const contracts = (
      catalog.find(
        (entry) => entry.ref.artifactDigest === ref.artifactDigest,
      ) as (typeof catalog)[number]
    ).manifest.contracts;
    const name = `loom${index++}`;
    lines.push(
      `const ${name}: LoomRef<${schemaType(contracts.input, "input")}, ${schemaType(contracts.normalizedInput)}, ${schemaType(contracts.output)}> = ${stableJson({ kind: "loom_ref", ...ref, contracts })};`,
      `export { ${name} as ${JSON.stringify(alias)} };`,
    );
  }
  const referencesFile = join(project, ".intloom/dependencies.ts");
  if (explicit || old || Object.keys(declarations).length) {
    await mkdir(dirname(referencesFile), { recursive: true });
    await writeFile(`${referencesFile}.tmp`, `${lines.join("\n")}\n`);
    await rename(`${referencesFile}.tmp`, referencesFile);
    await writeFile(`${lockFile}.tmp`, `${stableJson(lock)}\n`);
    await rename(`${lockFile}.tmp`, lockFile);
  }
  return { lock, lockFile, referencesFile, catalog };
}
