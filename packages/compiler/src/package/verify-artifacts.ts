import { access, lstat, readFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";
import { fail } from "../errors.ts";
import { entryName } from "../emit/generate-entry.ts";
import { isPathWithin } from "../source/references.ts";
import type { LinkedLoom, ModuleReference } from "../analyze/model.ts";
import { inspectModule } from "./inspect-module.ts";
import { verifyDeclarations } from "./verify-declarations.ts";
import { resolveExportOrigins } from "./resolve-exports.ts";
import { listOutputFiles } from "./output-files.ts";

export async function verifyArtifacts(
  root: string,
  output: string,
  loom: LinkedLoom,
): Promise<void> {
  return verifyPackageArtifacts(
    root,
    output,
    [
      ...Object.values(loom.model.codes).map((code) => code.module),
      ...Object.values(loom.model.stages).flatMap((stage) => [
        stage.stateSchema,
        stage.initializeState,
      ]),
      ...Object.values(loom.model.agents).flatMap((agent) => [
        agent.outputSchema,
        ...agent.tools,
      ]),
    ],
    ["blueprint", "codes", "agentSpecs"],
  );
}

export async function verifyPackageArtifacts(
  root: string,
  output: string,
  modules: readonly ModuleReference[],
  exports: readonly string[],
): Promise<void> {
  const packageJson = JSON.parse(
    await readFile(resolve(output, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    exports?: Record<string, unknown>;
    files?: string[];
  };
  if (!packageJson.files?.includes("**/*"))
    fail("INVALID_OUTPUT", "Package files must include **/*");
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  };
  const entryExport = packageJson.exports?.["."];
  if (
    !entryExport ||
    typeof entryExport !== "object" ||
    !("types" in entryExport) ||
    entryExport.types !== `./${entryName}.d.ts` ||
    !("default" in entryExport) ||
    entryExport.default !== `./${entryName}.js`
  ) {
    fail(
      "INVALID_OUTPUT",
      `Package exports must declare types ./${entryName}.d.ts and default ./${entryName}.js`,
    );
  }
  for (const [condition, target] of Object.entries(entryExport)) {
    if (
      !["types", "default", "import"].includes(condition) ||
      (condition === "import" && target !== `./${entryName}.js`)
    ) {
      fail(
        "INVALID_OUTPUT",
        "Unsupported package entry condition; types/default/import must refer to generated entry files",
      );
    }
  }
  if (packageJson.exports?.["./package.json"] !== "./package.json")
    fail("INVALID_OUTPUT", "Package must export its metadata");
  const inspected = new Map<string, ReturnType<typeof inspectModule>>();
  async function moduleInfo(file: string, sourceFile?: string) {
    const cached = inspected.get(file);
    if (cached) return cached;
    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch (cause) {
      fail(
        "INVALID_OUTPUT",
        "Missing referenced JavaScript module",
        { file: sourceFile ?? file },
        cause,
      );
    }
    const info = inspectModule(content, sourceFile ?? file);
    inspected.set(file, info);
    return info;
  }
  for (const module of modules) {
    const emitted = resolve(
      output,
      relative(root, module.sourceFile).replace(/\.ts$/, ".js"),
    );
    await moduleInfo(emitted, module.sourceFile);
    const origins = await resolveExportOrigins(
      emitted,
      module.exportName,
      output,
      moduleInfo,
    );
    if (origins.size !== 1)
      fail(
        "INVALID_OUTPUT",
        `${origins.size ? "Ambiguous" : "No"} runtime export ${module.exportName}; check re-exports and type-only declarations`,
        module.location ?? { file: module.sourceFile },
      );
  }

  for (const file of await listOutputFiles(output)) {
    // Browser resources are opaque, already built assets, not Node execution bindings.
    if (relative(output, file).split(sep)[0] === "apps") continue;
    if (
      /\.(?:spec|intg)\./.test(file) ||
      relative(output, file).split(sep).includes("test")
    )
      fail("INVALID_OUTPUT", "Tests must not enter output", { file });
    if (/\.cjs$|\.d\.cts$/.test(file))
      fail("INVALID_OUTPUT", "Loom modules must emit ESM, not CommonJS", {
        file,
      });
    if (/\.d\.(?:ts|mts)$/.test(file))
      await verifyDeclarations(file, output, dependencies);
    if (!/\.(?:js|mjs)$/.test(file)) continue;
    const info = await moduleInfo(file);
    if (file === resolve(output, `${entryName}.js`)) {
      for (const name of exports)
        if (!info.exports.has(name))
          fail("INVALID_OUTPUT", `Missing named export: ${name}`, { file });
    }
    for (const binding of info.importedBindings.values()) {
      if (!binding.source.startsWith(".") || binding.imported === "*") continue;
      const target = resolve(dirname(file), binding.source);
      if (!isPathWithin(output, target))
        fail("INVALID_OUTPUT", `Import escapes output: ${binding.source}`, {
          file,
        });
      if (target.endsWith(".json")) {
        if (binding.imported !== "default")
          fail("INVALID_OUTPUT", "JSON modules only provide a default export", {
            file,
          });
        try {
          JSON.parse(await readFile(target, "utf8"));
        } catch (cause) {
          fail(
            "INVALID_OUTPUT",
            "Missing or invalid JSON module",
            { file: target },
            cause,
          );
        }
        continue;
      }
      const origins = await resolveExportOrigins(
        target,
        binding.imported,
        output,
        moduleInfo,
      );
      if (origins.size !== 1)
        fail(
          "INVALID_OUTPUT",
          `Missing or ambiguous runtime import ${binding.imported} from ${binding.source}`,
          { file },
        );
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
