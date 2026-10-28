import { resolve } from "node:path";
import type { CompileOptions, CompileResult } from "../types.ts";
import { loadCapability } from "./load-capability.ts";
import { emitCapability } from "./emit-capability.ts";
import { buildPackage } from "../build/build-package.ts";
import { verifyPackageArtifacts } from "../package/verify-artifacts.ts";
import { exists } from "../package/output-files.ts";

export async function compileCapability(
  options: CompileOptions,
): Promise<CompileResult> {
  const source = await loadCapability(options.packageRoot);
  const config = resolve(
    source.root,
    options.tsconfigFile ?? "tsconfig.build.json",
  );
  await buildPackage({
    root: source.root,
    checkOnly: options.checkOnly ?? false,
    ...(options.tsconfigFile || (await exists(config)) ? { config } : {}),
    manifest: source.manifest,
    assets: source.assets,
    generate: (directory) => emitCapability(source, directory),
    verify: (output) =>
      verifyPackageArtifacts(
        source.root,
        output,
        Object.values(source.modules).map((item) => item.module),
        ["definition", "plan", "bindings"],
      ),
  });
  return {
    packageRoot: source.root,
    outputPath: resolve(source.root, "dist"),
    packageName: source.manifest.name,
    packageVersion: source.manifest.version,
    loomName: source.definition.name,
    diagnostics: [],
  };
}
