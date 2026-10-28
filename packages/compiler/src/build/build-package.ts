import { copyFile, lstat, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ResourceAsset } from "../source/types.ts";
import { fail } from "../errors.ts";
import { entryName, type GeneratedEntry } from "../emit/generate-entry.ts";
import { isPathWithin } from "../source/references.ts";
import { exists, relocateSourceMaps } from "../package/output-files.ts";
import { compileTypeScript } from "../emit/compile-typescript.ts";
import { relocateEntry } from "../emit/relocate-entry.ts";
import {
  preparePackage,
  type DistributionSource,
} from "../package/prepare-package.ts";
import { publishOutput } from "./publish-output.ts";
import { cleanupBuild } from "./cleanup-build.ts";

export async function buildPackage(input: {
  root: string;
  config?: string;
  checkOnly?: boolean;
  manifest: DistributionSource;
  assets: readonly ResourceAsset[];
  generate(directory: string): GeneratedEntry;
  verify(output: string): Promise<void>;
}): Promise<void> {
  const { root, config } = input;
  if (config && (!isPathWithin(root, config) || !(await exists(config))))
    fail(
      "INVALID_BUILD_CONFIG",
      "Build tsconfig must exist inside packageRoot",
      { file: config },
    );
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
    const generated = input.generate(temporary);
    await writeFile(entry, generated.text, { flag: "wx" });
    const output = resolve(temporary, "output");
    await compileTypeScript({
      root,
      ...(config ? { config } : {}),
      entry,
      output,
      destination,
      generatedConfig: resolve(temporary, "tsconfig.json"),
      generated,
    });
    for (const asset of input.assets) {
      const target = resolve(output, asset.outputPath);
      if (!isPathWithin(output, target) || (await exists(target)))
        fail(
          "INVALID_OUTPUT",
          `Resource output collision: ${asset.outputPath}`,
        );
      await mkdir(dirname(target), { recursive: true });
      await copyFile(asset.sourceFile, target);
    }
    await relocateSourceMaps(output, destination);
    await relocateEntry(output, temporary);
    await preparePackage(root, output, input.manifest);
    await input.verify(output);
    if (!input.checkOnly)
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
