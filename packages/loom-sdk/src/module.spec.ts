import assert from "node:assert/strict";
import { test } from "node:test";
import * as z from "zod";
import { loomModuleSchema, type LoomModule } from "./module.ts";
import { defineAgentTool } from "./agent.ts";

function fixture() {
  let calls = 0;
  const forbidden = (): never => {
    calls++;
    throw new Error("Validation must not execute business definitions");
  };
  const code = Object.assign(forbidden, { recover: forbidden });
  const value = {
    blueprint: {
      loomName: "example",
      inputs: ["prompt"],
      entryStageName: "first",
      stages: {
        first: {
          stageName: "first",
          stateSchema: z.json().superRefine(forbidden),
          initializeState: forbidden,
          entryStepName: "run",
          steps: {
            run: {
              stepName: "run",
              execution: { kind: "code", codeId: "CODE-abcdefghijklmnopqrstu" },
              on: { done: { kind: "stage_end" } },
            },
          },
          on: { done: { kind: "loom_end" } },
        },
      },
    },
    codes: { "CODE-abcdefghijklmnopqrstu": code },
    agentSpecs: {
      "AGENT-abcdefghijklmnopqrstu": {
        name: "reviewer",
        description: "Review",
        instructions: "Review the draft",
        llm: "thinking",
        outputSchema: z
          .strictObject({ outcome: z.literal("done") })
          .superRefine(forbidden),
        skills: [],
        tools: [
          defineAgentTool({
            id: "read",
            description: "Read",
            inputSchema: z.string().superRefine(forbidden),
            outputSchema: z.string().superRefine(forbidden),
            execute: forbidden,
            endsAgent: forbidden,
          }),
        ],
      },
    },
  } satisfies LoomModule;
  return { value, calls: () => calls };
}

test("validates compiled structure without invoking code, tools, initializers or schema parsers", () => {
  const f = fixture();
  const parsed = loomModuleSchema.parse(f.value);
  assert.equal(
    parsed.codes["CODE-abcdefghijklmnopqrstu"],
    f.value.codes["CODE-abcdefghijklmnopqrstu"],
  );
  assert.equal(
    parsed.blueprint.stages.first?.stateSchema,
    f.value.blueprint.stages.first.stateSchema,
  );
  assert.equal(f.calls(), 0);
});

for (const { name, change, path } of [
  {
    name: "unknown module export",
    change: (value) => ({ ...value, extra: {} }),
    path: [],
  },
  {
    name: "malformed Code ID",
    change: (value) => ({
      ...value,
      codes: { "CODE-short": () => ({ outcome: "done" }) },
    }),
    path: ["codes", "CODE-short"],
  },
  {
    name: "non-callable Code",
    change: (value) => ({
      ...value,
      codes: { "CODE-abcdefghijklmnopqrstu": {} },
    }),
    path: ["codes", "CODE-abcdefghijklmnopqrstu"],
  },
  {
    name: "non-callable recovery",
    change: (value) => ({
      ...value,
      codes: {
        "CODE-abcdefghijklmnopqrstu": Object.assign(
          () => ({ outcome: "done" }),
          { recover: true },
        ),
      },
    }),
    path: ["codes", "CODE-abcdefghijklmnopqrstu"],
  },
  {
    name: "malformed Agent ID",
    change: (value) => ({
      ...value,
      agentSpecs: {
        "AGENT-short": value.agentSpecs["AGENT-abcdefghijklmnopqrstu"],
      },
    }),
    path: ["agentSpecs", "AGENT-short"],
  },
  {
    name: "duplicate input declaration",
    change: (value) => ({
      ...value,
      blueprint: { ...value.blueprint, inputs: ["prompt", "prompt"] },
    }),
    path: ["blueprint", "inputs"],
  },
  {
    name: "reserved Loom name",
    change: (value) => ({
      ...value,
      blueprint: { ...value.blueprint, loomName: "constructor" },
    }),
    path: ["blueprint", "loomName"],
  },
  {
    name: "invalid Agent output Schema",
    change: (value) => ({
      ...value,
      agentSpecs: {
        "AGENT-abcdefghijklmnopqrstu": {
          ...value.agentSpecs["AGENT-abcdefghijklmnopqrstu"],
          outputSchema: {},
        },
      },
    }),
    path: ["agentSpecs", "AGENT-abcdefghijklmnopqrstu", "outputSchema"],
  },
] satisfies {
  name: string;
  change(value: ReturnType<typeof fixture>["value"]): unknown;
  path: string[];
}[]) {
  test(`rejects ${name} without executing business definitions`, () => {
    const f = fixture();
    const parsed = loomModuleSchema.safeParse(change(f.value));
    assert.equal(parsed.success, false);
    if (parsed.success) assert.fail("Expected malformed module to be rejected");
    assert.deepEqual(
      parsed.error.issues.map((issue) => issue.path),
      [path],
    );
    assert.equal(f.calls(), 0);
  });
}
