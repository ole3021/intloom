import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { publications, repositoryRoot } from "./publication.ts";
import { readVersions, releaseNotes } from "./release.ts";

import { readReleasePlan } from "./release-files.ts";
import { validateRelease, releaseChannel } from "./version.ts";

const plan = await readReleasePlan();
if (plan.commit !== process.env.GITHUB_SHA)
  throw new Error("Release plan commit mismatch.");
const versions = await readVersions();
if (publications.some(({ name }) => versions[name] !== plan.versions[name]))
  throw new Error("Release plan versions changed.");
const changelog = await readFile(
  resolve(repositoryRoot, "CHANGELOG.md"),
  "utf8",
);
for (const name of plan.selected) {
  validateRelease(
    versions[name],
    releaseChannel(versions[name]),
    process.env.RELEASE_REF ?? "",
  );
  releaseNotes(changelog, name, versions[name]);
}
