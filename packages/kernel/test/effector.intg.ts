import assert from "node:assert/strict";
import { mkdir, symlink } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  createEffector,
  initializeProject,
  flow,
  cancelAllRuns,
} from "@intloom/kernel";
import { credential } from "./agent-fixture.ts";
import { compiledWorkflow } from "./initialization-fixture.ts";
import { projectFixture } from "./project-fixture.ts";
import { runtimeFixture } from "./runtime-fixture.ts";
import { agentId, codeId } from "./workflow-fixture.ts";

test("published Effector runs a Loader-assembled Agent with real Tool dispatch and a controlled model transport", async (t) => {
  credential(t);
  const project = await projectFixture(t);
  await mkdir(resolve(project.installation, "node_modules/@intloom"));
  await symlink(
    fileURLToPath(new URL("../", import.meta.url)),
    resolve(project.installation, "node_modules/@intloom/kernel"),
    "dir",
  );
  const body = compiledWorkflow("fixture", codeId, { [agentId]: "reasoning" })
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
  await project.add("@test/effector", body);
  const requests: {
    stream: boolean;
    messages: { role: string; content?: string }[];
  }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(input), "https://model.invalid/v1/chat/completions");
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
    effector: createEffector(),
    storage: runtimeFixture().storage,
  });
  t.after(() => cancelAllRuns(execution));
  assert.equal((await flow(execution, "fixture", "input")).status, "completed");
  assert.equal(requests.length, 2);
  const result = requests[1]?.messages.find(
    (message) => message.role === "tool",
  );
  assert.deepEqual(JSON.parse(result?.content ?? "null"), {
    state: { value: "initial" },
  });
});
