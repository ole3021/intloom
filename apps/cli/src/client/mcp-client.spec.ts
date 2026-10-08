import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { connectProjectClient } from "./mcp-client.ts";
import { view } from "../../test/unit-fixture.ts";

const connection = {
  url: "http://127.0.0.1:32123/internal/mcp/studio",
  token: "test-token",
};

function connected(t: TestContext) {
  t.mock.method(Client.prototype, "connect", async () => {});
  return t.mock.method(Client.prototype, "close", async () => {});
}

test("business calls decode structured results and preserve exact human answers", async (t) => {
  connected(t);
  const calls: unknown[] = [];
  t.mock.method(Client.prototype, "callTool", async (request: unknown) => {
    calls.push(request);
    return {
      structuredContent: { run: view },
      content: [{ type: "text", text: "not JSON" }],
    };
  });
  const client = await connectProjectClient(connection);
  t.after(() => client.close());
  assert.deepEqual(await client.flow("test", "  original\n意图  "), view);
  const answer = [
    { questionId: "required", isSkipped: false, answer: "  human\nanswer  " },
  ];
  assert.deepEqual(
    await client.answerAsk(view.runId, "ACTION-original", answer),
    view,
  );
  assert.deepEqual(calls, [
    {
      name: "flow",
      arguments: { flowName: "test", intent: "  original\n意图  " },
    },
    {
      name: "answer_ask",
      arguments: { runId: view.runId, actionId: "ACTION-original", answer },
    },
  ]);
});

test("text fallback is validated and malformed successes or errors stay protocol failures", async (t) => {
  connected(t);
  let response: unknown = {
    content: [{ type: "text", text: JSON.stringify({ run: view }) }],
  };
  t.mock.method(Client.prototype, "callTool", async () => response);
  const client = await connectProjectClient(connection);
  t.after(() => client.close());
  assert.deepEqual(await client.getRun(view.runId), view);
  for (const invalid of [
    { content: [{ type: "text", text: "private invalid response" }] },
    { content: [], structuredContent: { run: { runId: "incomplete" } } },
    { content: [], structuredContent: { run: view, unexpected: true } },
    {
      content: [],
      isError: true,
      structuredContent: { error: { message: "private invalid error" } },
    },
  ]) {
    response = invalid;
    await assert.rejects(client.getRun(view.runId), {
      code: "PROJECT_RESPONSE_INVALID",
      message: /invalid.*response/u,
    });
  }
  response = {
    content: [],
    isError: true,
    structuredContent: {
      error: {
        code: "CONFLICT",
        message: "The action was consumed.",
        retryable: true,
      },
    },
  };
  await assert.rejects(client.getRun(view.runId), {
    code: "CONFLICT",
    retryable: true,
    message: "The action was consumed.",
  });
});

test("Record results are typed, validated and distinguish missing data", async (t) => {
  connected(t);
  let record: unknown = null;
  t.mock.method(Client.prototype, "callTool", async () => ({
    content: [],
    structuredContent: { record },
  }));
  const client = await connectProjectClient(connection);
  t.after(() => client.close());
  assert.equal(await client.getRecord("missing"), null);
  record = {
    id: "REC-1",
    flowName: "test",
    stageName: "first",
    data: { value: "正文" },
    createdAt: view.createdAt,
  };
  assert.deepEqual(await client.getRecord("REC-1"), record);
  record = { data: {} };
  await assert.rejects(client.getRecord("bad"), {
    code: "PROJECT_RESPONSE_INVALID",
  });
});

test("uncertain mutations are attempted once and close is idempotent without cancelling Runs", async (t) => {
  const closed = connected(t);
  const calls = t.mock.method(Client.prototype, "callTool", async () => {
    throw new Error("connection lost after acceptance");
  });
  const client = await connectProjectClient(connection);
  await assert.rejects(client.flow("test", "once"), {
    code: "PROJECT_REQUEST_FAILED",
  });
  assert.equal(calls.mock.callCount(), 1);
  const first = client.close();
  assert.equal(client.close(), first);
  await first;
  assert.equal(closed.mock.callCount(), 1);
  await assert.rejects(client.listRuns(), { code: "PROJECT_CLIENT_CLOSED" });
  assert.equal(calls.mock.callCount(), 1);
});

test("connection failures release the client and invalid settings are rejected before connecting", async (t) => {
  const closed = connected(t);
  const connecting = t.mock.method(Client.prototype, "connect", async () => {
    throw new Error("private transport failure");
  });
  await assert.rejects(connectProjectClient(connection), {
    code: "PROJECT_CONNECTION_FAILED",
    message: "Could not connect to the project service.",
  });
  assert.equal(closed.mock.callCount(), 1);
  for (const invalid of [
    "file:///tmp/project",
    "http://user:pass@localhost/mcp",
    "http://localhost/mcp#fragment",
  ])
    await assert.rejects(
      connectProjectClient({ ...connection, url: invalid }),
      { code: "INVALID_REQUEST" },
    );
  await assert.rejects(
    connectProjectClient(connection, { requestId: "bad\nheader" }),
    { code: "INVALID_REQUEST" },
  );
  assert.equal(connecting.mock.callCount(), 1);
});
