import { resolve } from "node:path";
import {
  type PublicationName,
  publications,
  writeJson,
} from "./publication.ts";
import {
  archiveName,
  assertReleaseManifest,
  readVersions,
  type ReleaseEntry,
  type ReleasePlan,
} from "./release.ts";

import { artifactIntegrity, readPackedPackage } from "./archive.ts";
import { readReleasePlan, releaseDirectory } from "./release-files.ts";
import { releaseChannel } from "./version.ts";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length && args[0] !== "--selected"))
  throw new Error("Usage: node scripts/release-manifest.ts [--selected]");
const versions = await readVersions();
const plan: ReleasePlan =
  args[0] === "--selected"
    ? await readReleasePlan()
    : {
        commit: process.env.GITHUB_SHA ?? "local",
        versions,
        selected: publications.map((item) => item.name),
      };
if (publications.some(({ name }) => plan.versions[name] !== versions[name]))
  throw new Error("Stale release plan versions.");
const entries: ReleaseEntry[] = [];
for (const item of publications.filter((item) =>
  plan.selected.includes(item.name),
)) {
  const version = versions[item.name];
  const archive = resolve(releaseDirectory, archiveName(item.name, version));
  const manifest = await readPackedPackage(archive, item.name, version);
  const dependencies: Partial<Record<PublicationName, string>> = {};
  for (const [name, range] of Object.entries({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  })) {
    const dependency = publications.find((item) => item.name === name);
    if (!dependency) continue;
    const required = versions[dependency.name];
    if (![required, `^${required}`, `~${required}`].includes(String(range)))
      throw new Error(`Unexpected internal dependency range: ${name}@${range}`);
    dependencies[dependency.name] = required;
  }
  entries.push({
    name: item.name,
    version,
    tag: releaseChannel(version),
    file: archiveName(item.name, version),
    integrity: await artifactIntegrity(archive),
    dependencies,
  });
}
const release = { ...plan, entries };
assertReleaseManifest(release);
await writeJson(resolve(releaseDirectory, "manifest.json"), release);
console.log(`Verified ${entries.length} selected archives for publication.`);
