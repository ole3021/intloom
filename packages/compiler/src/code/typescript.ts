import { spawn } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire, isBuiltin } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import type { Diagnostic } from "@intloom/loom-sdk";
import { init, parse } from "es-module-lexer";
import type { Project } from "../project/read.ts";
import { isWithin, type ResolvedReference } from "../project/resolve.ts";

export async function runProcess(
  file: string,
  args: readonly string[],
  cwd: string,
): Promise<{ code: number; output: string }> {
  return new Promise((done, reject) => {
    const child = spawn(file, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => done({ code: code ?? 1, output }));
  });
}

export async function emittedModules(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await emittedModules(path)));
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(path);
  }
  return files.sort();
}

export async function compile(
  project: Project,
  scratch: string,
  stage: string,
  entry: ResolvedReference,
  agent: ResolvedReference | undefined,
  diagnostics: Diagnostic[],
): Promise<void> {
  const assertion = join(scratch, "entry-check.ts");
  const sourceImport = (ref: ResolvedReference) =>
    JSON.stringify(relative(scratch, ref.source).replaceAll("\\", "/"));
  await writeFile(
    assertion,
    [
      'import type { AgentDefinition, ExecInput, ExecOutput, JsonResult, LoomEntry, LoomInput, WorkflowDefinition } from "@intloom/loom-sdk";',
      `import * as entryModule from ${sourceImport(entry)};`,
      `const entry = entryModule[${JSON.stringify(entry.export)}];`,
      "type Entry<E> = E extends AgentDefinition ? E : E extends WorkflowDefinition ? LoomInput extends ExecInput<E> ? ExecOutput<E> extends JsonResult<ExecOutput<E>> ? E : never : never : E extends LoomEntry ? E : never;",
      "const checked: Entry<typeof entry> = entry; void checked;",
      ...(agent
        ? [
            `import * as agentModule from ${sourceImport(agent)};`,
            `const mainAgent: AgentDefinition = agentModule[${JSON.stringify(agent.export)}]; void mainAgent;`,
          ]
        : []),
    ].join("\n"),
  );
  const authorConfig = join(project.root, "tsconfig.json");
  let hasConfig = true;
  try {
    await readFile(authorConfig);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    hasConfig = false;
  }
  const config = join(scratch, "tsconfig.json");
  await writeFile(
    config,
    JSON.stringify({
      ...(hasConfig ? { extends: authorConfig } : {}),
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        verbatimModuleSyntax: true,
        skipLibCheck: true,
        ...(!hasConfig ? { types: [] } : {}),
        allowJs: true,
        checkJs: true,
        rootDir: project.root,
        outDir: stage,
        noEmit: false,
        emitDeclarationOnly: false,
        noEmitOnError: true,
        declaration: true,
        declarationMap: false,
        sourceMap: false,
        inlineSourceMap: false,
        incremental: false,
        composite: false,
        rewriteRelativeImportExtensions: true,
      },
      files: [entry.source, ...(agent ? [agent.source] : []), assertion],
      include: [],
      exclude: [],
    }),
  );
  const require = createRequire(import.meta.url);
  const tsc = join(
    dirname(require.resolve("typescript/package.json")),
    "bin/tsc",
  );
  const result = await runProcess(
    process.execPath,
    [tsc, "-p", config, "--pretty", "false"],
    project.root,
  );
  if (result.code === 0) return;
  for (const line of result.output.trim().split("\n")) {
    const match = /^(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line);
    if (match) {
      const generated = resolve(project.root, match[1] ?? "") === assertion;
      diagnostics.push({
        code: match[4] ?? "TYPESCRIPT",
        file: generated
          ? join(project.root, "loom.yaml")
          : resolve(project.root, match[1] ?? ""),
        ...(!generated
          ? { line: Number(match[2]), column: Number(match[3]) }
          : {}),
        message: `${generated ? "Entry/agent contract: " : ""}${match[5]}`,
      });
    } else if (line.trim()) {
      diagnostics.push({ code: "TYPESCRIPT", message: line.trim() });
    }
  }
  if (!result.output.trim())
    diagnostics.push({
      code: "TYPESCRIPT",
      message: `TypeScript exited with code ${result.code}`,
    });
}

export async function checkImports(
  project: Project,
  stage: string,
  modules: readonly string[],
  diagnostics: Diagnostic[],
): Promise<void> {
  await init;
  const dependencies = {
    ...project.package.dependencies,
    ...project.package.optionalDependencies,
    ...project.package.peerDependencies,
  };
  for (const file of modules) {
    const [imports] = parse(await readFile(file, "utf8"));
    for (const imported of imports) {
      const specifier = imported.specifier;
      if (
        specifier == null ||
        isBuiltin(specifier) ||
        (imported.type === "dynamic" && imported.glob)
      )
        continue;
      if (specifier.startsWith(".")) {
        const target = resolve(dirname(file), specifier);
        if (!isWithin(stage, target))
          diagnostics.push({
            code: "EXTERNAL_MODULE",
            file: relative(stage, file),
            message: `Local import '${specifier}' escapes the built package`,
          });
        else {
          try {
            await readFile(target);
          } catch {
            diagnostics.push({
              code: "MISSING_IMPORT",
              file: relative(stage, file),
              message: `Local import '${specifier}' is missing from the built package`,
            });
          }
        }
      } else {
        const name = specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0];
        if (!name || !Object.hasOwn(dependencies, name))
          diagnostics.push({
            code: "UNDECLARED_DEPENDENCY",
            file: relative(stage, file),
            message: `Import '${specifier}' must be declared as a runtime package dependency`,
          });
      }
    }
  }
}
