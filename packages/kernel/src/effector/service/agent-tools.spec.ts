import assert from "node:assert/strict";
import { test } from "node:test";
import * as z from "zod";
import { defineAgentTool } from "@intloom/workflow-sdk";
import {
  scriptedAgent,
  executionAccess,
  latestToolResult,
} from "../../../test/effector-fixture.ts";
import { createEffector } from "../create-effector.ts";
import { serviceTool } from "./agent-tools.ts";
import { createAgent } from "./create-agent.ts";
import { agentJsonSchema } from "../agent-tool.ts";
import {
  agentSpec,
  credential,
  testConfig,
} from "../../../test/agent-fixture.ts";
import { agentId, source } from "../../../test/workflow-fixture.ts";

test("compatible providers receive intact recursive JSON Tool schemas and omitted optional fields", async (t) => {
  credential(t);
  for (const model of ["deepseek-v4.1-flash", "glm-5.3-flash"]) {
    let parsed = 0;
    let executed = 0;
    let requests = 0;
    const input = {
      value: { description: "Example", items: [1, { active: true }] },
    };
    const tool = defineAgentTool({
      id: "submit",
      description: "Save JSON",
      inputSchema: z
        .strictObject({ value: z.json(), note: z.string().optional() })
        .transform((value) => {
          parsed++;
          return value;
        }),
      outputSchema: z.strictObject({ saved: z.boolean() }),
      execute: async (value) => {
        executed++;
        assert.deepEqual(value, input);
        return { saved: true };
      },
    });
    t.mock.method(
      globalThis,
      "fetch",
      async (
        _url: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        requests++;
        const request = JSON.parse(String(init?.body));
        assert.ok(
          request.messages.some(
            (message: { role: string; content: unknown }) =>
              message.role === "system" &&
              typeof message.content === "string" &&
              message.content.includes('"outcome"'),
          ),
          "The final output contract must be part of system instructions",
        );
        assert.deepEqual(
          request.tools.find(
            (tool: { function: { name: string } }) =>
              tool.function.name === "submit",
          ).function.parameters,
          agentJsonSchema(tool.inputSchema),
        );
        const delta =
          requests === 1
            ? {
                role: "assistant",
                tool_calls: [
                  {
                    index: 0,
                    id: "fixture-call",
                    type: "function",
                    function: {
                      name: "submit",
                      arguments: JSON.stringify(input),
                    },
                  },
                ],
              }
            : { role: "assistant", content: '{"outcome":"ready"}' };
        const common = {
          id: "fixture",
          object: "chat.completion.chunk",
          created: 0,
          model,
        };
        const frames = [
          { ...common, choices: [{ index: 0, delta, finish_reason: null }] },
          {
            ...common,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: requests === 1 ? "tool_calls" : "stop",
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          },
        ];
        return new Response(
          frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("") +
            "data: [DONE]\n\n",
          { headers: { "content-type": "text/event-stream" } },
        );
      },
    );
    const config = testConfig();
    config.llms.default.model = model;
    const { executable } = await createAgent(
      { ...agentSpec(), tools: [tool] },
      { agentId, source, config },
    );
    assert.deepEqual(
      await createEffector().executeAgent(
        executable,
        null,
        executionAccess().agent,
      ),
      { outcome: "ready" },
    );
    assert.deepEqual([requests, executed, parsed], [2, 1, 1]);
  }
});

test("service models execute the same SDK Tool with original schema transforms exactly once", async () => {
  let inputs = 0;
  let outputs = 0;
  let calls = 0;
  const tool = defineAgentTool({
    id: "calculate",
    description: "Calculate",
    inputSchema: z.object({ n: z.number() }).transform(({ n }) => {
      inputs++;
      return { n: n + 1 };
    }),
    outputSchema: z.string().transform((n) => {
      outputs++;
      return { n: Number(n) + 1 };
    }),
    execute: async (input, access) => {
      calls++;
      assert.equal("commit" in access.storage, false);
      return String(input.n);
    },
  });
  const agent = scriptedAgent(
    (request) => {
      const result = latestToolResult(request);
      if (!result) return { calls: [{ name: tool.id, input: { n: 1 } }] };
      assert.deepEqual(result.output, { type: "json", value: { n: 3 } });
      return { text: '{"outcome":"complete"}' };
    },
    { calculate: serviceTool(tool) },
  );
  assert.deepEqual(
    await createEffector().executeAgent(agent, null, executionAccess().agent),
    { outcome: "complete" },
  );
  assert.deepEqual([inputs, outputs, calls], [1, 1, 1]);
});
