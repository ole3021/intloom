import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { execute } from "../src/e2e/runner.ts";
import { snapshotCandidate } from "../src/e2e/candidate.ts";
import { Evidence } from "../src/e2e/evidence.ts";
import { controlledModel, createProbe } from "./e2e-fixture.ts";

const cli = fileURLToPath(new URL("../dist/bin.js", import.meta.url));

test("candidate preserves installed runtime files outside dist without rebuilding dependencies", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-e2e-candidate-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "source"),
    built = join(source, "dist"),
    dependency = join(source, "node_modules/probe-runtime");
  await mkdir(built, { recursive: true });
  await mkdir(join(dependency, "dist"), { recursive: true });
  const manifest = {
    name: "built-probe",
    version: "1.0.0",
    type: "module",
    main: "./loom.mjs",
    dependencies: { "probe-runtime": "1.0.0" },
  };
  await writeFile(join(source, "package.json"), JSON.stringify(manifest));
  await writeFile(join(built, "package.json"), JSON.stringify(manifest));
  await writeFile(
    join(built, "loom.mjs"),
    "export { marker } from 'probe-runtime';\n",
  );
  await writeFile(
    join(dependency, "package.json"),
    JSON.stringify({
      name: "probe-runtime",
      version: "1.0.0",
      type: "module",
      main: "./index.js",
      scripts: { build: "exit 1" },
    }),
  );
  await writeFile(
    join(dependency, "index.js"),
    "export const marker = 'preserved';\n",
  );
  await writeFile(join(dependency, ".env"), "TEST_SECRET=must-not-be-copied\n");
  const evidence = new Evidence(join(root, "evidence"));
  await evidence.prepare();
  const candidate = await snapshotCandidate(
    join(source, "package.json"),
    built,
    root,
    evidence,
  );
  const consumer = join(root, "consumer");
  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  const invoke = promisify(execFile);
  await invoke(
    "npm",
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      candidate.archive,
    ],
    {
      cwd: consumer,
      env: { ...process.env, npm_config_cache: join(root, "cache") },
    },
  );
  const result = await invoke(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import {marker} from 'built-probe'; console.log(marker)",
    ],
    { cwd: consumer },
  );
  assert.equal(result.stdout.trim(), "preserved");
  await assert.rejects(
    readFile(join(consumer, "node_modules/probe-runtime/.env")),
    { code: "ENOENT" },
  );
});
for (const entry of ["cmd", "mcp"] as const)
  test(`E2E ${entry}: built generic Loom, four inputs, two Runs, questions, confirmation and independent checks`, {
    timeout: 90000,
  }, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "intloom-e2e-probe-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const model = await controlledModel(t);
    const packagePath = await createProbe(join(root, "loom"), model.baseURL);
    const built = await readFile(join(packagePath, "dist/loom.mjs"), "utf8");
    const result = await execute(
      {
        packagePath,
        root: join(root, "output"),
        cli,
        entry,
        caseId: "alpha",
        seed: "probe",
      },
      new AbortController().signal,
      {
        ...process.env,
        PROBE_API_KEY: "probe-private-key",
        npm_config_offline: "true",
      },
    );
    assert.equal(result.status, "passed", JSON.stringify(result));
    assert.equal(result.rounds, 2);
    const saved = JSON.parse(await readFile(result.paths.result, "utf8"));
    assert.equal(saved.cleanup, "stopped");
    assert.equal(saved.checks.status, "passed");
    assert.notEqual(saved.rounds[0].run.runId, saved.rounds[1].run.runId);
    assert.deepEqual(model.failures, []);
    assert.deepEqual(
      [...model.models].sort(),
      entry === "cmd" ? ["service", "user"] : ["user", "worker"],
    );
    const evidence = await readFile(
      join(result.paths.evidence, "actions.jsonl"),
      "utf8",
    );
    assert.ok(!evidence.includes("probe-private-key"));
    assert.equal(
      await readFile(join(packagePath, "dist/loom.mjs"), "utf8"),
      built,
      "E2E never rebuilds or modifies the source distribution",
    );
  });

for (const mode of [
  "early_finish",
  "check_failure",
  "worker_truncated",
] as const)
  test(`E2E preserves failure and stops later rounds: ${mode}`, {
    timeout: 90000,
  }, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "intloom-e2e-failure-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const model = await controlledModel(
      t,
      mode === "check_failure" ? "normal" : mode,
    );
    const packagePath = await createProbe(join(root, "loom"), model.baseURL);
    if (mode === "check_failure")
      await writeFile(
        join(packagePath, "e2e/check.mjs"),
        "throw new Error('Expected independent check failure');\n",
      );
    const result = await execute(
      {
        packagePath,
        root: join(root, "output"),
        cli,
        entry: "mcp",
        caseId: "Alpha",
        seed: "failure",
      },
      new AbortController().signal,
      {
        ...process.env,
        PROBE_API_KEY: "probe-private-key",
        npm_config_offline: "true",
      },
    );
    assert.equal(result.status, "failed", JSON.stringify(result));
    assert.equal(result.rounds, mode === "check_failure" ? 1 : 0);
    assert.equal(
      result.error?.code,
      mode === "early_finish"
        ? "RUN_MISSING"
        : mode === "check_failure"
          ? "CASE_CHECK_FAILED"
          : "MODEL_EXECUTION_INCOMPLETE",
    );
    assert.ok(await readFile(result.paths.report, "utf8"));
    assert.deepEqual(model.failures, []);
  });

test("CLI e2e lists local cases without a model and reports missing builds", {
  timeout: 15000,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-e2e-command-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packagePath = await createProbe(
    join(root, "loom"),
    "http://127.0.0.1:1",
  );
  const invoke = promisify(execFile);
  const listed = await invoke(process.execPath, [cli, "e2e", "--list"], {
    cwd: packagePath,
  });
  assert.equal(JSON.parse(listed.stdout).cases[0].rounds, 2);
  await rm(join(packagePath, "dist"), { recursive: true });
  const result = await invoke(
    process.execPath,
    [
      cli,
      "e2e",
      packagePath,
      "--root",
      join(root, "output"),
      "--case",
      "Alpha",
    ],
    { env: { ...process.env, PROBE_API_KEY: "probe-private-key" } },
  ).catch((e) => e);
  assert.equal(result.code, 2);
  assert.equal(JSON.parse(result.stdout).error.code, "LOOM_NOT_BUILT");
});
