import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { discoverWorkflows, loadWorkflow } from "@intloom/kernel/workflow";

async function fixture(
  t: TestContext,
  local: boolean,
  asset = "skills/attachment.txt",
) {
  const root = await realpath(
    await mkdtemp(resolve(tmpdir(), "workflow-loader-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageRoot = resolve(root, "node_modules/@test/flow");
  const assetRoot = local ? resolve(packageRoot, "dist") : packageRoot;
  await mkdir(resolve(assetRoot, "skills"), { recursive: true });
  await writeFile(
    resolve(root, "package.json"),
    JSON.stringify({ type: "module", dependencies: { "@test/flow": "1.0.0" } }),
  );
  await writeFile(
    resolve(packageRoot, "package.json"),
    JSON.stringify({
      name: "@test/flow",
      version: "1.0.0",
      type: "module",
      intloom: { type: "workflow", version: "2026-10-08" },
      exports: {
        ".": {
          types: local ? "./dist/flow.d.ts" : "./flow.d.ts",
          default: local ? "./dist/flow.js" : "./flow.js",
        },
        "./package.json": "./package.json",
      },
    }),
  );
  const zodFile = findPackageJSON("zod", import.meta.url);
  assert.ok(zodFile);
  await symlink(dirname(zodFile), resolve(root, "node_modules/zod"), "dir");
  const module = `
import * as z from "zod";
export const blueprint = { flowName: "fixture", entryStageName: "first", stages: {
  first: { stageName: "first", initializeState: () => ({ value: "initial" }), stateSchema: z.object({ value: z.string() }), entryStepName: "run",
    steps: { run: { stepName: "run", execution: { kind: "code", codeId: "CODE-abcdefghijklmnopqrstu" }, on: { complete: { kind: "stage_end" } } } },
    on: { complete: { kind: "workflow_end" } } }
} };
export const codes = { "CODE-abcdefghijklmnopqrstu": () => { throw new Error("loader must not invoke Code"); } };
export const agentSpecs = { "AGENT-abcdefghijklmnopqrstu": {
  name: "review", description: "", instructions: "review", llm: "reasoning", outputSchema: z.object({ outcome: z.string() }),
  skills: [{ name: "review", description: "", content: "review", assets: ["skills/SKILL.md", ${JSON.stringify(asset)}] }], tools: []
} };
`;
  await writeFile(resolve(assetRoot, "flow.js"), module);
  await writeFile(
    resolve(assetRoot, "skills/SKILL.md"),
    '---\nname: review\ndescription: ""\n---\nreview',
  );
  await writeFile(resolve(assetRoot, "skills/attachment.txt"), "attachment");
  const {
    sources: [source],
    failures,
  } = await discoverWorkflows(root);
  assert.deepEqual(failures, []);
  assert.ok(source);
  return { source, assetRoot, packageRoot, root };
}

for (const local of [true, false]) {
  test(`loads ${local ? "local dist" : "published root"} through package exports`, async (t) => {
    const { source, assetRoot } = await fixture(t, local);
    assert.equal(source.assetRoot, assetRoot);
    const workflow = await loadWorkflow(source);
    assert.equal(workflow.blueprint.flowName, "fixture");
    assert.equal(
      workflow.blueprint.stages.first?.stateSchema.safeParse({ value: "ok" })
        .success,
      true,
    );
    assert.equal(Object.keys(workflow.codes).length, 1);
  });
}

test("rejects missing attachments", async (t) => {
  const { source } = await fixture(t, false, "skills/missing.txt");
  await assert.rejects(loadWorkflow(source), { code: "WORKFLOW_LOAD_FAILED" });
});

test("rejects attachment traversal and symlink escape", async (t) => {
  const first = await fixture(t, false, "../outside.txt");
  await assert.rejects(loadWorkflow(first.source), {
    code: "INVALID_WORKFLOW",
  });
  const second = await fixture(t, true);
  await rm(resolve(second.assetRoot, "skills/attachment.txt"));
  await writeFile(resolve(second.root, "outside.txt"), "outside");
  await symlink(
    resolve(second.root, "outside.txt"),
    resolve(second.assetRoot, "skills/attachment.txt"),
  );
  await assert.rejects(loadWorkflow(second.source), /escapes resource root/);
});

test("rejects broken module exports without reporting a loaded Workflow", async (t) => {
  const { source, assetRoot } = await fixture(t, false);
  await writeFile(
    resolve(assetRoot, "flow.js"),
    "export const blueprint = {};",
  );
  await assert.rejects(loadWorkflow(source), { code: "INVALID_WORKFLOW" });
});
