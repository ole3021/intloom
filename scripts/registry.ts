import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { repositoryRoot } from "./publication.ts";
import {
  assertReleaseManifest,
  type ReleaseEntry,
  type ReleaseManifest,
} from "./release.ts";
import { releaseDirectory } from "./release-files.ts";
import { compareVersions, validateVersion } from "./version.ts";

export async function registryVersion(
  name: string,
  version: string,
): Promise<{ integrity: string; version?: string } | undefined> {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(
      `Registry check failed: ${name}@${version} HTTP ${response.status}`,
    );
  const body = (await response.json()) as {
    version?: string;
    dist?: { integrity?: string };
  };
  if (!body.dist?.integrity || !body.version)
    throw new Error(`Missing registry integrity: ${name}@${version}`);
  validateVersion(body.version);
  return { integrity: body.dist.integrity, version: body.version };
}

/** Complete every read-only check before the first publish; retries skip only identical archives. */
export async function pendingPublications(
  release: ReleaseManifest,
  lookup = registryVersion,
): Promise<ReleaseEntry[]> {
  assertReleaseManifest(release);
  const pending: ReleaseEntry[] = [];
  for (const entry of release.entries) {
    const existing = await lookup(entry.name, entry.version);
    if (!existing) {
      const channel = await lookup(entry.name, entry.tag);
      if (
        channel?.version &&
        compareVersions(entry.version, channel.version) <= 0
      )
        throw new Error(
          `Release would move ${entry.name}@${entry.tag} backwards: ${entry.version} <= ${channel.version}`,
        );
      pending.push(entry);
    } else if (existing.integrity !== entry.integrity)
      throw new Error(
        `Version already exists with different content: ${entry.name}@${entry.version}`,
      );
    for (const [name, version] of Object.entries(entry.dependencies)) {
      if (
        release.entries.some(
          (candidate) =>
            candidate.name === name && candidate.version === version,
        )
      )
        continue;
      if (!(await lookup(name, version)))
        throw new Error(`Publish dependency first: ${name}@${version}`);
    }
  }
  return pending;
}

export async function publishArchives(
  release: ReleaseManifest,
  provenance: boolean,
): Promise<void> {
  const pending = await pendingPublications(release);
  for (const entry of pending) {
    const args = [
      "publish",
      resolve(releaseDirectory, entry.file),
      "--access",
      "public",
      "--tag",
      entry.tag,
    ];
    if (provenance) args.push("--provenance");
    await new Promise<void>((resolve, reject) => {
      const child = spawn("npm", args, {
        cwd: repositoryRoot,
        stdio: "inherit",
      });
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`npm publish failed: ${entry.name} (${code})`)),
      );
    });
    console.log(`Published ${entry.name}@${entry.version}`);
  }
  console.log(
    `Publication complete: ${pending.length} new, ${release.entries.length - pending.length} identical versions already present.`,
  );
}
