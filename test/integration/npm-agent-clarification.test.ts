import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildPackage } from "../../packages/compiler/dist/index.js";
import { serve } from "../../packages/kernel/dist/index.js";
import type { ArtifactRef } from "../../packages/loom-sdk/dist/index.js";

test("a pure Agent continues from a durable question with its earlier tool receipt and original task", async (t) => {
  const root = fileURLToPath(new URL("../../", import.meta.url)),
    dir = await mkdtemp(join(tmpdir(), "intloom-question-"));
  const data = join(dir, "data"),
    modules = join(dir, "installed"),
    exec = promisify(execFile);
  await Promise.all([data, modules].map((d) => mkdir(d)));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const completions: string[] = [];
  const server = createServer(async (req, res) => {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const body = JSON.parse(Buffer.concat(buffers).toString());
    const task = body.messages.find((m: { role: string }) => m.role === "user")
      .content as string;
    const resumed = task.includes("GREEN");
    if (resumed) assert.match(task, /blue-receipt/);
    const haveReceipt = body.messages.some(
      (m: { role: string }) => m.role === "tool",
    );
    const name = resumed ? "writeReport" : haveReceipt ? "askUser" : "measure";
    const args = resumed
      ? { message: "GREEN" }
      : haveReceipt
        ? { question: "Which label?" }
        : {};
    completions.push(name);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: `fixture-${completions.length}`,
        object: "chat.completion",
        created: 1,
        model: "qwen3.8-flash",
        choices: [
          {
            index: 0,
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: `call-${completions.length}`,
                  type: "function",
                  function: { name, arguments: JSON.stringify(args) },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  await writeFile(
    join(data, "intloom.yaml"),
    JSON.stringify({
      version: 1,
      harness: "mastra",
      models: {
        live: {
          provider: "alibaba",
          model: "qwen3.8-flash",
          credentialRef: "env:FIXTURE_KEY",
          options: {
            baseUrl:
              "http://127.0.0.1:" +
              (server.address() as AddressInfo).port +
              "/v1",
            api: "chat",
          },
        },
      },
      profiles: { default: "live" },
    }),
  );
  await writeFile(join(data, ".env"), "FIXTURE_KEY=test-only\n");
  const archive = await buildPackage(
    join(root, "test/integration/fixtures/clarification"),
    dir,
  );
  await exec(
    "npm",
    ["install", "--prefix", modules, "--no-audit", "--no-fund", archive],
    { env: { ...process.env, npm_config_cache: join(dir, "cache") } },
  );
  let host = await serve({ dataDir: data });
  t.after(() => host.close());
  const loom = await host.installLoom({
    source: join(modules, "node_modules/test-clarify/commands/write"),
    installedDirectory: true,
  });
  const created = await host.createRun({
    loom,
    input: { message: "Mark the measured sample" },
  });
  const wait = async (expected: string) => {
    for (let i = 0; i < 300; i++) {
      const run = await host.getRun(created.id);
      if (run.status === expected) return run;
      if (run.status === "failed") assert.fail(JSON.stringify(run.error));
      await delay(20);
    }
    throw Error(`Timed out waiting for ${expected}`);
  };
  await host.startRun(created.id);
  const pending = await wait("waiting");
  await host.close();
  host = await serve({ dataDir: data });
  assert.equal((await host.getRun(created.id)).status, "waiting");
  const [requestId] = pending.pendingInteractionIds;
  assert.ok(requestId);
  await host.respondInteraction(
    requestId,
    { action: "submit", value: "GREEN" },
    { source: { kind: "agent", via: "api" } },
  );
  const done = await wait("succeeded");
  assert.deepEqual(completions, ["measure", "askUser", "writeReport"]);
  const ref = done.output as ArtifactRef;
  assert.equal(ref.runId, created.id);
  assert.equal(
    Buffer.from(
      (await host.readArtifact({ artifactId: ref.id })).data,
    ).toString(),
    "GREEN\n",
  );
});
