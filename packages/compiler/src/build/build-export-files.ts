import {
  access,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fail } from "../errors.ts";
import { entryName, generateEntry } from "../emit/generate-entry.ts";
import { isPathWithin } from "../source/references.ts";
import type { LinkedLoom } from "../analyze/model.ts";
import { verifyArtifacts } from "../package/verify-artifacts.ts";
import { exists, relocateSourceMaps } from "../package/output-files.ts";
import { compileTypeScript } from "../emit/compile-typescript.ts";
import { publishOutput } from "./publish-output.ts";
import { cleanupBuild } from "./cleanup-build.ts";
import { relocateEntry } from "../emit/relocate-entry.ts";
import { preparePackage } from "../package/prepare-package.ts";

export async function buildExportFiles(loom: LinkedLoom): Promise<void> {
  const root = loom.model.options.packageRoot;
  const config = resolve(
    root,
    loom.model.options.tsconfigFile ?? "tsconfig.build.json",
  );
  if (!isPathWithin(root, config))
    fail("INVALID_BUILD_CONFIG", "tsconfigFile must be inside packageRoot", {
      file: config,
    });
  try {
    await access(config);
  } catch (cause) {
    fail(
      "INVALID_BUILD_CONFIG",
      "Build tsconfig does not exist",
      { file: config },
      cause,
    );
  }
  const destination = resolve(root, "dist");
  if ((await exists(destination)) && !(await lstat(destination)).isDirectory())
    fail("INVALID_BUILD_CONFIG", "dist must be a regular directory", {
      file: destination,
    });
  const temporary = await mkdtemp(resolve(root, ".intloom-build-"));
  const entry = resolve(temporary, `${entryName}.ts`);
  let preserveRecovery = false;
  let failure: { cause: unknown } | undefined;
  try {
    const generated = generateEntry(loom, temporary);
    await writeFile(entry, generated.text, { flag: "wx" });
    const output = resolve(temporary, "output");
    await compileTypeScript({
      root,
      config,
      entry,
      output,
      destination,
      generatedConfig: resolve(temporary, "tsconfig.json"),
      generated,
    });
    for (const asset of loom.model.assets) {
      const target = resolve(output, asset.outputPath);
      if (!isPathWithin(output, target) || (await exists(target)))
        fail(
          "INVALID_OUTPUT",
          `Resource output collision or invalid path: ${asset.outputPath}`,
        );
      await mkdir(dirname(target), { recursive: true });
      await copyFile(asset.sourceFile, target);
    }
    await relocateSourceMaps(output, destination);
    await relocateEntry(output, temporary);
    await preparePackage(root, output, loom.model.manifest);
    await verifyArtifacts(root, output, loom);
    await publishOutput(
      output,
      destination,
      resolve(temporary, "previous-dist"),
      () => {
        preserveRecovery = true;
      },
    );
  } catch (cause) {
    failure = { cause };
  }
  await cleanupBuild({ entry, temporary, preserveRecovery, failure });
}
