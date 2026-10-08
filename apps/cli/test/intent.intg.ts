import assert from "node:assert/strict";
import { createServer } from "node:http";
import { writeFile, readFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { connectProject, startService, stopService } from "@intloom/cli";
import type { UserAskConfirmation } from "@intloom/kernel";
import * as z from "zod";
import { cli, pending } from "./project-fixture.ts";
import { temporaryDirectory } from "./directory-fixture.ts";
import { packSpecification } from "./workflow-fixture.ts";

interface State {
  id: string;
  intent: string;
  questions: {
    id: string;
    question: string;
    isBlock: boolean;
    answer?: string;
    skipped?: boolean;
  }[];
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

async function modelFixture(t: TestContext) {
  const reads: State[] = [];
  const failures: string[] = [];
  const requests: string[] = [];
  let sequence = 0;
  const server = createServer((req, res) => {
    void (async () => {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      requests.push(req.url ?? "");
      assert.equal(req.url, "/v1/chat/completions");
      const request = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        messages: Message[];
      };
      const last = request.messages.at(-1);
      let message: Message;
      const call = request.messages
        .flatMap((item) => item.tool_calls ?? [])
        .find((item) => item.id === last?.tool_call_id);
      if (last?.role !== "tool") message = tool("read_specification", {});
      else if (call?.function.name === "read_specification") {
        const state = JSON.parse(last.content ?? "null") as State;
        reads.push(structuredClone(state));
        assert.ok(
          reads.length <= 5,
          "The controlled model must not create an unbounded repair loop.",
        );
        const id = `SCON-${state.id}`;
        message = tool("submit_specification", {
          changes: [
            {
              target_ref: id,
              reason: "Save the constraint",
              patch: [
                {
                  op: "add",
                  path: "",
                  value: {
                    id,
                    status: "active",
                    description: state.intent,
                    record_refs: [],
                  },
                },
              ],
            },
            ...(state.questions[1]?.skipped
              ? [
                  {
                    target_ref: "SDEF-theme",
                    reason: "Preserve the nonblocking item skipped by the user",
                    patch: [
                      {
                        op: "add",
                        path: "",
                        value: {
                          id: "SDEF-theme",
                          status: "active",
                          question: "Which UI theme?",
                          description:
                            "The theme is undecided for this iteration.",
                          impact_refs: [],
                          record_refs: [],
                        },
                      },
                    ],
                  },
                ]
              : []),
          ],
          questions: [
            {
              id: "QST-1",
              question: "Where should it be deployed?",
              isBlock: true,
            },
            { id: "QST-2", question: "Which UI theme?", isBlock: false },
          ],
          processedFeedbackCount: state.feedbacks.length,
        });
      } else {
        assert.equal(call?.function.name, "submit_specification");
        assert.deepEqual(JSON.parse(last?.content ?? "null"), { saved: true });
        message = {
          role: "assistant",
          content: JSON.stringify({
            outcome:
              reads.at(-1)?.questions[0]?.answer !== undefined
                ? "ready"
                : "clarification_required",
          }),
        };
      }
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          id: `chatcmpl-${++sequence}`,
          object: "chat.completion",
          created: 0,
          model: "intent-test",
          choices: [
            {
              index: 0,
              message,
              finish_reason: message.tool_calls ? "tool_calls" : "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      );
    })().catch((error: unknown) => {
      failures.push(String(error));
      res.writeHead(500).end(String(error));
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
    reads,
    failures,
    requests,
    url: `http://127.0.0.1:${address.port}/v1`,
  };
}

for (const storage of ["file", "sqlite"] as const)
  test(`${storage}: fresh init, add Intent, CLI flow, answers, confirmation and preserved results after removal`, {
    timeout: 120_000,
  }, async (t) => {
    const base = await temporaryDirectory(t, async (directory) => {
      await stopService(join(directory, "new-project")).catch(() => {});
    });
    const root = join(base, "new-project");
    const archive = await packSpecification(base);
    const initialized = await cli(root, ["init", "--json"]);
    assert.equal(initialized.code, 0, initialized.stdout);
    const added = await cli(root, ["workflow", "add", archive, "--json"]);
    assert.equal(added.code, 0, added.stdout);
    await assert.rejects(readFile(join(root, "package.json")), {
      code: "ENOENT",
    });
    const model = await modelFixture(t);
    const initialConfig = await readFile(join(root, "intloom.yaml"), "utf8");
    await writeFile(
      join(root, "intloom.yaml"),
      initialConfig.replace("localStorage: file", `localStorage: ${storage}`) +
        `\nllms:\n  default:\n    provider: openai-compatible\n    model: intent-test\n    secret: ENV.INTLOOM_CLI_TEST_KEY\n    baseURL: ${model.url}\n`,
    );
    const previous = process.env.INTLOOM_CLI_TEST_KEY;
    process.env.INTLOOM_CLI_TEST_KEY = "fixture-credential";
    try {
      await startService({ projectRoot: root });
    } finally {
      if (previous === undefined) delete process.env.INTLOOM_CLI_TEST_KEY;
      else process.env.INTLOOM_CLI_TEST_KEY = previous;
    }
    const initial = await cli(root, [
      "flow",
      "intent",
      "--intent",
      "  deployment constraints\noriginal requirements  ",
      "--json",
    ]);
    assert.equal(
      initial.code,
      0,
      JSON.stringify({
        stdout: initial.stdout,
        modelRequests: model.requests,
        modelFailures: model.failures,
      }),
    );
    const view = JSON.parse(initial.stdout).run;
    assert.equal(view.status, "waiting");
    assert.equal(view.cursor.stepName, "clarify");
    const client = await connectProject(root);
    t.after(() => client.close());
    const confirm = await client.answerAsk(view.runId, view.pendingAction.id, [
      { questionId: "QST-1", isSkipped: false, answer: "Local" },
      { questionId: "QST-2", isSkipped: true },
    ]);
    assert.equal(confirm.status, "waiting");
    assert.equal(confirm.cursor.stepName, "confirm");
    const context = (pending(confirm).request as UserAskConfirmation).context;
    assert.match(context, /^Specification ready to save/);
    assert.match(context, /deployment constraints/);
    assert.match(context, /original requirements/);
    assert.doesNotMatch(context, /"baseline"|"changes"|"record_refs"/);
    const done = await client.answerAsk(view.runId, pending(confirm).id, {
      isConfirmed: true,
    });
    assert.equal(done.status, "completed");
    assert.equal(model.reads.length, 2);
    assert.equal(model.reads[1]?.questions[0]?.answer, "Local");
    assert.equal(model.reads[1]?.questions[0]?.isBlock, true);
    assert.equal(model.reads[1]?.questions[1]?.skipped, true);
    assert.equal(model.reads[1]?.questions[1]?.answer, undefined);
    assert.equal(
      model.reads[0]?.intent,
      "  deployment constraints\noriginal requirements  ",
    );
    const record = await client.getRecord(done.runId);
    assert.notEqual(record, null);
    const data = z
      .object({
        questions: z.array(z.object({ id: z.string() })),
        changes: z.array(z.object({ target_ref: z.string() })),
      })
      .parse(record?.data);
    assert.deepEqual(
      data.questions.map((item) => item.id),
      ["QST-1"],
    );
    assert.ok(data.changes.some((item) => item.target_ref === "SDEF-theme"));
    await client.close();
    await stopService(root);
    if (storage === "file") {
      assert.ok((await readdir(join(root, "intloom/artifacts"))).length > 0);
      assert.ok((await readdir(join(root, "intloom/records"))).length > 0);
    } else
      assert.ok(
        (await readFile(join(root, "intloom/storage.sqlite"))).length > 0,
      );
    const beforeRestore = await readFile(join(root, "intloom.yaml"), "utf8");
    await rm(join(root, ".intloom"), { recursive: true });
    process.env.INTLOOM_CLI_TEST_KEY = "fixture-credential";
    try {
      await startService({ projectRoot: root });
    } finally {
      if (previous === undefined) delete process.env.INTLOOM_CLI_TEST_KEY;
      else process.env.INTLOOM_CLI_TEST_KEY = previous;
    }
    assert.equal(
      await readFile(join(root, "intloom.yaml"), "utf8"),
      beforeRestore,
    );
    const restarted = await connectProject(root);
    assert.deepEqual(await restarted.getRecord(done.runId), record);
    const artifact = await restarted.getArtifact({
      flowName: "intent",
      stageName: "specification",
    });
    assert.ok(artifact);
    await restarted.close();
    await stopService(root);
    const removed = await cli(root, [
      "workflow",
      "remove",
      "@intloom/workflow-intent",
      "--json",
    ]);
    assert.equal(removed.code, 0, removed.stdout);
    await startService({ projectRoot: root });
    const withoutWorkflow = await connectProject(root);
    try {
      assert.deepEqual(await withoutWorkflow.listWorkflows(), []);
      assert.deepEqual(await withoutWorkflow.getRecord(done.runId), record);
      assert.deepEqual(
        await withoutWorkflow.getArtifact({ artifactId: artifact.id }),
        artifact,
      );
    } finally {
      await withoutWorkflow.close();
    }
  });
