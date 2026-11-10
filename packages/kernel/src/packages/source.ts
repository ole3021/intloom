import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { InstalledLoomRef, LoomManifest } from "@intloom/loom-sdk";
import {
  assertPackagePath,
  dependencyClosure,
  PackageError,
  verifyArtifact,
} from "@intloom/loom-sdk/package-format";

import { satisfies, valid } from "semver";
import { list } from "tar";

export interface PackageSource {
  readonly ref: InstalledLoomRef;
  readonly manifest: LoomManifest;
  readonly npmName: string;
  readonly files: ReadonlyMap<string, Uint8Array>;
}
export async function directoryFiles(
  directory: string,
  installedNpmPackage = false,
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  async function visit(relative: string): Promise<void> {
    const path = join(directory, relative);
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new PackageError("PACKAGE_PATH_INVALID", path);
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (installedNpmPackage && !relative && entry.name === "node_modules")
        continue;
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      assertPackagePath(child);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile())
        files.set(child, await readFile(join(directory, child)));
      else
        throw new PackageError(
          "PACKAGE_PATH_INVALID",
          `Unsupported file or link: ${child}`,
        );
    }
  }
  await visit("");
  return files;
}
export async function readPackageDirectory(directory: string) {
  // Stored snapshots can predate the unified npm identity. Integrity and exact Run bindings still apply.
  return validate(await directoryFiles(directory), {
    allowLegacyNpmName: true,
  });
}
async function validate(
  files: ReadonlyMap<string, Uint8Array>,
  options?: { allowLegacyNpmName?: boolean },
): Promise<PackageSource> {
  const { manifest, integrity, npmName } = await verifyArtifact(files, options);
  if (
    !valid(manifest.version) ||
    !satisfies(process.versions.node, manifest.requirements.node)
  )
    throw new PackageError(
      "TARGET_UNSUPPORTED",
      `${manifest.id}: incompatible package or Node version.`,
    );
  return {
    ref: {
      id: manifest.id,
      version: manifest.version,
      artifactDigest: integrity.artifactDigest,
    },
    manifest,
    npmName,
    files,
  };
}
export async function readPackageSource(source: string) {
  const stat = await lstat(source);
  if (stat.isDirectory()) {
    return splitPackage(await directoryFiles(source), false);
  }
  return readPackageArchive(source, stat);
}

export async function readPackageArchive(
  source: string,
  stat?: Awaited<ReturnType<typeof lstat>>,
) {
  return splitPackage(await archiveFiles(source, stat), true);
}

export async function archiveFiles(
  source: string,
  stat?: Awaited<ReturnType<typeof lstat>>,
) {
  if (!(stat ?? (await lstat(source))).isFile())
    throw new PackageError("PACKAGE_PATH_INVALID", source);
  const files = new Map<string, Uint8Array>();
  const names = new Set<string>();
  const pending: Promise<void>[] = [];
  let failure: Error | undefined;
  await list({
    file: source,
    strict: true,
    onReadEntry(entry) {
      try {
        const path = entry.path.replace(/\/$/, "");
        assertPackagePath(path);
        if (names.has(path))
          throw new PackageError(
            "PACKAGE_PATH_INVALID",
            `Duplicate archive entry: ${path}`,
          );
        names.add(path);
        if (entry.type === "Directory") {
          if (path !== "package" && !path.startsWith("package/"))
            throw new PackageError("BUNDLE_INVALID", path);
          return;
        }
        if (entry.type !== "File")
          throw new PackageError(
            "PACKAGE_PATH_INVALID",
            `Unsupported archive entry: ${path} (${entry.type})`,
          );
        if (!path.startsWith("package/"))
          throw new PackageError("BUNDLE_INVALID", path);
        const chunks: Buffer[] = [];
        pending.push(
          new Promise<void>((resolve, reject) => {
            entry.on("data", (chunk: Buffer) => chunks.push(chunk));
            entry.on("end", () => {
              files.set(path.slice("package/".length), Buffer.concat(chunks));
              resolve();
            });
            entry.on("error", reject);
          }),
        );
      } catch (error) {
        failure ??= error as Error;
      }
    },
  });
  await Promise.all(pending);
  if (failure) throw failure;
  return files;
}

async function splitPackage(files: Map<string, Uint8Array>, archive: boolean) {
  const groups = new Map<string, Map<string, Uint8Array>>();
  for (const [path, bytes] of files) {
    if (!path.startsWith("dependencies/")) continue;
    const match = /^dependencies\/([a-f0-9]{64})\/(.+)$/.exec(path);
    if (!match?.[1] || !match[2])
      throw new PackageError("BUNDLE_INVALID", path);
    const digest = match[1];
    const group = groups.get(digest) ?? new Map<string, Uint8Array>();
    group.set(match[2], bytes);
    groups.set(digest, group);
    files.delete(path);
  }
  const root = await validate(files);
  const packages: [PackageSource, ...PackageSource[]] = [root];
  for (const [digest, contents] of groups) {
    const child = await validate(contents);
    if (child.ref.artifactDigest !== digest)
      throw new PackageError("INTEGRITY_MISMATCH", digest);
    packages.push(child);
  }
  if (
    (archive || groups.size) &&
    dependencyClosure([root.ref], packages).length !== packages.length
  )
    throw new PackageError("BUNDLE_INVALID", "Unreferenced dependency.");
  return { root: root.ref, packages };
}
