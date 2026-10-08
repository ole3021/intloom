import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { PackageManifest, PublicationName } from "./publication.ts";
import type { ReleaseManifest } from "./release.ts";
import { releaseDirectory } from "./release-files.ts";
import { validateRelease } from "./version.ts";

/** Validate the actual archive once; source/declaration boundaries are covered by package tests. */
export async function readPackedPackage(
  archive: string,
  name: PublicationName,
  version: string,
): Promise<PackageManifest> {
  const run = promisify(execFile);
  const { stdout } = await run("tar", [
    "-xOf",
    archive,
    "package/package.json",
  ]);
  const manifest: PackageManifest = JSON.parse(stdout);
  if (manifest.name !== name || manifest.version !== version)
    throw new Error(`Packed identity mismatch: ${name}@${version}`);
  if (
    manifest.private ||
    manifest.publishConfig?.access !== "public" ||
    !manifest.license?.trim() ||
    !manifest.repository ||
    !manifest.engines?.node
  )
    throw new Error(`Missing publication metadata: ${name}`);
  const { stdout: listing } = await run("tar", ["-tzf", archive]);
  const files = listing.trim().split("\n");
  if (!files.includes("package/LICENSE"))
    throw new Error(`Missing packed license: ${name}`);
  if (files.some((file) => /\.(spec|intg)\.|(^|\/)test\//.test(file)))
    throw new Error(`Test in distribution: ${name}`);
  for (const category of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ] as const)
    for (const [dependency, range] of Object.entries(
      manifest[category] ?? {},
    )) {
      if (/^(workspace|file|link|catalog):/.test(range))
        throw new Error(`Local dependency in packed manifest: ${dependency}`);
      if (
        dependency === "@intloom/kernel" &&
        (name !== "@intloom/cli" || category !== "dependencies")
      )
        throw new Error("Only CLI may carry the private Kernel dependency.");
    }
  if (name === "@intloom/cli") {
    if (
      manifest.bundleDependencies?.join() !== "@intloom/kernel" ||
      manifest.dependencies?.["@intloom/kernel"] !== version
    )
      throw new Error("CLI must bundle the matching private Kernel.");
    const { stdout } = await run("tar", [
      "-xOf",
      archive,
      "package/node_modules/@intloom/kernel/package.json",
    ]);
    const kernel: PackageManifest = JSON.parse(stdout);
    if (
      kernel.name !== "@intloom/kernel" ||
      kernel.private !== true ||
      kernel.version !== version
    )
      throw new Error("Invalid embedded Kernel version.");
  }
  if (name === "intloom" && manifest.dependencies?.["@intloom/cli"] !== version)
    throw new Error("The launcher requires an exact CLI version.");
  return manifest;
}

export async function artifactIntegrity(file: string): Promise<string> {
  return `sha512-${createHash("sha512")
    .update(await readFile(file))
    .digest("base64")}`;
}

export async function verifyReleaseArchives(
  release: ReleaseManifest,
  ref: string,
): Promise<void> {
  for (const entry of release.entries) {
    validateRelease(entry.version, entry.tag, ref);
    if (
      (await artifactIntegrity(resolve(releaseDirectory, entry.file))) !==
      entry.integrity
    )
      throw new Error(`Release archive integrity mismatch: ${entry.name}`);
  }
}
