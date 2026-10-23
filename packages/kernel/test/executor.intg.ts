import assert from "node:assert/strict";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createExecution } from "../src/execution/create-execution.ts";
import { initializeProject } from "../src/host/create-project-execution.ts";
import { run, cancelAllRuns } from "./operations-harness.ts";
import { credential } from "./agent-fixture.ts";
import { compiledLoom } from "./initialization-fixture.ts";
import { projectFixture } from "./project-fixture.ts";
import { runtimeFixture } from "./runtime-fixture.ts";
import { agentId, codeId } from "./loom-fixture.ts";

test("Loader-assembled Execution uses project .env for a Loader-assembled Agent with real Tool dispatch and controlled model transport", async (t) => {
  credential(t);
  delete process.env.INTLOOM_LOOM_TEST_KEY;
  const project = await projectFixture(t);
  await writeFile(
    resolve(project.root, ".env"),
    "INTLOOM_LOOM_TEST_KEY=fixture-file-credential\n",
  );
  await mkdir(resolve(project.installation, "node_modules/@intloom"));
  await symlink(
    fileURLToPath(new URL("../", import.meta.url)),
    resolve(project.installation, "node_modules/@intloom/kernel"),
    "dir",
  );
  const body = compiledLoom("fixture", codeId, { [agentId]: "thinking" })
    .replace(
      `kind: "code", codeId: ${JSON.stringify(codeId)}`,
      `kind: "agent", agentId: ${JSON.stringify(agentId)}`,
    )
    .replace(
      "skills: [], tools: []",
      `skills: [], tools: [{ id: "read_fixture", description: "Read current State", inputSchema: z.strictObject({}), outputSchema: z.json(), execute: async (_input, access) => {
      if ("commit" in access.storage || "interaction" in access) throw new Error("Invalid Agent capabilities");
      return { state: access.state.value };
    } }]`,
    );
  await project.add("@test/executor", body);
  const requests: {
    stream: boolean;
    messages: { role: string; content?: string }[];
  }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(input), "https://model.invalid/v1/chat/completions");
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer fixture-file-credential",
      );
      const request = JSON.parse(String(init?.body));
      requests.push(request);
      const first = requests.length === 1;
      assert.equal(request.stream, true);
      const delta = first
        ? {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: "call-read",
                type: "function",
                function: { name: "read_fixture", arguments: "{}" },
              },
            ],
          }
        : { role: "assistant", content: '{"outcome":"complete"}' };
      const frames = [
        {
          id: "chatcmpl-fixture",
          object: "chat.completion.chunk",
          created: 0,
          model: "test-model",
          choices: [{ index: 0, delta, finish_reason: null }],
        },
        {
          id: "chatcmpl-fixture",
          object: "chat.completion.chunk",
          created: 0,
          model: "test-model",
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: first ? "tool_calls" : "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
      ];
      return new Response(
        frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("") +
          "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  );
  const execution = await initializeProject(project.root, {
    executor: createExecution(),
    storage: runtimeFixture().storage,
  });
  t.after(() => cancelAllRuns(execution));
  assert.equal(
    (await run(execution, "fixture", { prompt: "input" })).status,
    "completed",
  );
  assert.equal(requests.length, 2);
  assert.equal(process.env.INTLOOM_LOOM_TEST_KEY, undefined);
  const result = requests[1]?.messages.find(
    (message) => message.role === "tool",
  );
  assert.deepEqual(JSON.parse(result?.content ?? "null"), {
    state: { value: "initial" },
  });
});
