import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TestContext } from "node:test";
import { stringify } from "yaml";
import * as z from "zod";
import { loomProtocolVersion } from "@intloom/loom-sdk";
import { runSchema, type Run } from "../src/e2e/contracts.ts";

export async function createProbe(root: string, baseURL: string, rounds = 2) {
  await mkdir(join(root, "dist"), { recursive: true });
  await symlink(
    fileURLToPath(new URL("../node_modules", import.meta.url)),
    join(root, "node_modules"),
  );
  const manifest = {
    name: "e2e-local-probe",
    version: "1.0.0",
    type: "module",
    dependencies: { zod: "^4.6.5" },
    loom: { type: "loom", version: loomProtocolVersion },
    exports: {
      ".": { types: "./loom.d.ts", default: "./loom.mjs" },
      "./package.json": "./package.json",
    },
    files: ["**/*"],
  };
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await writeFile(join(root, "dist/package.json"), JSON.stringify(manifest));
  await writeFile(
    join(root, "dist/loom.mjs"),
    await readFile(new URL("./fixtures/e2e/loom.mjs", import.meta.url)),
  );
  await writeFile(
    join(root, "dist/loom.d.ts"),
    "export const blueprint: unknown; export const codes: unknown; export const agentSpecs: unknown;\n",
  );
  const caseRoot = join(root, "e2e/cases/Alpha");
  await mkdir(join(caseRoot, "workspace/assets"), { recursive: true });
  await writeFile(
    join(caseRoot, "workspace/assets/example.txt"),
    "fixture input",
  );
  await writeFile(
    join(caseRoot, "knowledge.md"),
    "## K01\nUSER_ONLY_KNOWLEDGE. Confirm the probe result and answer scope questions with local testing.\n",
  );
  await writeFile(
    join(caseRoot, "later.md"),
    "## K02\nFUTURE_ONLY_KNOWLEDGE\n",
  );
  await writeFile(
    join(caseRoot, "case.yaml"),
    stringify({
      id: "Alpha",
      name: "Generic repeated Loom",
      rounds: Array.from({ length: rounds }, (_, i) => ({
        id: `round-${i + 1}`,
        input: {
          prompt: `Probe round ${i + 1}`,
          files: ["assets/example.txt"],
          dirs: ["assets"],
          urls: ["https://example.invalid/input"],
        },
        ...(i ? { knowledge: "later.md" } : {}),
      })),
    }),
  );
  const model = {
    provider: "openai-compatible",
    model: "user",
    secret: "ENV.PROBE_API_KEY",
    baseURL,
  };
  await writeFile(
    join(root, "e2e/config.yaml"),
    stringify({
      version: 1,
      models: {
        user: model,
        worker: { ...model, model: "worker" },
        service: { default: { ...model, model: "service" } },
      },
      limits: {
        maxDurationMs: 60000,
        maxUserSteps: 20,
        maxAgentSteps: 10,
        commandTimeoutMs: 30000,
      },
      checks: ["check.mjs"],
    }),
  );
  await writeFile(
    join(root, "e2e/check.mjs"),
    `import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const c=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.equal(c.run.loomName,'iteration-probe');
assert.equal(c.results.records.length,1);assert.equal(c.results.artifacts.length,1);
const data=c.results.records[0].data;
assert.equal(data.readCount,1);assert.equal(data.isConfirmed,true);
assert.deepEqual(data.input,c.round.input);
assert.equal(await readFile(data.input.files[0],'utf8'),'fixture input');
assert.equal(c.previousRounds.length,c.round.index-1);
assert.deepEqual(c.previousRecords,c.previousRounds.flatMap(r=>r.results.records));
console.log('Generic case checks passed');\n`,
  );
  return root;
}

interface Message {
  role: string;
  content?: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }[];
}
interface Request {
  model: string;
  messages: Message[];
  tools: { function: { name: string } }[];
}
function findRun(value: unknown): Run | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.runId === "string" && typeof item.status === "string")
    return runSchema.parse(item);
  for (const part of Object.values(item)) {
    const found = findRun(part);
    if (found) return found;
  }
  return undefined;
}
export async function controlledModel(
  t: TestContext,
  mode: "normal" | "early_finish" | "worker_truncated" = "normal",
) {
  const failures: string[] = [],
    models = new Set<string>();
  let sequence = 0;
  const call = (name: string, input: unknown): Message => ({
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: `call-${++sequence}`,
        type: "function",
        function: { name, arguments: JSON.stringify(input) },
      },
    ],
  });
  const server = createServer((req, res) => {
    void (async () => {
      assert.equal(req.headers.authorization, "Bearer probe-private-key");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const request: Request = JSON.parse(Buffer.concat(chunks).toString());
      models.add(request.model);
      const last = request.messages.findLast((m) => m.role === "tool");
      const previous = request.messages
        .flatMap((m) => m.tool_calls ?? [])
        .find((c) => c.id === last?.tool_call_id)?.function.name;
      const completion = request.tools.find((t) =>
        /^(?:e2e_complete_task|intloom_complete_step)/u.test(t.function.name),
      )?.function.name;
      let message: Message;
      if (request.model === "user") {
        const content = request.messages.find(
          (m) => m.role === "user",
        )?.content;
        assert.ok(content);
        const prompt = JSON.parse(content);
        if (prompt.roundId === "round-1")
          assert.ok(!prompt.knowledge.includes("FUTURE_ONLY_KNOWLEDGE"));
        assert.ok(completion);
        const run = last?.content
          ? findRun(JSON.parse(last.content))
          : undefined;
        if (mode === "early_finish")
          message = call(completion, { status: "finished" });
        else if (!last) message = call("start_run", {});
        else if (run?.pendingAction) {
          const action = run.pendingAction;
          const questions =
            action.kind === "user_ask_questions"
              ? z.array(z.object({ id: z.string() })).parse(action.request)
              : [];
          message = call(
            action.kind === "user_ask_questions"
              ? "submit_questions"
              : "submit_confirmation",
            {
              runId: run.runId,
              actionId: action.id,
              knowledgeRefs: ["K01"],
              decision: "Authorized probe scope.",
              ...(action.kind === "user_ask_questions"
                ? {
                    answers: questions.map((q) => ({
                      questionId: q.id,
                      isSkipped: false,
                      answer: "Local testing.",
                    })),
                  }
                : { isConfirmed: true }),
            },
          );
        } else if (run?.status === "completed" && run.settled)
          message = call(completion, { status: "finished" });
        else message = call("observe_run", {});
      } else {
        assert.ok(
          !JSON.stringify(request.messages).includes("USER_ONLY_KNOWLEDGE"),
        );
        if (!last) message = call("read_probe", {});
        else if (previous === "read_probe")
          message = call("submit_probe", {
            summary: "Run the local probe",
            question: "What is the scope?",
          });
        else
          message = completion
            ? call(completion, { outcome: "complete" })
            : { role: "assistant", content: '{"outcome":"complete"}' };
      }
      const truncate =
        mode === "worker_truncated" &&
        request.model === "worker" &&
        previous === "submit_probe";
      const base = {
        id: `response-${++sequence}`,
        object: "chat.completion.chunk",
        created: 0,
        model: request.model,
      };
      const frames = [
        {
          ...base,
          choices: [
            {
              index: 0,
              delta: {
                ...message,
                ...(message.tool_calls
                  ? {
                      tool_calls: message.tool_calls.map((c, index) => ({
                        ...c,
                        index,
                      })),
                    }
                  : {}),
              },
              finish_reason: null,
            },
          ],
        },
        {
          ...base,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: truncate
                ? "length"
                : message.tool_calls
                  ? "tool_calls"
                  : "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
      ];
      res
        .writeHead(200, { "content-type": "text/event-stream" })
        .end(
          frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("") +
            "data: [DONE]\n\n",
        );
    })().catch((cause) => {
      failures.push(String(cause));
      res.writeHead(500).end("Controlled fixture failed");
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { baseURL: `http://127.0.0.1:${address.port}/v1`, failures, models };
}
