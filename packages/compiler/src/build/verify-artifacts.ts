import { access, lstat, readFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";
import { fail } from "../errors.ts";
import { entryName } from "./generate-entry.ts";
import { isPathWithin } from "../source/references.ts";
import type { LinkedWorkflow, ModuleReference } from "../analyze/model.ts";
import { inspectModule } from "./inspect-module.ts";
import { listOutputFiles } from "./output-files.ts";

export async function verifyArtifacts(
  root: string,
  output: string,
  workflow: LinkedWorkflow,
): Promise<void> {
  const packageJson = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    exports?: Record<string, unknown>;
    files?: string[];
  };
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
  };
  const entryExport = packageJson.exports?.["."];
  if (
    !entryExport ||
    typeof entryExport !== "object" ||
    !("types" in entryExport) ||
    entryExport.types !== `./dist/${entryName}.d.ts` ||
    !("default" in entryExport) ||
    entryExport.default !== `./dist/${entryName}.js`
  ) {
    fail(
      "INVALID_OUTPUT",
      `package.json exports["."] must declare types ./dist/${entryName}.d.ts and default ./dist/${entryName}.js`,
    );
  }
  for (const [condition, target] of Object.entries(entryExport)) {
    if (
      !["types", "default", "import"].includes(condition) ||
      (condition === "import" && target !== `./dist/${entryName}.js`)
    ) {
      fail(
        "INVALID_OUTPUT",
        "Unsupported package entry condition; types/default/import must refer to generated entry files",
      );
    }
  }
  if (!packageJson.files?.includes("dist"))
    fail("INVALID_OUTPUT", "package.json files must include dist");
  const inspected = new Map<string, ReturnType<typeof inspectModule>>();
  async function moduleInfo(file: string, sourceFile?: string) {
    const cached = inspected.get(file);
    if (cached) return cached;
    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch (cause) {
      if (!sourceFile) throw cause;
      fail(
        "INVALID_OUTPUT",
        "Missing referenced JavaScript module",
        { file: sourceFile },
        cause,
      );
    }
    const info = inspectModule(content, sourceFile ?? file);
    inspected.set(file, info);
    return info;
  }
  const modules: ModuleReference[] = [
    ...Object.values(workflow.model.codes).map((code) => code.module),
    ...Object.values(workflow.model.stages).flatMap((stage) => [
      stage.stateSchema,
      stage.initializeState,
    ]),
    ...Object.values(workflow.model.agents).flatMap((agent) => [
      agent.outputSchema,
      ...agent.tools,
    ]),
  ];
  for (const module of modules) {
    const emitted = resolve(
      output,
      relative(root, module.sourceFile).replace(/\.ts$/, ".js"),
    );
    const info = await moduleInfo(emitted, module.sourceFile);
    if (!info.exports.has(module.exportName))
      fail(
        "INVALID_OUTPUT",
        `No runtime export ${module.exportName}; type-only declarations are not executable resources`,
        { file: module.sourceFile },
      );
    if (info.forwarded.has(module.exportName))
      fail(
        "INVALID_OUTPUT",
        "Reference the resource's defining module directly; re-export entry points are not supported yet",
        { file: module.sourceFile },
      );
  }
  for (const file of await listOutputFiles(output)) {
    if (
      /\.(?:spec|intg)\./.test(file) ||
      relative(output, file).split(sep).includes("test")
    )
      fail("INVALID_OUTPUT", "Tests must not enter output", { file });
    if (!file.endsWith(".js")) continue;
    const info = await moduleInfo(file);
    if (file === resolve(output, `${entryName}.js`)) {
      for (const name of ["blueprint", "codes", "agentSpecs"])
        if (!info.exports.has(name))
          fail("INVALID_OUTPUT", `Missing named export: ${name}`, { file });
    }
    for (const specifier of info.imports) {
      if (specifier.startsWith(".")) {
        const target = resolve(dirname(file), specifier);
        if (!isPathWithin(output, target))
          fail("INVALID_OUTPUT", `Import escapes output: ${specifier}`, {
            file,
          });
        try {
          if (!(await lstat(target)).isFile()) throw new Error("Not a file");
        } catch (cause) {
          fail(
            "INVALID_OUTPUT",
            `Missing emitted module: ${specifier}`,
            { file },
            cause,
          );
        }
      } else if (!isBuiltin(specifier)) {
        const packageName = specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0];
        if (!packageName || !Object.hasOwn(dependencies, packageName))
          fail(
            "INVALID_OUTPUT",
            `Runtime dependency is not declared: ${specifier}`,
            { file },
          );
      }
    }
  }
  for (const suffix of [".js", ".d.ts", ".js.map"]) {
    try {
      await access(resolve(output, `${entryName}${suffix}`));
    } catch (cause) {
      fail(
        "INVALID_OUTPUT",
        `Missing entry artifact: ${entryName}${suffix}`,
        undefined,
        cause,
      );
    }
  }
}
