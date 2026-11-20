// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: This test runs directly under Node, outside Turbo tasks and caching.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const packages = [
  "packages/loom-sdk",
  "packages/compiler",
  "packages/kernel",
  "apps/cli",
];

test("framework archives build Looms that install and import in an independent npm consumer", (t) => {
  const scratch = mkdtempSync(join(tmpdir(), "intloom-authoring-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const archives = process.env.INTLOOM_ARCHIVES_DIR
    ? resolve(process.env.INTLOOM_ARCHIVES_DIR)
    : join(scratch, "archives");

  if (process.env.INTLOOM_REQUIRE_ARCHIVES !== "1") {
    mkdirSync(archives, { recursive: true });
    const launcher = join(scratch, "launcher");
    execFileSync(
      process.execPath,
      [join(root, "apps/cli/scripts/build-npm-launcher.mjs"), launcher],
      { cwd: root },
    );
    const inventory = [];
    for (const directory of [...packages.map((p) => join(root, p)), launcher]) {
      const manifest = JSON.parse(
        readFileSync(join(directory, "package.json"), "utf8"),
      );
      const filename = `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`;
      execFileSync(
        "bun",
        [
          "--no-env-file",
          "pm",
          "pack",
          "--ignore-scripts",
          "--quiet",
          "--filename",
          join(archives, filename),
        ],
        { cwd: directory },
      );
      inventory.push({
        name: manifest.name,
        version: manifest.version,
        file: filename,
        sha256: createHash("sha256")
          .update(readFileSync(join(archives, filename)))
          .digest("hex"),
      });
    }
    writeFileSync(
      join(archives, "packages.json"),
      `${JSON.stringify({ scope: "authoring", packages: inventory }, null, 2)}\n`,
    );
  }

  const inventory = JSON.parse(
    readFileSync(join(archives, "packages.json"), "utf8"),
  );
  assert.equal(inventory.scope, "authoring");
  assert.deepEqual(inventory.packages.map((p) => p.name).sort(), [
    "@intloom/cli",
    "@intloom/compiler",
    "@intloom/kernel",
    "@intloom/loom-sdk",
    "intloom",
  ]);
  const dependencies = {};
  for (const item of inventory.packages) {
    const archive = join(archives, item.file);
    assert.equal(
      createHash("sha256").update(readFileSync(archive)).digest("hex"),
      item.sha256,
      item.name,
    );
    dependencies[item.name] = `file:${archive}`;
  }
  const consumer = join(scratch, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies,
      devDependencies: { "@types/node": "26.6.6" },
    }),
  );
  const options = {
    cwd: consumer,
    encoding: "utf8",
    env: { ...process.env, npm_config_cache: join(scratch, "npm-cache") },
  };
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--engine-strict",
    ],
    options,
  );
  for (const item of inventory.packages) {
    const directory = join(consumer, "node_modules", item.name);
    const installed = JSON.parse(
      readFileSync(join(directory, "package.json"), "utf8"),
    );
    assert.equal(installed.version, item.version);
    if (
      ["@intloom/loom-sdk", "@intloom/compiler", "@intloom/kernel"].includes(
        item.name,
      )
    ) {
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `await import(${JSON.stringify(item.name)});`,
        ],
        options,
      );
      assert.ok(
        readFileSync(join(directory, installed.exports["."].types)).length,
      );
    }
    if (installed.bin) {
      const entry = join(directory, Object.values(installed.bin)[0]);
      assert.equal(
        execFileSync(process.execPath, [entry, "--version"], options).trim(),
        item.version,
      );
      assert.match(
        execFileSync(process.execPath, [entry, "--help"], options),
        /check.*|build.*/,
      );
      const unavailable = spawnSync(process.execPath, [entry, "run"], options);
      assert.notEqual(unavailable.status, 0);
    }
  }
  assert.match(
    execFileSync(
      join(consumer, "node_modules/.bin/intloom"),
      ["--help"],
      options,
    ),
    /Usage:/,
  );

  const cli = join(consumer, "node_modules/@intloom/cli/dist/bin.js");
  const compiler = join(consumer, "node_modules/@intloom/compiler/dist/bin.js");
  const builtPackages = {};
  for (const name of [
    "code-report",
    "code-report-workspace",
    "agent-research",
    "workflow-report",
    "hello-loom",
    "meeting-notes",
    "intent-loom",
  ]) {
    const project = join(consumer, "projects", name);
    cpSync(
      join(
        root,
        "examples",
        name === "code-report-workspace" ? "code-report" : name,
      ),
      project,
      {
        recursive: true,
        filter: (source) =>
          !["node_modules", "dist", ".turbo"].some((part) =>
            source.split(/[\\/]/).includes(part),
          ),
      },
    );
    if (name === "code-report-workspace") {
      const metadata = JSON.parse(
        readFileSync(join(project, "package.json"), "utf8"),
      );
      metadata.name = "@intloom-example/code-report-workspace";
      writeFileSync(join(project, "package.json"), JSON.stringify(metadata));
      writeFileSync(
        join(project, "loom.yaml"),
        readFileSync(join(project, "loom.yaml"), "utf8").replace(
          "scope: intloom",
          "scope: workspace",
        ),
      );
    }
    assert.match(
      execFileSync(
        process.execPath,
        [cli, "check", project, "--details"],
        options,
      ),
      /Code dynamic calls: not statically enumerated/,
    );
    assert.match(
      execFileSync(process.execPath, [compiler, "build", project], options),
      /Built/,
    );
    const output = join(project, "dist");
    const metadata = JSON.parse(
      readFileSync(join(output, "package.json"), "utf8"),
    );
    assert.equal(metadata.loom, "./loom.json");
    assert.equal(metadata.scripts, undefined);
    assert.equal(metadata.devDependencies, undefined);
    assert.doesNotMatch(
      JSON.stringify(metadata.dependencies),
      /workspace:|file:|link:/,
    );
    const packed = JSON.parse(
      execFileSync(
        "npm",
        ["pack", "--json", "--ignore-scripts", "--pack-destination", scratch],
        { ...options, cwd: output },
      ),
    );
    assert.ok(packed[0].files.some((file) => file.path.endsWith(".d.ts")));
    assert.ok(
      packed[0].files.every(
        (file) =>
          !file.path.includes(".intloom-prepare-") &&
          (!file.path.endsWith(".ts") || file.path.endsWith(".d.ts")),
      ),
    );
    builtPackages[metadata.name] = `file:${join(scratch, packed[0].filename)}`;
  }

  const runtime = join(scratch, "runtime-consumer");
  mkdirSync(runtime);
  writeFileSync(
    join(runtime, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        ...builtPackages,
        "@intloom/loom-sdk": dependencies["@intloom/loom-sdk"],
        "@intloom/kernel": dependencies["@intloom/kernel"],
      },
    }),
  );
  const runtimeOptions = { ...options, cwd: runtime };
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--engine-strict",
    ],
    runtimeOptions,
  );
  cpSync(
    new URL("./fixtures/consume.mjs", import.meta.url),
    join(runtime, "consume.mjs"),
  );
  execFileSync(
    process.execPath,
    [join(runtime, "consume.mjs")],
    runtimeOptions,
  );
  cpSync(
    new URL("./fixtures/data-consumer.mjs", import.meta.url),
    join(runtime, "data-consumer.mjs"),
  );
  t.diagnostic(
    execFileSync(
      process.execPath,
      [join(runtime, "data-consumer.mjs")],
      runtimeOptions,
    ),
  );
  cpSync(
    new URL("./fixtures/run-consumer.mjs", import.meta.url),
    join(runtime, "run-consumer.mjs"),
  );
  t.diagnostic(
    execFileSync(
      process.execPath,
      [join(runtime, "run-consumer.mjs")],
      runtimeOptions,
    ),
  );
  for (const fixture of [
    "rich-examples.test.mjs",
    "definition-driver.mjs",
    "intent",
  ]) {
    cpSync(
      new URL(`./fixtures/${fixture}`, import.meta.url),
      join(runtime, fixture),
      { recursive: true },
    );
  }
  const business = execFileSync(
    process.execPath,
    ["--test", "--test-reporter=tap", "rich-examples.test.mjs"],
    {
      ...runtimeOptions,
      env: { ...runtimeOptions.env, NODE_TEST_CONTEXT: undefined },
    },
  );
  assert.match(business, /^# tests [1-9]\d*$/m);
  assert.match(business, /^# fail 0$/m);
  t.diagnostic(business);
  cpSync(
    new URL("./fixtures/consume.mts", import.meta.url),
    join(runtime, "consume.mts"),
  );
  writeFileSync(
    join(runtime, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        noEmit: true,
        module: "NodeNext",
        target: "ES2022",
        strict: true,
        exactOptionalPropertyTypes: true,
        types: [],
      },
      files: ["consume.mts"],
    }),
  );
  const tsc = join(
    dirname(createRequire(compiler).resolve("typescript/package.json")),
    "bin/tsc",
  );
  execFileSync(
    process.execPath,
    [tsc, "-p", join(runtime, "tsconfig.json")],
    runtimeOptions,
  );
});
