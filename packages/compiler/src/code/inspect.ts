import { readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  agentDefinitionSchema,
  getExecKind,
  type Diagnostic,
  workflowDefinitionSchema,
} from "@intloom/loom-sdk";
import type { ResolvedReference } from "../project/resolve.ts";
import { schemaDiagnostics } from "../project/read.ts";
import { runProcess } from "./typescript.ts";

export interface ComponentInspection {
  readonly kind: "code" | "agent" | "workflow";
  readonly module: string;
  readonly path: readonly string[];
}

export interface Inspection {
  readonly components: readonly ComponentInspection[];
  readonly entryKind?: "code" | "agent" | "workflow";
  readonly skillGroups: readonly {
    readonly file: string;
    readonly paths: readonly string[];
  }[];
  readonly diagnostics: readonly Diagnostic[];
}

export async function inspectModules(
  stage: string,
  modules: readonly string[],
  entry: ResolvedReference,
  mainAgent: ResolvedReference | undefined,
): Promise<Inspection> {
  const diagnostics: Diagnostic[] = [];
  const skillGroups: { file: string; paths: readonly string[] }[] = [];
  const components: ComponentInspection[] = [];
  const seen = new Set<unknown>();
  const exports = new Map<string, Record<string, unknown>>();
  const visit = (value: unknown, file: string, path: readonly string[]) => {
    const kind = getExecKind(value);
    if (kind)
      components.push({
        kind,
        module: relative(stage, file).replaceAll("\\", "/"),
        path,
      });
    if (seen.has(value)) return;
    seen.add(value);
    if (kind === "agent") {
      const parsed = agentDefinitionSchema.safeParse(value);
      if (!parsed.success) {
        diagnostics.push(...schemaDiagnostics(parsed.error, file));
        return;
      }
      skillGroups.push({ file, paths: parsed.data.skills ?? [] });
      for (const [name, tool] of Object.entries(parsed.data.tools ?? {}))
        if (typeof tool !== "string")
          visit(tool.exec, file, [...path, "tools", name]);
    } else if (kind === "workflow") {
      const parsed = workflowDefinitionSchema.safeParse(value);
      if (!parsed.success) {
        diagnostics.push(...schemaDiagnostics(parsed.error, file));
        return;
      }
      for (const step of parsed.data.steps)
        visit(step.exec, file, [...path, "steps", step.name]);
    }
  };
  for (const file of modules) {
    const module: Record<string, unknown> = await import(
      pathToFileURL(file).href
    );
    exports.set(file, module);
    for (const [name, value] of Object.entries(module))
      visit(value, file, [name]);
  }
  const target = exports.get(join(stage, entry.module))?.[entry.export];
  const entryKind = getExecKind(target);
  if (!entryKind)
    diagnostics.push({
      code: "INVALID_ENTRY",
      file: entry.source,
      message: `Export '${entry.export}' is not a Code, Agent or Workflow`,
    });
  if (mainAgent) {
    const value = exports.get(join(stage, mainAgent.module))?.[
      mainAgent.export
    ];
    const parsed = agentDefinitionSchema.safeParse(value);
    if (!parsed.success)
      diagnostics.push({
        code: "INVALID_MAIN_AGENT",
        file: mainAgent.source,
        message: `Export '${mainAgent.export}' must be an Agent definition`,
      });
    else
      for (const name of ["startRun", "startPatch"]) {
        if (Object.hasOwn(parsed.data.tools ?? {}, name))
          diagnostics.push({
            code: "PLATFORM_TOOL_CONFLICT",
            file: mainAgent.source,
            path: ["tools", name],
            message: `Main Agent tool name '${name}' is reserved for the platform`,
          });
      }
  }
  return {
    ...(entryKind ? { entryKind } : {}),
    components,
    skillGroups,
    diagnostics,
  };
}

export async function inspect(
  stage: string,
  scratch: string,
  modules: readonly string[],
  entry: ResolvedReference,
  mainAgent: ResolvedReference | undefined,
): Promise<Inspection> {
  const resultFile = join(scratch, "inspection.json");
  const runner = join(scratch, "inspect.mjs");
  await writeFile(
    runner,
    [
      `import { inspectModules } from ${JSON.stringify(import.meta.url)};`,
      'import { writeFile } from "node:fs/promises";',
      `const result = await inspectModules(${JSON.stringify(stage)}, ${JSON.stringify(modules)}, ${JSON.stringify(entry)}, ${JSON.stringify(mainAgent)});`,
      `await writeFile(${JSON.stringify(resultFile)}, JSON.stringify(result));`,
    ].join("\n"),
  );
  const result = await runProcess(process.execPath, [runner], stage);
  if (result.code !== 0)
    return {
      components: [],
      skillGroups: [],
      diagnostics: [
        {
          code: "DEFINITION_LOAD",
          message:
            result.output.trim() ||
            `Definition inspection exited with code ${result.code}`,
        },
      ],
    };
  try {
    return JSON.parse(await readFile(resultFile, "utf8")) as Inspection;
  } catch (error) {
    return {
      components: [],
      skillGroups: [],
      diagnostics: [
        {
          code: "DEFINITION_LOAD",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}
