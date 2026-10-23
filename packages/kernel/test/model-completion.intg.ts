import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { openLog, withLogger } from "@intloom/utils";
import { createAgent } from "../src/execution/model/create-agent.ts";
import { timeModelRequest } from "../src/execution/model/model-timing.ts";
import { createExecution } from "../src/execution/create-execution.ts";
import { agentSpec, testConfig } from "./agent-fixture.ts";
import { agentId, source } from "./loom-fixture.ts";
import { executionAccess } from "./access-fixture.ts";

const secret = "PRIVATE_COMPLETION_TRANSPORT_SENTINEL";
type Row = Record<string, unknown> & { event: string };

function frame(delta: unknown, reason?: string | null) {
  return `data: ${JSON.stringify({
    id: secret,
    object: "chat.completion.chunk",
    created: 0,
    model: "test-model",
    choices: [{ index: 0, delta, finish_reason: reason }],
  })}\n\n`;
}

async function fixture(
  t: TestContext,
  response: (request: Record<string, unknown>) => string,
) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-completion-"));
  const logs = await openLog({ directory });
  t.after(async () => {
    await logs.close();
    await rm(directory, { recursive: true, force: true });
  });
  let requests = 0;
  const serverErrors: unknown[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requests++;
      assert.equal(req.headers.authorization, `Bearer ${secret}`);
      assert.equal(body.stream, true);
      assert.equal(body.includeRawChunks, undefined);
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "x-private-header": secret,
      });
      res.end(response(body));
    })().catch((error) => {
      serverErrors.push(error);
      res.destroy(error);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  t.after(() => assert.deepEqual(serverErrors, []));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseURL = `http://127.0.0.1:${address.port}/v1`;
  const originalFetch = globalThis.fetch;
  t.mock.method(
    globalThis,
    "fetch",
    (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(
        String(input),
        `${baseURL}/chat/completions`,
        "Only the local fixture may be called",
      );
      return originalFetch(input, init);
    },
  );
  const config = testConfig();
  config.llms.default.baseURL = baseURL;
  const { executable } = await createAgent(agentSpec(), {
    agentId,
    source,
    config,
    credentials: () => secret,
  });
  return {
    executable,
    logs,
    get requests() {
      return requests;
    },
    async rows(): Promise<Row[]> {
      logs.flush();
      const text = await readFile(logs.filePath, "utf8");
      assert.equal(
        text.includes(secret),
        false,
        "No raw content or private reason in logs",
      );
      return text
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
  };
}

test("installed OpenAI-compatible SDK preserves completion mapping across local SSE endings", async (t) => {
  const cases = [
    {
      name: "stop with DONE",
      reason: "stop",
      done: true,
      mapped: "stop",
      mapping: "matched",
    },
    {
      name: "stop with EOF only",
      reason: "stop",
      done: false,
      mapped: "stop",
      mapping: "matched",
    },
    {
      name: "tool calls",
      reason: "tool_calls",
      done: true,
      mapped: "tool-calls",
      mapping: "matched",
    },
    {
      name: "legacy function call",
      reason: "function_call",
      done: true,
      mapped: "tool-calls",
      mapping: "matched",
    },
    {
      name: "output limit",
      reason: "length",
      done: true,
      mapped: "length",
      mapping: "matched",
    },
    {
      name: "content filter",
      reason: "content_filter",
      done: true,
      mapped: "content-filter",
      mapping: "matched",
    },
    {
      name: "missing reason with DONE",
      reason: undefined,
      done: true,
      mapped: "other",
      mapping: "missing",
    },
    {
      name: "missing reason with EOF",
      reason: undefined,
      done: false,
      mapped: "other",
      mapping: "missing",
    },
    {
      name: "unknown reason",
      reason: secret,
      done: true,
      mapped: "other",
      mapping: "unrecognized",
    },
  ];
  for (const item of cases)
    await t.test(item.name, async (t) => {
      const owned = await fixture(
        t,
        () =>
          frame({ role: "assistant", content: secret }, null) +
          frame({}, item.reason) +
          'data: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\n' +
          (item.done ? "data: [DONE]\n\n" : ""),
      );
      const model = await owned.executable.agent.getModel();
      assert.equal(
        model.specificationVersion,
        "v2",
        "Exercise the same Mastra model router",
      );
      const timing = timeModelRequest(
        model,
        new AbortController().signal,
        owned.logs.logger,
        { modelRequestId: item.name },
      );
      const response = await timing.model.doStream({ prompt: [] });
      const reader = response.stream.getReader();
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        assert.notEqual(
          part.value.type,
          "raw",
          "Raw chunks must not reach Agent processing",
        );
      }
      timing.report();
      assert.equal(timing.providerFinishReason, item.mapped);
      assert.equal(owned.requests, 1);
      const row = (await owned.rows()).find(
        (r) =>
          r.event === "model_step_completed" || r.event === "model_step_failed",
      );
      assert.ok(row);
      assert.deepEqual(row.completion, {
        rawChunks: 3,
        chatChunks: 3,
        finishMarkers: item.reason === undefined ? 0 : 1,
        upstreamReason:
          item.reason === undefined
            ? "absent"
            : item.reason === secret
              ? "unrecognized"
              : item.reason,
        finishParts: 1,
        adapterRawReason:
          item.reason === undefined
            ? "absent"
            : item.reason === secret
              ? "unrecognized"
              : item.reason,
        mapping: item.mapping,
      });
    });
});

test("actual Agent rejects missing or unknown completion without a follow-up request", async (t) => {
  for (const reason of [undefined, secret])
    await t.test(reason === undefined ? "missing" : "unknown", async (t) => {
      const owned = await fixture(
        t,
        () =>
          frame({ role: "assistant", content: secret }, null) +
          frame({}, reason) +
          "data: [DONE]\n\n",
      );
      await assert.rejects(
        withLogger(owned.logs.logger, () =>
          createExecution().executeAgent(
            owned.executable,
            null,
            executionAccess().agent,
          ),
        ),
        {
          code: "LLM_RESPONSE_INVALID",
          message: /without a recognized completion reason/u,
        },
      );
      assert.equal(owned.requests, 1);
      const rows = await owned.rows();
      const failed = rows.find((row) => row.event === "model_step_failed");
      assert.ok(failed);
      assert.equal(failed.providerFinishReason, "other");
      assert.equal(
        (failed.completion as Record<string, unknown>).mapping,
        reason === undefined ? "missing" : "unrecognized",
      );
      assert.equal(
        rows.some(
          (row) =>
            row.event === "tool_started" || row.event === "agent_completed",
        ),
        false,
      );
    });
});

test("actual Agent accepts a valid completion Tool without requiring an SSE DONE sentinel", async (t) => {
  const owned = await fixture(t, (request) => {
    const tools = request.tools as { function: { name: string } }[];
    const complete = tools.find((tool) =>
      tool.function.name.includes("intloom_complete_step"),
    );
    assert.ok(complete);
    return (
      frame(
        {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: "complete",
              type: "function",
              function: {
                name: complete.function.name,
                arguments: '{"outcome":"complete"}',
              },
            },
          ],
        },
        null,
      ) + frame({}, "tool_calls")
    );
  });
  const result = await withLogger(owned.logs.logger, () =>
    createExecution().executeAgent(
      owned.executable,
      null,
      executionAccess().agent,
    ),
  );
  assert.deepEqual(result, { outcome: "complete" });
  assert.equal(owned.requests, 1);
  const completed = (await owned.rows()).find(
    (row) => row.event === "model_step_completed",
  );
  assert.ok(completed);
  assert.equal(
    (completed.completion as Record<string, unknown>).mapping,
    "matched",
  );
});

test("an unterminated final SSE event is not exposed as a parsed upstream finish marker", async (t) => {
  const owned = await fixture(
    t,
    () =>
      frame({ role: "assistant", content: secret }, null) +
      frame({}, "stop").trimEnd(),
  );
  await assert.rejects(
    withLogger(owned.logs.logger, () =>
      createExecution().executeAgent(
        owned.executable,
        null,
        executionAccess().agent,
      ),
    ),
    { code: "LLM_RESPONSE_INVALID" },
  );
  assert.equal(owned.requests, 1);
  const failed = (await owned.rows()).find(
    (row) => row.event === "model_step_failed",
  );
  assert.ok(failed);
  assert.deepEqual(failed.completion, {
    rawChunks: 1,
    chatChunks: 1,
    finishMarkers: 0,
    upstreamReason: "absent",
    finishParts: 1,
    adapterRawReason: "absent",
    mapping: "missing",
  });
});
