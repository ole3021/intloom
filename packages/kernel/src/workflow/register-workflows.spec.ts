import assert from "node:assert/strict";
import { test } from "node:test";
import { agentSpec } from "../../test/agent-fixture.ts";
import {
  agentId,
  codeId,
  source,
  workflowModule,
} from "../../test/workflow-fixture.ts";
import { registerWorkflows } from "./register-workflows.ts";
import type { LoadedAgent } from "./types.ts";
import { validateWorkflow } from "./validate-workflow.ts";

test("registers Code and Blueprint references in own-property tables", () => {
  const workflow = validateWorkflow(source, workflowModule());
  const result = registerWorkflows([workflow], []);
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
  const first = validateWorkflow(source, workflowModule());
  const existing = registerWorkflows([first], []);
  const second = validateWorkflow(
    { ...source, packageName: "@test/second" },
    workflowModule(),
  );
  assert.throws(() => registerWorkflows([second], [], existing), {
    code: "WORKFLOW_CONFLICT",
  });
  const another = validateWorkflow(second.source, {
    ...workflowModule(),
    blueprint: { ...workflowModule().blueprint, flowName: "another" },
  });
  assert.throws(
    () => registerWorkflows([another], [], existing),
    /Code already registered/,
  );
  assert.deepEqual(Object.keys(existing.blueprints), ["fixture"]);
  assert.deepEqual(Object.keys(existing.codes), [codeId]);
  assert.equal(existing.blueprints.fixture, first.blueprint);
});

test("requires all Agent definitions to have exactly one complete resource descriptor", () => {
  const spec = agentSpec();
  const workflow = validateWorkflow(source, {
    ...workflowModule(),
    agentSpecs: { [agentId]: spec },
  });
  const initialized = { agentId, source, spec };
  assert.throws(
    () => registerWorkflows([workflow], []),
    /Missing loaded Agent/,
  );
  assert.throws(
    () => registerWorkflows([workflow], [initialized, initialized]),
    /duplicate loaded Agent/,
  );
  assert.throws(() => registerWorkflows([], [initialized]), /Unexpected/);
  const incomplete = { ...initialized, spec: {} } as LoadedAgent;
  assert.throws(
    () => registerWorkflows([workflow], [incomplete]),
    /Incomplete loaded Agent/,
  );
  const result = registerWorkflows([workflow], [initialized]);
  assert.equal(result.agents[agentId], initialized);
  const otherInput = workflowModule();
  const otherCodeId = "CODE-ABCDEFGHIJKLMNOPQRSTU";
  otherInput.blueprint.flowName = "other";
  otherInput.blueprint.stages.first.steps.run.execution.codeId = otherCodeId;
  const other = validateWorkflow(
    { ...source, packageName: "@test/other" },
    {
      ...otherInput,
      codes: { [otherCodeId]: otherInput.codes[codeId] },
      agentSpecs: { [agentId]: spec },
    },
  );
  assert.throws(
    () => registerWorkflows([other], [initialized], result),
    /Agent already registered/,
  );
  assert.deepEqual(Object.keys(result.codes), [codeId]);
});
