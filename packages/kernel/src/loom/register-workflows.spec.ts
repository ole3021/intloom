import assert from "node:assert/strict";
import { test } from "node:test";
import { agentSpec } from "../../test/agent-fixture.ts";
import {
  agentId,
  codeId,
  source,
  workflowModule,
} from "../../test/workflow-fixture.ts";
import { registerLooms } from "./register-looms.ts";
import type { LoadedAgent } from "./types.ts";
import { validateLoom } from "./validate-loom.ts";

test("registers Code and Blueprint references in own-property tables", () => {
  const workflow = validateLoom(source, workflowModule());
  const result = registerLooms([workflow], []);
  assert.equal(result.blueprints.fixture, workflow.blueprint);
  assert.equal(result.codes[codeId], workflow.codes[codeId]);
  assert.equal(result.sources.fixture, source);
  for (const table of [
    result.blueprints,
    result.codes,
    result.agents,
    result.sources,
  ]) {
    assert.equal(Object.getPrototypeOf(table), null);
  }
});

test("rejects duplicate flows and IDs without changing existing registries", () => {
  const first = validateLoom(source, workflowModule());
  const existing = registerLooms([first], []);
  const second = validateLoom(
    { ...source, packageName: "@test/second" },
    workflowModule(),
  );
  assert.throws(() => registerLooms([second], [], existing), {
    code: "LOOM_CONFLICT",
  });
  const another = validateLoom(second.source, {
    ...workflowModule(),
    blueprint: { ...workflowModule().blueprint, loomName: "another" },
  });
  assert.throws(
    () => registerLooms([another], [], existing),
    /Code already registered/,
  );
  assert.deepEqual(Object.keys(existing.blueprints), ["fixture"]);
  assert.deepEqual(Object.keys(existing.codes), [codeId]);
  assert.equal(existing.blueprints.fixture, first.blueprint);
});

test("requires all Agent definitions to have exactly one complete resource descriptor", () => {
  const spec = agentSpec();
  const workflow = validateLoom(source, {
    ...workflowModule(),
    agentSpecs: { [agentId]: spec },
  });
  const initialized = { agentId, source, spec };
  assert.throws(() => registerLooms([workflow], []), /Missing loaded Agent/);
  assert.throws(
    () => registerLooms([workflow], [initialized, initialized]),
    /duplicate loaded Agent/,
  );
  assert.throws(() => registerLooms([], [initialized]), /Unexpected/);
  const incomplete = { ...initialized, spec: {} } as LoadedAgent;
  assert.throws(
    () => registerLooms([workflow], [incomplete]),
    /Incomplete loaded Agent/,
  );
  const result = registerLooms([workflow], [initialized]);
  assert.equal(result.agents[agentId], initialized);
  const otherInput = workflowModule();
  const otherCodeId = "CODE-ABCDEFGHIJKLMNOPQRSTU";
  otherInput.blueprint.loomName = "other";
  otherInput.blueprint.stages.first.steps.run.execution.codeId = otherCodeId;
  const other = validateLoom(
    { ...source, packageName: "@test/other" },
    {
      ...otherInput,
      codes: { [otherCodeId]: otherInput.codes[codeId] },
      agentSpecs: { [agentId]: spec },
    },
  );
  assert.throws(
    () => registerLooms([other], [initialized], result),
    /Agent already registered/,
  );
  assert.deepEqual(Object.keys(result.codes), [codeId]);
});
