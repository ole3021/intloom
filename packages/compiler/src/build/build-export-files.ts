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
import { entryName, generateEntry } from "./generate-entry.ts";
import { isPathWithin } from "../source/references.ts";
import type { LinkedWorkflow } from "../analyze/model.ts";
import { verifyArtifacts } from "./verify-artifacts.ts";
import { exists, relocateSourceMaps } from "./output-files.ts";
import { compileTypeScript } from "./compile-typescript.ts";
import { publishOutput } from "./publish-output.ts";
import { cleanupBuild } from "./cleanup-build.ts";

export async function buildExportFiles(
  workflow: LinkedWorkflow,
): Promise<void> {
  const root = workflow.model.options.packageRoot;
  const config = resolve(
    root,
    workflow.model.options.tsconfigFile ?? "tsconfig.build.json",
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
  const entry = resolve(root, `${entryName}.ts`);
  const destination = resolve(root, "dist");
  if ((await exists(destination)) && !(await lstat(destination)).isDirectory())
    fail("INVALID_BUILD_CONFIG", "dist must be a regular directory", {
      file: destination,
    });
  // The exclusive generated entry also locks builds for the same package; author-owned files are not overwritten.
  try {
    await writeFile(entry, generateEntry(workflow), { flag: "wx" });
  } catch (cause) {
    fail(
      "BUILD_FAILED",
      "Cannot create generated entry; remove a stale entry or wait for the active build",
      { file: entry },
      cause,
    );
  }
  let temporary: string | undefined;
  let preserveRecovery = false;
  let failure: { cause: unknown } | undefined;
  try {
    temporary = await mkdtemp(resolve(root, ".intloom-build-"));
    const output = resolve(temporary, "output");
    await compileTypeScript({
      root,
      config,
      entry,
      output,
      destination,
      generatedConfig: resolve(temporary, "tsconfig.json"),
    });
    for (const asset of workflow.model.assets) {
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
    await verifyArtifacts(root, output, workflow);
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
