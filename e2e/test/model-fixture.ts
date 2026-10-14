import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { TestContext } from "node:test";
import type { Entry } from "../runner/contracts.ts";

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
  tool_choice?: string | { type: string; function?: { name: string } };
  model: string;
  messages: Message[];
  tools: {
    function: {
      name: string;
      parameters?: { type?: string; required?: string[] };
    };
  }[];
  stream: boolean;
}
interface Call {
  id: string;
  input: unknown;
}
const readTools = [
  "read_specification",
  "read_solution",
  "read_implementation",
  "read_validation",
];
const sourcePath = "src/greet.mjs",
  testPath = "test/greet.test.mjs";
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as ObjectValue;
}
function findRun(value: unknown): ObjectValue | undefined {
  if (value && typeof value === "object") {
    const item = object(value);
    if (typeof item.runId === "string") return item;
    for (const part of Object.values(item)) {
      if (part && typeof part === "object" && !Array.isArray(part)) {
        const found = findRun(part);
        if (found) return found;
      }
    }
  }
  return undefined;
}

/** Controlled model transport only; actual CLI, package, host, Tools, files and checks execute. */
export async function modelFixture(
  t: TestContext,
  entry: Entry,
  truncateWorker = false,
  invalidAnswers: "none" | "once" | "always" = "none",
  failedService = false,
  probeClosedTool = false,
  invalidValidation = false,
  invalidCompletion = false,
) {
  let sequence = 0,
    setupIndex = 0;
  let runId: string | undefined;
  const failures: string[] = [];
  const models = new Set<string>();
  let questionAttempts = 0;
  let userRequests = 0;
  const runningObservations: string[] = [];
  let pendingAction: ObjectValue | undefined;
  const queues = new Map<string, { rest: Call[]; outcome: string }>();
  let currentIntent = "";
  let completionAttempts = 0;
  let closedProbeOutcome: string | undefined;
  let closedProbeInjected = false;
  const toolMessage = (
    call: Call,
    rest: Call[] = [],
    outcome = "ready",
  ): Message => {
    const id = `fixture-call-${++sequence}`;
    queues.set(id, { rest, outcome });
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
  };
  function user(request: Request): Message {
    assert.equal(request.tool_choice, "required");
    const completion = request.tools.find((tool) =>
      tool.function.name.startsWith("e2e_complete_task"),
    );
    assert.ok(
      completion,
      "Simulated users require a typed round completion Tool",
    );
    assert.equal(completion.function.parameters?.type, "object");
    assert.ok(completion.function.parameters?.required?.includes("status"));
    if (entry === "mcp") {
      const admission = request.tools.find(
        (tool) => tool.function.name === "mcp_flow",
      );
      assert.equal(admission?.function.parameters?.type, "object");
      assert.ok(admission?.function.parameters?.required?.includes("intent"));
      assert.ok(admission?.function.parameters?.required?.includes("flowName"));
    }
    const prompt = JSON.parse(
      request.messages.find((message) => message.role === "user")?.content ??
        "null",
    ) as {
      workflowArchive: string;
      flowName: string;
      intent: string;
      knowledge: string;
      mcpTools?: { name: string; inputSchema: { required?: string[] } }[];
      iteration: { initializeProject: boolean };
    };
    if (entry === "mcp" && !prompt.iteration.initializeProject) {
      const admission = prompt.mcpTools?.find((tool) => tool.name === "flow");
      assert.ok(admission?.inputSchema.required?.includes("intent"));
      assert.ok(admission?.inputSchema.required?.includes("flowName"));
      assert.ok(
        !prompt.mcpTools?.some((tool) => tool.name === "claim_agent_call"),
      );
    }
    if (currentIntent !== prompt.intent) {
      currentIntent = prompt.intent;
      setupIndex = 0;
      runId = undefined;
      pendingAction = undefined;
    }
    const setup: Call[] = [
      ...(prompt.iteration.initializeProject
        ? [
            { id: "intloom_command", input: { args: ["init"] } },
            { id: "seed_workspace", input: {} },
            {
              id: "intloom_command",
              input: { args: ["workflow", "add", prompt.workflowArchive] },
            },
            { id: "configure_project", input: {} },
            { id: "intloom_command", input: { args: ["start"] } },
            {
              id: "intloom_command",
              input: {
                args: [
                  "doctor",
                  "--execution",
                  entry === "cmd" ? "cli" : "agent_ide",
                ],
              },
            },
            { id: "intloom_command", input: { args: ["flows"] } },
          ]
        : []),
      ...(entry === "mcp"
        ? [
            ...(prompt.iteration.initializeProject
              ? [{ id: "connect_mcp", input: {} }]
              : []),
            {
              id: "mcp_flow",
              input: {
                flowName: prompt.flowName,
                intent: prompt.intent,
              },
            },
          ]
        : [
            {
              id: "intloom_command",
              input: {
                args: ["flow", prompt.flowName, "--intent", prompt.intent],
              },
            },
          ]),
    ];
    if (setupIndex < setup.length)
      return toolMessage(setup[setupIndex++] as Call);
    const value = JSON.parse(request.messages.at(-1)?.content ?? "null");
    const run = findRun(value);
    if (run) runId = String(run.runId);
    assert.ok(runId, "The real admission must return a Run ID");
    if (run && ["completed", "failed", "paused"].includes(String(run.status)))
      return failedService
        ? {
            role: "assistant",
            content: "The Run failed; no final decision was produced.",
          }
        : toolMessage({
            id: completion.function.name,
            input: { status: "finished" },
          });
    const previousCall = request.messages.findLast(
      (message) => message.tool_calls?.length,
    )?.tool_calls?.[0];
    const previousName = previousCall?.function.name;
    if (previousName === "observe_run" && run?.status === "running")
      runningObservations.push(String(run.runId));
    if (
      previousName === "submit_questions" ||
      previousName === "submit_confirmation"
    ) {
      const response = object(value);
      if (response.code === 0 || response.isError === false)
        pendingAction = undefined;
    }
    if (run)
      pendingAction = run.pendingAction ? object(run.pendingAction) : undefined;
    if (run?.status !== "running" && pendingAction) {
      const action = pendingAction;
      const isConfirmation = action.kind === "user_ask_confirmation";
      const answer = isConfirmation
        ? { isConfirmed: true }
        : (action.request as ObjectValue[]).map((item) => ({
            questionId: item.id,
            isSkipped: false,
            answer:
              prompt.knowledge.match(/Greeting format: ([^\n]+)/u)?.[1] ??
              "Hello, name!",
          }));
      if (!isConfirmation) questionAttempts++;
      const invalid =
        !isConfirmation &&
        (invalidAnswers === "always" ||
          (invalidAnswers === "once" && questionAttempts === 1));
      return toolMessage({
        id: isConfirmation ? "submit_confirmation" : "submit_questions",
        input: {
          runId,
          actionId: action.id,
          ...(isConfirmation
            ? { isConfirmed: true }
            : { answers: invalid ? JSON.stringify(answer) : answer }),
          knowledgeRefs: ["K01"],
          decision:
            "The actual prompt is answered from the case's greeting constraint.",
        },
      });
    }
    if (run?.pendingAgentCall)
      return toolMessage({
        id: "execute_agent_call",
        input: { runId, callId: object(run.pendingAgentCall).id },
      });
    return toolMessage({ id: "observe_run", input: { runId } });
  }
  function plan(
    name: string,
    value: unknown,
  ): { calls: Call[]; outcome: string } {
    const state = object(value);
    const processedFeedbackCount =
      (state.feedbacks as unknown[] | undefined)?.length ?? 0;
    if (name === "read_specification") {
      const answered =
        (state.questions as ObjectValue[])[0]?.answer !== undefined;
      return {
        outcome: answered ? "ready" : "clarification_required",
        calls: [
          {
            id: "submit_specification",
            input: {
              changes: [
                {
                  target_ref: "SCON-greeting",
                  reason: "Use the known greeting format",
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
              questions: [
                {
                  id: "QST-1",
                  question: "What greeting format should be used?",
                  isBlock: true,
                },
              ],
              processedFeedbackCount,
            },
          },
        ],
      };
    }
    if (name === "read_solution")
      return {
        outcome: "ready",
        calls: [
          {
            id: "submit_solution",
            input: {
              changes: [
                {
                  target_ref: "OCON-greeting",
                  reason: "Keep the ESM function",
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
              processedFeedbackCount,
              checks: [
                {
                  id: "greeting-tests",
                  purpose: "Run real Node tests",
                  command: process.execPath,
                  args: ["--test", testPath],
                },
              ],
            },
          },
        ],
      };
    if (name === "read_implementation")
      return {
        outcome: "ready",
        calls: [
          { id: "read_project_file", input: { path: sourcePath } },
          {
            id: "write_project_file",
            input: {
              path: sourcePath,
              content: 'export const greet = name => "Hello, " + name + "!";\n',
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
              processedFeedbackCount,
            },
          },
        ],
      };
    assert.equal(name, "read_validation");
    const scope = object(state.scope);
    const checks = (targets: ObjectValue[]) =>
      targets.map((target) => ({
        target,
        evidences: [
          {
            id: `VEVD-${target.ref}`,
            method: "test",
            code_path: [{ path: testPath, lines: [4] }],
            target_ref: target.ref,
            result: "fullfill",
            checkId: "greeting-tests",
          },
        ],
        result: {
          status: "verified",
          reason: "The host executed the real greeting test",
        },
      }));
    return {
      outcome: "ready",
      calls: [
        {
          id: "submit_validation",
          input: {
            specification_checks: checks(scope.specification as ObjectValue[]),
            solution_checks: checks(scope.solution as ObjectValue[]),
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
          },
        },
      ],
    };
  }
  function complete(request: Request, outcome: string): Message {
    completionAttempts++;
    const hostCompletion = request.tools?.find((tool) =>
      tool.function.name.startsWith("intloom_complete_step"),
    )?.function.name;
    if (hostCompletion)
      return toolMessage({ id: hostCompletion, input: { outcome } });
    if (entry === "mcp") {
      const name = request.tools?.find((tool) =>
        tool.function.name.startsWith("e2e_complete_task"),
      )?.function.name;
      assert.ok(name);
      return toolMessage({
        id: name,
        input: { outcome: invalidCompletion ? "invented" : outcome },
      });
    }
    return { role: "assistant", content: JSON.stringify({ outcome }) };
  }
  function worker(request: Request): Message {
    const completion = request.tools?.find((tool) =>
      tool.function.name.startsWith("e2e_complete_task"),
    );
    if (entry === "mcp") {
      assert.equal(request.tool_choice, "required");
      assert.ok(
        completion?.function.parameters?.required?.includes("outcome"),
        "MCP completion must use the host output schema",
      );
    } else
      assert.ok(
        request.messages.some((message) =>
          message.content?.includes(
            "You MUST answer with a JSON object that matches the JSON schema above.",
          ),
        ),
        "Service workers must receive SDK schema injection",
      );
    const last = request.messages.at(-1);
    if (closedProbeOutcome && last?.role === "tool") {
      assert.ok(
        last.content?.includes("This Agent has saved its final submission"),
        "Host termination feedback must reach the worker without a generic replacement",
      );
      const outcome = closedProbeOutcome;
      closedProbeOutcome = undefined;
      return complete(request, outcome);
    }
    if (last?.role !== "tool") {
      const name = request.tools?.find(
        (tool) =>
          readTools.includes(tool.function.name) ||
          tool.function.name === "read_probe",
      )?.function.name;
      assert.ok(name);
      return toolMessage({ id: name, input: {} });
    }
    const call = request.messages
      .flatMap((message) => message.tool_calls ?? [])
      .find((call) => call.id === last.tool_call_id);
    assert.ok(call);
    const value = JSON.parse(last.content ?? "null");
    if (
      invalidValidation &&
      call.function.name === "submit_validation" &&
      value.saved === false
    )
      return toolMessage({
        id: "submit_validation",
        input: JSON.parse(call.function.arguments),
      });
    const next =
      call.function.name === "read_probe"
        ? {
            rest: [
              {
                id: "submit_probe",
                input: {
                  summary: "Local scope",
                  question: "Confirm the authorized scope?",
                },
              },
            ],
            outcome: "complete",
          }
        : readTools.includes(call.function.name)
          ? (() => {
              const result = plan(call.function.name, value);
              result.calls = result.calls.flatMap((item) => {
                if (
                  !["submit_specification", "submit_solution"].includes(item.id)
                )
                  return [item];
                const input = object(item.input);
                const edits = (input.changes as ObjectValue[]).map((change) => {
                  const value = {
                    ...object((change.patch as ObjectValue[])[0]?.value),
                  };
                  delete value.record_refs;
                  return { reason: change.reason, value };
                });
                const {
                  changes: _changes,
                  processedFeedbackCount: _count,
                  ...rest
                } = input;
                return [
                  {
                    id: item.id.replace("submit_", "edit_"),
                    input: { draftRevision: value.draftRevision, edits },
                  },
                  {
                    id: item.id,
                    input: { ...rest, draftRevision: value.draftRevision },
                  },
                ];
              });
              if (
                invalidValidation &&
                call.function.name === "read_validation"
              ) {
                const submission = result.calls.find(
                  (call) => call.id === "submit_validation",
                );
                assert.ok(submission);
                const checks = object(submission.input)
                  .specification_checks as ObjectValue[];
                const evidences = checks[0]?.evidences as ObjectValue[];
                const paths = evidences[0]?.code_path as ObjectValue[];
                assert.ok(paths[0]);
                paths[0].lines = [50000];
              }
              return { rest: result.calls, outcome: result.outcome };
            })()
          : queues.get(call.id);
    assert.ok(next);
    queues.delete(call.id);
    if (call.function.name.startsWith("edit_") && next.rest[0])
      next.rest[0].input = {
        ...object(next.rest[0].input),
        draftRevision: value.draftRevision,
      };
    if (next.rest[0])
      return toolMessage(next.rest[0], next.rest.slice(1), next.outcome);
    assert.deepEqual(value, { saved: true });
    if (
      probeClosedTool &&
      !closedProbeInjected &&
      call.function.name === "submit_specification"
    ) {
      closedProbeInjected = true;
      closedProbeOutcome = next.outcome;
      return toolMessage({ id: "read_specification", input: {} });
    }
    return complete(request, next.outcome);
  }
  const server = createServer((req, res) => {
    void (async () => {
      assert.equal(
        req.headers.authorization,
        "Bearer fixture-private-credential",
      );
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const request = JSON.parse(
        Buffer.concat(chunks).toString("utf8"),
      ) as Request;
      assert.equal(request.stream, true);
      assert.match(String(req.headers["user-agent"]), /intloom/u);
      if (entry === "mcp" || request.model === "user")
        assert.match(
          String(req.headers["x-opencode-session"]),
          /^[a-f0-9]{64}$/u,
        );
      models.add(request.model);
      if (failedService && request.model === "system") {
        res.writeHead(410, { "content-type": "application/json" }).end(
          JSON.stringify({
            error: { message: "Fixture model endpoint unavailable." },
          }),
        );
        return;
      }
      if (request.model === "user") userRequests++;
      const message =
        request.model === "user" ? user(request) : worker(request);
      const completion = message.tool_calls?.some((call) =>
        call.function.name.startsWith("e2e_complete_task"),
      );
      const truncate = truncateWorker && request.model !== "user" && completion;
      const id = `fixture-response-${++sequence}`;
      const frames = [
        {
          id,
          object: "chat.completion.chunk",
          created: 0,
          model: request.model,
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
          model: request.model,
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
    })().catch((cause: unknown) => {
      failures.push(cause instanceof Error ? cause.message : String(cause));
      res.writeHead(500).end("Controlled model fixture failed.");
    });
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
  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    failures,
    models,
    get userRequests() {
      return userRequests;
    },
    get completionAttempts() {
      return completionAttempts;
    },
    runningObservations,
  };
}
