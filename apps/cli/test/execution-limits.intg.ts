import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { connectProject, startProjectHost } from "@intloom/cli";
import { cli, pending } from "./project-fixture.ts";
import { temporaryDirectory } from "./directory-fixture.ts";
import { packSpecification } from "./workflow-fixture.ts";

interface SpecificationState {
  id: string;
  intent: string;
  questions: { id: string; answer?: string }[];
  feedbacks: unknown[];
}
interface Message {
  role: string;
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }[];
}

/** A real streamed tool/final exchange with no provider or external network. */
async function modelFixture(t: TestContext) {
  let sequence = 0;
  let requests = 0;
  const errors: string[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      assert.equal(req.url, "/v1/chat/completions");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        stream: boolean;
        messages: Message[];
      };
      assert.equal(body.stream, true);
      requests++;
      const last = body.messages.at(-1);
      const previousCall = body.messages
        .flatMap((message) => message.tool_calls ?? [])
        .find((call) => call.id === last?.tool_call_id);
      let message: Message;
      if (last?.role !== "tool") message = tool("read_specification", {});
      else if (previousCall?.function.name === "read_specification") {
        const state = JSON.parse(last.content ?? "null") as SpecificationState;
        const clarification = state.intent === "requires clarification";
        message = tool("submit_specification", {
          changes: [
            {
              target_ref: `SCON-${state.id}`,
              reason: "Save the requirement",
              patch: [
                {
                  op: "add",
                  path: "",
                  value: {
                    id: `SCON-${state.id}`,
                    status: "active",
                    description: state.intent,
                    record_refs: [],
                  },
                },
              ],
            },
          ],
          questions: clarification
            ? [{ id: "QST-1", question: "Which local mode?", isBlock: true }]
            : [],
          processedFeedbackCount: state.feedbacks.length,
        });
      } else {
        assert.equal(previousCall?.function.name, "submit_specification");
        assert.deepEqual(JSON.parse(last?.content ?? "null"), { saved: true });
        message = {
          role: "assistant",
          content: JSON.stringify({
            outcome:
              last &&
              body.messages.some(
                (item) =>
                  typeof item.content === "string" &&
                  item.content.includes("requires clarification"),
              )
                ? "clarification_required"
                : "ready",
          }),
        };
      }
      const delta = {
        ...message,
        ...(message.tool_calls
          ? {
              tool_calls: message.tool_calls.map((call, index) => ({
                ...call,
                index,
              })),
            }
          : {}),
      };
      const id = `chatcmpl-${++sequence}`;
      const frames = [
        {
          id,
          object: "chat.completion.chunk",
          created: 0,
          model: "intent-budget-test",
          choices: [{ index: 0, delta, finish_reason: null }],
        },
        {
          id,
          object: "chat.completion.chunk",
          created: 0,
          model: "intent-budget-test",
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: message.tool_calls ? "tool_calls" : "stop",
            },
          ],
          // The second Run has unknown provider usage; never infer zero cost.
          ...(requests <= 3
            ? {
                usage: {
                  prompt_tokens: 2,
                  completion_tokens: 1,
                  total_tokens: 3,
                },
              }
            : {}),
        },
      ];
      res
        .writeHead(200, { "content-type": "text/event-stream" })
        .end(
          frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("") +
            "data: [DONE]\n\n",
        );
    })().catch((error: unknown) => {
      errors.push(String(error));
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  function tool(name: string, input: unknown): Message {
    return {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: `call-${++sequence}`,
          type: "function",
          function: { name, arguments: JSON.stringify(input) },
        },
      ],
    };
  }
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  );
  return {
    get requests() {
      return requests;
    },
    errors,
    url: `http://127.0.0.1:${address.port}/v1`,
  };
}

async function installedProject(t: TestContext) {
  const base = await temporaryDirectory(t);
  const root = join(base, "budget-project");
  const archive = await packSpecification(base);
  const initialized = await cli(root, ["init", "--json"]);
  assert.equal(initialized.code, 0, initialized.stdout);
  const installed = await cli(root, ["workflow", "add", archive, "--json"]);
  assert.equal(installed.code, 0, installed.stdout);
  return root;
}

async function afterExecution(
  client: Awaited<ReturnType<typeof connectProject>>,
  runId: string,
) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const run = await client.getRun(runId);
    if (run.status !== "running") return run;
    await delay(100);
  }
  assert.fail(`Run ${runId} did not reach a waiting or terminal state`);
}

test("built Host rejects invalid execution limits and releases startup resources", {
  timeout: 60_000,
}, async (t) => {
  const root = await installedProject(t);
  await mkdir(join(root, "intloom"), { recursive: true });
  const limitsFile = join(root, "intloom/host.json");
  await writeFile(
    limitsFile,
    JSON.stringify({ unsupported: "PRIVATE_SENTINEL" }),
  );
  await assert.rejects(
    startProjectHost({ projectRoot: root }),
    (error: unknown) => {
      assert.ok(error instanceof Error && "code" in error);
      assert.equal(error.code, "CLI_EXECUTION_LIMITS_INVALID");
      assert.match(error.message, /intloom\/host\.json/u);
      assert.doesNotMatch(error.message, /PRIVATE_SENTINEL/u);
      return true;
    },
  );
  await writeFile(limitsFile, JSON.stringify({ run: { maxModelCalls: 3 } }));
  const host = await startProjectHost({ projectRoot: root });
  await host.close();
});

test("public Host budget spans Agent continuations, blocks HTTP, and preserves committed Records", {
  timeout: 120_000,
}, async (t) => {
  const root = await installedProject(t);
  const model = await modelFixture(t);
  const original = await readFile(join(root, "intloom.yaml"), "utf8");
  await writeFile(
    join(root, "intloom.yaml"),
    `${original}\nllms:\n  default:\n    provider: openai-compatible\n    model: intent-budget-test\n    secret: ENV.INTLOOM_CLI_TEST_KEY\n    baseURL: ${model.url}\n`,
  );
  await mkdir(join(root, "intloom"), { recursive: true });
  await writeFile(
    join(root, "intloom/host.json"),
    JSON.stringify({ run: { maxModelCalls: 3 } }),
  );
  const priorKey = process.env.INTLOOM_CLI_TEST_KEY;
  process.env.INTLOOM_CLI_TEST_KEY = "local-fixture-credential";
  let host: Awaited<ReturnType<typeof startProjectHost>> | undefined;
  let client: Awaited<ReturnType<typeof connectProject>> | undefined;
  try {
    host = await startProjectHost({ projectRoot: root });
    client = await connectProject(root);

    const first = await afterExecution(
      client,
      (await client.flow("intent", "fixed local requirement")).runId,
    );
    assert.equal(first.status, "waiting");
    assert.equal(first.cursor.stepName, "confirm");
    assert.equal(model.requests, 3);
    const completed = await afterExecution(
      client,
      (
        await client.answerAsk(first.runId, pending(first).id, {
          isConfirmed: true,
        })
      ).runId,
    );
    assert.equal(completed.status, "completed");
    const committed = await client.getRecord(completed.runId);
    assert.ok(committed);

    const second = await afterExecution(
      client,
      (await client.flow("intent", "requires clarification")).runId,
    );
    assert.equal(second.status, "waiting");
    assert.equal(second.cursor.stepName, "clarify");
    assert.equal(model.requests, 6);
    try {
      await client.answerAsk(second.runId, pending(second).id, [
        { questionId: "QST-1", isSkipped: false, answer: "Local" },
      ]);
    } catch (error) {
      assert.ok(error instanceof Error && "code" in error);
      assert.equal(error.code, "RUN_STOPPED");
    }
    const stopped = await afterExecution(client, second.runId);
    assert.equal(stopped.status, "failed");
    assert.equal(stopped.lastError?.code, "RUN_STOPPED");
    assert.equal(stopped.lastError?.retryable, false);
    assert.match(stopped.lastError?.message ?? "", /model_calls/u);
    assert.equal(
      model.requests,
      6,
      "the next Agent must be stopped before HTTP",
    );
    assert.deepEqual(await client.getRecord(completed.runId), committed);
    assert.deepEqual(model.errors, []);

    const history = await cli(root, [
      "logs",
      second.runId,
      "--json",
      "--debug",
    ]);
    assert.equal(history.code, 0, history.stdout);
    const rows = JSON.parse(history.stdout).data as Record<string, unknown>[];
    const exceeded = rows.find((row) => row.event === "run_budget_exceeded");
    assert.ok(exceeded);
    assert.equal(exceeded.runId, second.runId);
    assert.equal(exceeded.reason, "model_calls");
    assert.equal(exceeded.modelCalls, 3);
    const safeFields = new Set([
      "time",
      "level",
      "event",
      "runId",
      "reason",
      "modelCalls",
      "knownInputTokens",
      "knownOutputTokens",
      "usageUnknownSteps",
      "durationMs",
    ]);
    assert.ok(Object.keys(exceeded).every((field) => safeFields.has(field)));
    const summary = rows.find((row) => row.event === "run_usage_summary");
    assert.ok(summary);
    assert.equal(summary.modelCalls, 3);
    assert.ok(Number(summary.usageUnknownSteps) >= 1);
    assert.ok(Object.keys(summary).every((field) => safeFields.has(field)));
    assert.doesNotMatch(
      history.stdout,
      /local-fixture-credential|requires clarification/u,
    );

    const firstHistory = await cli(root, [
      "logs",
      completed.runId,
      "--json",
      "--debug",
    ]);
    assert.equal(firstHistory.code, 0, firstHistory.stdout);
    const firstSummary = (
      JSON.parse(firstHistory.stdout).data as Record<string, unknown>[]
    ).find((row) => row.event === "run_usage_summary");
    assert.ok(firstSummary);
    assert.equal(firstSummary.modelCalls, 3);
    assert.ok(Number(firstSummary.knownInputTokens) > 0);
    assert.ok(Number(firstSummary.knownOutputTokens) > 0);
    assert.equal(firstSummary.usageUnknownSteps, 0);
  } finally {
    await client?.close();
    await host?.close();
    if (priorKey === undefined) delete process.env.INTLOOM_CLI_TEST_KEY;
    else process.env.INTLOOM_CLI_TEST_KEY = priorKey;
  }
});

test("known token budget stops the next streamed request at the public Host boundary", {
  timeout: 120_000,
}, async (t) => {
  const root = await installedProject(t);
  const model = await modelFixture(t);
  const original = await readFile(join(root, "intloom.yaml"), "utf8");
  await writeFile(
    join(root, "intloom.yaml"),
    `${original}\nllms:\n  default:\n    provider: openai-compatible\n    model: intent-budget-test\n    secret: ENV.INTLOOM_CLI_TEST_KEY\n    baseURL: ${model.url}\n`,
  );
  await mkdir(join(root, "intloom"), { recursive: true });
  await writeFile(
    join(root, "intloom/host.json"),
    JSON.stringify({ run: { maxKnownInputTokens: 2 } }),
  );
  const priorKey = process.env.INTLOOM_CLI_TEST_KEY;
  process.env.INTLOOM_CLI_TEST_KEY = "local-fixture-credential";
  let host: Awaited<ReturnType<typeof startProjectHost>> | undefined;
  let client: Awaited<ReturnType<typeof connectProject>> | undefined;
  try {
    host = await startProjectHost({ projectRoot: root });
    client = await connectProject(root);
    const launched = await client
      .flow("intent", "fixed local requirement")
      .catch((error: unknown) => {
        assert.ok(error instanceof Error && "code" in error);
        assert.equal(error.code, "RUN_STOPPED");
        return null;
      });
    const runs = await client.listRuns();
    assert.equal(runs.length, 1);
    const run = runs[0];
    assert.ok(run);
    if (launched) assert.equal(launched.runId, run.runId);
    const stopped = await afterExecution(client, run.runId);
    assert.equal(stopped.status, "failed");
    assert.equal(stopped.lastError?.code, "RUN_STOPPED");
    assert.equal(stopped.lastError?.retryable, false);
    assert.match(stopped.lastError?.message ?? "", /known_input_tokens/u);
    assert.equal(model.requests, 1);
    assert.deepEqual(model.errors, []);
    const history = await cli(root, ["logs", run.runId, "--json", "--debug"]);
    assert.equal(history.code, 0, history.stdout);
    const rows = JSON.parse(history.stdout).data as Record<string, unknown>[];
    const exceeded = rows.find((row) => row.event === "run_budget_exceeded");
    assert.ok(exceeded);
    assert.equal(exceeded.reason, "known_input_tokens");
    assert.equal(exceeded.modelCalls, 1);
    assert.equal(exceeded.knownInputTokens, 2);
    const summary = rows.find((row) => row.event === "run_usage_summary");
    assert.ok(summary);
    assert.equal(summary.usageUnknownSteps, 0);
  } finally {
    await client?.close();
    await host?.close();
    if (priorKey === undefined) delete process.env.INTLOOM_CLI_TEST_KEY;
    else process.env.INTLOOM_CLI_TEST_KEY = priorKey;
  }
});
