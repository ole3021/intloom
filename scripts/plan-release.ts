import { execFile } from "node:child_process";
import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { publications, repositoryRoot, writeJson } from "./publication.ts";
import {
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
if (base && !/^0+$/.test(base)) {
  if (!/^[a-f0-9]{40}$/.test(base))
    throw new Error("Invalid release base commit.");
  await run("git", ["cat-file", "-e", `${base}^{commit}`], {
    cwd: repositoryRoot,
  });
  for (const item of publications) {
    const path = `${item.directory}/package.json`;
    const { stdout: files } = await run(
      "git",
      ["ls-tree", "--name-only", base, "--", path],
      { cwd: repositoryRoot },
    );
    if (!files.trim()) continue;
    const { stdout } = await run("git", ["show", `${base}:${path}`], {
      cwd: repositoryRoot,
    });
    const manifest = JSON.parse(stdout);
    if (
      manifest.name === (item.name === "intloom" ? "@intloom/cli" : item.name)
    )
      previous[item.name] = manifest.version;
  }
}
const requested = process.env.RELEASE_PACKAGES;
if (!base && !requested)
  throw new Error("Manual preparation requires an explicit package selection.");
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
