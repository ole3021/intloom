import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createTool } from "@mastra/core/tools";
import * as z from "zod";
import { runAgent } from "../src/e2e/agent.ts";
import { Evidence } from "../src/e2e/evidence.ts";
import { toolSchema } from "../src/e2e/schema.ts";

async function fixture(
  t: TestContext,
  failure: "once" | "always" | "partial" | "eof" | "denied" | "idle",
) {
  const root = await mkdtemp(join(tmpdir(), "e2e-model-transport-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requests: unknown[] = [];
  let mutations = 0;
  const evidence = new Evidence(root);
  evidence.secrets.push("private-fixture-key");
  const server = createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      requests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      if (failure === "denied") {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: { message: "", type: "permission_error" },
            context: "private-fixture-key",
          }),
        );
        return;
      }
      if (
        failure === "always" ||
        (failure === "once" && requests.length === 2)
      ) {
        req.socket.destroy();
        return;
      }
      const tool = requests.length === 1;
      const delta =
        tool || failure === "eof"
          ? {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: "owned-probe-one",
                  type: "function",
                  function: {
                    name: "owned_probe",
                    arguments: tool ? '{"value":"saved"}' : '{"value":',
                  },
                },
              ],
            }
          : {
              role: "assistant",
              content:
                failure === "partial" ? "partial" : '{"status":"finished"}',
            };
      const frame = (value: unknown, reason: string | null) =>
        `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 0, model: "fixture", choices: [{ index: 0, delta: value, finish_reason: reason }] })}\n\n`;
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(frame(delta, null));
      if (!tool && failure === "idle") {
        const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 10);
        res.on("close", () => clearInterval(keepAlive));
        return;
      }
      if (!tool && failure === "eof") {
        res.end();
        return;
      }
      if (!tool && failure === "partial") {
        setTimeout(() => res.destroy(), 30);
        return;
      }
      res.end(`${frame({}, tool ? "tool_calls" : "stop")}data: [DONE]\n\n`);
    })().catch(() => res.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    root,
    requests,
    get mutations() {
      return mutations;
    },
    run: () =>
      runAgent({
        id: "transport-fixture",
        model: {
          provider: "openai-compatible",
          model: "fixture",
          secret: "ENV.FIXTURE_KEY",
          baseURL: `http://127.0.0.1:${address.port}/v1`,
          providerOptions: { openai: { reasoningEffort: "low" } },
        },
        environment: { FIXTURE_KEY: "private-fixture-key" },
        instructions: "Use the owned Tool once and return JSON.",
        prompt: "Fixture",
        tools: {
          owned_probe: createTool({
            id: "owned_probe",
            description: "Owned test mutation.",
            inputSchema: toolSchema(
              z.toJSONSchema(z.object({ value: z.string() })),
            ),
            execute: async () => {
              mutations++;
              return { saved: true };
            },
          }),
        },
        maxSteps: 4,
        signal: new AbortController().signal,
        evidence,
        connectionTimeoutMs: 1000,
        connectionRetries: 1,
        ...(failure === "idle" ? { idleTimeoutMs: 80 } : {}),
      }),
  };
}

test("actual SDK model connection retry preserves accepted Tool results and resends only the same unresponded request", async (t) => {
  const owned = await fixture(t, "once");
  assert.deepEqual(await owned.run(), { status: "finished" });
  assert.equal(owned.mutations, 1);
  assert.equal(owned.requests.length, 3);
  for (const request of owned.requests)
    assert.equal(
      (request as { reasoning_effort?: string }).reasoning_effort,
      "low",
    );
  assert.deepEqual(owned.requests[1], owned.requests[2]);
  const events = (await readFile(join(owned.root, "actions.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(
    events.filter((event) => event.kind === "model_connection_retry").length,
    1,
  );
});

test("actual SDK connection failures exhaust bounded attempts with an environment diagnostic", async (t) => {
  const owned = await fixture(t, "always");
  await assert.rejects(owned.run(), {
    code: "MODEL_TRANSPORT_FAILED",
    category: "environment",
  });
  assert.equal(owned.requests.length, 2);
  assert.equal(owned.mutations, 0);
});

test("actual SDK partial response failure never replays an accepted Tool or retries an opened response", async (t) => {
  const owned = await fixture(t, "partial");
  await assert.rejects(owned.run(), {
    code: "MODEL_TRANSPORT_FAILED",
    category: "environment",
    message: /opened model response stream failed: UND_ERR_SOCKET/u,
  });
  assert.equal(owned.requests.length, 2);
  assert.equal(owned.mutations, 1);
  const events = (await readFile(join(owned.root, "actions.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(
    events.some((event) => event.kind === "model_connection_retry"),
    false,
  );
  assert.equal(
    events.some(
      (event) =>
        event.kind === "model_stream_failed" &&
        event.data.code === "UND_ERR_SOCKET",
    ),
    true,
  );
});

test("an opened Tool stream ending without a provider finish cannot trigger automatic argument repair", async (t) => {
  const owned = await fixture(t, "eof");
  await assert.rejects(owned.run(), {
    code: "MODEL_STREAM_INCOMPLETE",
    category: "environment",
  });
  assert.equal(owned.requests.length, 2);
  assert.equal(owned.mutations, 1);
});

test("a stalled opened response times out despite SSE keepalives and never repeats accepted Tools", async (t) => {
  const owned = await fixture(t, "idle");
  await assert.rejects(owned.run(), {
    code: "MODEL_STREAM_IDLE_TIMEOUT",
    category: "environment",
  });
  assert.equal(owned.requests.length, 2);
  assert.equal(owned.mutations, 1);
  const events = (await readFile(join(owned.root, "actions.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(
    events.filter((e) => e.kind === "model_stream_idle_timeout").length,
    1,
  );
  assert.equal(
    events.some((e) => e.kind === "model_connection_retry"),
    false,
  );
  assert.equal(
    events.filter((e) => e.kind === "model_stream_observation").length,
    2,
  );
});

test("an empty provider error preserves its HTTP permission status without retry", async (t) => {
  const owned = await fixture(t, "denied");
  await assert.rejects(owned.run(), {
    code: "MODEL_REQUEST_FAILED",
    category: "environment",
    message: /HTTP 403/u,
  });
  assert.equal(owned.requests.length, 1);
  assert.equal(owned.mutations, 0);
  const events = (await readFile(join(owned.root, "actions.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const error = events.find((event) => event.kind === "model_error");
  assert.equal(error.data.statusCode, 403);
  assert.match(error.data.diagnostic, /HTTP 403/u);
  assert.equal(
    JSON.parse(error.data.responseBody).error.type,
    "permission_error",
  );
  assert.equal(error.data.responseBody.includes("private-fixture-key"), false);
});
