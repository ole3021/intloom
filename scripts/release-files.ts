import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repositoryRoot } from "./publication.ts";
import {
  assertReleaseManifest,
  assertReleasePlan,
  type ReleaseManifest,
  type ReleasePlan,
} from "./release.ts";

export const releaseDirectory = resolve(repositoryRoot, ".release");

export async function readReleasePlan(): Promise<ReleasePlan> {
  const plan: ReleasePlan = JSON.parse(
    await readFile(resolve(releaseDirectory, "plan.json"), "utf8"),
  );
  assertReleasePlan(plan);
  return plan;
}

export async function readReleaseManifest(): Promise<ReleaseManifest> {
  const release: ReleaseManifest = JSON.parse(
    await readFile(resolve(releaseDirectory, "manifest.json"), "utf8"),
  );
  assertReleaseManifest(release);
  return release;
}
