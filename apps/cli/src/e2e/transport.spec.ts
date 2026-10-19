import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { ModelRouterLanguageModel } from "@mastra/core/llm";
import { Evidence } from "./evidence.ts";
import { E2eError } from "./contracts.ts";
import { modelTransport } from "./transport.ts";

async function fixture(
  t: TestContext,
  stream: ModelRouterLanguageModel["doStream"],
  retries = 2,
  signal = new AbortController().signal,
  timeoutMs = 1000,
  idleTimeoutMs?: number,
) {
  const root = await mkdtemp(join(tmpdir(), "e2e-transport-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const evidence = new Evidence(root);
  return {
    root,
    model: modelTransport(
      {
        specificationVersion: "v2",
        modelId: "fixture",
        provider: "fixture",
        supportedUrls: {},
        doStream: stream,
        doGenerate: stream,
      },
      { actor: "user", signal, evidence, retries, timeoutMs, idleTimeoutMs },
    ),
  };
}

test("a transient connection failure retries the identical model input before any response stream", async (t) => {
  const requests: unknown[] = [];
  const { model, root } = await fixture(t, async (input) => {
    requests.push(input.prompt);
    if (requests.length === 1)
      throw new Error("Connection failed", {
        cause: Object.assign(new Error("TLS reset"), { code: "ECONNRESET" }),
      });
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    };
  });
  await model.doStream({ prompt: [] });
  assert.deepEqual(requests, [[], []]);
  const events = (await readFile(join(root, "actions.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(
    events.filter((event) => event.kind === "model_connection_retry").length,
    1,
  );
});

test("an already opened response stream or a permanent credential error is never retried", async (t) => {
  let calls = 0;
  const broken = await fixture(t, async () => {
    calls++;
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.error(new Error("partial stream lost"));
        },
      }),
    };
  });
  const response = await broken.model.doStream({ prompt: [] });
  await assert.rejects(response.stream.getReader().read(), {
    code: "MODEL_TRANSPORT_FAILED",
    category: "environment",
  });
  const events = (await readFile(join(broken.root, "actions.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.ok(
    events.some(
      (event) =>
        event.kind === "model_stream_failed" &&
        event.data.diagnostic === "partial stream lost",
    ),
  );
  assert.equal(calls, 1);
  const permanent = Object.assign(new Error("Unauthorized"), {
    statusCode: 401,
  });
  const denied = await fixture(t, async () => {
    calls++;
    throw permanent;
  });
  await assert.rejects(
    denied.model.doStream({ prompt: [] }),
    (cause) => cause === permanent,
  );
  assert.equal(calls, 2);
});

test("connection attempts are bounded and overall execution cancellation takes precedence", async (t) => {
  let calls = 0;
  const failed = await fixture(
    t,
    async () => {
      calls++;
      throw Object.assign(new Error("TLS reset"), { code: "ECONNRESET" });
    },
    1,
  );
  await assert.rejects(failed.model.doStream({ prompt: [] }), {
    code: "MODEL_TRANSPORT_FAILED",
    category: "environment",
  });
  assert.equal(calls, 2);
  const waiting: ModelRouterLanguageModel["doStream"] = async () =>
    new Promise(() => {});
  const timeout = await fixture(t, waiting, 0, undefined, 10);
  // A referenced timer keeps this synthetic signal-only provider alive until its deadline.
  const keepAlive = setTimeout(() => {}, 1000);
  t.after(() => clearTimeout(keepAlive));
  await assert.rejects(timeout.model.doStream({ prompt: [] }), {
    code: "MODEL_TRANSPORT_FAILED",
  });
  const controller = new AbortController();
  const budget = new E2eError(
    "EXECUTION_BUDGET_EXCEEDED",
    "Budget reached.",
    "runner",
  );
  const canceled = await fixture(
    t,
    async () => {
      controller.abort(budget);
      throw budget;
    },
    2,
    controller.signal,
  );
  await assert.rejects(
    canceled.model.doStream({ prompt: [] }),
    (cause) => cause === budget,
  );
});

test("stream timing evidence records boundaries without copying model payloads", async (t) => {
  const f = await fixture(t, async () => ({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: "text-delta",
          id: "text-one",
          delta: "private-model-payload",
        });
        controller.enqueue({
          type: "finish",
          finishReason: "stop",
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        });
        controller.close();
      },
    }),
  }));
  const response = await f.model.doStream({ prompt: [] });
  const reader = response.stream.getReader();
  while (!(await reader.read()).done) {
    /* Consume the complete provider stream. */
  }
  const raw = await readFile(join(f.root, "actions.jsonl"), "utf8");
  assert.doesNotMatch(raw, /private-model-payload/);
  const events = raw
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(
    events.filter((e) => e.kind === "model_stream_opened").length,
    1,
  );
  const stats = events.find((e) => e.kind === "model_stream_observation").data;
  assert.equal(stats.finished, true);
  assert.equal(stats.parts, 2);
  assert.ok(
    stats.firstPartMs <= stats.lastPartMs &&
      stats.lastPartMs <= stats.elapsedMs,
  );
});

test("decoded stream progress renews the optional idle deadline", async (t) => {
  const f = await fixture(
    t,
    async () => ({
      stream: new ReadableStream({
        async start(controller) {
          for (let index = 0; index < 6; index++) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            controller.enqueue({ type: "text-delta", id: "text", delta: "x" });
          }
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: 1, outputTokens: 6, totalTokens: 7 },
          });
          controller.close();
        },
      }),
    }),
    0,
    undefined,
    1000,
    60,
  );
  const response = await f.model.doStream({ prompt: [] });
  const reader = response.stream.getReader();
  let parts = 0;
  while (!(await reader.read()).done) parts++;
  assert.equal(parts, 7);
});
