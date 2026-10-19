import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as z from "zod";
import { defineAgentTool } from "@intloom/loom-sdk";
import { executionAccess } from "./access-fixture.ts";
import { scriptedAgent, latestToolResult } from "./executor-fixture.ts";
import { createExecution } from "../src/execution/create-execution.ts";
import { serviceTool } from "../src/execution/model/agent-tools.ts";
import { createAgent } from "../src/execution/model/create-agent.ts";
import { agentJsonSchema } from "../src/execution/agent-tool.ts";
import { ERRORS } from "../src/errors.ts";
import { agentSpec, credential, testConfig } from "./agent-fixture.ts";
import { agentId, source } from "./loom-fixture.ts";
import { createProjectAccess } from "../src/access/project/access.ts";

test("a provider EOF cannot be retried as a malformed Tool argument after an accepted operation", async (t) => {
  credential(t);
  let requests = 0;
  let executed = 0;
  const tool = defineAgentTool({
    id: "echo",
    description: "Save one value.",
    inputSchema: z.strictObject({ value: z.string() }),
    outputSchema: z.strictObject({ saved: z.boolean() }),
    execute: async () => {
      executed++;
      return { saved: true };
    },
  });
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    const frame = (delta: unknown, finishReason: string | null) =>
      `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 0, model: "fixture", choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`;
    const body = frame(
      {
        role: "assistant",
        tool_calls: [
          {
            index: 0,
            id: `call-${requests}`,
            type: "function",
            function: {
              name: "echo",
              arguments: requests === 1 ? '{"value":"saved"}' : '{"value":',
            },
          },
        ],
      },
      null,
    );
    return new Response(
      requests === 1
        ? `${body}${frame({}, "tool_calls")}data: [DONE]\n\n`
        : body,
      { headers: { "content-type": "text/event-stream" } },
    );
  });
  const { executable } = await createAgent(
    { ...agentSpec(), tools: [tool] },
    { agentId, source, config: testConfig() },
  );
  await assert.rejects(
    createExecution({ maxAgentSteps: 4 }).executeAgent(
      executable,
      null,
      executionAccess().agent,
    ),
    { code: "LLM_RESPONSE_INVALID" },
  );
  assert.equal(requests, 2);
  assert.equal(executed, 1);
});

test("an unavailable command or cwd can be corrected in one service Agent without replaying a process", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "agent-command-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const bad of [
    { command: join(root, "missing"), args: [] },
    { command: process.execPath, args: [], cwd: "missing-cwd" },
  ]) {
    let completed = 0;
    const tool = defineAgentTool({
      id: "run",
      description: "Run an argv command.",
      inputSchema: z.strictObject({
        command: z.string(),
        args: z.array(z.string()),
        cwd: z.string().optional(),
      }),
      outputSchema: z.strictObject({
        exitCode: z.number().nullable(),
        stderr: z.string(),
      }),
      endsAgent: (output) => output.exitCode === 0,
      execute: async (input, access) => {
        assert.ok(access.project);
        const result = await access.project.run(
          {
            command: input.command,
            args: input.args,
            ...(input.cwd === undefined ? {} : { cwd: input.cwd }),
          },
          access.signal,
        );
        if (result.exitCode === 0) completed++;
        return { exitCode: result.exitCode, stderr: result.stderr };
      },
    });
    const agent = scriptedAgent(
      (request) => {
        if (agent.requests.length === 1)
          return { calls: [{ name: "run", input: bad }] };
        if (completed === 0) {
          assert.match(
            JSON.stringify(latestToolResult(request)?.output),
            /12[67]/u,
          );
          return {
            calls: [
              {
                name: "run",
                input: {
                  command: process.execPath,
                  args: ["-e", "process.exit(0)"],
                },
              },
            ],
          };
        }
        return { text: '{"outcome":"complete"}' };
      },
      { run: serviceTool(tool) },
    );
    assert.deepEqual(
      await createExecution().executeAgent(
        agent,
        null,
        executionAccess(undefined, createProjectAccess(root)).agent,
      ),
      { outcome: "complete" },
    );
    assert.equal(completed, 1);
    assert.equal(agent.requests.length, 3);
  }
});

test("compatible providers receive intact recursive JSON Tool schemas and omitted optional fields", async (t) => {
  credential(t);
  for (const valueSchema of [z.json(), z.record(z.string(), z.json())])
    for (const model of [
      "deepseek-v4.1-flash",
      "glm-5.3-flash",
      "minimax-m3",
    ]) {
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
          .strictObject({ value: valueSchema, note: z.string().optional() })
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
              usage: {
                prompt_tokens: 1,
                completion_tokens: 1,
                total_tokens: 2,
              },
            },
          ];
          return new Response(
            `${frames
              .map((frame) => `data: ${JSON.stringify(frame)}\n\n`)
              .join("")}data: [DONE]\n\n`,
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
        await createExecution().executeAgent(
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
    await createExecution().executeAgent(agent, null, executionAccess().agent),
    { outcome: "complete" },
  );
  assert.deepEqual([inputs, outputs, calls], [1, 1, 1]);
});

test("a validated terminal Tool closes service Tools only after success and still requires a valid final outcome", async () => {
  for (const finalText of ['{"outcome":"complete"}', "not an outcome"]) {
    let calls = 0;
    const tool = defineAgentTool({
      id: "submit",
      description: "Submit once",
      inputSchema: z.strictObject({}),
      outputSchema: z.strictObject({ saved: z.boolean() }),
      endsAgent: (result) => result.saved,
      execute: async () => ({ saved: ++calls === 2 }),
    });
    const agent = scriptedAgent(
      (request) => {
        if (calls < 2) {
          assert.ok(request.tools?.some((item) => item.name === "submit"));
          return { calls: [{ name: "submit", input: {} }] };
        }
        assert.deepEqual(
          request.tools?.map((item) => item.name),
          ["intloom_complete_step"],
        );
        assert.deepEqual(request.toolChoice, {
          type: "tool",
          toolName: "intloom_complete_step",
        });
        return { text: finalText };
      },
      { submit: serviceTool(tool) },
    );
    const execution = createExecution().executeAgent(
      agent,
      null,
      executionAccess().agent,
    );
    if (finalText.startsWith("{"))
      assert.deepEqual(await execution, { outcome: "complete" });
    else await assert.rejects(execution, { code: "AGENT_OUTPUT_INVALID" });
    assert.equal(calls, 2);
    assert.equal(agent.requests.length, 3);
  }
});

test("closed business Tools complete once through the host outcome Tool without a free-text round", async () => {
  let submissions = 0;
  const submit = defineAgentTool({
    id: "submit",
    description: "Save once",
    inputSchema: z.strictObject({}),
    outputSchema: z.strictObject({ saved: z.boolean() }),
    endsAgent: (output) => output.saved,
    execute: async () => {
      submissions++;
      return { saved: true };
    },
  });
  const executable = scriptedAgent(
    (request) => {
      if (submissions === 0) return { calls: [{ name: "submit", input: {} }] };
      assert.deepEqual(request.toolChoice, {
        type: "tool",
        toolName: "intloom_complete_step",
      });
      assert.deepEqual(
        request.tools?.map((tool) => tool.name),
        ["intloom_complete_step"],
      );
      return {
        calls: [
          { name: "intloom_complete_step", input: { outcome: "complete" } },
        ],
      };
    },
    { submit: serviceTool(submit) },
  );
  assert.deepEqual(
    await createExecution().executeAgent(
      executable,
      null,
      executionAccess().agent,
    ),
    { outcome: "complete" },
  );
  assert.equal(submissions, 1);
  assert.equal(executable.requests.length, 2);
});

test("original Tool input rejection can be corrected in-call without execution or replay, while execute INVALID_REQUEST remains fatal", async () => {
  let executions = 0;
  const tool = defineAgentTool({
    id: "run",
    description: "Run inside the project; omit cwd for root",
    inputSchema: z.strictObject({
      cwd: z
        .string()
        .refine((path) => !path.startsWith("/"), "private-input-value")
        .optional(),
    }),
    outputSchema: z.strictObject({ saved: z.boolean() }),
    endsAgent: (result) => result.saved,
    execute: async () => {
      executions++;
      return { saved: true };
    },
  });
  const agent = scriptedAgent(
    (request) => {
      if (!agent.requests.length || agent.requests.length === 1)
        return {
          calls: [{ name: "run", input: { cwd: "/private-input-value" } }],
        };
      if (executions === 0) {
        const result = latestToolResult(request);
        assert.ok(result);
        const text = JSON.stringify(result.output);
        assert.ok(text.includes("cwd (custom)"));
        assert.ok(!text.includes("private-input-value"));
        return { calls: [{ name: "run", input: {} }] };
      }
      return { text: '{"outcome":"complete"}' };
    },
    { run: serviceTool(tool) },
  );
  assert.deepEqual(
    await createExecution().executeAgent(agent, null, executionAccess().agent),
    { outcome: "complete" },
  );
  assert.equal(executions, 1);
  assert.equal(agent.requests.length, 3);
  const throwing = defineAgentTool({
    ...tool,
    execute: async () => {
      throw ERRORS.create("INVALID_REQUEST");
    },
  });
  const failed = scriptedAgent(
    () => ({ calls: [{ name: "run", input: {} }] }),
    { run: serviceTool(throwing) },
  );
  await assert.rejects(
    createExecution().executeAgent(failed, null, executionAccess().agent),
    { code: "TOOL_EXECUTION_FAILED" },
  );
  assert.equal(failed.requests.length, 1);
});

for (const input of [
  { n: "private-value" },
  { n: 1, unexpected: "private-value" },
])
  test("invalid transport shape is correctable before the original Tool executes", async () => {
    let executions = 0;
    const tool = defineAgentTool({
      id: "submit",
      description: "Submit a number",
      inputSchema: z.strictObject({ n: z.number() }),
      outputSchema: z.strictObject({ saved: z.boolean() }),
      endsAgent: (value) => value.saved,
      execute: async () => {
        executions++;
        return { saved: true };
      },
    });
    const agent = scriptedAgent(
      (request) => {
        if (agent.requests.length === 1)
          return { calls: [{ name: "submit", input }] };
        if (executions === 0) {
          assert.ok(latestToolResult(request));
          return { calls: [{ name: "submit", input: { n: 1 } }] };
        }
        return { text: '{"outcome":"complete"}' };
      },
      { submit: serviceTool(tool) },
    );
    assert.deepEqual(
      await createExecution().executeAgent(
        agent,
        null,
        executionAccess().agent,
      ),
      { outcome: "complete" },
    );
    assert.equal(executions, 1);
    assert.equal(agent.requests.length, 3);
  });
