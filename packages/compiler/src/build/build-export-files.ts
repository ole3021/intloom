import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { fail } from "../errors.ts";
import { generateEntry } from "../emit/generate-entry.ts";
import { isPathWithin } from "../source/references.ts";
import type { LinkedLoom } from "../analyze/model.ts";
import { verifyArtifacts } from "../package/verify-artifacts.ts";
import { buildPackage } from "./build-package.ts";

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
  await buildPackage({
    root,
    config,
    manifest: loom.model.manifest,
    assets: loom.model.assets,
    checkOnly: loom.model.options.checkOnly ?? false,
    generate: (directory) => generateEntry(loom, directory),
    verify: (output) => verifyArtifacts(root, output, loom),
  });
}
