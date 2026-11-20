import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import type { CompiledLoom, Diagnostic } from "@intloom/loom-sdk";
import { inspect, type ComponentInspection } from "./code/inspect.ts";
import { checkImports, compile, emittedModules } from "./code/typescript.ts";
import { createManifest, createPackage } from "./output/manifest.ts";
import { readProject } from "./project/read.ts";
import { resolveReference } from "./project/resolve.ts";
import { collectResources } from "./resources/collect.ts";
import { collectSkills } from "./resources/skills.ts";

export interface CompilerOptions {
  readonly projectDir?: string;
}

export type CheckResult =
  | {
      readonly ok: true;
      readonly manifest: CompiledLoom;
      readonly inspection: {
        readonly components: readonly ComponentInspection[];
        readonly codeCalls: "dynamic";
      };
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

export async function prepare(
  options: CompilerOptions,
  consume: (
    stage: string,
    scratch: string,
    manifest: CompiledLoom,
  ) => Promise<void>,
): Promise<CheckResult> {
  const root = resolve(options.projectDir ?? ".");
  const diagnostics: Diagnostic[] = [];
  let scratch: string | undefined;
  try {
    const project = await readProject(root, diagnostics);
    if (!project || diagnostics.length) return { ok: false, diagnostics };
    const entry = await resolveReference(
      root,
      project.manifest.entry,
      diagnostics,
    );
    const agent = project.manifest.agent
      ? await resolveReference(root, project.manifest.agent, diagnostics)
      : undefined;
    if (!entry || diagnostics.length) return { ok: false, diagnostics };
    scratch = await mkdtemp(join(root, ".intloom-prepare-"));
    const stage = join(scratch, "package");
    await mkdir(stage);
    await writeFile(
      join(stage, "package.json"),
      JSON.stringify({ type: "module" }),
    );
    await compile(project, scratch, stage, entry, agent, diagnostics);
    if (diagnostics.length) return { ok: false, diagnostics };
    await rm(join(stage, basename(scratch)), { recursive: true, force: true });
    const modules = await emittedModules(stage);
    const sourceFiles = new Map<string, string>();
    for (const module of modules) {
      const original = join(root, relative(stage, module));
      const typescript = original
        .replace(/\.mjs$/, ".mts")
        .replace(/\.js$/, ".ts");
      try {
        await access(typescript);
        sourceFiles.set(module, typescript);
      } catch {
        sourceFiles.set(module, original);
      }
    }
    const copied = new Set<string>();
    const excluded = [scratch, join(root, "dist")];
    const resources = await collectResources(
      root,
      stage,
      project.manifest.resources,
      excluded,
      diagnostics,
      copied,
    );
    await checkImports(project, stage, modules, diagnostics);
    if (diagnostics.length) return { ok: false, diagnostics };
    const inspected = await inspect(stage, scratch, modules, entry, agent);
    diagnostics.push(
      ...inspected.diagnostics.map((diagnostic) =>
        diagnostic.file
          ? {
              ...diagnostic,
              file: sourceFiles.get(diagnostic.file) ?? diagnostic.file,
            }
          : diagnostic,
      ),
    );
    if (!inspected.entryKind || diagnostics.length)
      return { ok: false, diagnostics };
    const groups = inspected.skillGroups.map((group) => ({
      ...group,
      file: sourceFiles.get(group.file) ?? group.file,
    }));
    const skills = await collectSkills(root, groups, diagnostics);
    resources.push(
      ...(await collectResources(
        root,
        stage,
        skills.map((skill) => skill.path),
        excluded,
        diagnostics,
        copied,
      )),
    );
    if (diagnostics.length) return { ok: false, diagnostics };
    const manifest = createManifest(
      project,
      entry,
      agent,
      inspected.entryKind,
      skills,
      [...new Set(resources)].sort(),
    );
    await writeFile(
      join(stage, "loom.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await writeFile(
      join(stage, "package.json"),
      `${JSON.stringify(createPackage(project, manifest), null, 2)}\n`,
    );
    await consume(stage, scratch, manifest);
    return {
      ok: true,
      manifest,
      inspection: { components: inspected.components, codeCalls: "dynamic" },
      diagnostics: [],
    };
  } catch (error) {
    diagnostics.push({
      code: "PROJECT_ERROR",
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, diagnostics };
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
  }
}
