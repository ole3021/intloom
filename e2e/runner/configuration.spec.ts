import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { caseSchema } from "./contracts.ts";
import {
  configurationSchema,
  configurationProfile,
  caseConfiguration,
  snapshotConfiguration,
} from "./configuration.ts";
import { selectCase } from "./cases.ts";
import { execute } from "./execute.ts";
import { repositoryRoot } from "./options.ts";

test("data-only cases and optional config limits support third-party names and arbitrary CMD model roles", async (t) => {
  const config = configurationSchema.parse({
    workflow: { source: "..", flowName: "third-party" },
    models: {
      user: "user",
      cmd: { default: "base", analyst: "analysis" },
      mcp: { worker: "worker" },
    },
  });
  const manifest = caseSchema.parse({
    id: "Alpha",
    intents: ["  First scope.\n", "Second scope."],
    models: {
      cmd: { analyst: "case-analysis" },
      mcp: { worker: "case-worker" },
    },
  });
  const merged = caseConfiguration(config, manifest);
  const cmd = configurationProfile(merged, "cmd", { ZEN_API_KEY: "fixture" });
  assert.equal(cmd.service?.analyst?.model, "case-analysis");
  assert.equal(cmd.service?.default?.model, "base");
  assert.equal(cmd.limits.maxDurationMs, undefined);
  assert.equal(
    configurationProfile(merged, "mcp", { ZEN_API_KEY: "fixture" }).clientAgent
      ?.model,
    "case-worker",
  );
  assert.equal(manifest.intents[0], "  First scope.\n");
  assert.throws(() => configurationProfile(merged, "cmd", {}), {
    code: "MODEL_CREDENTIAL_MISSING",
  });
  const root = await mkdtemp(join(tmpdir(), "e2e-config-case-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "Alpha"));
  await writeFile(join(root, "Alpha/case.yaml"), "intents:\n  - First scope\n");
  await writeFile(
    join(root, "Alpha/knowledge.md"),
    "Local business facts without numbered sections.",
  );
  const data = (await selectCase(root, "alpha", "seed")).data;
  assert.equal(data.manifest.id, "Alpha");
  assert.deepEqual(data.knowledgeIds, ["knowledge"]);
  assert.equal(
    (
      await selectCase(
        join(repositoryRoot, "packages/intent/e2e/cases"),
        "M01",
        "seed",
      )
    ).data.manifest.intents.length,
    2,
  );
  assert.equal(
    (
      await selectCase(
        join(repositoryRoot, "packages/intent/e2e/cases"),
        "L01",
        "seed",
      )
    ).data.manifest.intents.length,
    10,
  );
});

test("acceptance resources stay optional and preserve local helper modules", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "e2e-config-copy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const suite = join(root, "suite");
  await mkdir(join(suite, "checks"), { recursive: true });
  await writeFile(join(suite, "config.yaml"), "# configuration");
  await writeFile(join(suite, "checks/run.mjs"), "import './helper.mjs';");
  await writeFile(join(suite, "checks/helper.mjs"), "export const value = 1;");
  const config = configurationSchema.parse({
    workflow: { source: "..", flowName: "any" },
    models: { user: "model" },
    acceptance: { scripts: ["checks/run.mjs"] },
  });
  assert.equal(
    await snapshotConfiguration(suite, join(root, "copy"), config),
    "",
  );
  await assert.rejects(
    snapshotConfiguration(suite, join(root, "invalid"), {
      ...config,
      acceptance: { scripts: ["../outside.mjs"] },
    }),
    { code: "CONFIGURATION_INVALID" },
  );
  assert.equal(
    configurationSchema.safeParse({ ...config, limits: { maxDurationMs: 0 } })
      .success,
    false,
  );
});

test("missing Zen credentials block without preflight and configured acceptance is reported as not run", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "e2e-credential-block-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const suite = join(root, "suite");
  await mkdir(join(suite, "cases/Alpha"), { recursive: true });
  await writeFile(
    join(suite, "cases/Alpha/case.yaml"),
    "intents:\n  - Local scope\n",
  );
  await writeFile(
    join(suite, "cases/Alpha/knowledge.md"),
    "Authorized local scope.",
  );
  await writeFile(
    join(suite, "config.yaml"),
    "workflow:\n  source: ..\n  flowName: example\nmodels:\n  user: model\n  cmd:\n    default: model\nacceptance:\n  scripts: [check.mjs]\n",
  );
  const result = await execute(
    {
      entry: "cmd",
      root: join(root, "runs"),
      suite,
      casesRoot: join(suite, "cases"),
      caseId: "alpha",
      seed: "test",
      workflow: "",
      cli: "/unused",
    },
    undefined,
    {},
  );
  assert.equal(result.error?.code, "MODEL_CREDENTIAL_MISSING");
  assert.equal(result.status, "blocked");
  assert.equal(result.acceptance.status, "not_run");
  assert.equal(result.rounds.length, 0);
});
