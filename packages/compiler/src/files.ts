import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assertPackagePath,
  PackageError,
  verifyArtifact,
} from "@intloom/loom-sdk/package-format";

export async function readDirectory(
  directory: string,
  omitBundledDependencies: boolean,
): Promise<Map<string, Uint8Array>> {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new PackageError("PACKAGE_PATH_INVALID", directory);
  const files = new Map<string, Uint8Array>();
  async function visit(relative: string): Promise<void> {
    for (const entry of await readdir(join(directory, relative), {
      withFileTypes: true,
    })) {
      if (
        omitBundledDependencies &&
        !relative &&
        entry.name === "dependencies" &&
        entry.isDirectory()
      )
        continue;
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      assertPackagePath(path);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile())
        files.set(path, await readFile(join(directory, path)));
      else
        throw new PackageError(
          "PACKAGE_PATH_INVALID",
          `Unsupported file or link: ${path}`,
        );
    }
  }
  await visit("");
  return files;
}
export async function readArtifact(
  directory: string,
  omitBundledDependencies = false,
) {
  const files = await readDirectory(directory, omitBundledDependencies);
  const verified = await verifyArtifact(files);
  return {
    files,
    ...verified,
    ref: {
      id: verified.manifest.id,
      version: verified.manifest.version,
      artifactDigest: verified.integrity.artifactDigest,
    },
  };
}
