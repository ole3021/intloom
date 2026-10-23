import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import * as z from "zod";
import { defineAgentTool } from "@intloom/loom-sdk";
import { openLog, withLogger } from "@intloom/utils";
import { createAgent } from "../src/execution/model/create-agent.ts";
import { createExecution } from "../src/execution/create-execution.ts";
import { agentSpec, testConfig } from "./agent-fixture.ts";
import { agentId, source } from "./loom-fixture.ts";
import { executionAccess } from "./access-fixture.ts";

const secret = "PRIVATE_RETRY_SENTINEL";
async function fixture(
  t: TestContext,
  mode: "recover" | "exhaust" | "denied" | "partial" | "cancel",
) {
  const dir = await mkdtemp(join(tmpdir(), "intloom-sdk-retry-"));
  const logs = await openLog({ directory: dir });
  t.after(async () => {
    await logs.close();
    await rm(dir, { recursive: true, force: true });
  });
  const bodies: unknown[] = [];
  const access = executionAccess();
  let effects = 0;
  const server = createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      bodies.push(JSON.parse(Buffer.concat(chunks).toString()));
      assert.equal(req.headers.authorization, `Bearer ${secret}`);
      const tool = bodies.length === 1 && ["recover", "partial"].includes(mode);
      if (
        !tool &&
        mode !== "partial" &&
        (mode !== "recover" || bodies.length < 5)
      ) {
        res.writeHead(mode === "denied" ? 401 : 503, {
          "content-type": "application/json",
        });
        res.end(
          JSON.stringify({ error: { message: secret, type: "api_error" } }),
        );
        if (mode === "cancel")
          setTimeout(() => access.controller.abort(new Error("Stopped")), 25);
        return;
      }
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "x-private": secret,
      });
      const frame = (delta: unknown, reason: string | null) =>
        `data: ${JSON.stringify({ id: secret, object: "chat.completion.chunk", created: 0, model: "fixture", choices: [{ index: 0, delta, finish_reason: reason }] })}\n\n`;
      if (mode === "partial" && !tool) {
        res.write(frame({ role: "assistant", content: "partial" }, null));
        setTimeout(() => res.destroy(), 30);
        return;
      }
      res.write(
        frame(
          {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: `call-${bodies.length}`,
                type: "function",
                function: {
                  name: tool ? "save" : "intloom_complete_step",
                  arguments: JSON.stringify(
                    tool ? {} : { outcome: "complete" },
                  ),
                },
              },
            ],
          },
          null,
        ),
      );
      res.end(`${frame({}, "tool_calls")}data: [DONE]\n\n`);
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
  const config = testConfig();
  config.llms.default.baseURL = `http://127.0.0.1:${address.port}/v1`;
  const spec = {
    ...agentSpec(),
    tools: [
      defineAgentTool({
        id: "save",
        description: "Owned mutation",
        inputSchema: z.strictObject({}),
        outputSchema: z.strictObject({ saved: z.boolean() }),
        execute: async () => {
          effects++;
          return { saved: true };
        },
      }),
    ],
  };
  const { executable } = await createAgent(spec, {
    agentId,
    source,
    config,
    credentials: () => secret,
  });
  return {
    bodies,
    get effects() {
      return effects;
    },
    run: () =>
      withLogger(logs.logger, () =>
        createExecution().executeAgent(executable, null, access.agent),
      ),
    async rows(): Promise<Record<string, unknown>[]> {
      logs.flush();
      const raw = await readFile(logs.filePath, "utf8");
      assert.equal(raw.includes(secret), false);
      return raw
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    },
  };
}

test("native SDK retries three times, retains accepted Tools and reports every attempt", async (t) => {
  const f = await fixture(t, "recover");
  assert.deepEqual(await f.run(), { outcome: "complete" });
  assert.equal(f.bodies.length, 5);
  assert.equal(f.effects, 1);
  for (const body of f.bodies.slice(2)) assert.deepEqual(body, f.bodies[1]);
  const rows = await f.rows();
  assert.deepEqual(
    rows.filter((r) => r.event === "model_retry_started").map((r) => r.attempt),
    [2, 3, 4],
  );
  assert.equal(
    rows.filter((r) => r.event === "model_attempt_failed").length,
    3,
  );
  const success = rows.filter((r) => r.event === "model_step_completed").at(-1);
  assert.equal(success?.attempts, 4);
  assert.ok(Number(success?.durationMs) >= 0);
  assert.equal(success?.streamOpened, true);
  assert.ok(
    rows.some(
      (r) => r.event === "model_http_response_headers" && r.httpStatus === 503,
    ),
  );
  assert.ok(
    rows.some(
      (r) => r.event === "model_connection_established" && r.tls === "not_used",
    ),
  );
  assert.ok(
    rows.some(
      (r) =>
        r.event === "model_http_request_headers_sending" &&
        r.connectionUse === "reused",
    ),
  );
});

test("exhausted native SDK retries preserve the last HTTP failure after four attempts", async (t) => {
  const f = await fixture(t, "exhaust");
  await assert.rejects(f.run(), {
    code: "LLM_REQUEST_FAILED",
    message: /HTTP 503/u,
  });
  assert.equal(f.bodies.length, 4);
  assert.equal(f.effects, 0);
  const rows = await f.rows();
  assert.equal(
    rows.filter((r) => r.event === "model_attempt_failed").length,
    4,
  );
  assert.equal(rows.find((r) => r.event === "model_step_failed")?.attempts, 4);
});

for (const mode of ["denied", "partial", "cancel"] as const)
  test(`native retry does not replay ${mode} failures`, async (t) => {
    const f = await fixture(t, mode);
    await assert.rejects(f.run());
    assert.equal(f.bodies.length, mode === "partial" ? 2 : 1);
    assert.equal(f.effects, mode === "partial" ? 1 : 0);
    const rows = await f.rows();
    assert.equal(
      rows.filter((r) => r.event === "model_retry_started").length,
      0,
    );
    if (mode === "cancel")
      assert.ok(rows.some((r) => r.event === "model_step_stopped"));
  });
