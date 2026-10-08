import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { repositoryRoot } from "./publication.ts";
import { githubReleaseExists } from "./github.ts";
import { releaseNotes } from "./release.ts";
import { readReleaseManifest, releaseDirectory } from "./release-files.ts";

const release = await readReleaseManifest();
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.GITHUB_REF !== "refs/heads/main" ||
  release.commit !== process.env.GITHUB_SHA
)
  throw new Error(
    "Finalization requires the verified main-branch release commit.",
  );
const run = promisify(execFile);
const changelog = await readFile(
  resolve(repositoryRoot, "CHANGELOG.md"),
  "utf8",
);
for (const entry of release.entries.filter(
  (entry) => entry.name !== "intloom",
)) {
  const tag = `${entry.name}@${entry.version}`;
  const { stdout: existing } = await run(
    "git",
    [
      "ls-remote",
      "--tags",
      "origin",
      `refs/tags/${tag}`,
      `refs/tags/${tag}^{}`,
    ],
    { cwd: repositoryRoot },
  );
  const targets = existing
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(/\s+/));
  const target =
    targets.find((line) => line[1]?.endsWith("^{}"))?.[0] ?? targets[0]?.[0];
  if (target && target !== release.commit)
    throw new Error(`Release tag already targets another commit: ${tag}`);
  const exists = await githubReleaseExists(tag, (args) =>
    run("gh", args, { cwd: repositoryRoot }),
  );
  if (target && !exists) throw new Error(`Existing tag has no release: ${tag}`);
  if (!exists) {
    const notes = releaseNotes(changelog, entry.name, entry.version);
    const notesFile = resolve(
      releaseDirectory,
      `${entry.name.replaceAll("/", "-").replace(/^@/, "")}-notes.md`,
    );
    await writeFile(notesFile, `${notes}\n`);
    await run(
      "gh",
      [
        "release",
        "create",
        tag,
        "--target",
        release.commit,
        "--title",
        tag,
        "--notes-file",
        notesFile,
        "--latest=false",
        ...(entry.tag === "next" ? ["--prerelease"] : []),
      ],
      { cwd: repositoryRoot },
    );
  }
  const files = [
    entry.file,
    ...(entry.name === "@intloom/cli"
      ? release.entries
          .filter((item) => item.name === "intloom")
          .map((item) => item.file)
      : []),
    "manifest.json",
  ];
  await run(
    "gh",
    [
      "release",
      "upload",
      tag,
      ...files.map((file) => resolve(releaseDirectory, file)),
      "--clobber",
    ],
    { cwd: repositoryRoot },
  );
}
