import assert from "node:assert/strict";
import * as z from "zod";
import { randomUUID } from "node:crypto";
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
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  cancelAllRuns,
  createEffector,
  initializeProject,
  type JsonValue,
  type RunView,
  type ProjectExecution,
} from "@intloom/kernel";
import { openFileStorage } from "@intloom/kernel/storage/file";
import { openSqliteStorage } from "@intloom/kernel/storage/sqlite";
import { specificationStateSchema } from "../schemas/specification-state.ts";
import { implementationStateSchema } from "../schemas/implementation-state.ts";
import { authoring } from "../src/flow/draft.ts";
import { validationContextSchema } from "../schemas/validation-state.ts";

interface ToolCall {
  id: string;
  input: JsonValue;
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
export const sourcePath = "src/greet.mjs";
export const testPath = "test/greet.test.mjs";
const source = 'export const greet = name => "Hello, " + name + "!";\n';
const readTools = [
  "read_specification",
  "read_solution",
  "read_implementation",
  "read_validation",
];

/** Uses the unmodified compiled four-Stage Workflow, real Tools, project commands and Storage. */
export async function fullFlowFixture(
  t: TestContext,
  backend: "file" | "sqlite",
  repair = false,
) {
  const root = await mkdtemp(join(tmpdir(), "intent-full-flow-"));
  let execution: ProjectExecution | undefined;
  const open = () =>
    backend === "file"
      ? openFileStorage({ directory: join(root, "intloom/artifacts-store") })
      : openSqliteStorage({
          filename: join(root, "intloom/storage.sqlite"),
          projectId: "full-flow",
        });
  const handle = await open();
  const key = "INTLOOM_FULL_FLOW_TEST_KEY";
  const previous = process.env[key];
  // Nested Node test commands must run independently of this runner's IPC context.
  const testContext = process.env.NODE_TEST_CONTEXT;
  delete process.env.NODE_TEST_CONTEXT;
  process.env[key] = "fixture-credential";
  t.after(async () => {
    try {
      if (execution) await cancelAllRuns(execution);
      await handle.dispose();
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
      if (testContext === undefined) delete process.env.NODE_TEST_CONTEXT;
      else process.env.NODE_TEST_CONTEXT = testContext;
      await rm(root, { recursive: true, force: true });
    }
  });
  const packageRoot = fileURLToPath(new URL("../", import.meta.url));
  const manifest = JSON.parse(
    await readFile(join(packageRoot, "package.json"), "utf8"),
  );
  const installation = join(root, ".intloom/workflows/node_modules/@intloom");
  await mkdir(installation, { recursive: true });
  await symlink(packageRoot, join(installation, "workflow-intent"), "dir");
  await mkdir(join(root, "src"));
  await mkdir(join(root, "test"));
  await writeFile(
    join(root, sourcePath),
    "export const greet = name => name;\n",
  );
  await writeFile(
    join(root, testPath),
    `import assert from "node:assert/strict";
import { test } from "node:test";
import { greet } from "../src/greet.mjs";
test("greeting preserves Unicode", () => assert.equal(greet("朋友"), "Hello, 朋友!"));
`,
  );
  await writeFile(
    join(root, "intloom.yaml"),
    `intent: {apps: []}
workflows:
  - name: "@intloom/workflow-intent"
    version: "${manifest.version}"
    sha256: "${"a".repeat(64)}"
llms:
  default:
    provider: openai-compatible
    model: full-flow-test
    secret: ENV.${key}
    baseURL: https://full-flow.invalid/v1
`,
  );
  const reads: { tool: string; state: JsonValue }[] = [];
  function plan(tool: string, value: JsonValue): ToolCall[] {
    reads.push({ tool, state: structuredClone(value) });
    switch (tool) {
      case "read_specification": {
        const { artifactSchema: _schema, ...data } = z
          .record(z.string(), z.json())
          .parse(value);
        const state = specificationStateSchema.loose().parse(data);
        return [
          {
            id: "submit_specification",
            input: {
              changes: [
                {
                  target_ref: "SCON-greeting",
                  reason: "Implement the requested greeting",
                  patch: [
                    {
                      op: "add",
                      path: "",
                      value: {
                        id: "SCON-greeting",
                        status: "active",
                        description:
                          "greet(name) returns Hello, name! and preserves Unicode",
                        record_refs: [],
                      },
                    },
                  ],
                },
              ],
              questions: [],
              processedFeedbackCount: state.feedbacks.length,
            },
          },
        ];
      }
      case "read_solution": {
        const state = z.object({ feedbacks: z.array(z.json()) }).parse(value);
        return [
          {
            id: "submit_solution",
            input: {
              changes: [
                {
                  target_ref: "OCON-greeting",
                  reason:
                    "Keep the existing ESM function and verify its result",
                  patch: [
                    {
                      op: "add",
                      path: "",
                      value: {
                        id: "OCON-greeting",
                        name: "Greeting",
                        status: "active",
                        definition:
                          "An ESM greet function returns Hello, name!",
                        constraint_refs: ["SCON-greeting"],
                        rules: [],
                        record_refs: [],
                      },
                    },
                  ],
                },
              ],
              questions: [],
              processedFeedbackCount: state.feedbacks.length,
              checks: [
                {
                  id: "greeting-tests",
                  purpose:
                    "Assert the requested greeting using real Node tests",
                  command: process.execPath,
                  args: ["--test", testPath],
                },
              ],
            },
          },
        ];
      }
      case "read_implementation": {
        const { submissionContext: _context, ...businessState } = z
          .record(z.string(), z.unknown())
          .parse(value);
        const state = implementationStateSchema.parse(businessState);
        return [
          { id: "read_project_file", input: { path: sourcePath } },
          {
            id: "write_project_file",
            input: {
              path: sourcePath,
              content:
                repair && state.iterations === 0
                  ? 'export const greet = name => "Wrong, " + name + "!";\n'
                  : source,
            },
          },
          {
            id: "submit_implementation",
            input: {
              changes: [
                {
                  paths: [{ path: sourcePath }],
                  description: "Implement the confirmed greeting",
                  origin_refs: ["SCON-greeting", "OCON-greeting"],
                },
              ],
              processedFeedbackCount: state.feedbacks.length,
            },
          },
        ];
      }
      case "read_validation": {
        const state = validationContextSchema.parse(value);
        assert.ok(state.scope);
        assert.equal(state.commandResults[0]?.exitCode, 0);
        const checks = (targets: typeof state.scope.specification) =>
          targets.map((target) => ({
            target,
            evidences: [
              {
                id: `VEVD-${target.ref}`,
                method: "test" as const,
                code_path: [{ path: testPath, lines: [4] }],
                target_ref: target.ref,
                result: "fullfill" as const,
                checkId: "greeting-tests",
              },
            ],
            result: {
              status: "verified" as const,
              reason:
                "The real host test asserts the greeting and Unicode preservation",
            },
          }));
        const proposal = {
          specification_checks: checks(state.scope.specification),
          solution_checks: checks(state.scope.solution),
          tests_checks: [
            {
              test_code_ref: {
                id: "VTCD-greeting",
                path: testPath,
                lineStart: 4,
                lineEnd: 4,
              },
              ttarget_refs: ["SCON-greeting", "OCON-greeting"],
              status: "passed",
              checkId: "greeting-tests",
            },
          ],
          findings: [],
          code_issues: [],
        };
        return [{ id: "submit_validation", input: proposal }];
      }
      default:
        throw new Error(`Unexpected full-flow read Tool: ${tool}`);
    }
  }
  function calls(tool: string, value: JsonValue) {
    const view = z.record(z.string(), z.json()).parse(value);
    return plan(tool, value).flatMap((call) => {
      if (!["submit_specification", "submit_solution"].includes(call.id))
        return [call];
      const input = z.record(z.string(), z.json()).parse(call.input);
      const changes = z
        .array(
          z.object({
            reason: z.string(),
            patch: z.array(z.object({ value: z.json() })),
          }),
        )
        .parse(input.changes);
      const {
        changes: _changes,
        processedFeedbackCount: _count,
        ...rest
      } = input;
      return [
        {
          id: call.id.replace("submit_", "edit_"),
          input: {
            draftRevision: z.string().parse(view.draftRevision),
            edits: changes.map((c) => ({
              reason: c.reason,
              value: z.json().parse(authoring(c.patch[0]?.value)),
            })),
          },
        },
        {
          id: call.id,
          input: {
            ...rest,
            draftRevision: z.string().parse(view.draftRevision),
          },
        },
      ];
    });
  }
  let sequence = 0;
  const queues = new Map<string, ToolCall[]>();
  const modelRequests: Message[][] = [];
  function toolMessage(call: ToolCall, rest: ToolCall[]): Message {
    const id = `full-flow-${++sequence}`;
    queues.set(id, rest);
    return {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id,
          type: "function",
          function: { name: call.id, arguments: JSON.stringify(call.input) },
        },
      ],
    };
  }
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(
        String(input),
        "https://full-flow.invalid/v1/chat/completions",
      );
      const request = JSON.parse(String(init?.body)) as {
        messages: Message[];
        tools: { function: { name: string } }[];
        stream: boolean;
      };
      assert.equal(request.stream, true);
      modelRequests.push(request.messages);
      const last = request.messages.at(-1);
      let message: Message;
      if (last?.role !== "tool") {
        const tool = request.tools.find((tool) =>
          readTools.includes(tool.function.name),
        );
        assert.ok(tool);
        message = toolMessage({ id: tool.function.name, input: {} }, []);
      } else {
        const call = request.messages
          .flatMap((item) => item.tool_calls ?? [])
          .find((call) => call.id === last.tool_call_id);
        assert.ok(call);
        const result = JSON.parse(last.content ?? "null") as JsonValue;
        const next = readTools.includes(call.function.name)
          ? calls(call.function.name, result)
          : queues.get(call.id);
        assert.ok(next);
        queues.delete(call.id);
        const first = next[0];
        if (
          call.function.name.startsWith("edit_") &&
          first &&
          typeof result === "object" &&
          result &&
          "draftRevision" in result
        )
          first.input = {
            ...z.record(z.string(), z.json()).parse(first.input),
            draftRevision: result.draftRevision as string,
          };
        if (first) message = toolMessage(first, next.slice(1));
        else {
          assert.deepEqual(result, { saved: true });
          message = { role: "assistant", content: '{"outcome":"ready"}' };
        }
      }
      const id = `chatcmpl-${++sequence}`;
      const frames = [
        {
          id,
          object: "chat.completion.chunk",
          created: 0,
          model: "full-flow-test",
          choices: [
            {
              index: 0,
              delta: {
                ...message,
                ...(message.tool_calls
                  ? {
                      tool_calls: message.tool_calls.map((call, index) => ({
                        ...call,
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
          id,
          object: "chat.completion.chunk",
          created: 0,
          model: "full-flow-test",
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: message.tool_calls ? "tool_calls" : "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
      ];
      return new Response(
        frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("") +
          "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  );
  execution = await initializeProject(root, {
    storage: handle.access,
    effector: createEffector(),
  });
  const runtime = execution.runtime;
  const blueprint = execution.registries.blueprints.intent;
  assert.ok(blueprint);
  assert.equal(blueprint.exclusive, true);
  assert.deepEqual(Object.keys(blueprint.stages), [
    "specification",
    "solution",
    "implementation",
    "validation",
  ]);
  async function stable(runId: string) {
    const deadline = Date.now() + 10_000;
    let view = await runtime.getRun(runId);
    while (view.status === "running" && Date.now() < deadline) {
      await delay(5);
      view = await runtime.getRun(runId);
    }
    assert.notEqual(view.status, "running", `Run did not settle: ${runId}`);
    return view;
  }
  async function completeClientAgent(view: RunView) {
    assert.ok(view.pendingAgentCall);
    const ref = { runId: view.runId, callId: view.pendingAgentCall.id };
    const { task, ownerToken } = await runtime.claimAgentCall({
      ...ref,
      claimId: randomUUID(),
    });
    const owner = { ...ref, ownerToken };
    const read = task.tools.find((tool) => readTools.includes(tool.id));
    assert.ok(read);
    const call = (tool: ToolCall) =>
      runtime.callAgentTool({
        ...owner,
        toolId: tool.id,
        toolCallId: randomUUID(),
        input: tool.input,
      });
    const context = await call({ id: read.id, input: {} });
    let revision = z.record(z.string(), z.json()).parse(context).draftRevision;
    for (const tool of calls(read.id, context)) {
      if (
        tool.id.startsWith("submit_") &&
        ["submit_specification", "submit_solution"].includes(tool.id)
      )
        tool.input = {
          ...z.record(z.string(), z.json()).parse(tool.input),
          draftRevision: z.string().parse(revision),
        };
      const result = await call(tool);
      if (tool.id.startsWith("edit_"))
        revision = z.record(z.string(), z.json()).parse(result).draftRevision;
    }
    await runtime.completeAgentCall({
      ...owner,
      result: { outcome: "ready" },
    });
    return stable(view.runId);
  }
  return {
    root,
    execution,
    handle,
    open,
    reads,
    modelRequests,
    completeClientAgent,
    stable,
  };
}
