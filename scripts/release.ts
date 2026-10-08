import { resolve } from "node:path";
import {
  type PublicationName,
  publications,
  readManifest,
  repositoryRoot,
} from "./publication.ts";
import { compareVersions, releaseChannel, validateVersion } from "./version.ts";

export type PublicationVersions = Record<PublicationName, string>;
export interface ReleasePlan {
  commit: string;
  versions: PublicationVersions;
  selected: PublicationName[];
}
export interface ReleaseEntry {
  name: PublicationName;
  version: string;
  tag: "latest" | "next";
  file: string;
  integrity: string;
  dependencies: Partial<PublicationVersions>;
}
export interface ReleaseManifest extends ReleasePlan {
  entries: ReleaseEntry[];
}

export function archiveName(name: string, version: string): string {
  return `${name.replace(/^@/, "").replaceAll("/", "-")}-${version}.tgz`;
}

/** CLI and its launcher are one release unit; other public packages have independent versions. */
export function selectPublications(
  names: readonly string[],
): PublicationName[] {
  const selected = new Set(names);
  for (const name of selected)
    if (!publications.some((item) => item.name === name))
      throw new Error(`Unknown public package: ${name}`);
  if (selected.has("intloom") || selected.has("@intloom/cli")) {
    selected.add("intloom");
    selected.add("@intloom/cli");
  }
  return publications
    .filter((item) => selected.has(item.name))
    .map((item) => item.name);
}

export function selectChangedPublications(
  current: PublicationVersions,
  previous: Partial<PublicationVersions>,
): PublicationName[] {
  const selected: string[] = [];
  for (const { name } of publications) {
    const old = previous[name];
    const version = current[name];
    if (version === old) continue;
    if (old !== undefined && compareVersions(version, old) <= 0)
      throw new Error(
        `Release versions must increase: ${name} ${old} -> ${version}`,
      );
    selected.push(name);
  }
  return selectPublications(selected);
}

export async function readVersions(
  root = repositoryRoot,
): Promise<PublicationVersions> {
  const versions = {} as PublicationVersions;
  for (const item of publications) {
    const manifest = await readManifest(resolve(root, item.directory));
    if (
      manifest.name !== (item.name === "intloom" ? "@intloom/cli" : item.name)
    )
      throw new Error(`Workspace identity mismatch: ${item.name}`);
    validateVersion(manifest.version);
    versions[item.name] = manifest.version;
  }
  const kernel = await readManifest(resolve(root, "packages/kernel"));
  if (!kernel.private || kernel.version !== versions["@intloom/cli"])
    throw new Error("The embedded Kernel must match the CLI version.");
  return versions;
}

export function assertReleasePlan(plan: ReleasePlan): void {
  if (!plan || (plan.commit !== "local" && !/^[a-f0-9]{40}$/.test(plan.commit)))
    throw new Error("Invalid release commit.");
  if (
    Object.keys(plan.versions).sort().join() !==
    publications
      .map((item) => item.name)
      .sort()
      .join()
  )
    throw new Error("Invalid publication version snapshot.");
  for (const version of Object.values(plan.versions)) validateVersion(version);
  if (plan.versions.intloom !== plan.versions["@intloom/cli"])
    throw new Error("CLI entry versions must match.");
  if (selectPublications(plan.selected).join() !== plan.selected.join())
    throw new Error("Invalid release selection or dependency order.");
  for (const name of plan.selected)
    if (plan.versions[name] === "0.0.0")
      throw new Error("0.0.0 cannot be published.");
}

export function assertReleaseManifest(release: ReleaseManifest): void {
  assertReleasePlan(release);
  if (
    release.entries.map((entry) => entry.name).join() !==
    release.selected.join()
  )
    throw new Error("Release entries do not match the selected packages.");
  for (const entry of release.entries) {
    if (
      entry.version !== release.versions[entry.name] ||
      entry.tag !== releaseChannel(entry.version) ||
      entry.file !== archiveName(entry.name, entry.version)
    )
      throw new Error(`Invalid release identity: ${entry.name}`);
    if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(entry.integrity))
      throw new Error(`Invalid archive integrity: ${entry.name}`);
    for (const [name, version] of Object.entries(entry.dependencies)) {
      if (!publications.some((item) => item.name === name))
        throw new Error(`Unknown release dependency: ${name}`);
      validateVersion(version);
    }
  }
}

export const draftReleaseNote =
  "Describe the user-visible change before merging this release PR.";

export function releaseNotes(
  changelog: string,
  name: PublicationName,
  version: string,
): string {
  const canonical = name === "intloom" ? "@intloom/cli" : name;
  const notes = changelog
    .split(`## ${canonical}@${version}\n`)[1]
    ?.split("\n## ")[0]
    ?.trim();
  if (!notes || notes.includes(draftReleaseNote))
    throw new Error(
      `Missing reviewed changelog entry: ${canonical}@${version}`,
    );
  return notes;
}
