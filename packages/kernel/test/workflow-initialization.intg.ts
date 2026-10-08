import assert from "node:assert/strict";
import { test } from "node:test";
import { initializeWorkflows } from "@intloom/kernel/workflow";
import { credential, testConfig } from "./agent-fixture.ts";
import {
  compiledWorkflow,
  initializationProject,
} from "./initialization-fixture.ts";

const codeA = "CODE-abcdefghijklmnopqrstu";
const codeB = "CODE-ABCDEFGHIJKLMNOPQRSTU";
const codeC = "CODE-012345678901234567890";
const agentA = "AGENT-abcdefghijklmnopqrstu";
const agentB = "AGENT-ABCDEFGHIJKLMNOPQRSTU";

test("initializes multiple local and published Workflows with model-independent Agent resources", async (t) => {
  credential(t);
  const project = await initializationProject(t);
  await project.add(
    "@test/local",
    compiledWorkflow("local", codeA, { [agentA]: "reasoning" }),
    true,
  );
  await project.add(
    "@test/installed",
    compiledWorkflow("installed", codeB),
    false,
  );
  const result = await initializeWorkflows({
    projectRoot: project.root,
    config: { ...testConfig(), workflows: project.workflows },
  });
  assert.deepEqual(result.workflows, [
    { packageName: "@test/local", flowName: "local", isAvailable: true },
    {
      packageName: "@test/installed",
      flowName: "installed",
      isAvailable: true,
    },
  ]);
  assert.deepEqual(Object.keys(result.registries.blueprints), [
    "local",
    "installed",
  ]);
  assert.equal(typeof result.registries.codes[codeA], "function");
  assert.equal(
    result.registries.agents[agentA]?.spec.instructions,
    "Review changes",
  );
});

test("isolates discovery, import and incomplete-export failures and continues loading", async (t) => {
  const project = await initializationProject(t);
  await project.add(
    "@test/protocol",
    compiledWorkflow("protocol", codeA),
    false,
    "unsupported",
  );
  await project.add(
    "@test/import",
    "throw new Error('fixture import failed');",
  );
  await project.add(
    "@test/incomplete",
    compiledWorkflow("incomplete", codeB).replace(
      /export const codes = .*;/,
      "export const codes = {};",
    ),
  );
  await project.add("@test/good", compiledWorkflow("good", codeC));
  const result = await initializeWorkflows({
    projectRoot: project.root,
    config: { ...testConfig(), workflows: project.workflows },
  });
  const failed = result.workflows.filter((entry) => !entry.isAvailable);
  assert.deepEqual(
    failed.map((entry) => [entry.packageName, entry.phase, entry.error.code]),
    [
      ["@test/protocol", "discover", "UNSUPPORTED_WORKFLOW_PROTOCOL"],
      ["@test/import", "load", "WORKFLOW_LOAD_FAILED"],
      ["@test/incomplete", "load", "INVALID_WORKFLOW"],
    ],
  );
  assert.ok(failed[1]?.error.cause instanceof Error);
  assert.deepEqual(Object.keys(result.registries.blueprints), ["good"]);
  assert.deepEqual(Object.keys(result.registries.codes), [codeC]);
  assert.equal(result.workflows.at(-1)?.isAvailable, true);
});

test("ignores missing model credentials while loading and preserves resource conflicts", async (t) => {
  credential(t);
  const previous = process.env.INTLOOM_ABSENT_FIXTURE_KEY;
  delete process.env.INTLOOM_ABSENT_FIXTURE_KEY;
  t.after(() => {
    if (previous !== undefined)
      process.env.INTLOOM_ABSENT_FIXTURE_KEY = previous;
  });
  const project = await initializationProject(t);
  await project.add(
    "@test/broken",
    compiledWorkflow("broken", codeA, {
      [agentA]: "reasoning",
      [agentB]: "coding",
    }),
  );
  await project.add(
    "@test/good",
    compiledWorkflow("good", codeB, { [agentA]: "reasoning" }),
  );
  const config = { ...testConfig(), workflows: project.workflows };
  config.llms.coding = {
    ...config.llms.default,
    secret: "ENV.INTLOOM_ABSENT_FIXTURE_KEY",
  };
  const result = await initializeWorkflows({
    projectRoot: project.root,
    config,
  });
  const first = result.workflows[0];
  assert.ok(first?.isAvailable);
  assert.deepEqual(Object.keys(result.registries.codes), [codeA]);
  assert.deepEqual(Object.keys(result.registries.agents), [agentA, agentB]);
  assert.deepEqual(Object.keys(result.registries.blueprints), ["broken"]);
  const conflict = result.workflows[1];
  assert.ok(conflict && !conflict.isAvailable);
  assert.equal(conflict.error.code, "WORKFLOW_CONFLICT");
});

for (const conflict of ["flow", "code", "agent"]) {
  test(`marks a later ${conflict} conflict unavailable and preserves earlier registrations`, async (t) => {
    credential(t);
    const project = await initializationProject(t);
    await project.add(
      "@test/first",
      compiledWorkflow("first", codeA, { [agentA]: "reasoning" }),
    );
    await project.add(
      "@test/conflict",
      compiledWorkflow(
        conflict === "flow" ? "first" : "conflict",
        conflict === "code" ? codeA : codeB,
        { [conflict === "agent" ? agentA : agentB]: "reasoning" },
      ),
    );
    await project.add("@test/last", compiledWorkflow("last", codeC));
    const result = await initializeWorkflows({
      projectRoot: project.root,
      config: { ...testConfig(), workflows: project.workflows },
    });
    const entry = result.workflows[1];
    assert.ok(entry && !entry.isAvailable);
    assert.equal(entry.phase, "register");
    assert.equal(entry.error.code, "WORKFLOW_CONFLICT");
    assert.deepEqual(Object.keys(result.registries.blueprints), [
      "first",
      "last",
    ]);
    assert.deepEqual(Object.keys(result.registries.codes), [codeA, codeC]);
    assert.deepEqual(Object.keys(result.registries.agents), [agentA]);
    assert.equal(result.workflows[2]?.isAvailable, true);
  });
}

test("returns empty registries when all declared Workflows fail", async (t) => {
  const project = await initializationProject(t);
  await project.add("@test/broken", "export const blueprint = {};");
  const result = await initializeWorkflows({
    projectRoot: project.root,
    config: { ...testConfig(), workflows: project.workflows },
  });
  assert.equal(result.workflows[0]?.isAvailable, false);
  assert.deepEqual(Object.keys(result.registries.blueprints), []);
  assert.deepEqual(Object.keys(result.registries.codes), []);
  assert.deepEqual(Object.keys(result.registries.agents), []);
});
