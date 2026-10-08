import assert from "node:assert/strict";
import { test } from "node:test";
import { LoomError } from "@intloom/utils";
import { codeId, source, workflowModule } from "../../test/workflow-fixture.ts";
import { validateWorkflow } from "./validate-workflow.ts";

test("validates compiled references without invoking Code or parsing business State", () => {
  const input = workflowModule();
  let called = false;
  let initialized = false;
  input.blueprint.stages.first.initializeState = () => {
    initialized = true;
    throw new Error("loader must not initialize Stage State");
  };
  input.codes[codeId] = () => {
    called = true;
    throw new Error("must not execute");
  };
  const result = validateWorkflow(source, input);
  assert.equal(result.source, source);
  assert.equal(result.codes[codeId], input.codes[codeId]);
  assert.equal(
    result.blueprint.stages.first?.stateSchema,
    input.blueprint.stages.first.stateSchema,
  );
  assert.equal(called, false);
  assert.equal(initialized, false);
});

for (const [name, mutate] of [
  [
    "missing entry Stage",
    (value) => {
      value.blueprint.entryStageName = "missing";
    },
  ],
  [
    "missing entry Step",
    (value) => {
      value.blueprint.stages.first.entryStepName = "missing";
    },
  ],
  [
    "mismatched Step key",
    (value) => {
      value.blueprint.stages.first.steps.run.stepName = "other";
    },
  ],
  [
    "missing Code",
    (value) => {
      value.blueprint.stages.first.steps.run.execution.codeId =
        "CODE-ABCDEFGHIJKLMNOPQRSTU";
    },
  ],
  [
    "missing Stage outcome",
    (value) => {
      value.blueprint.stages.first.on =
        {} as typeof value.blueprint.stages.first.on;
    },
  ],
] satisfies readonly (readonly [
  string,
  (value: ReturnType<typeof workflowModule>) => void,
])[]) {
  test(`rejects ${name}`, () => {
    const value = workflowModule();
    mutate(value);
    assert.throws(
      () => validateWorkflow(source, value),
      (error) => LoomError.is(error) && error.code === "INVALID_WORKFLOW",
    );
  });
}

test("rejects non-callable Codes and obsolete execution branches", () => {
  const input = workflowModule();
  assert.throws(
    () => validateWorkflow(source, { ...input, codes: { [codeId]: {} } }),
    /Invalid Workflow exports/,
  );
  const stage = input.blueprint.stages.first;
  const run = stage.steps.run;
  for (const obsolete of [
    { ...run, preHookId: codeId },
    { ...run, execution: { kind: "kernel", capabilityId: "ask" } },
  ]) {
    assert.throws(
      () =>
        validateWorkflow(source, {
          ...input,
          blueprint: {
            ...input.blueprint,
            stages: { first: { ...stage, steps: { run: obsolete } } },
          },
        }),
      /Invalid Workflow exports/,
    );
  }
});

test("rejects missing and non-callable Stage initializers", () => {
  const input = workflowModule();
  for (const initializeState of [undefined, null, {}, "initializer"]) {
    assert.throws(
      () =>
        validateWorkflow(source, {
          ...input,
          blueprint: {
            ...input.blueprint,
            stages: {
              first: { ...input.blueprint.stages.first, initializeState },
            },
          },
        }),
      /Invalid Workflow exports/,
    );
  }
});
