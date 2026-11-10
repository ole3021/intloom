// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: The Node artifact tests run outside Turbo.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const fixtures = join(import.meta.dirname, "fixtures");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const candidateDir =
  process.env.INTLOOM_CANDIDATE_DIR &&
  resolve(process.env.INTLOOM_CANDIDATE_DIR);
const archiveDir = candidateDir
  ? join(candidateDir, "framework")
  : await mkdtemp(join(tmpdir(), "intloom-npm-archives-"));
if (!candidateDir) {
  before(() => run("bun", ["run", "turbo", "run", "@intloom/cli#build"], root));
  after(() => rm(archiveDir, { recursive: true, force: true }));
}
const rootManifest = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
) as { devDependencies: Record<string, string> };

type PackedManifest = {
  name: string;
  version: string;
  exports?: Record<string, unknown>;
};

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")}\n${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout.trim();
}

async function pack(directory: string) {
  const manifest = JSON.parse(
    await readFile(join(root, directory, "package.json"), "utf8"),
  ) as PackedManifest;
  await mkdir(archiveDir, { recursive: true });
  const archive = join(
    archiveDir,
    `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`,
  );
  // The SDK-only and full consumers install the same candidate bytes.
  const exists = await access(archive).then(
    () => true,
    () => false,
  );
  if (process.env.INTLOOM_REQUIRE_ARCHIVES === "1") assert.ok(exists, archive);
  if (!exists)
    run(
      "bun",
      [
        "--no-env-file",
        "pm",
        "pack",
        "--filename",
        archive,
        "--ignore-scripts",
        "--quiet",
      ],
      join(root, directory),
    );
  return archive;
}

test("SDK tarball supplies isolated public types without engine dependencies", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "intloom-loom-sdk-consumer-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const archive = await pack("packages/loom-sdk");
  const consumer = join(temporary, "consumer");
  await mkdir(consumer);
  const sdkManifest = JSON.parse(
    await readFile(join(root, "packages/loom-sdk/package.json"), "utf8"),
  ) as { devDependencies: { zod: string } };
  const compilerManifest = JSON.parse(
    await readFile(join(root, "packages/compiler/package.json"), "utf8"),
  ) as { dependencies: { esbuild: string } };
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "@intloom/loom-sdk": `file:${archive}`,
        zod: sdkManifest.devDependencies.zod,
        typescript: rootManifest.devDependencies.typescript,
        esbuild: compilerManifest.dependencies.esbuild,
      },
    }),
  );
  run(
    "npm",
    ["install", "--engine-strict", "--no-audit", "--no-fund"],
    consumer,
  );
  await cp(
    join(fixtures, "sdk-consumer.ts.fixture"),
    join(consumer, "index.ts"),
  );
  await writeFile(
    join(consumer, "author.ts"),
    (
      await readFile(
        join(root, "packages/loom-sdk/test/types/author.ts"),
        "utf8",
      )
    ).replace('"../../src/index.ts"', '"@intloom/loom-sdk"'),
  );
  await writeFile(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        module: "NodeNext",
        strict: true,
        exactOptionalPropertyTypes: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
      },
      files: ["index.ts", "author.ts"],
    }),
  );
  const files = run(
    join(consumer, "node_modules/.bin/tsc"),
    ["-p", "tsconfig.json", "--listFiles"],
    consumer,
  );
  assert.doesNotMatch(files, /node_modules[/\\](?:@mastra|@libsql|libsql)/);
  await cp(
    join(fixtures, "author-bundle.mjs"),
    join(consumer, "verify-author.mjs"),
  );
  assert.match(
    run(process.execPath, ["verify-author.mjs"], consumer),
    /author-bundle:.*verified/,
  );
  run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'await import("@intloom/loom-sdk"); await import("@intloom/loom-sdk/package-format");',
    ],
    consumer,
  );
  const installed = await realpath(
    join(consumer, "node_modules/@intloom/loom-sdk"),
  );
  assert.ok(relative(root, installed).startsWith(".."));
});

test("all framework tarballs load in Node with working CLI and native dependencies", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "intloom-node-consumer-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const dependencies: Record<string, string> = {};
  const manifests: PackedManifest[] = [];
  for (const directory of [
    "packages/loom-sdk",
    "packages/compiler",
    "packages/kernel",
    "apps/cli",
  ]) {
    const manifest = JSON.parse(
      await readFile(join(root, directory, "package.json"), "utf8"),
    ) as PackedManifest;
    manifests.push(manifest);
    const archive = await pack(directory);
    dependencies[manifest.name] = `file:${archive}`;
  }
  const launcherDir = join(temporary, "launcher");
  run(
    process.execPath,
    [join(root, "apps/cli/scripts/build-npm-launcher.mjs"), launcherDir],
    root,
  );
  const launcher = JSON.parse(
    await readFile(join(launcherDir, "package.json"), "utf8"),
  ) as PackedManifest;
  const launcherArchive = await pack(relative(root, launcherDir));
  dependencies[launcher.name] = `file:${launcherArchive}`;
  manifests.push(launcher);
  const consumer = join(temporary, "consumer");
  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        ...dependencies,
        zod: "4.6.7",
        typescript: rootManifest.devDependencies.typescript,
        "@modelcontextprotocol/client":
          rootManifest.devDependencies["@modelcontextprotocol/client"],
      },
    }),
  );
  run(
    "npm",
    ["install", "--engine-strict", "--no-audit", "--no-fund"],
    consumer,
  );
  for (const manifest of manifests) {
    const installedPath = join(consumer, "node_modules", manifest.name);
    const installed = JSON.parse(
      await readFile(join(installedPath, "package.json"), "utf8"),
    ) as {
      version: string;
      engines: { node: string };
      dependencies?: Record<string, string>;
    };
    assert.equal(installed.version, manifest.version);
    assert.equal(installed.engines.node, "^22.22.0 || ^24.0.0 || ^26.0.0");
    assert.ok(
      !JSON.stringify(installed.dependencies ?? {}).includes("workspace:"),
      `${manifest.name}: unresolved workspace dependency in tarball`,
    );
    for (const [name, version] of Object.entries(
      installed.dependencies ?? {},
    )) {
      const local = manifests.find((candidate) => candidate.name === name);
      if (local) {
        assert.equal(version, local.version, `${manifest.name}: ${name}`);
      }
    }
    assert.ok(relative(root, await realpath(installedPath)).startsWith(".."));
    for (const subpath of Object.keys(manifest.exports ?? {})) {
      if (subpath === "./bin") continue; // Executable import runs the CLI.
      const specifier =
        manifest.name + (subpath === "." ? "" : subpath.slice(1));
      run(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `await import(${JSON.stringify(specifier)})`,
        ],
        consumer,
      );
    }
  }
  const cli = join(consumer, "node_modules/.bin/intloom");
  assert.equal(run(cli, ["--version"], consumer), manifests.at(-1)?.version);
  assert.match(run(cli, ["--help"], consumer), /status --watch/);
  assert.match(run(cli, ["startup", "--help"], consumer), /MCP HTTP/);
  const unavailable = spawnSync(cli, ["run"], {
    cwd: consumer,
    encoding: "utf8",
  });
  assert.equal(unavailable.status, 2);
  assert.equal(unavailable.stdout, "");
  await cp(
    join(fixtures, "dependencies.mjs"),
    join(consumer, "dependencies.mjs"),
  );
  const evidence = run(process.execPath, ["dependencies.mjs"], consumer);
  t.diagnostic(evidence);
  assert.equal(JSON.parse(evidence).sqlite, "ok");
  await cp(
    join(fixtures, "compiler-consumer.mjs"),
    join(consumer, "compiler-consumer.mjs"),
  );
  const compiler = run(process.execPath, ["compiler-consumer.mjs"], consumer);
  assert.match(compiler, /compiler-consumer:.*verified/);
  t.diagnostic(compiler);
  await cp(
    join(fixtures, "lifecycle-consumer.mjs"),
    join(consumer, "lifecycle-consumer.mjs"),
  );
  await cp(
    join(root, "test/fixtures/lifecycle-code.ts.fixture"),
    join(consumer, "lifecycle-code.ts"),
  );
  await cp(join(root, "test/fixtures/cli.mjs"), join(consumer, "cli.mjs"));
  const lifecycle = run(process.execPath, ["lifecycle-consumer.mjs"], consumer);
  assert.match(lifecycle, /lifecycle-consumer:.*verified/);
  t.diagnostic(lifecycle);
  await cp(
    join(fixtures, "execution-consumer.mjs"),
    join(consumer, "execution-consumer.mjs"),
  );
  await cp(
    join(root, "test/fixtures/execution-workflow.ts.fixture"),
    join(consumer, "execution-workflow.ts"),
  );
  const execution = run(process.execPath, ["execution-consumer.mjs"], consumer);
  assert.match(execution, /execution-consumer:.*verified/);
  t.diagnostic(execution);
  await cp(
    join(fixtures, "recovery-consumer.mjs"),
    join(consumer, "recovery-consumer.mjs"),
  );
  await cp(
    join(root, "test/fixtures/recovery-workflow.ts.fixture"),
    join(consumer, "recovery-workflow.ts"),
  );
  const recovery = run(process.execPath, ["recovery-consumer.mjs"], consumer);
  assert.match(recovery, /recovery-consumer:.*verified/);
  t.diagnostic(recovery);
  await cp(
    join(fixtures, "outcomes-consumer.mjs"),
    join(consumer, "outcomes-consumer.mjs"),
  );
  await cp(
    join(root, "test/fixtures/outcomes-outcome.ts.fixture"),
    join(consumer, "outcomes-outcome.ts"),
  );
  const outcomes = run(process.execPath, ["outcomes-consumer.mjs"], consumer);
  assert.match(outcomes, /outcomes-consumer:.*verified/);
  t.diagnostic(outcomes);
  await cp(
    join(fixtures, "mcp-consumer.mjs"),
    join(consumer, "mcp-consumer.mjs"),
  );
  const mcp = run(process.execPath, ["mcp-consumer.mjs"], consumer);
  assert.match(mcp, /mcp-consumer:.*verified/);
  t.diagnostic(mcp);
  await cp(
    candidateDir ? join(candidateDir, "examples") : join(fixtures, "looms"),
    join(consumer, "examples"),
    { recursive: true },
  );
  await cp(
    join(fixtures, "examples-consumer.mjs"),
    join(consumer, "examples-consumer.mjs"),
  );
  const examples = run(
    process.execPath,
    ["examples-consumer.mjs", ...(candidateDir ? [candidateDir] : [])],
    consumer,
  );
  assert.match(examples, /examples-consumer:.*verified/);
  t.diagnostic(examples);
  await cp(
    join(fixtures, "lifecycle-types.ts.fixture"),
    join(consumer, "lifecycle-types.ts"),
  );
  await writeFile(
    join(consumer, "tsconfig.lifecycle.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        module: "NodeNext",
        strict: true,
        exactOptionalPropertyTypes: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
      },
      files: ["lifecycle-types.ts"],
    }),
  );
  const sdkFiles = run(
    join(consumer, "node_modules/.bin/tsc"),
    ["-p", "tsconfig.lifecycle.json", "--listFiles"],
    consumer,
  );
  assert.doesNotMatch(sdkFiles, /node_modules[/\\](?:@mastra|@libsql|libsql)/);
  for (const name of ["intloom", "@intloom/cli"]) {
    const command = join(consumer, "node_modules", name, "dist/bin.js");
    assert.equal(
      run(process.execPath, [command, "--version"], consumer),
      launcher.version,
    );
  }
});
