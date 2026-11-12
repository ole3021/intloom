import { writeFixturePackage } from "./fixture-package.ts";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { compileLoom } from "../../packages/compiler/dist/index.js";
import {
  serve as serveHost,
  type Kernel,
} from "../../packages/kernel/dist/index.js";
import type {
  RunEvent,
  RuntimeBindings,
} from "../../packages/loom-sdk/dist/index.js";
async function serve(options: { dataDir: string; bindings?: RuntimeBindings }) {
  const projectDir = await mkdtemp(join(options.dataDir, "../model-project-"));
  const { models, tools, resolveCredential } = options.bindings ?? {};
  const model = Object.values(models ?? {}).flatMap((slots) =>
    Object.values(slots),
  )[0];
  if (model)
    await writeFile(
      join(projectDir, "intloom.yaml"),
      JSON.stringify({
        version: 1,
        models: { test: { ...model, credentialRef: "env:TEST_MODEL" } },
        profiles: { default: "test" },
      }),
    );
  return serveHost({
    dataDir: options.dataDir,
    projectDir,
    bindings: {
      ...(tools ? { tools } : {}),
      ...(resolveCredential ? { resolveCredential } : {}),
    },
  });
}
const root = fileURLToPath(new URL("../../", import.meta.url));
async function fixture(t: TestContext, source: string) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-execution-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const author = join(directory, "author");
  await mkdir(author);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(author, "node_modules"),
  );
  await writeFile(join(author, "loom.ts"), source);
  await writeFile(join(author, "guide.txt"), "Use precise arithmetic.");
  await writeFixturePackage(join(author, "loom.ts"));
  const compiled = await compileLoom({
    entryFile: join(author, "loom.ts"),
    outDir: join(directory, "compiled"),
    target: "node22",
  });
  assert.ok(compiled.ok, JSON.stringify(compiled));
  return { directory, compiled, dataDir: join(directory, "data") };
}
async function settled(host: Kernel, id: string) {
  for (let i = 0; i < 500; i++) {
    const view = await host.getRun(id);
    if (
      ["succeeded", "failed", "cancelled", "interrupted"].includes(view.status)
    )
      return view;
    await delay(10);
  }
  throw new Error("Run did not settle");
}
const hasCode = (code: string) => (error: unknown) =>
  (error as { code?: string }).code === code;
test("native Mastra feasibility probe persists a wait across new processes without replaying a completed step", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "intloom-execution-wait-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const phase of ["create", "inspect", "resume"]) {
    const child = spawnSync(
      process.execPath,
      [
        join(root, "test/integration/fixtures/execution-wait-probe.mjs"),
        join(root, "packages/kernel/package.json"),
        directory,
        phase,
      ],
      { encoding: "utf8", timeout: 15_000 },
    );
    assert.equal(
      child.status,
      0,
      `${phase}: ${child.error ?? ""}\n${child.stdout}\n${child.stderr}`,
    );
    assert.match(child.stdout, new RegExp(`native-wait: ${phase} verified`));
  }
});
test("executes native Workflow constructs, nested scopes and binding outputs with one boundary parse", async (t) => {
  const { compiled, dataDir } = await fixture(
    t,
    await readFile(
      join(root, "test/fixtures/execution-workflow.ts.fixture"),
      "utf8",
    ),
  );
  const bindings: RuntimeBindings = {
    tools: {
      "workflow-run@1.0.0": {
        multiply: {
          implementation: "multiply",
          revision: "1",
          execute: ({ input }) => (input as number) * 3,
        },
      },
    },
  };
  const host = await serve({ dataDir, bindings });
  t.after(() => host.close());
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom: ref, input: undefined });
  await host.startRun(run.id);
  const result = await settled(host, run.id);
  assert.equal(result.status, "succeeded", JSON.stringify(result));
  assert.deepEqual(result.output, {
    value: 141,
    initial: 2,
    seed: 3,
    counts: { input: 1, boundOutput: 1 },
  });
  await host.close();
  const reopen = await serve({ dataDir, bindings });
  t.after(() => reopen.close());
  assert.deepEqual((await reopen.getRun(run.id)).output, result.output);
});

test("bindings are scoped, required before creation and fixed across explicit start", async (t) => {
  const { compiled, dataDir } = await fixture(
    t,
    await readFile(
      join(root, "test/fixtures/execution-workflow.ts.fixture"),
      "utf8",
    ),
  );
  const none = await serve({ dataDir });
  const ref = await none.installLoom({ source: compiled.artifactDir });
  await assert.rejects(
    none.createRun({ loom: ref, input: 1 }),
    hasCode("BINDING_UNAVAILABLE"),
  );
  await none.close();
  const host = await serve({
    dataDir,
    bindings: {
      tools: {
        "*": {
          multiply: {
            implementation: "multiply",
            revision: "1",
            execute: ({ input }) => input,
          },
        },
      },
    },
  });
  const created = await host.createRun({ loom: ref, input: 1 });
  await host.close();
  const changed = await serve({
    dataDir,
    bindings: {
      tools: {
        "*": {
          multiply: {
            implementation: "multiply",
            revision: "2",
            execute: ({ input }) => input,
          },
        },
      },
    },
  });
  t.after(() => changed.close());
  await assert.rejects(
    changed.startRun(created.id),
    hasCode("BINDING_MISMATCH"),
  );
  assert.equal((await changed.getRun(created.id)).status, "created");
});

async function modelServer(
  t: TestContext,
  mode:
    | "ok"
    | "bad_input"
    | "bad_structure"
    | "limit"
    | "responses"
    | "anthropic" = "ok",
) {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<
      string,
      unknown
    >;
    requests.push({ ...body, requestPath: req.url });
    if (mode === "anthropic") {
      const messages = body.messages as { content: unknown }[];
      const answered = messages.some(
        (m) =>
          Array.isArray(m.content) &&
          m.content.some((c) => c.type === "tool_result"),
      );
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: `msg_${requests.length}`,
          type: "message",
          role: "assistant",
          model: "MiniMax-M3",
          stop_sequence: null,
          stop_reason: answered ? "end_turn" : "tool_use",
          usage: { input_tokens: 5, output_tokens: 5 },
          content: answered
            ? [{ type: "text", text: "done" }]
            : [
                {
                  type: "tool_use",
                  id: "local_call",
                  name: "local",
                  input: {},
                },
                {
                  type: "tool_use",
                  id: "bound_call",
                  name: "bound",
                  input: {},
                },
              ],
        }),
      );
      return;
    }
    if (mode === "responses") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "resp_fixture",
          object: "response",
          created_at: 1,
          status: "completed",
          model: body.model,
          output: [
            {
              id: "msg_fixture",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [
                {
                  type: "output_text",
                  text: body.text ? '{"value":42}' : "done",
                  annotations: [],
                },
              ],
            },
          ],
          usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
        }),
      );
      return;
    }
    const messages = body.messages as { role: string; content: unknown }[];
    const prompt = messages.find((m) => m.role === "user")?.content;
    let delta: unknown = { content: "done" };
    let reason = "stop";
    if (body.response_format)
      delta = {
        content: mode === "bad_structure" ? '{"value":"bad"}' : '{"value":42}',
      };
    else if (
      prompt === "TOOLS" &&
      (!messages.some((m) => m.role === "tool") || mode === "limit")
    ) {
      delta = {
        tool_calls: [
          {
            index: 0,
            id: `local-${requests.length}`,
            type: "function",
            function: {
              name: "local",
              arguments: mode === "bad_input" ? '{"value":"bad"}' : "{}",
            },
          },
          {
            index: 1,
            id: `bound-${requests.length}`,
            type: "function",
            function: { name: "bound", arguments: "{}" },
          },
        ],
      };
      reason = "tool_calls";
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "completion",
        object: "chat.completion",
        created: 1,
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", ...(delta as object) },
            finish_reason: reason,
          },
        ],
        usage:
          mode === "ok" && body.response_format
            ? undefined
            : mode === "ok" && prompt !== "TOOLS"
              ? {
                  prompt_tokens: 0,
                  completion_tokens: 0,
                  total_tokens: 0,
                  cost: 0,
                  currency: "USD",
                }
              : { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { requests, baseUrl: `http://127.0.0.1:${address.port}/v1` };
}
test("real Mastra Agent loop with a local provider fixture preserves Skills and single boundary validation", async (t) => {
  const wire = await modelServer(t);
  const { compiled, dataDir } = await fixture(
    t,
    await readFile(
      join(root, "test/integration/fixtures/execution-agents.ts.fixture"),
      "utf8",
    ),
  );
  let calls = 0;
  const host = await serve({
    dataDir,
    bindings: {
      models: {
        "agent-run@1.0.0": {
          model: {
            provider: "openai",
            model: "gpt-4.1-mini",
            credentialRef: "test",
            options: { baseUrl: wire.baseUrl },
          },
        },
      },
      tools: {
        "agent-run@1.0.0": {
          multiply: {
            implementation: "multiply",
            revision: "1",
            execute: ({ input }) => {
              calls++;
              return (input as { value: number }).value * 2;
            },
          },
        },
      },
      resolveCredential: () => "fixture-key",
    },
  });
  t.after(() => host.close());
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom: ref, input: "all" });
  await host.startRun(run.id);
  const result = await settled(host, run.id);
  assert.equal(result.status, "succeeded", JSON.stringify(result));
  assert.deepEqual(result.output, {
    text: "done",
    structured: { value: 42 },
    tool: "done",
    counts: {
      textOutput: 1,
      structuredOutput: 1,
      localInput: 1,
      boundInput: 1,
      boundOutput: 1,
      toolTextOutput: 1,
    },
  });
  assert.equal(calls, 1);
  assert.equal(wire.requests.length, 4);
  assert.ok(
    JSON.stringify(wire.requests[0]?.messages).includes(
      "arithmetic: Small arithmetic",
    ),
  );
  const events = (await host.listRunEvents({ runId: run.id, limit: 100 }))
    .items;
  const started = events.filter((e) => e.type === "model.invocation.started");
  const ended = events.filter((e) => e.type === "model.invocation.finished");
  assert.equal(new Set(started.map((e) => e.details?.invocationId)).size, 3);
  assert.deepEqual(
    ended.map((e) => e.details?.invocationId),
    started.map((e) => e.details?.invocationId),
  );
  assert.deepEqual(
    ended.map((e) => [e.details?.stepCount, e.details?.status]),
    [
      [1, "succeeded"],
      [1, "succeeded"],
      [2, "succeeded"],
    ],
  );
  const steps = events.filter((e) => e.type === "model.step.finished");
  assert.deepEqual(
    steps.map((e) => [
      e.origin?.componentId,
      e.details?.step,
      e.details?.inputTokens,
      e.details?.outputTokens,
      e.details?.reportedCost,
    ]),
    [
      ["text", 1, 0, 0, 0],
      ["structured", 1, undefined, undefined, undefined],
      ["tool-agent", 1, 5, 5, undefined],
      ["tool-agent", 2, 5, 5, undefined],
    ],
  );
  assert.equal(steps[0]?.details?.currency, "USD");
  const activity = await host.getRunActivity(run.id);
  assert.equal(activity.usage.calls, 3);
  assert.equal(activity.usage.observedSteps, 4);
  assert.deepEqual(activity.usage.inputTokens, { reported: 10, receipts: 3 });
  assert.deepEqual(activity.usage.outputTokens, { reported: 10, receipts: 3 });
  assert.deepEqual(activity.usage.costs, { USD: { reported: 0, receipts: 1 } });
  assert.equal(activity.usage.complete, false);
  const models = activity.recentExecutions.filter(
    (call) => call.kind === "model",
  );
  assert.deepEqual(
    models.map((call) => [
      call.origin?.componentId,
      call.usage?.inputTokens.reported,
      call.usage?.observedSteps,
      call.usage?.complete,
    ]),
    [
      ["text", 0, 1, true],
      ["structured", 0, 1, false],
      ["tool-agent", 10, 2, true],
    ],
  );
  for (const tool of events.filter((event) => event.type === "tool.started"))
    assert.ok(
      started.some((model) => model.executionId === tool.parentExecutionId),
    );

  assert.ok(
    events.some((e) => e.type === "run.started" && e.schemaVersion === 1),
  );
  assert.ok(wire.requests[1]?.response_format);
  assert.ok(!JSON.stringify(await host.getRun(run.id)).includes("fixture-key"));
  await host.close();
  assert.ok(run.location);
  await assert.rejects(readFile(join(run.location.dataDir, "mastra.db")), {
    code: "ENOENT",
  });
  for (const file of ["kernel.db"])
    assert.ok(
      !(await readFile(join(run.location.dataDir, file))).includes(
        Buffer.from("fixture-key"),
      ),
      file,
    );
});

test("rejects invalid model/tool output and unfinished tool loops without fallback or retry", async (t) => {
  for (const mode of [
    "bad_input",
    "bad_structure",
    "limit",
    "bad_output",
  ] as const) {
    const wire = await modelServer(t, mode === "bad_output" ? "ok" : mode);
    const { compiled, dataDir } = await fixture(
      t,
      await readFile(
        join(root, "test/integration/fixtures/execution-agents.ts.fixture"),
        "utf8",
      ),
    );
    let calls = 0;
    const host = await serve({
      dataDir,
      bindings: {
        models: {
          "*": {
            model: {
              provider: "openai",
              model: "gpt-4.1-mini",
              credentialRef: "test",
              options: { baseUrl: wire.baseUrl },
            },
          },
        },
        tools: {
          "*": {
            multiply: {
              implementation: "multiply",
              revision: "1",
              execute: () => {
                calls++;
                return mode === "bad_output" ? "invalid" : 6;
              },
            },
          },
        },
        resolveCredential: () => "fixture-key",
      },
    });
    t.after(() => host.close());
    const ref = await host.installLoom({ source: compiled.artifactDir });
    const run = await host.createRun({
      loom: ref,
      input: mode === "bad_structure" ? "structured" : "tool",
    });
    await host.startRun(run.id);
    const result = await settled(host, run.id);
    assert.equal(result.status, "failed", `${mode}: ${JSON.stringify(result)}`);
    if (mode === "bad_input") {
      const failure = await host.getRunResult(run.id);
      assert.equal(failure.error?.code, "TOOL_EXECUTION_FAILED");
      assert.ok(!JSON.stringify(failure).includes('"value":"bad"'));
    }
    if (mode === "limit") {
      const failure = await host.getRunResult(run.id);
      assert.equal(failure.error?.code, "MODEL_INCOMPLETE");
    }
    assert.equal(wire.requests.length, mode === "limit" ? 2 : 1, mode);
    assert.ok(calls <= (mode === "limit" ? 2 : 1));
    assert.equal(result.output, undefined);
    await host.close();
    assert.ok(run.location);
    await assert.rejects(readFile(join(run.location.dataDir, "mastra.db")), {
      code: "ENOENT",
    });
    for (const file of ["kernel.db"])
      assert.ok(
        !(await readFile(join(run.location.dataDir, file))).includes(
          Buffer.from("fixture-key"),
        ),
        file,
      );
  }
});

test("preserves an incomplete Agent classification inside a native Workflow callback", async (t) => {
  const wire = await modelServer(t, "limit");
  const source = (
    await readFile(
      join(root, "test/integration/fixtures/execution-agents.ts.fixture"),
      "utf8",
    )
  )
    .replace(
      "defineAgent, defineCode",
      "defineWorkflow, defineStep, defineAgent, defineCode",
    )
    .replace(
      'evidence",entry});',
      'evidence",entry:defineWorkflow({id:"outer",inputSchema:z.string(),outputSchema:z.string()}).map(()=>"TOOLS").then(defineStep(toolAgent,{id:"model-step"})).commit()});',
    );
  const { compiled, dataDir } = await fixture(t, source);
  const host = await serve({
    dataDir,
    bindings: {
      models: {
        "*": {
          model: {
            provider: "openai",
            model: "gpt-4.1-mini",
            credentialRef: "test",
            options: { baseUrl: wire.baseUrl },
          },
        },
      },
      tools: {
        "*": {
          multiply: {
            implementation: "multiply",
            revision: "1",
            execute: () => 6,
          },
        },
      },
      resolveCredential: () => "fixture-key",
    },
  });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom, input: "TOOLS" });
  await host.startRun(run.id);
  assert.equal((await settled(host, run.id)).status, "failed");
  const result = await host.getRunResult(run.id);
  assert.equal(result.error?.code, "MODEL_INCOMPLETE");
  assert.deepEqual(result.error?.origin, {
    workflowId: "outer",
    stepPath: ["model-step"],
    componentId: "tool-agent",
  });
  const events = (await host.listRunEvents({ runId: run.id, limit: 100 }))
    .items;
  assert.ok(
    events
      .filter((e) => e.type.startsWith("model."))
      .every(
        (e) =>
          JSON.stringify(e.origin) ===
          JSON.stringify(
            events.find((row) => row.type === "model.invocation.started")
              ?.origin,
          ),
      ),
  );
  assert.deepEqual(
    events.find((e) => e.type === "model.invocation.started")?.origin,
    result.error?.origin,
  );
  assert.equal(
    events.find((e) => e.type === "model.invocation.finished")?.details?.status,
    "failed",
  );
  assert.deepEqual(result.error?.details, {
    finishReason: "tool-calls",
    maxSteps: 2,
    steps: 2,
  });
  assert.equal(wire.requests.length, 2);
});

test("native Agent entry and Agent Step use the same execution boundary", async (t) => {
  const source = await readFile(
    join(root, "test/integration/fixtures/execution-agents.ts.fixture"),
    "utf8",
  );
  for (const entry of [
    "text",
    'defineWorkflow({id:"agent-flow",inputSchema:z.string(),outputSchema:z.string()}).then(defineStep(text,{id:"text-step"})).commit()',
  ]) {
    const wire = await modelServer(t);
    const { compiled, dataDir } = await fixture(
      t,
      source
        .replace(
          "defineAgent, defineCode",
          "defineWorkflow, defineStep, defineAgent, defineCode",
        )
        .replace('evidence",entry});', `evidence",entry:${entry}});`),
    );
    const host = await serve({
      dataDir,
      bindings: {
        models: {
          "*": {
            model: {
              provider: "openai",
              model: "gpt-4.1-mini",
              credentialRef: "test",
              options: { baseUrl: wire.baseUrl },
            },
          },
        },
        resolveCredential: () => "fixture-key",
      },
    });
    t.after(() => host.close());
    const ref = await host.installLoom({ source: compiled.artifactDir });
    const run = await host.createRun({ loom: ref, input: "TEXT" });
    await host.startRun(run.id);
    assert.equal((await settled(host, run.id)).output, "done");
    assert.equal(wire.requests.length, 1);
  }
});

test("Workflow failure and cancellation wait for parallel callbacks to finish", async (t) => {
  const { compiled, dataDir } = await fixture(
    t,
    await readFile(
      join(root, "test/integration/fixtures/parallel-stop.ts.fixture"),
      "utf8",
    ),
  );
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const ref = await host.installLoom({ source: compiled.artifactDir });
  for (const mode of ["fail", "cancel"]) {
    const fail = new AbortController();
    const finish = new AbortController();
    const server = createServer(async (request, response) => {
      const { signal } = request.url === "/fail" ? fail : finish;
      if (!signal.aborted) await once(signal, "abort");
      response.writeHead(204).end();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => server.close());
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const signals = `http://127.0.0.1:${address.port}`;
    const run = await host.createRun({ loom: ref, input: { mode, signals } });
    await host.startRun(run.id);
    try {
      await t.waitFor(
        async () => {
          const { items } = await host.listRunEvents({ runId: run.id });
          const logs = items.flatMap((e) =>
            e.type === "log" ? [e.details.message] : [],
          );
          assert.ok(
            logs.includes("slow-start") && logs.includes("control-start"),
          );
        },
        { timeout: 10_000 },
      );
      if (mode === "cancel") {
        assert.equal((await host.cancelRun(run.id)).run.status, "stopping");
      } else {
        fail.abort();
        await t.waitFor(
          async () => {
            assert.equal((await host.getRun(run.id)).status, "stopping");
          },
          { timeout: 10_000 },
        );
        assert.equal((await host.cancelRun(run.id)).disposition, "no_change");
      }
    } finally {
      fail.abort();
      finish.abort();
    }
    const result = await settled(host, run.id);
    assert.equal(
      result.status,
      mode === "cancel" ? "cancelled" : "failed",
      JSON.stringify(result),
    );
    const events = (await host.listRunEvents({ runId: run.id })).items;
    assert.ok(
      events.some(
        (e) =>
          (e.type === "log" ? e.details.message : undefined) === "slow-end",
      ),
    );
    if (mode === "cancel")
      assert.ok(
        events.some(
          (e) =>
            (e.type === "log" ? e.details.message : undefined) ===
            "control-end",
        ),
      );
  }
});

test("empty Workflow, unmatched routing and empty foreach retain their declared data shapes", async (t) => {
  const sources = [
    [
      'defineWorkflow({id:"empty",inputSchema:z.number(),outputSchema:z.number()}).commit()',
      3,
      3,
    ],
    [
      'defineWorkflow({id:"route",inputSchema:z.number(),outputSchema:z.strictObject({never:z.number().optional()})}).branch([[()=>false,defineStep({id:"never",inputSchema:z.number(),outputSchema:z.number(),execute:()=>{throw Error("unselected");}})]]).commit()',
      3,
      {},
    ],
    [
      'defineWorkflow({id:"each",inputSchema:z.array(z.number()),outputSchema:z.array(z.number())}).foreach(defineStep({id:"never",inputSchema:z.number(),outputSchema:z.number(),execute:()=>{throw Error("empty");}})).commit()',
      [],
      [],
    ],
  ] as const;
  for (const [entry, input, output] of sources) {
    const { compiled, dataDir } = await fixture(
      t,
      `import {defineLoom,defineWorkflow,defineStep} from "@intloom/loom-sdk";import{z}from"zod";export default defineLoom({id:"shapes",version:"1.0.0",description:"shapes",entry:${entry}});`,
    );
    const host = await serve({ dataDir });
    t.after(() => host.close());
    const loom = await host.installLoom({ source: compiled.artifactDir });
    const run = await host.createRun({ loom, input });
    await host.startRun(run.id);
    const result = await settled(host, run.id);
    assert.equal(result.status, "succeeded", JSON.stringify(result));
    assert.deepEqual(result.output, output);
  }
});

test("Code tool calls keep typed input internal and validate only unknown binding output", async (t) => {
  const source = await readFile(
    join(root, "test/integration/fixtures/execution-agents.ts.fixture"),
    "utf8",
  );
  const { compiled, dataDir } = await fixture(
    t,
    source.slice(0, source.indexOf("const entry=")) +
      `
const entry=defineCode({id:"call-tools",inputSchema:z.number(),outputSchema:z.strictObject({local:z.number(),bound:z.number(),counts:z.record(z.string(),z.number())}),uses:{tools:[local,bound]},execute:async({inputData,context})=>({local:await context.tools.call(local,{value:inputData}),bound:await context.tools.call(bound,{value:inputData}),counts:{...counts}})});
export default defineLoom({id:"code-tools",version:"1.0.0",description:"tools",entry});`,
  );
  const host = await serve({
    dataDir,
    bindings: {
      tools: {
        "code-tools@1.0.0": {
          multiply: {
            implementation: "multiply",
            revision: "1",
            execute: ({ input }) => (input as { value: number }).value * 2,
          },
        },
      },
    },
  });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom, input: 3 });
  await host.startRun(run.id);
  assert.deepEqual((await settled(host, run.id)).output, {
    local: 4,
    bound: 6,
    counts: { boundOutput: 1 },
  });
});

test("cancellation drains asynchronous map and condition callbacks", async (t) => {
  for (const operation of ["map", "branch", "dowhile"] as const) {
    const chain =
      operation === "map"
        ? ".map(async(data)=>{await pause(data);return data.inputData;})"
        : operation === "branch"
          ? '.branch([[async(data)=>{await pause(data);return false;},step]]).map(()=>"done")'
          : ".dowhile(step,async(data)=>{await pause(data);return false;})";
    const { compiled, dataDir } = await fixture(
      t,
      `import{defineLoom,defineWorkflow,defineStep}from"@intloom/loom-sdk";import{z}from"zod";
let log:(message:string)=>void=()=>{};
const pause=async(_data:unknown)=>{log("callback-start");await new Promise(r=>setTimeout(r,150));log("callback-end");};
const step=defineStep({id:"echo",inputSchema:z.string(),outputSchema:z.string(),execute:({inputData})=>inputData});
const begin=defineStep({id:"begin",inputSchema:z.string(),outputSchema:z.string(),execute:({inputData,context})=>{log=context.logger.info;return inputData;}});
export default defineLoom({id:"async-callback",version:"1.0.0",description:"drain",entry:defineWorkflow({id:"flow",inputSchema:z.string(),outputSchema:z.string()}).then(begin)${chain}.commit()});`,
    );
    const host = await serve({ dataDir });
    t.after(() => host.close());
    const loom = await host.installLoom({ source: compiled.artifactDir });
    const run = await host.createRun({ loom, input: "value" });
    await host.startRun(run.id);
    let started = false;
    for (let i = 0; i < 200; i++) {
      started = (await host.listRunEvents({ runId: run.id })).items.some(
        (e) =>
          (e.type === "log" ? e.details.message : undefined) ===
          "callback-start",
      );
      if (started) break;
      await delay(5);
    }
    assert.ok(started, operation);
    await host.cancelRun(run.id);
    assert.equal((await settled(host, run.id)).status, "cancelled");
    assert.ok(
      (await host.listRunEvents({ runId: run.id })).items.some(
        (e) =>
          (e.type === "log" ? e.details.message : undefined) === "callback-end",
      ),
      operation,
    );
  }
});

test("explicit Responses API binding reaches the selected endpoint", async (t) => {
  const wire = await modelServer(t, "responses");
  const { compiled, dataDir } = await fixture(
    t,
    await readFile(
      join(root, "test/integration/fixtures/execution-agents.ts.fixture"),
      "utf8",
    ),
  );
  const host = await serve({
    dataDir,
    bindings: {
      models: {
        "*": {
          model: {
            provider: "openai",
            model: "gpt-4.1-mini",
            credentialRef: "test",
            options: { baseUrl: wire.baseUrl, api: "responses" },
          },
        },
      },
      tools: {
        "*": {
          multiply: {
            implementation: "multiply",
            revision: "1",
            execute: () => 0,
          },
        },
      },
      resolveCredential: () => "fixture-key",
    },
  });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  for (const input of ["text", "structured"]) {
    const run = await host.createRun({ loom, input });
    await host.startRun(run.id);
    const result = await settled(host, run.id);
    assert.equal(result.status, "succeeded", JSON.stringify(result));
    const output = result.output as Record<string, unknown>;
    assert.deepEqual(output[input], input === "text" ? "done" : { value: 42 });
  }
  assert.equal(wire.requests.length, 2);
  assert.ok(wire.requests.every((r) => r.requestPath === "/v1/responses"));
});

test("Alibaba Qwen uses explicit compatible endpoints and native schemas without fallback", async (t) => {
  const source = await readFile(
    join(root, "test/integration/fixtures/execution-agents.ts.fixture"),
    "utf8",
  );
  for (const mode of ["ok", "responses", "bad_structure"] as const) {
    const wire = await modelServer(t, mode);
    const { compiled, dataDir } = await fixture(t, source);
    let calls = 0;
    const host = await serve({
      dataDir,
      bindings: {
        models: {
          "*": {
            model: {
              provider: "alibaba",
              model: "qwen3.8-flash",
              credentialRef: "test",
              options: {
                baseUrl: wire.baseUrl,
                api: mode === "responses" ? "responses" : "chat",
                ...(mode === "ok" && { reasoningEffort: "none" }),
              },
            },
          },
        },
        tools: {
          "*": {
            multiply: {
              implementation: "multiply",
              revision: "1",
              execute: ({ input }) => {
                calls++;
                return (input as { value: number }).value * 2;
              },
            },
          },
        },
        resolveCredential: () => "fixture-key",
      },
    });
    t.after(() => host.close());
    const loom = await host.installLoom({ source: compiled.artifactDir });
    const run = await host.createRun({
      loom,
      input: mode === "ok" ? "all" : "structured",
    });
    await host.startRun(run.id);
    const result = await settled(host, run.id);
    assert.equal(
      result.status,
      mode === "bad_structure" ? "failed" : "succeeded",
    );
    assert.equal(wire.requests.length, mode === "ok" ? 4 : 1);
    assert.ok(wire.requests.every((r) => r.model === "qwen3.8-flash"));
    for (const request of wire.requests) {
      if (mode === "ok") assert.equal(request.reasoning_effort, "none");
      else assert.equal("reasoning_effort" in request, false);
    }
    const request = wire.requests[mode === "ok" ? 1 : 0];
    assert.ok(request);
    const format =
      mode === "responses"
        ? (request.text as { format: { type: string; strict: boolean } }).format
        : (request.response_format as {
            type: string;
            json_schema: { strict: boolean };
          });
    assert.equal(format.type, "json_schema");
    assert.equal(
      "strict" in format ? format.strict : format.json_schema.strict,
      true,
    );
    assert.ok(
      wire.requests.every(
        (r) =>
          r.requestPath ===
          (mode === "responses" ? "/v1/responses" : "/v1/chat/completions"),
      ),
    );
    if (mode === "bad_structure") assert.equal(result.output, undefined);
    else {
      const output = result.output as {
        structured: unknown;
        counts: Record<string, number>;
      };
      assert.deepEqual(output.structured, { value: 42 });
      assert.equal(output.counts.structuredOutput, 1);
    }
    assert.equal(calls, mode === "ok" ? 1 : 0);
  }

  const { compiled, dataDir } = await fixture(t, source);
  const wire = await modelServer(t);
  for (const model of [
    { provider: "alibaba", model: "qwen3.8-flash", credentialRef: "test" },
    {
      provider: "alibaba",
      model: "qwen3.8-flash",
      credentialRef: "test",
      options: {
        baseUrl: wire.baseUrl,
        api: "responses",
        reasoningEffort: "none",
      },
    },
    {
      provider: "openai",
      model: "gpt-4.1-mini",
      credentialRef: "test",
      options: { baseUrl: wire.baseUrl, reasoningEffort: "none" },
    },
    {
      provider: "alibaba",
      model: "qwen3.6-plus",
      credentialRef: "test",
      options: { baseUrl: wire.baseUrl },
    },
    {
      provider: "openai",
      model: "qwen3.8-flash",
      credentialRef: "test",
      options: { baseUrl: wire.baseUrl },
    },
  ] as const) {
    const host = await serve({
      dataDir,
      bindings: {
        models: { "*": { model } },
        tools: {
          "*": {
            multiply: {
              implementation: "multiply",
              revision: "1",
              execute: () => 0,
            },
          },
        },
        resolveCredential: () => "fixture-key",
      },
    });
    try {
      const loom = await host.installLoom({ source: compiled.artifactDir });
      await assert.rejects(
        host.createRun({ loom, input: "structured" }),
        hasCode("BINDING_UNAVAILABLE"),
      );
    } finally {
      await host.close();
    }
  }
  assert.equal(wire.requests.length, 0);
});

test("MiniMax CN uses native Messages tools and rejects unsupported structured output before requests", async (t) => {
  const wire = await modelServer(t, "anthropic");
  const source = await readFile(
    join(root, "test/integration/fixtures/execution-agents.ts.fixture"),
    "utf8",
  );
  const { compiled, dataDir } = await fixture(t, source);
  const bindings: RuntimeBindings = {
    models: {
      "*": {
        model: {
          provider: "minimax-cn",
          model: "MiniMax-M3",
          credentialRef: "test",
          options: { baseUrl: "https://api.minimax.cn/anthropic/v1" },
        },
      },
    },
    tools: {
      "*": {
        multiply: {
          implementation: "multiply",
          revision: "1",
          execute: ({ input }) => (input as { value: number }).value * 2,
        },
      },
    },
    resolveCredential: () => "fixture-key",
  };
  const host = await serve({ dataDir, bindings });
  t.after(() => host.close());
  const unsupported = await host.installLoom({ source: compiled.artifactDir });
  await assert.rejects(
    host.createRun({ loom: unsupported, input: "text" }),
    hasCode("MODEL_CAPABILITY_UNSUPPORTED"),
  );
  assert.equal(wire.requests.length, 0);
  const toolFixture = await fixture(
    t,
    source.replace('evidence",entry});', 'evidence",entry:toolAgent});'),
  );
  const loom = await host.installLoom({
    source: toolFixture.compiled.artifactDir,
  });
  const fetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, "https://api.minimax.cn");
    return fetch(new URL(url.pathname, wire.baseUrl), init);
  };
  t.after(() => {
    globalThis.fetch = fetch;
  });
  const run = await host.createRun({ loom, input: "TOOLS" });
  await host.startRun(run.id);
  const result = await settled(host, run.id);
  assert.equal(result.status, "succeeded", JSON.stringify(result));
  assert.equal(result.output, "done");
  assert.equal(wire.requests.length, 2);
  assert.ok(
    wire.requests.every((r) => r.requestPath === "/anthropic/v1/messages"),
  );
});

test("nested parallel Step failures retain their own path and safe business code after reopen", async (t) => {
  const { compiled, dataDir } = await fixture(
    t,
    `
    import {defineLoom,defineWorkflow,defineStep} from "@intloom/loom-sdk";
    import {z} from "zod";
    const io={inputSchema:z.string(),outputSchema:z.string()};
    const inner=defineWorkflow({id:"nested-work",...io}).then(defineStep({id:"check",...io,
      execute:({context,inputData})=>context.fail(inputData)})).commit();
    const outer=defineWorkflow({id:"parent",inputSchema:z.string(),outputSchema:z.object({review:z.string(),other:z.string()})}).parallel([
      defineStep(inner,{id:"review"}),defineStep({id:"other",...io,execute:({inputData})=>inputData})]).commit();
    export default defineLoom({id:"fail-path",version:"1.0.0",description:"diagnostic",entry:outer});`,
  );
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  for (const input of ["SCOPE_REJECTED", "/private/SECRET"]) {
    const run = await host.createRun({ loom, input });
    await host.startRun(run.id);
    const r = await settled(host, run.id);
    assert.equal(r.status, "failed");
    assert.deepEqual(r.error?.origin, {
      workflowId: "nested-work",
      stepPath: ["review", "check"],
      componentId: "check",
    });
    assert.equal(r.error?.code, "EXECUTION_FAILED");
    assert.equal(
      r.error?.businessCode,
      input === "SCOPE_REJECTED" ? input : undefined,
    );
    assert.ok(!JSON.stringify(r.error).includes("SECRET"));
  }
  await host.close();
  const reopened = await serve({ dataDir });
  t.after(() => reopened.close());
  const runs = await reopened.listRuns({});
  const errors = await Promise.all(
    runs.items.map(async (r) => (await reopened.getRunResult(r.id)).error),
  );
  assert.ok(errors.some((e) => e?.businessCode === "SCOPE_REJECTED"));
});

test("a rejected durable model receipt stops the loop without a second provider request", async (t) => {
  const wire = await modelServer(t);
  const { compiled, dataDir } = await fixture(
    t,
    await readFile(
      join(root, "test/integration/fixtures/execution-agents.ts.fixture"),
      "utf8",
    ),
  );
  const bindings: RuntimeBindings = {
    models: {
      "*": {
        model: {
          provider: "openai",
          model: "gpt-4.1-mini",
          credentialRef: "fixture",
          options: { baseUrl: wire.baseUrl },
        },
      },
    },
    tools: {
      "*": {
        multiply: {
          implementation: "multiply",
          revision: "1",
          execute: () => 6,
        },
      },
    },
    resolveCredential: () => "fixture-key",
  };
  const host = await serve({ dataDir, bindings });
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom, input: "tool" });
  const { createClient } = createRequire(
    join(root, "packages/kernel/package.json"),
  )(
    "@libsql/client",
  ) as typeof import("../../packages/kernel/node_modules/@libsql/client/lib-esm/node.js");
  assert.ok(run.location);
  const db = createClient({
    url: `file:${join(run.location.dataDir, "kernel.db")}`,
  });
  await db.execute(
    "CREATE TRIGGER reject_receipt BEFORE INSERT ON run_events WHEN NEW.type='model.step.finished' BEGIN SELECT RAISE(ABORT,'receipt refused'); END",
  );
  await host.startRun(run.id);
  await host.close();
  assert.equal(wire.requests.length, 1);
  await db.execute("DROP TRIGGER reject_receipt");
  db.close();
  const reopened = await serve({ dataDir, bindings });
  t.after(() => reopened.close());
  assert.equal((await reopened.getRun(run.id)).status, "interrupted");
  assert.deepEqual(
    (await reopened.listRunEvents({ runId: run.id })).items
      .filter((e) => e.type.startsWith("model."))
      .map((e) => e.type),
    [
      "model.invocation.started",
      "model.request.updated",
      "model.request.updated",
    ],
  );
  assert.equal(wire.requests.length, 1);
});

test("parallel calls to one Agent keep separate receipt paths, IDs and persisted pages", async (t) => {
  const wire = await modelServer(t);
  const { compiled, dataDir } = await fixture(
    t,
    `
    import {defineLoom,defineAgent,defineStep,defineWorkflow} from "@intloom/loom-sdk";import {z} from "zod";
    const io={inputSchema:z.string(),outputSchema:z.string()};
    const agent=defineAgent({id:"shared",...io,model:{slot:"text"},instructions:"Reply.",prompt:({inputData})=>inputData,outputMode:"text"});
    const workflow=defineWorkflow({id:"outer",inputSchema:z.string(),outputSchema:z.object({left:z.string(),right:z.string()})})
      .parallel([defineStep(agent,{id:"left"}),defineStep(agent,{id:"right"})]).commit();
    export default defineLoom({id:"parallel-usage",version:"1.0.0",description:"usage",entry:workflow});`,
  );
  const host = await serve({
    dataDir,
    bindings: {
      models: {
        "*": {
          text: {
            provider: "openai",
            model: "gpt-4.1-mini",
            credentialRef: "test",
            options: { baseUrl: wire.baseUrl },
          },
        },
      },
      resolveCredential: () => "fixture-key",
    },
  });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom, input: "parallel" });
  await host.startRun(run.id);
  assert.equal((await settled(host, run.id)).status, "succeeded");
  await host.close();
  const reopened = await serve({ dataDir });
  t.after(() => reopened.close());
  const events: RunEvent[] = [];
  let after = 0;
  for (;;) {
    const page = await reopened.listRunEvents({
      runId: run.id,
      after,
      limit: 2,
    });
    events.push(...page.items);
    if (!page.nextAfter) break;
    after = page.nextAfter;
  }
  const ids = new Set();
  for (const branch of ["left", "right"]) {
    const rows = events.filter(
      (e): e is Extract<RunEvent, { type: `model.${string}` }> =>
        e.type.startsWith("model.") &&
        Array.isArray(e.origin?.stepPath) &&
        e.origin.stepPath[0] === branch,
    );
    assert.deepEqual(
      rows.map((r) => r.type),
      [
        "model.invocation.started",
        "model.request.updated",
        "model.request.updated",
        "model.step.finished",
        "model.invocation.finished",
      ],
    );
    assert.ok(
      rows.every(
        (r) =>
          r.origin?.componentId === "shared" &&
          r.details?.invocationId === rows[0]?.details?.invocationId,
      ),
    );
    assert.equal(typeof rows[0]?.details?.invocationId, "string");
    ids.add(rows[0]?.details?.invocationId);
  }
  const activity = await reopened.getRunActivity(run.id);
  const models = activity.recentExecutions.filter(
    (call) => call.kind === "model",
  );
  assert.deepEqual(new Set(models.map((call) => call.id)), ids);
  assert.deepEqual(
    new Set(models.map((call) => call.origin?.stepPath?.[0])),
    new Set(["left", "right"]),
  );
  assert.equal(ids.size, 2);
  assert.equal(wire.requests.length, 2);
});
