import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agentId,
  source,
  workflowModule,
} from "../../../test/workflow-fixture.ts";
import {
  agentSpec,
  credential,
  testConfig,
} from "../../../test/agent-fixture.ts";
import { deferred } from "../../../test/runtime-fixture.ts";
import { createAgent } from "./create-agent.ts";
import { createServicePreparation } from "./prepare.ts";
import { createExecutionPreparation } from "../../core/prepare-execution.ts";
import { validateWorkflow } from "../../workflow/validate-workflow.ts";

function fixture() {
  const spec = agentSpec();
  const module = workflowModule();
  const blueprint = validateWorkflow(source, {
    ...module,
    agentSpecs: { [agentId]: spec },
    blueprint: {
      ...module.blueprint,
      stages: {
        first: {
          ...module.blueprint.stages.first,
          steps: {
            run: {
              ...module.blueprint.stages.first.steps.run,
              execution: { kind: "agent", agentId },
            },
          },
        },
      },
    },
  }).blueprint;
  return {
    spec,
    blueprint,
    resources: { [agentId]: { agentId, spec, source } },
  };
}

test("service preparation shares concurrent assembly, retries failed preparation, and isolates client policy", async (t) => {
  credential(t);
  const f = fixture();
  const gate = deferred();
  let calls = 0;
  const preparation = createServicePreparation(
    testConfig(),
    f.resources,
    async (...args) => {
      calls++;
      await gate.promise;
      if (calls === 1) throw new Error("assembly failure");
      return createAgent(...args);
    },
  );
  const first = preparation.prepare(f.blueprint);
  const second = preparation.prepare(f.blueprint);
  const failures = Promise.all([
    assert.rejects(first, { code: "KERNEL_UNAVAILABLE" }),
    assert.rejects(second, { code: "KERNEL_UNAVAILABLE" }),
  ]);
  gate.resolve();
  await failures;
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(preparation.agents), []);
  await Promise.all([
    preparation.prepare(f.blueprint),
    preparation.prepare(f.blueprint),
  ]);
  assert.equal(calls, 2);
  assert.equal(typeof preparation.agents[agentId]?.execute, "function");
});

test("client preparation never reads llms and an unused role never blocks service preparation", async (t) => {
  credential(t);
  const f = fixture();
  const config = testConfig();
  config.llms.coding = {
    ...config.llms.default,
    secret: "ENV.INTLOOM_UNUSED_ROLE_KEY",
  };
  const preparation = createServicePreparation(config, f.resources);
  await preparation.prepare(f.blueprint);
  assert.equal(typeof preparation.agents[agentId]?.execute, "function");
  const client = createExecutionPreparation(
    {
      ...config,
      get llms(): never {
        throw new Error("Client read llms");
      },
    },
    f.resources,
  );
  const codeOnly = validateWorkflow(source, workflowModule()).blueprint;
  assert.equal(
    (await client.prepare(codeOnly, "agent_ide")).agentExecutor,
    "mcp_client",
  );
  assert.equal(
    (await client.prepare(f.blueprint, "agent_ide")).agentExecutor,
    "mcp_client",
  );
  assert.deepEqual(Object.keys(client.agents), []);
});
