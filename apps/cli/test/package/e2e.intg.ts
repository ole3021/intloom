import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { testArchives } from "../../../../scripts/test-packages.ts";
import { controlledModel, createProbe } from "../e2e-fixture.ts";

test("installed CLI runs built local Loom E2E with CMD by default outside the repository", {
  timeout: 120000,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-e2e-package-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const consumer = join(root, "consumer");
  await mkdir(consumer);
  const archives = await testArchives([
    "@intloom/cli",
    "@intloom/compiler",
    "@intloom/loom-sdk",
    "@intloom/utils",
  ]);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: { "@intloom/cli": `file:${archives["@intloom/cli"]}` },
      overrides: Object.fromEntries(
        Object.entries(archives).map(([name, file]) => [name, `file:${file}`]),
      ),
    }),
  );
  const run = promisify(execFile);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PROBE_API_KEY: "probe-private-key",
  };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  await run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--engine-strict",
    ],
    {
      cwd: consumer,
      env,
      timeout: 90000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  const cli = join(consumer, "node_modules/@intloom/cli/dist/bin.js");
  const files = await readdir(
    join(consumer, "node_modules/@intloom/cli/dist/e2e"),
  );
  assert.ok(files.includes("runner.js"));
  const commands = await readdir(
    join(consumer, "node_modules/@intloom/cli/dist/cmd"),
  );
  assert.ok(commands.includes("e2e.js"));
  assert.equal(
    files.some((file) => /\.(?:spec|intg)\./u.test(file)),
    false,
  );
  const model = await controlledModel(t);
  const packagePath = await createProbe(join(root, "loom"), model.baseURL, 1);
  // Resolve the candidate's runtime graph entirely from this isolated installation.
  await rm(join(packagePath, "node_modules"));
  await symlink(
    join(consumer, "node_modules"),
    join(packagePath, "node_modules"),
  );
  const output = await run(
    process.execPath,
    [
      cli,
      "e2e",
      packagePath,
      "--case",
      "Alpha",
      "--root",
      join(root, "output"),
    ],
    { cwd: consumer, env, timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
  );
  const result = JSON.parse(output.stdout);
  assert.equal(result.status, "passed", output.stdout);
  const saved = JSON.parse(await readFile(result.paths.result, "utf8"));
  assert.equal(saved.entry, "cmd");
  assert.equal(saved.cleanup, "stopped");
  assert.equal(saved.checks.status, "passed");
  assert.deepEqual([...model.models].sort(), ["service", "user"]);
  assert.deepEqual(model.failures, []);
});
