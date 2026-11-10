import assert from "node:assert/strict";
import {
  spawn,
  spawnSync,
  execFileSync,
  type SpawnSyncReturns,
} from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { closeSync, openSync, writeSync } from "node:fs";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { gt, valid } from "semver";

const {
  values: { base },
} = parseArgs({ options: { base: { type: "string" } } });
const root = fileURLToPath(new URL("../", import.meta.url));
const { version } = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
) as { version: string };
await mkdir(join(root, ".release"), { recursive: true });
const destination = await mkdtemp(
  join(root, ".release", `${version}-${process.platform}-${process.arch}-`),
);
console.log(`Preparing candidate: ${destination}`);
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (base !== undefined) {
  assert.match(base, /^[a-f0-9]{40}$/);
  execFileSync("git", ["cat-file", "-e", `${base}^{commit}`], { cwd: root });
  const units: Record<string, { version: string; changed: boolean }> = {};
  for (const [unit, path] of Object.entries({
    framework: "packages/loom-sdk/package.json",
    cli: "apps/cli/package.json",
    site: "apps/site/package.json",
    app: "apps/app/package.json",
  })) {
    const { version } = JSON.parse(await readFile(join(root, path), "utf8"));
    const old: SpawnSyncReturns<string> = spawnSync(
      "git",
      ["show", `${base}:${path}`],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    const previous: string | null =
      old.status === 0 ? JSON.parse(old.stdout).version : null;
    assert.ok(
      valid(version) &&
        (!previous || previous === version || gt(version, previous)),
      `Invalid ${unit} version`,
    );
    const changed = previous !== version;
    if (changed) await access(join(root, "releases", unit, `${version}.md`));
    units[unit] = { version, changed };
  }
  await writeFile(
    join(destination, "plan.json"),
    `${JSON.stringify({ sha, base, units }, null, 2)}\n`,
  );
}
await cp(
  join(root, "test/e2e/npm/fixtures/looms"),
  join(destination, "examples"),
  { recursive: true },
);
await cp(
  join(root, "docs/maintainers/candidate.md"),
  join(destination, "README.md"),
);
const log = openSync(join(destination, "verification.log"), "wx");
try {
  for (const task of ["clean", "verify"]) {
    writeSync(log, `\n$ bun --no-env-file run ${task}\n`);
    const child = spawn("bun", ["--no-env-file", "run", task], {
      cwd: root,
      env: {
        ...process.env,
        TURBO_FORCE: "true",
        TURBO_TELEMETRY_DISABLED: "1",
        INTLOOM_CANDIDATE_DIR: destination,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (bytes: Buffer) => {
      writeSync(log, bytes);
      process.stdout.write(bytes);
    });
    child.stderr.on("data", (bytes: Buffer) => {
      writeSync(log, bytes);
      process.stderr.write(bytes);
    });
    const [code, signal] = await once(child, "close");
    assert.equal(
      code,
      0,
      `${task} failed (${signal ?? code}); evidence retained at ${destination}`,
    );
  }
} finally {
  closeSync(log);
}

const packages = [];
const dependencies: Record<string, string> = {};
for (const file of (await readdir(join(destination, "framework"))).sort()) {
  const archive = join(destination, "framework", file);
  const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
    .trim()
    .split("\n");
  assert.ok(
    entries.every((entry) =>
      /^package\/(?:package\.json|author-files\.d\.ts|README\.md|LICENSE|dist(?:\/.*)?)$/.test(
        entry,
      ),
    ),
    `${file}: unexpected package content`,
  );
  const manifest = JSON.parse(
    execFileSync("tar", ["-xOf", archive, "package/package.json"], {
      encoding: "utf8",
    }),
  ) as { name: string; version: string; dependencies?: Record<string, string> };
  const unit =
    manifest.name === "intloom" || manifest.name === "@intloom/cli"
      ? "apps/cli"
      : "packages/loom-sdk";
  const expected = JSON.parse(
    await readFile(join(root, unit, "package.json"), "utf8"),
  ).version;
  assert.equal(manifest.version, expected);
  const integrity =
    "sha512-" +
    createHash("sha512")
      .update(await readFile(archive))
      .digest("base64");
  packages.push({ ...manifest, integrity, file: `framework/${file}`, entries });
  dependencies[manifest.name] = `file:./framework/${file}`;
}
assert.deepEqual(packages.map((p) => p.name).sort(), [
  "@intloom/cli",
  "@intloom/compiler",
  "@intloom/kernel",
  "@intloom/loom-sdk",
  "intloom",
]);
assert.deepEqual(packages.find((p) => p.name === "intloom")?.dependencies, {
  "@intloom/cli": packages.find((p) => p.name === "@intloom/cli")?.version,
});
await writeFile(
  join(destination, "package.json"),
  `${JSON.stringify(
    {
      name: "intloom-local-candidate",
      version,
      private: true,
      type: "module",
      dependencies: { ...dependencies, zod: "4.6.7" },
      overrides: dependencies,
    },
    null,
    2,
  )}\n`,
);
const files = [];
for (const file of (await readdir(destination, { recursive: true })).sort()) {
  const path = join(destination, file);
  if (!(await stat(path)).isFile()) continue;
  const bytes = await readFile(path);
  files.push({
    file,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
await writeFile(
  join(destination, "candidate.json"),
  `${JSON.stringify(
    {
      formatVersion: 2,
      commit: sha,
      version,
      status: "verified",
      createdAt: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      bun: execFileSync("bun", ["--version"], { encoding: "utf8" }).trim(),
      verification: {
        command: "bun run verify",
        cleanBuild: true,
        turboForce: true,
        log: "verification.log",
        liveModels: false,
        humanClient: false,
        registryPublished: false,
      },
      packages,
      files,
    },
    null,
    2,
  )}\n`,
);
const manifestDigest = createHash("sha256")
  .update(await readFile(join(destination, "candidate.json")))
  .digest("hex");
await writeFile(
  join(destination, "SHA256SUMS"),
  `${[
    ...files.map(({ file, sha256 }) => `${sha256}  ${file}`),
    `${manifestDigest}  candidate.json`,
  ].join("\n")}\n`,
);
console.log(
  `Verified candidate: ${relative(root, destination)} (not published)`,
);
