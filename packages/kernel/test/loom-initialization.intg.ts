import assert from "node:assert/strict";
import { test } from "node:test";
import { initializeLooms } from "@intloom/kernel/loom";
import { credential, testConfig } from "./agent-fixture.ts";
import {
  compiledLoom,
  initializationProject,
} from "./initialization-fixture.ts";

const codeA = "CODE-abcdefghijklmnopqrstu";
const codeB = "CODE-ABCDEFGHIJKLMNOPQRSTU";
const codeC = "CODE-012345678901234567890";
const agentA = "AGENT-abcdefghijklmnopqrstu";
const agentB = "AGENT-ABCDEFGHIJKLMNOPQRSTU";

test("initializes multiple local and published Looms with model-independent Agent resources", async (t) => {
  credential(t);
  const project = await initializationProject(t);
  await project.add(
    "@test/local",
    compiledLoom("local", codeA, { [agentA]: "thinking" }),
    true,
  );
  await project.add("@test/installed", compiledLoom("installed", codeB), false);
  const result = await initializeLooms({
    projectRoot: project.root,
    config: { ...testConfig(), looms: project.looms },
  });
  assert.deepEqual(result.looms, [
    { packageName: "@test/local", loomName: "local", isAvailable: true },
    {
      packageName: "@test/installed",
      loomName: "installed",
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
    compiledLoom("protocol", codeA),
    false,
    "unsupported",
  );
  await project.add(
    "@test/import",
    "throw new Error('fixture import failed');",
  );
  await project.add(
    "@test/incomplete",
    compiledLoom("incomplete", codeB).replace(
      /export const codes = .*;/,
      "export const codes = {};",
    ),
  );
  await project.add("@test/good", compiledLoom("good", codeC));
  const result = await initializeLooms({
    projectRoot: project.root,
    config: { ...testConfig(), looms: project.looms },
  });
  const failed = result.looms.filter((entry) => !entry.isAvailable);
  assert.deepEqual(
    failed.map((entry) => [entry.packageName, entry.phase, entry.error.code]),
    [
      ["@test/protocol", "discover", "UNSUPPORTED_LOOM_PROTOCOL"],
      ["@test/import", "load", "LOOM_LOAD_FAILED"],
      ["@test/incomplete", "load", "INVALID_LOOM"],
    ],
  );
  assert.ok(failed[1]?.error.cause instanceof Error);
  assert.deepEqual(Object.keys(result.registries.blueprints), ["good"]);
  assert.deepEqual(Object.keys(result.registries.codes), [codeC]);
  assert.equal(result.looms.at(-1)?.isAvailable, true);
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
    compiledLoom("broken", codeA, {
      [agentA]: "thinking",
      [agentB]: "coding",
    }),
  );
  await project.add(
    "@test/good",
    compiledLoom("good", codeB, { [agentA]: "thinking" }),
  );
  const config = { ...testConfig(), looms: project.looms };
  config.llms.coding = {
    ...config.llms.default,
    secret: "ENV.INTLOOM_ABSENT_FIXTURE_KEY",
  };
  const result = await initializeLooms({
    projectRoot: project.root,
    config,
  });
  const first = result.looms[0];
  assert.ok(first?.isAvailable);
  assert.deepEqual(Object.keys(result.registries.codes), [codeA]);
  assert.deepEqual(Object.keys(result.registries.agents), [agentA, agentB]);
  assert.deepEqual(Object.keys(result.registries.blueprints), ["broken"]);
  const conflict = result.looms[1];
  assert.ok(conflict && !conflict.isAvailable);
  assert.equal(conflict.error.code, "LOOM_CONFLICT");
});

for (const conflict of ["run", "code", "agent"]) {
  test(`marks a later ${conflict} conflict unavailable and preserves earlier registrations`, async (t) => {
    credential(t);
    const project = await initializationProject(t);
    await project.add(
      "@test/first",
      compiledLoom("first", codeA, { [agentA]: "thinking" }),
    );
    await project.add(
      "@test/conflict",
      compiledLoom(
        conflict === "run" ? "first" : "conflict",
        conflict === "code" ? codeA : codeB,
        { [conflict === "agent" ? agentA : agentB]: "thinking" },
      ),
    );
    await project.add("@test/last", compiledLoom("last", codeC));
    const result = await initializeLooms({
      projectRoot: project.root,
      config: { ...testConfig(), looms: project.looms },
    });
    const entry = result.looms[1];
    assert.ok(entry && !entry.isAvailable);
    assert.equal(entry.phase, "register");
    assert.equal(entry.error.code, "LOOM_CONFLICT");
    assert.deepEqual(Object.keys(result.registries.blueprints), [
      "first",
      "last",
    ]);
    assert.deepEqual(Object.keys(result.registries.codes), [codeA, codeC]);
    assert.deepEqual(Object.keys(result.registries.agents), [agentA]);
    assert.equal(result.looms[2]?.isAvailable, true);
  });
}

test("returns empty registries when all declared Looms fail", async (t) => {
  const project = await initializationProject(t);
  await project.add("@test/broken", "export const blueprint = {};");
  const result = await initializeLooms({
    projectRoot: project.root,
    config: { ...testConfig(), looms: project.looms },
  });
  assert.equal(result.looms[0]?.isAvailable, false);
  assert.deepEqual(Object.keys(result.registries.blueprints), []);
  assert.deepEqual(Object.keys(result.registries.codes), []);
  assert.deepEqual(Object.keys(result.registries.agents), []);
});
