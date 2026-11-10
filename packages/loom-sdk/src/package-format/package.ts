import { stableJson } from "../schema/json.ts";
import { z } from "zod";
import type { ArtifactIntegrity, LoomManifest } from "../contracts/package.ts";
import type { InstalledLoomRef } from "../definitions/loom.ts";
import { checkOutcome } from "../contracts/outcome.ts";

export class PackageError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PackageError";
  }
}
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const identity = z.strictObject({
  id: z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
  version: z
    .string()
    .regex(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    ),
});
const ref = identity.extend({ artifactDigest: digest });
const object = z.record(z.string(), z.json());
const contracts = z.strictObject({
  input: object,
  normalizedInput: object,
  output: object,
});
const capabilities = z.array(z.enum(["tool_use", "structured_output"]));
const outcome = z.strictObject({
  description: z.string().optional(),
  artifacts: z
    .record(
      id,
      z.strictObject({
        at: z.string(),
        description: z.string().optional(),
        mediaTypes: z.array(z.string()).optional(),
        multiple: z.boolean().optional(),
        required: z.boolean().optional(),
      }),
    )
    .optional(),
  acceptance: z
    .strictObject({
      at: z.string(),
      subjectAt: z.string(),
      criteria: z.array(z.strictObject({ id, description: z.string() })).min(1),
    })
    .optional(),
});
const component = z.strictObject({
  kind: z.enum(["code", "agent", "tool", "skill", "workflow"]),
  description: z.string().optional(),
  contracts: contracts.optional(),
  uses: z
    .strictObject({
      agents: z.array(id).optional(),
      tools: z.array(id).optional(),
      resources: z.array(id).optional(),
    })
    .optional(),
  model: z
    .strictObject({ slot: id, profile: id.optional(), capabilities })
    .optional(),
  binding: id.optional(),
  instructions: z
    .union([
      z.strictObject({ text: z.string() }),
      z.strictObject({ resource: id }),
    ])
    .optional(),
  tools: z.array(id).optional(),
  skills: z.array(id).optional(),
  resources: z.array(id).optional(),
  resultTool: id.optional(),
  outputMode: z.enum(["text", "structured"]).optional(),
  generation: z
    .strictObject({
      maxSteps: z.number().int().positive(),
      temperature: z.number().optional(),
      maxOutputTokens: z.number().int().positive().optional(),
    })
    .optional(),
  workflowType: z.literal("mastra").optional(),
  structure: z.array(z.json()).optional(),
});
const manifestSchema = identity.extend({
  name: z.string().min(1),
  formatVersion: z.literal(1),
  description: z.string(),
  storage: z.enum(["global", "project"]),
  entry: z.strictObject({
    kind: z.enum(["code", "agent", "workflow"]),
    id,
    workflowType: z.literal("mastra").optional(),
  }),
  module: z.strictObject({
    path: z.literal("./runtime.mjs"),
    export: z.literal("default"),
  }),
  contracts,
  components: z.record(id, component),
  dependencies: z.record(id, ref),
  resources: z.record(id, z.strictObject({ path: z.string() })),
  requirements: z.strictObject({
    node: z.string().min(1),
    workflowTypes: z.array(z.literal("mastra")),
    models: z.record(id, capabilities),
    tools: z.array(id),
  }),
  outcome: outcome.optional(),
  build: z.strictObject({
    compilerVersion: z.string(),
    target: z.enum(["node22", "node26"]),
  }),
});
const integritySchema = z.strictObject({
  formatVersion: z.literal(1),
  artifactDigest: digest,
  files: z.array(z.tuple([z.string(), digest])),
});
export function parseManifest(value: unknown): LoomManifest {
  const result = manifestSchema.safeParse(value);
  if (!result.success)
    throw new PackageError("MANIFEST_INVALID", result.error.message);
  // These are wire contracts; absent optional JSON properties are omitted.
  const manifest = result.data as LoomManifest;
  const entry = manifest.components[manifest.entry.id];
  if (
    !entry ||
    entry.kind !== manifest.entry.kind ||
    stableJson(entry.contracts) !== stableJson(manifest.contracts) ||
    entry.workflowType !== manifest.entry.workflowType
  )
    throw new PackageError(
      "MANIFEST_INVALID",
      "Entry does not match its component contract.",
    );
  if (manifest.outcome) checkOutcome(manifest.outcome);
  for (const resource of Object.values(manifest.resources)) {
    assertPackagePath(resource.path);
    if (
      !resource.path.startsWith("resources/") &&
      !resource.path.startsWith("skills/")
    )
      throw new PackageError(
        "MANIFEST_INVALID",
        "Resource paths must be inside resources/.",
      );
  }
  return manifest;
}
export function assertPackagePath(path: string): void {
  if (
    !path ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new PackageError(
      "PACKAGE_PATH_INVALID",
      `Invalid package-relative path: ${path}`,
    );
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
export async function createIntegrity(
  files: ReadonlyMap<string, Uint8Array>,
): Promise<ArtifactIntegrity> {
  const encoder = new TextEncoder();
  const paths = [...files.keys()].filter((path) => path !== "integrity.json");
  for (const path of paths) assertPackagePath(path);
  // UTF-8 byte order, independent of locale and UTF-16 surrogate ordering.
  paths.sort((a, b) => {
    const left = encoder.encode(a);
    const right = encoder.encode(b);
    for (let i = 0; i < Math.min(left.length, right.length); i++)
      if (left[i] !== right[i]) return (left[i] ?? 0) - (right[i] ?? 0);
    return left.length - right.length;
  });
  const entries = await Promise.all(
    paths.map(
      async (path) =>
        [path, await sha256(files.get(path) as Uint8Array)] as const,
    ),
  );
  return {
    formatVersion: 1,
    artifactDigest: await sha256(encoder.encode(JSON.stringify(entries))),
    files: entries,
  };
}
export async function verifyArtifact(
  files: ReadonlyMap<string, Uint8Array>,
  options: { allowLegacyNpmName?: boolean } = {},
): Promise<{
  manifest: LoomManifest;
  integrity: ArtifactIntegrity;
  npmName: string;
}> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const read = (path: string) => {
    const bytes = files.get(path);
    if (!bytes)
      throw new PackageError("PACKAGE_INCOMPLETE", `Missing ${path}.`);
    return JSON.parse(decoder.decode(bytes)) as unknown;
  };
  const parsed = integritySchema.safeParse(read("integrity.json"));
  if (!parsed.success)
    throw new PackageError("INTEGRITY_INVALID", parsed.error.message);
  const actual = await createIntegrity(files);
  if (stableJson(parsed.data) !== stableJson(actual))
    throw new PackageError(
      "INTEGRITY_MISMATCH",
      "Package files or digest do not match integrity.json.",
    );
  const manifest = parseManifest(read("loom.json"));
  const npm = z
    .object({ name: identity.shape.id, version: identity.shape.version })
    .safeParse(read("package.json"));
  if (
    !npm.success ||
    (!options.allowLegacyNpmName && npm.data.name !== manifest.id) ||
    npm.data.version !== manifest.version
  )
    throw new PackageError(
      "MANIFEST_INVALID",
      "npm package name and version must match the Loom ID and version.",
    );
  if (!files.has("runtime.mjs"))
    throw new PackageError("PACKAGE_INCOMPLETE", "Missing runtime.mjs.");
  for (const { path } of Object.values(manifest.resources))
    if (!files.has(path))
      throw new PackageError("PACKAGE_INCOMPLETE", `Missing resource ${path}.`);
  return { manifest, integrity: actual, npmName: npm.data.name };
}

/** Select the exact finite dependency graph; callers own file/catalog validation. */
export function dependencyClosure<
  T extends { readonly ref: InstalledLoomRef; readonly manifest: LoomManifest },
>(roots: readonly InstalledLoomRef[], catalog: readonly T[]): T[] {
  const available = new Map(
    catalog.map((entry) => [entry.ref.artifactDigest, entry]),
  );
  const visiting = new Set<string>();
  const complete = new Map<string, T>();
  function visit(ref: InstalledLoomRef): void {
    if (complete.has(ref.artifactDigest)) {
      if (stableJson(complete.get(ref.artifactDigest)?.ref) !== stableJson(ref))
        throw new PackageError("DEPENDENCY_IDENTITY_MISMATCH", ref.id);
      return;
    }
    if (visiting.has(ref.artifactDigest))
      throw new PackageError("DEPENDENCY_CYCLE", ref.id);
    const entry = available.get(ref.artifactDigest);
    if (!entry)
      throw new PackageError(
        "DEPENDENCY_MISSING",
        `Missing ${ref.id}@${ref.version} (${ref.artifactDigest}).`,
      );
    if (stableJson(entry.ref) !== stableJson(ref))
      throw new PackageError("DEPENDENCY_IDENTITY_MISMATCH", ref.id);
    visiting.add(ref.artifactDigest);
    for (const child of Object.values(entry.manifest.dependencies))
      visit(child);
    visiting.delete(ref.artifactDigest);
    complete.set(ref.artifactDigest, entry);
  }
  for (const root of roots) visit(root);
  return [...complete.values()].sort((a, b) =>
    a.ref.artifactDigest.localeCompare(b.ref.artifactDigest),
  );
}
