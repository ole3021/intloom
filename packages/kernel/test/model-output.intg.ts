import assert from "node:assert/strict";

import { test } from "node:test";

import type { PublicSchema } from "@mastra/core/schema";
import { createTool } from "@mastra/core/tools";

import * as z from "zod";

import { executionAccess } from "./access-fixture.ts";
import { latestToolResult, scriptedAgent } from "./executor-fixture.ts";

import { createExecution } from "../src/execution/create-execution.ts";
import { agentJsonSchema } from "../src/execution/agent-tool.ts";

test("Agent output uses the original Zod transform once and rejects invalid outcomes", async () => {
  let parses = 0;
  const executable = scriptedAgent(() => ({
    text: '{"outcome":"  complete  "}',
  }));
  const outputSchema = z
    .strictObject({ outcome: z.string() })
    .transform((value) => {
      parses++;
      return { outcome: value.outcome.trim() };
    });
  const transformed = { ...executable, outputSchema };
  assert.deepEqual(
    await createExecution().executeAgent(
      transformed,
      null,
      executionAccess().agent,
    ),
    { outcome: "complete" },
  );
  assert.equal(parses, 1);
  const refined = {
    ...executable,
    outputSchema: z.strictObject({ outcome: z.string() }).refine(() => false),
  };
  await assert.rejects(
    createExecution().executeAgent(refined, null, executionAccess().agent),
    { code: "AGENT_OUTPUT_INVALID" },
  );
  const invalidStep = {
    ...executable,
    outputSchema: z
      .strictObject({ outcome: z.string() })
      .transform(() => ({ outcome: "complete", output: {} })),
  };
  await assert.rejects(
    createExecution().executeAgent(invalidStep, null, executionAccess().agent),
    { code: "STEP_RESULT_INVALID" },
  );
});

test("invalid final Agent output is classified without exposing the model text", async () => {
  for (const text of [
    '{"outcome":1}',
    '{"outcome":"complete","extra":1}',
    "not json",
  ]) {
    const executable = scriptedAgent(() => ({ text }));
    await assert.rejects(
      createExecution().executeAgent(executable, null, executionAccess().agent),
      (error) => {
        assert.ok(error instanceof Error && "code" in error);
        assert.equal(error.code, "AGENT_OUTPUT_INVALID");
        assert.equal(error.message.includes(text), false);
        return true;
      },
    );
    assert.equal(executable.requests.length, 1);
  }
});

test("Mastra structured output probe: intermediate text with a Tool is not the final outcome", async () => {
  const outputSchema = z.strictObject({ outcome: z.string() });
  const schema = agentJsonSchema(outputSchema) as PublicSchema;
  const run = (errorStrategy: "strict" | "warn") => {
    let toolCalls = 0;
    const countedTool = createTool({
      id: "submit",
      description: "submit",
      inputSchema: z.strictObject({}),
      execute: async () => {
        toolCalls++;
        return { saved: true };
      },
    });
    const executable = scriptedAgent(
      (request) =>
        latestToolResult(request)
          ? { text: '{"outcome":"complete"}' }
          : {
              text: '{"progress":"working"}',
              calls: [{ name: "submit", input: {} }],
            },
      { submit: countedTool },
    );
    return {
      executable,
      get toolCalls() {
        return toolCalls;
      },
      generate: async () =>
        (
          await executable.agent.stream(
            "Use the Tool, then return the outcome.",
            {
              maxSteps: 3,
              toolCallConcurrency: 1,
              modelSettings: { maxRetries: 0 },
              maxProcessorRetries: 0,
              structuredOutput: {
                schema,
                errorStrategy,
                jsonPromptInjection: "auto",
              },
            },
          )
        ).getFullOutput(),
    };
  };
  const strict = run("strict");
  await assert.rejects(strict.generate(), (error) => {
    assert.ok(error instanceof Error && "id" in error);
    assert.equal(error.id, "STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED");
    return true;
  });
  assert.equal(strict.executable.requests.length, 1);
  assert.equal(strict.toolCalls, 1);

  const warn = run("warn");
  const response = await warn.generate();
  assert.equal(warn.executable.requests.length, 2);
  assert.equal(warn.toolCalls, 1);
  assert.equal(response.finishReason, "stop");
  assert.equal(response.steps.at(-1)?.text, '{"outcome":"complete"}');
  assert.equal(
    outputSchema.safeParse(JSON.parse(response.steps.at(-1)?.text ?? ""))
      .success,
    true,
  );
  assert.deepEqual(response.object, { outcome: "complete" });
});

test("Mastra structured output probe: an early valid object cannot validate the final round", async () => {
  const outputSchema = z.strictObject({ outcome: z.string() });
  const schema = agentJsonSchema(outputSchema) as PublicSchema;
  for (const finalText of ['{"outcome":1}', "", '{"outcome":"complete"}']) {
    let toolCalls = 0;
    const submit = createTool({
      id: "submit",
      description: "submit",
      inputSchema: z.strictObject({}),
      execute: async () => {
        toolCalls++;
        return { saved: true };
      },
    });
    const executable = scriptedAgent(
      (request) =>
        latestToolResult(request)
          ? { text: finalText }
          : {
              text: '{"outcome":"premature"}',
              calls: [{ name: "submit", input: {} }],
            },
      { submit },
    );
    const stream = await executable.agent.stream(
      "Use the Tool, then return the outcome.",
      {
        maxSteps: 3,
        toolCallConcurrency: 1,
        modelSettings: { maxRetries: 0 },
        maxProcessorRetries: 0,
        structuredOutput: {
          schema,
          errorStrategy: "warn",
          jsonPromptInjection: "auto",
        },
      },
    );
    const response = await stream.getFullOutput();
    assert.equal(executable.requests.length, 2);
    assert.equal(toolCalls, 1);
    assert.equal(response.finishReason, "stop");
    assert.deepEqual(response.object, { outcome: "premature" });
    assert.equal(response.steps.at(-1)?.text, finalText);
    assert.equal(
      finalText.length > 0 &&
        outputSchema.safeParse(JSON.parse(finalText)).success,
      finalText === '{"outcome":"complete"}',
    );
  }
});

test("Tool-round text cannot replace the final stop outcome", async () => {
  for (const firstText of ['{"progress":"working"}', "Working on it."]) {
    let toolCalls = 0;
    const submit = createTool({
      id: "submit",
      description: "submit",
      inputSchema: z.strictObject({}),
      execute: async () => {
        toolCalls++;
        return { saved: true };
      },
    });
    const executable = scriptedAgent(
      (request) =>
        latestToolResult(request)
          ? { text: '```json\n{"outcome":"complete"}\n```' }
          : { text: firstText, calls: [{ name: "submit", input: {} }] },
      { submit },
    );
    assert.deepEqual(
      await createExecution().executeAgent(
        executable,
        null,
        executionAccess().agent,
      ),
      { outcome: "complete" },
    );
    assert.equal(executable.requests.length, 2);
    assert.equal(toolCalls, 1);
  }
});

test("host completion is isolated from business Tool IDs, validates original output once and requires an untruncated response", async () => {
  for (const reason of ["tool-calls", "length"] as const) {
    let writes = 0,
      parses = 0;
    const business = createTool({
      id: "intloom_complete_step",
      description: "An existing business Tool",
      inputSchema: z.strictObject({}),
      execute: async () => ({ saved: ++writes }),
    });
    const original = scriptedAgent(
      (request) => {
        if (writes === 0)
          return { calls: [{ name: "intloom_complete_step", input: {} }] };
        assert.ok(
          request.tools?.some(
            (tool) => tool.name === "intloom_complete_step_1",
          ),
        );
        return {
          reason,
          calls: [
            { name: "intloom_complete_step_1", input: { outcome: "complete" } },
          ],
        };
      },
      { intloom_complete_step: business },
    );
    const executable = {
      ...original,
      outputSchema: z
        .strictObject({ outcome: z.literal("complete") })
        .transform((value) => {
          parses++;
          return value;
        }),
    };
    const result = createExecution().executeAgent(
      executable,
      null,
      executionAccess().agent,
    );
    if (reason === "length")
      await assert.rejects(result, { code: "STEP_EXECUTION_FAILED" });
    else assert.deepEqual(await result, { outcome: "complete" });
    assert.equal(writes, 1);
    assert.equal(parses, reason === "length" ? 0 : 1);
    assert.equal(original.requests.length, 2);
  }
});

test("invalid host completion is a fatal Agent output error without another model request", async () => {
  const original = scriptedAgent(() => ({
    calls: [{ name: "intloom_complete_step", input: { outcome: "invented" } }],
  }));
  const executable = {
    ...original,
    outputSchema: z.strictObject({ outcome: z.literal("complete") }),
  };
  await assert.rejects(
    createExecution().executeAgent(executable, null, executionAccess().agent),
    { code: "AGENT_OUTPUT_INVALID" },
  );
  assert.equal(original.requests.length, 1);
});

test("a Tool-round outcome cannot authorize an invalid or empty final stop response", async () => {
  for (const finalText of [
    '{"outcome":1}',
    "",
    "not json",
    'Saved the current draft.\n{"outcome":"complete"}',
    'Saved the current draft.\n```json\n{"outcome":"complete"}\n```',
    '{"outcome":"premature"}\n{"outcome":"complete"}',
    '{"outcome":"complete"}',
  ]) {
    let toolCalls = 0;
    const submit = createTool({
      id: "submit",
      description: "submit",
      inputSchema: z.strictObject({}),
      execute: async () => {
        toolCalls++;
        return { saved: true };
      },
    });
    const executable = scriptedAgent(
      (request) =>
        latestToolResult(request)
          ? { text: finalText }
          : {
              text: '{"outcome":"premature"}',
              calls: [{ name: "submit", input: {} }],
            },
      { submit },
    );
    const promise = createExecution().executeAgent(
      executable,
      null,
      executionAccess().agent,
    );
    if (
      finalText === '{"outcome":"complete"}' ||
      finalText.startsWith("Saved the current draft.")
    )
      assert.deepEqual(await promise, { outcome: "complete" });
    else await assert.rejects(promise, { code: "AGENT_OUTPUT_INVALID" });
    assert.equal(executable.requests.length, 2);
    assert.equal(toolCalls, 1);
  }
});

test("a final non-stop response cannot reuse an earlier Tool-round outcome", async () => {
  let toolCalls = 0;
  const submit = createTool({
    id: "submit",
    description: "submit",
    inputSchema: z.strictObject({}),
    execute: async () => {
      toolCalls++;
      return { saved: true };
    },
  });
  const executable = scriptedAgent(
    (request) =>
      latestToolResult(request)
        ? { text: '{"outcome":"complete"}', reason: "length" }
        : {
            text: '{"outcome":"premature"}',
            calls: [{ name: "submit", input: {} }],
          },
    { submit },
  );
  await assert.rejects(
    createExecution().executeAgent(executable, null, executionAccess().agent),
    { code: "STEP_EXECUTION_FAILED" },
  );
  assert.equal(executable.requests.length, 2);
  assert.equal(toolCalls, 1);
});
