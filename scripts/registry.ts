import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { repositoryRoot } from "./publication.ts";
import {
  assertReleaseManifest,
  type ReleaseEntry,
  type ReleaseManifest,
} from "./release.ts";
import { releaseDirectory } from "./release-files.ts";
import { compareVersions, validateVersion } from "./version.ts";

const visibilityChecks = 31;
const visibilityInterval = 10_000;

interface RegistryMetadata {
  version?: string;
  dist?: { integrity?: string };
}

function readRegistryVersion(
  body: RegistryMetadata,
  name: string,
  version: string,
): { integrity: string; version: string } {
  if (!body.dist?.integrity || !body.version)
    throw new Error(`Missing registry integrity: ${name}@${version}`);
  validateVersion(body.version);
  return { integrity: body.dist.integrity, version: body.version };
}

export async function registryVersion(
  name: string,
  version: string,
): Promise<{ integrity: string; version: string } | undefined> {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(
      `Registry check failed: ${name}@${version} HTTP ${response.status}`,
    );
  return readRegistryVersion(await response.json(), name, version);
}

async function registryInstallVersion(name: string, version: string) {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
    {
      headers: { accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(
      `Registry install index check failed: ${name}@${version} HTTP ${response.status}`,
    );
  const body = (await response.json()) as {
    versions?: Record<string, RegistryMetadata>;
  };
  if (
    !body.versions ||
    typeof body.versions !== "object" ||
    Array.isArray(body.versions)
  )
    throw new Error(`Missing registry install index: ${name}@${version}`);
  const metadata = body.versions?.[version];
  return metadata ? readRegistryVersion(metadata, name, version) : undefined;
}

/** npm's version endpoint and install index can become visible at different times. */
export async function verifyPublishedEntries(
  entries: readonly ReleaseEntry[],
  wait: (milliseconds: number) => Promise<unknown> = setTimeout,
): Promise<void> {
  let pending = entries;
  for (let attempt = 1; attempt <= visibilityChecks; attempt++) {
    const waiting: ReleaseEntry[] = [];
    for (const entry of pending) {
      const versions = await Promise.all([
        registryVersion(entry.name, entry.version),
        registryInstallVersion(entry.name, entry.version),
      ]);
      for (const [index, metadata] of versions.entries()) {
        if (!metadata) continue;
        const source = index === 0 ? "version metadata" : "install index";
        if (metadata.version !== entry.version)
          throw new Error(
            `Registry version mismatch: ${entry.name}@${entry.version} (${source}); received ${metadata.version}`,
          );
        if (metadata.integrity !== entry.integrity)
          throw new Error(
            `Registry integrity mismatch: ${entry.name}@${entry.version} (${source}); expected ${entry.integrity}, received ${metadata.integrity}`,
          );
      }
      if (versions.some((metadata) => !metadata)) waiting.push(entry);
    }
    if (!waiting.length) return;
    const names = waiting
      .map((entry) => `${entry.name}@${entry.version}`)
      .join(", ");
    if (attempt === visibilityChecks)
      throw new Error(
        `Published packages are not yet available in npm version metadata and install indexes after ${attempt} checks: ${names}. Rerun verification using the original CI artifacts; do not republish or rebuild them.`,
      );
    console.log(
      `Waiting for npm visibility (${attempt}/${visibilityChecks}): ${names}`,
    );
    await wait(visibilityInterval);
    pending = waiting;
  }
}

/** npm can still see stale metadata after the visibility check passes. */
export async function retryPublishedInstall(
  entries: readonly ReleaseEntry[],
  install: () => Promise<unknown>,
  wait: (milliseconds: number) => Promise<unknown> = setTimeout,
): Promise<void> {
  const published = new Set(
    entries.map(({ name, version }) => `${name}@${version}`),
  );
  for (let attempt = 1; attempt <= visibilityChecks; attempt++) {
    try {
      await install();
      return;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== 1 ||
        !("stderr" in error) ||
        typeof error.stderr !== "string" ||
        !/^npm (?:error|ERR!) code ETARGET\r?$/m.test(error.stderr)
      )
        throw error;
      const target =
        /^npm (?:error|ERR!) notarget No matching version found for (\S+)\.\r?$/m.exec(
          error.stderr,
        )?.[1];
      if (!target || !published.has(target)) throw error;
      if (attempt === visibilityChecks)
        throw new Error(
          `Published packages are not yet installable by npm after ${attempt} attempts: ${target}. Rerun verification using the original CI artifacts; do not republish or rebuild them.`,
          { cause: error },
        );
      console.log(
        `Waiting for npm installation (${attempt}/${visibilityChecks}): ${target} (ETARGET)`,
      );
      await wait(visibilityInterval);
    }
  }
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
