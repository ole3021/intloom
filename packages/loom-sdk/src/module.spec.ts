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

test("rejects malformed compiled resources and non-callable recovery entries", () => {
  const { value } = fixture();
  for (const bad of [
    { ...value, extra: {} },
    { ...value, codes: { "CODE-short": () => ({ outcome: "done" }) } },
    {
      ...value,
      codes: {
        "CODE-abcdefghijklmnopqrstu": Object.assign(
          () => ({ outcome: "done" }),
          { recover: true },
        ),
      },
    },
    {
      ...value,
      agentSpecs: {
        "AGENT-short": value.agentSpecs["AGENT-abcdefghijklmnopqrstu"],
      },
    },
    {
      ...value,
      blueprint: { ...value.blueprint, inputs: ["prompt", "prompt"] },
    },
    { ...value, blueprint: { ...value.blueprint, loomName: "constructor" } },
    {
      ...value,
      agentSpecs: {
        "AGENT-abcdefghijklmnopqrstu": {
          ...value.agentSpecs["AGENT-abcdefghijklmnopqrstu"],
          outputSchema: {},
        },
      },
    },
  ])
    assert.equal(loomModuleSchema.safeParse(bad).success, false);
});
