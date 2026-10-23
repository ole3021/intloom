import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate, setTimeout as delay } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import type { ModelRouterLanguageModel } from "@mastra/core/llm";
import { Evidence } from "./evidence.ts";
import { E2eError } from "./contracts.ts";
import { modelTransport } from "./transport.ts";

async function fixture(
  t: TestContext,
  stream: ModelRouterLanguageModel["doStream"],
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
      { actor: "user", signal, evidence, timeoutMs, idleTimeoutMs },
    ),
  };
}

test("a connection failure is preserved for SDK retry without an internal replay", async (t) => {
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
  await assert.rejects(model.doStream({ prompt: [] }), /Connection failed/u);
  assert.equal(requests.length, 1);
  // Stand in for a second SDK invocation; the monitor itself never retries.
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

test("one invocation makes one connection attempt and cancellation takes precedence", async (t) => {
  let calls = 0;
  const failed = await fixture(t, async () => {
    calls++;
    throw Object.assign(new Error("TLS reset"), { code: "ECONNRESET" });
  });
  await assert.rejects(failed.model.doStream({ prompt: [] }), {
    code: "ECONNRESET",
  });
  assert.equal(calls, 1);
  const waiting: ModelRouterLanguageModel["doStream"] = async () =>
    new Promise(() => {});
  const timeout = await fixture(t, waiting, undefined, 10);
  // A referenced timer keeps this synthetic signal-only provider alive until its deadline.
  const keepAlive = setTimeout(() => {}, 1000);
  t.after(() => clearTimeout(keepAlive));
  await assert.rejects(timeout.model.doStream({ prompt: [] }), {
    code: "MODEL_CONNECTION_TIMEOUT",
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

test("cancelling a pending read cancels upstream once, unlocks it and clears the idle deadline", async (t) => {
  let cancellations = 0;
  const reason = new Error("Consumer stopped");
  const upstream = new ReadableStream({
    cancel(cause) {
      assert.equal(cause, reason);
      cancellations++;
    },
  });
  const f = await fixture(
    t,
    async () => ({ stream: upstream }),
    undefined,
    1000,
    40,
  );
  const response = await f.model.doStream({ prompt: [] });
  const reader = response.stream.getReader();
  const pending = reader.read();
  await reader.cancel(reason);
  assert.equal((await pending).done, true);
  assert.equal(cancellations, 1);
  assert.equal(upstream.locked, false);
  await delay(80);
  const events = await readFile(join(f.root, "actions.jsonl"), "utf8");
  assert.doesNotMatch(events, /model_stream_idle_timeout|model_stream_failed/u);
});

test("the wrapper observes backpressure and preserves chunk identity", async (t) => {
  let pulls = 0;
  const chunk = { type: "text-delta" as const, id: "text", delta: "part" };
  const upstream = new ReadableStream(
    {
      pull(controller) {
        pulls++;
        controller.enqueue(chunk);
      },
    },
    { highWaterMark: 0 },
  );
  const f = await fixture(t, async () => ({ stream: upstream }));
  const response = await f.model.doStream({ prompt: [] });
  await setImmediate();
  assert.equal(pulls, 1, "An unread wrapper buffers only one chunk");
  const reader = response.stream.getReader();
  assert.equal((await reader.read()).value, chunk);
  await setImmediate();
  assert.equal(pulls, 2);
  await reader.cancel();
  assert.equal(upstream.locked, false);
});

test("missing or unknown finish reasons still fail and release the upstream reader", async (t) => {
  for (const finishReason of [undefined, "other"] as const) {
    const upstream = new ReadableStream({
      start(controller) {
        if (finishReason)
          controller.enqueue({
            type: "finish",
            finishReason,
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          });
        controller.close();
      },
    });
    const f = await fixture(t, async () => ({ stream: upstream }));
    const response = await f.model.doStream({ prompt: [] });
    await assert.rejects(response.stream.getReader().read(), {
      code: "MODEL_STREAM_INCOMPLETE",
    });
    assert.equal(upstream.locked, false);
    const events = (await readFile(join(f.root, "actions.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const observed = events.filter(
      (event) => event.kind === "model_stream_observation",
    );
    assert.equal(observed.length, 1);
    assert.equal(observed[0].data.finished, false);
  }
});
