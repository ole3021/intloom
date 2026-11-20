import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type Diagnostic,
  loomManifestSchema,
  type LoomManifest,
  packageIdentitySchema,
} from "@intloom/loom-sdk";
import { parseDocument } from "yaml";
import { z } from "zod";

const dependenciesSchema = z.record(z.string(), z.string());
const packageSchema = packageIdentitySchema.strip().extend({
  type: z.literal("module"),
  dependencies: dependenciesSchema.optional(),
  optionalDependencies: dependenciesSchema.optional(),
  peerDependencies: dependenciesSchema.optional(),
  peerDependenciesMeta: z
    .record(z.string(), z.object({ optional: z.boolean().optional() }))
    .optional(),
  engines: dependenciesSchema.optional(),
  description: z.string().optional(),
  license: z.string().optional(),
  private: z.boolean().optional(),
  author: z
    .union([
      z.string(),
      z.object({
        name: z.string(),
        email: z.string().optional(),
        url: z.string().optional(),
      }),
    ])
    .optional(),
  repository: z
    .union([
      z.string(),
      z.object({
        type: z.string(),
        url: z.string(),
        directory: z.string().optional(),
      }),
    ])
    .optional(),
  homepage: z.string().optional(),
});

export interface Project {
  readonly root: string;
  readonly manifest: LoomManifest;
  readonly package: z.infer<typeof packageSchema>;
}

export function schemaDiagnostics(
  error: z.ZodError,
  file: string,
): Diagnostic[] {
  return error.issues.map((issue) => ({
    code: "INVALID_DECLARATION",
    file,
    path: issue.path.map((part) =>
      typeof part === "symbol" ? String(part) : part,
    ),
    message: issue.message,
  }));
}

export async function readProject(
  root: string,
  diagnostics: Diagnostic[],
): Promise<Project | undefined> {
  const manifestFile = join(root, "loom.yaml");
  const document = parseDocument(await readFile(manifestFile, "utf8"));
  for (const error of document.errors)
    diagnostics.push({
      code: "INVALID_YAML",
      file: manifestFile,
      message: error.message,
    });
  if (document.errors.length) return;
  const manifest = loomManifestSchema.safeParse(document.toJS());
  if (!manifest.success)
    diagnostics.push(...schemaDiagnostics(manifest.error, manifestFile));
  const packageFile = join(root, "package.json");
  const metadata = packageSchema.safeParse(
    JSON.parse(await readFile(packageFile, "utf8")),
  );
  if (!metadata.success)
    diagnostics.push(...schemaDiagnostics(metadata.error, packageFile));
  if (!manifest.success || !metadata.success) return;
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const) {
    for (const [name, version] of Object.entries(metadata.data[field] ?? {})) {
      if (/^(?:workspace:|file:|link:|\.\.?\/|\/)/.test(version)) {
        diagnostics.push({
          code: "LOCAL_DEPENDENCY",
          file: packageFile,
          path: [field, name],
          message:
            "Distributable Loom dependencies must use installable package versions or URLs",
        });
      }
    }
  }
  return { root, manifest: manifest.data, package: metadata.data };
}
