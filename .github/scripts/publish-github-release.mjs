import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [unit, tag, version, sha, dir] = process.argv.slice(2);
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" }).trim();
// biome-ignore lint/suspicious/noUndeclaredEnvVars: GitHub Actions runs this release script directly, outside Turbo.
const repo = process.env.GITHUB_REPOSITORY;
const assets = [];
if (unit === "app") {
  const expected = [];
  for (const [target, extension] of Object.entries({
    "macos-arm64": ".dmg",
    "macos-x64": ".dmg",
    "win-x64": ".zip",
    "linux-x64": ".tar.gz",
  })) {
    const installer = `IntLoom-Studio-${version}-${target}${extension}`;
    const bundle = target.startsWith("macos-")
      ? "IntLoomStudio.app"
      : "IntLoomStudio";
    expected.push(
      installer,
      `${installer}.sha256`,
      `stable-${target}-update.json`,
      `stable-${target}-${bundle}.tar.zst`,
    );
  }
  assert.deepEqual(
    readdirSync(dir).sort(),
    expected.sort(),
    "Incomplete or unexpected Studio release files",
  );
  assets.push(...expected.map((name) => join(dir, name)));
} else {
  const candidate = JSON.parse(
    readFileSync(join(dir, "candidate.json"), "utf8"),
  );
  const packages = candidate.packages
    .filter(
      (p) =>
        (p.name === "intloom" || p.name === "@intloom/cli") ===
        (unit === "cli"),
    )
    .map(({ name, version, file, integrity }) => ({
      name,
      version,
      file,
      integrity,
    }));
  assert.ok(packages.length);
  assets.push(...packages.map((p) => join(dir, p.file)));
  const manifest = join(dir, `${unit}-${version}-manifest.json`);
  writeFileSync(
    manifest,
    `${JSON.stringify({ commit: sha, packages }, null, 2)}\n`,
  );
  assets.push(manifest);
}
const refs = execFileSync(
  "git",
  ["ls-remote", "--tags", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`],
  { encoding: "utf8" },
).trim();
if (refs)
  assert.equal(
    refs.split("\n").at(-1).split(/\s+/)[0],
    sha,
    "Existing tag points to another commit",
  );
const releases = gh(
  "api",
  "--paginate",
  `repos/${repo}/releases?per_page=100`,
  "--jq",
  ".[] | {tag_name, draft, prerelease, target_commitish} | @json",
)
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const existing = releases.find((release) => release.tag_name === tag);
const coreVersion = version.split("+")[0];
const prerelease = coreVersion.includes("-");
if (existing) {
  if (!existing.draft) {
    assert.ok(refs);
    process.exit(0);
  }
  assert.equal(
    existing.target_commitish,
    sha,
    "Draft belongs to another commit",
  );
} else {
  gh(
    "release",
    "create",
    tag,
    "--draft",
    "--target",
    sha,
    "--title",
    tag,
    "--notes-file",
    `releases/${unit}/${version}.md`,
    ...(prerelease ? ["--prerelease"] : []),
  );
}
gh("release", "upload", tag, ...assets, "--clobber");
// A delayed build or a retried draft may publish after a newer Studio release.
const latest =
  unit === "app" &&
  !prerelease &&
  !releases.some((release) => {
    if (release.draft || release.prerelease) return false;
    const stable = /^app-v(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(release.tag_name);
    return (
      stable &&
      stable[1].localeCompare(coreVersion, "en", { numeric: true }) > 0
    );
  });
gh("release", "edit", tag, "--draft=false", `--latest=${latest}`);
