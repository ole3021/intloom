import { verifyReleaseArchives } from "./archive.ts";
import { publishArchives } from "./registry.ts";
import { readReleaseManifest } from "./release-files.ts";

if (process.argv.length > 2)
  throw new Error("Automatic publication accepts no arguments.");
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.GITHUB_REPOSITORY !== "ole3021/intloom" ||
  process.env.GITHUB_REF !== "refs/heads/main" ||
  process.env.RELEASE_PUBLISH_ENABLED !== "true" ||
  !["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")
)
  throw new Error(
    "Automatic publication requires the enabled main-branch release workflow.",
  );
const release = await readReleaseManifest();
if (release.commit !== process.env.GITHUB_SHA)
  throw new Error("Release commit mismatch.");
await verifyReleaseArchives(release, process.env.RELEASE_REF ?? "");
await publishArchives(release, true);
