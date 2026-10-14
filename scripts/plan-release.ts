import { execFile } from "node:child_process";
import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  type PackageManifest,
  publications,
  readManifest,
  repositoryRoot,
  writeJson,
} from "./publication.ts";
import {
  assertDeliveryVersion,
  assertReleasePlan,
  type PublicationVersions,
  readVersions,
  selectChangedPublications,
  selectPublications,
} from "./release.ts";

import { releaseDirectory } from "./release-files.ts";

if (process.env.GITHUB_REF !== "refs/heads/main")
  throw new Error("Release preparation requires main.");
const versions = await readVersions();
const previous: Partial<PublicationVersions> = {};
const base = process.env.RELEASE_BASE;
const run = promisify(execFile);
if (!base || !/^[a-f0-9]{40}$/.test(base))
  throw new Error(
    "Release preparation requires RELEASE_BASE as a full commit SHA.",
  );
const initialPush =
  /^0+$/.test(base) && process.env.GITHUB_EVENT_NAME === "push";
if (/^0+$/.test(base) && !initialPush)
  throw new Error(
    "Manual release preparation requires an existing base commit.",
  );
const directories = [
  ...new Set(publications.map((item) => item.directory)),
  "packages/kernel",
];
const currentManifests = new Map<string, PackageManifest>();
const previousManifests = new Map<string, PackageManifest>();
for (const directory of directories)
  currentManifests.set(
    directory,
    await readManifest(resolve(repositoryRoot, directory)),
  );
if (!initialPush) {
  await run("git", ["cat-file", "-e", `${base}^{commit}`], {
    cwd: repositoryRoot,
  });
  for (const directory of directories) {
    const path = `${directory}/package.json`;
    const { stdout: files } = await run(
      "git",
      ["ls-tree", "--name-only", base, "--", path],
      { cwd: repositoryRoot },
    );
    if (!files.trim()) continue;
    const { stdout } = await run("git", ["show", `${base}:${path}`], {
      cwd: repositoryRoot,
    });
    const manifest: PackageManifest = JSON.parse(stdout);
    if (manifest.name === currentManifests.get(directory)?.name)
      previousManifests.set(directory, manifest);
  }
}
const snapshot = (manifests: Map<string, PackageManifest>) =>
  Object.fromEntries(
    [...manifests.values()].map(({ name, version }) => [name, version]),
  );
const currentVersions = snapshot(currentManifests);
const previousVersions = snapshot(previousManifests);
for (const [directory, current] of currentManifests) {
  const old = previousManifests.get(directory);
  if (old)
    assertDeliveryVersion(current, old, currentVersions, previousVersions);
}
for (const item of publications) {
  const old = previousManifests.get(item.directory);
  if (old) previous[item.name] = old.version;
}
const requested = process.env.RELEASE_PACKAGES;
const selected = requested
  ? selectPublications(
      requested === "all"
        ? publications.map((item) => item.name)
        : requested.split(",").map((name) => name.trim()),
    )
  : selectChangedPublications(versions, previous);
const plan = { commit: process.env.GITHUB_SHA ?? "", versions, selected };
assertReleasePlan(plan);
await mkdir(releaseDirectory, { recursive: true });
await writeJson(resolve(releaseDirectory, "plan.json"), plan);
if (process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `has-release=${selected.length > 0}\n`,
  );
console.log(
  selected.length
    ? `Selected: ${selected.map((name) => `${name}@${versions[name]}`).join(", ")}`
    : "No package version changed; publication skipped.",
);
