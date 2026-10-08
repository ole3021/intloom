import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  addWorkflow,
  connectProject,
  startService,
  serviceStatus,
} from "@intloom/cli";
import { cli, projectFixture, configureProject } from "./project-fixture.ts";
import { packSpecification } from "./workflow-fixture.ts";

test("CLI and MCP project clients retain classified model errors and safe diagnostics", {
  timeout: 30_000,
}, async (t) => {
  const privateText = "private-model-credential-and-response";
  let mode = "request";
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    req.resume();
    if (mode === "request") {
      res
        .writeHead(404, { "content-type": "application/json" })
        .end(JSON.stringify({ error: { message: privateText } }));
    } else if (mode === "response") {
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ invalid: privateText }));
    } else {
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          id: "chatcmpl-error-fixture",
          object: "chat.completion",
          created: 0,
          model: "fixture",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: `not JSON ${privateText}`,
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const root = await projectFixture(t, false);
  await addWorkflow(root, await packSpecification(root));
  await configureProject(root, {
    llms: {
      default: {
        provider: "openai-compatible",
        model: "fixture",
        secret: "ENV.INTLOOM_CLI_TEST_KEY",
        baseURL: `http://127.0.0.1:${address.port}/v1`,
      },
    },
  });
  const previous = process.env.INTLOOM_CLI_TEST_KEY;
  process.env.INTLOOM_CLI_TEST_KEY = privateText;
  try {
    await startService({ projectRoot: root });
  } finally {
    if (previous === undefined) delete process.env.INTLOOM_CLI_TEST_KEY;
    else process.env.INTLOOM_CLI_TEST_KEY = previous;
  }
  const client = await connectProject(root);
  t.after(() => client.close());
  for (const [scenario, code] of [
    ["request", "LLM_REQUEST_FAILED"],
    ["response", "LLM_RESPONSE_INVALID"],
    ["output", "AGENT_OUTPUT_INVALID"],
  ]) {
    assert.ok(scenario && code);
    mode = scenario;
    const before = requests;
    const result = await cli(root, [
      "flow",
      "intent",
      "--intent",
      "Todo error verification",
      "--json",
    ]);
    assert.equal(result.code, 1, result.stdout);
    assert.equal(result.stdout.trim().split("\n").length, 1);
    const view = JSON.parse(result.stdout).run;
    assert.equal(view.status, "failed");
    assert.equal(view.lastError.code, code);
    assert.deepEqual(view.cursor, {
      stageName: "specification",
      stepName: "analyze",
    });
    assert.deepEqual(Object.keys(view.lastError).sort(), [
      "code",
      "message",
      "retryable",
    ]);
    assert.equal(view.lastError.retryable, false);
    if (mode === "request")
      assert.match(view.lastError.message, /HTTP 404.*baseURL/u);
    assert.equal(requests - before, 1);
    assert.deepEqual(await client.getRun(view.runId), view);
    const terminal = await cli(root, ["attach", view.runId, "--no-color"]);
    assert.equal(terminal.code, 1);
    assert.ok(terminal.stdout.includes(code));
    assert.ok(terminal.stdout.includes(view.lastError.message));
    assert.ok(
      !JSON.stringify([
        result,
        terminal,
        await client.getRun(view.runId),
      ]).includes(privateText),
    );
    const service = await serviceStatus(root);
    assert.ok(service.logFile);
    const text = await readFile(
      join(root, ".intloom/logs", service.logFile),
      "utf8",
    );
    assert.ok(!text.includes(privateText));
    const rows = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((row) => row.runId === view.runId);
    assert.ok(rows.some((row) => row.event === "agent_started"));
    assert.ok(
      rows.some((row) => row.event === "step_failed" && row.err.code === code),
    );
  }
});
