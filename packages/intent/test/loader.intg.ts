import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  discoverWorkflows,
  initializeWorkflows,
  loadWorkflow,
} from "@intloom/kernel/workflow";
import { modelConfig } from "./loader-fixture.ts";

const root = fileURLToPath(new URL("../", import.meta.url));

test("loads local workspace Intent with resources relative to its resolved entry", async (t) => {
  const previous = process.env.INTLOOM_PACKED_TEST_KEY;
  process.env.INTLOOM_PACKED_TEST_KEY = "fixture-credential";
  t.after(() => {
    if (previous === undefined) delete process.env.INTLOOM_PACKED_TEST_KEY;
    else process.env.INTLOOM_PACKED_TEST_KEY = previous;
  });
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Initialization must not call the model");
  });
  const project = await mkdtemp(resolve(tmpdir(), "intent-local-"));
  t.after(() => rm(project, { recursive: true, force: true }));
  const installation = resolve(project, ".intloom/workflows");
  await mkdir(resolve(installation, "node_modules/@intloom"), {
    recursive: true,
  });
  await symlink(
    root,
    resolve(installation, "node_modules/@intloom/workflow-intent"),
    "dir",
  );
  const manifest = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  const config = modelConfig(manifest.version);
  const {
    sources: [source],
    failures,
  } = await discoverWorkflows(installation, config.workflows);
  assert.deepEqual(failures, []);
  assert.ok(source);
  assert.equal(source.assetRoot, resolve(source.packageRoot, "dist"));
  const workflow = await loadWorkflow(source);
  assert.equal(workflow.blueprint.flowName, "intent");
  const result = await initializeWorkflows({
    projectRoot: project,
    config,
  });
  assert.deepEqual(result.workflows, [
    {
      packageName: "@intloom/workflow-intent",
      flowName: "intent",
      isAvailable: true,
    },
  ]);
  for (const agent of Object.values(result.registries.agents)) {
    assert.equal(
      agent.spec.skills.length,
      agent.spec.name === "intent-analyst" ? 3 : 0,
    );
    assert.ok(agent.spec.tools.length >= 2);
  }
});
