import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { LoomManifest } from "@intloom/loom-sdk";
import {
  assertPackagePath,
  createIntegrity,
  PackageError,
  parseManifest,
} from "@intloom/loom-sdk/package-format";
import { stableJson } from "@intloom/loom-sdk/json";
import { z } from "zod";
import { valid } from "semver";
import { prepareDependencies } from "./dependencies.ts";
import { readArtifact } from "./files.ts";
import type { Inspection } from "./inspect.ts";
import { bundleModule, checkTypes, inspectModule } from "./module.ts";
import type {
  CompileDiagnostic,
  CompileOptions,
  CompileResult,
} from "./types.ts";

export async function compileLoom(
  options: CompileOptions,
): Promise<CompileResult> {
  let stage: CompileDiagnostic["stage"] = "definition";
  const temporary = await mkdtemp(join(tmpdir(), "intloom-compile-"));
  let staged: string | undefined;
  try {
    const { target = "node22" } = options;
    if (target !== "node22" && target !== "node26")
      throw new PackageError(
        "TARGET_UNSUPPORTED",
        "Supported targets are node22 and node26.",
      );
    const entry = resolve(options.entryFile);
    if (basename(entry) !== "loom.ts")
      throw new PackageError("ENTRY_INVALID", "Author entry must be loom.ts.");
    const root = dirname(entry);
    const output = resolve(options.outDir);
    const fromOutput = relative(output, entry);
    if (!fromOutput.startsWith("../") && fromOutput !== "..")
      throw new PackageError(
        "OUTPUT_INVALID",
        "Output cannot contain the author entry.",
      );
    stage = "dependencies";
    const resolved = await prepareDependencies(
      {
        projectDir: root,
        catalog: options.catalog ?? options.dependencies?.catalog ?? [],
        ...(options.update ? { update: true } : {}),
      },
      false,
      options.dependencies?.lock,
    );
    stage = "typecheck";
    await checkTypes(entry, temporary);
    stage = "module";
    const module = join(temporary, "loom.mjs");
    await bundleModule(entry, module, target);
    stage = "definition";
    const inspected = (await inspectModule(
      module,
      join(temporary, "inspection.json"),
      target,
    )) as Inspection;
    if (!valid(inspected.manifest.version))
      throw new PackageError("DEFINITION_INVALID", "Invalid semantic version.");
    stage = "dependencies";
    const dependencies = resolved.lock.dependencies;
    if (
      stableJson(inspected.declarations) !==
      stableJson(resolved.lock.declarations)
    )
      throw new PackageError(
        "DEPENDENCY_UNRESOLVED",
        "Runtime dependencies must match the static literal in loom.ts.",
      );
    for (const reference of inspected.dependencyRefs) {
      if (
        !Object.values(dependencies).some(
          (ref) => stableJson(ref) === stableJson(reference.ref),
        )
      )
        throw new PackageError(
          "DEPENDENCY_UNRESOLVED",
          `Unresolved Loom reference: ${reference.ref.id}`,
        );
      const installed = resolved.catalog.find(
        (entry) => entry.ref.artifactDigest === reference.ref.artifactDigest,
      );
      if (
        !installed ||
        stableJson(installed.manifest.contracts) !==
          stableJson(reference.contracts)
      )
        throw new PackageError(
          "DEPENDENCY_CONTRACT_MISMATCH",
          reference.ref.id,
        );
    }
    if (
      Object.keys(dependencies).length &&
      stableJson(JSON.parse(await readFile(resolved.lockFile, "utf8"))) !==
        stableJson(resolved.lock)
    )
      throw new PackageError(
        "LOCK_OUTDATED",
        "Resolve dependencies again before compiling.",
      );
    stage = "resources";
    const files = new Map<string, Uint8Array>([
      ["runtime.mjs", await readFile(module)],
    ]);
    const resources: Record<string, { path: string }> = {};
    for (const [id, source] of Object.entries(inspected.resourcePaths)) {
      assertPackagePath(source);
      let path = root;
      for (const part of source.split("/")) {
        path = join(path, part);
        if ((await lstat(path)).isSymbolicLink())
          throw new PackageError(
            "RESOURCE_INVALID",
            `Linked resource: ${source}`,
          );
      }
      if (!(await lstat(path)).isFile())
        throw new PackageError(
          "RESOURCE_INVALID",
          `Resource must be a file: ${source}`,
        );
      const target =
        inspected.manifest.resources[id]?.path ??
        `resources/${id}/${basename(source)}`;
      resources[id] = { path: target };
      files.set(target, await readFile(path));
    }
    stage = "artifact";
    const manifest: LoomManifest = parseManifest({
      ...inspected.manifest,
      dependencies,
      resources,
    });
    const authorPackage = await readFile(
      join(root, "package.json"),
      "utf8",
    ).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT")
        throw new PackageError(
          "PACKAGE_NAME_INVALID",
          `Missing package.json for Loom "${manifest.id}".`,
        );
      throw error;
    });
    const metadata = z
      .object({
        name: z.string().optional(),
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
        license: z.string().optional(),
        files: z.array(z.string()).optional(),
      })
      .parse(JSON.parse(authorPackage));
    if (options.npmName !== undefined && options.npmName !== manifest.id)
      throw new PackageError(
        "PACKAGE_NAME_INVALID",
        `npmName "${options.npmName}" cannot override Loom ID "${manifest.id}".`,
      );
    if (metadata.name !== manifest.id)
      throw new PackageError(
        "PACKAGE_NAME_INVALID",
        `Loom ID "${manifest.id}" must match package.json name "${metadata.name ?? "(missing)"}".`,
      );
    for (const file of ["README.md", "LICENSE", "LICENSE.md", "LICENSE.txt"]) {
      if (!metadata.files?.includes(file)) continue;
      const path = join(root, file);
      if (!(await lstat(path)).isFile())
        throw new PackageError(
          "PACKAGE_DOCUMENT_INVALID",
          `Expected a regular file: ${file}.`,
        );
      files.set(file, await readFile(path));
    }
    files.set(
      "package.json",
      new TextEncoder().encode(
        stableJson({
          name: manifest.id,
          description: manifest.description,
          ...(metadata.license ? { license: metadata.license } : {}),
          ...(metadata.repository ? { repository: metadata.repository } : {}),
          version: manifest.version,
          type: "module",
          engines: { node: manifest.requirements.node },
        }),
      ),
    );
    files.set("loom.json", new TextEncoder().encode(stableJson(manifest)));
    const integrity = await createIntegrity(files);
    files.set(
      "integrity.json",
      new TextEncoder().encode(stableJson(integrity)),
    );
    await mkdir(dirname(output), { recursive: true });
    const existing = await lstat(output).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
        return undefined;
      },
    );
    if (existing) {
      if (!existing.isDirectory() || existing.isSymbolicLink())
        throw new PackageError(
          "OUTPUT_INVALID",
          "Output is not an artifact directory.",
        );
      await readArtifact(output);
    }
    staged = await mkdtemp(join(dirname(output), ".loom-build-"));
    for (const [path, bytes] of files) {
      await mkdir(dirname(join(staged, path)), { recursive: true });
      await writeFile(join(staged, path), bytes);
    }
    if (existing) await rm(output, { recursive: true });
    await rename(staged, output);
    staged = undefined;
    return {
      ok: true,
      artifactDir: output,
      manifest,
      artifactDigest: integrity.artifactDigest,
      diagnostics: [],
    };
  } catch (error) {
    const failure = error as { code?: string; path?: string; message?: string };
    const code =
      stage === "resources" && failure.code === "ENOENT"
        ? "RESOURCE_MISSING"
        : (failure.code ??
          (stage === "module" ? "MODULE_UNSUPPORTED" : "COMPILE_FAILED"));
    return {
      ok: false,
      diagnostics: [
        {
          stage: code.startsWith("SCHEMA_") ? "schema" : stage,
          code,
          message: failure.message ?? String(error),
          ...(failure.path ? { path: failure.path } : {}),
        },
      ],
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
    if (staged) await rm(staged, { recursive: true, force: true });
  }
}
