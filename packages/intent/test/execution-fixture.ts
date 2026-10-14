import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import {
  createEffector,
  initializeProject,
  cancelAllRuns,
  type CodeExecutionAccess,
  type ExecutableCode,
  type JsonValue,
  type ProjectExecution,
  type StepResult,
  type RunView,
  type StorageAccess,
} from "@intloom/kernel";
import { openFileStorage } from "@intloom/kernel/storage/file";
import { openSqliteStorage } from "@intloom/kernel/storage/sqlite";
import type {
  SpecificationProposal,
  SpecificationState,
} from "../schemas/specification-state.ts";

import { applyChanges, emptyArtifact } from "../src/specification/changes.ts";
import { authoring } from "../src/flow/draft.ts";
import { objects } from "../src/flow/shared.ts";

export type Backend = "file" | "sqlite";
export interface Decision {
  readonly proposal: SpecificationProposal;
  readonly outcome: string;
}
interface CodeCall {
  readonly name: string;
  readonly access: CodeExecutionAccess<JsonValue>;
  proceed(access?: CodeExecutionAccess<JsonValue>): Promise<StepResult>;
}
interface ExecutionOptions {
  readonly recovery?: boolean;
  decide(
    state: SpecificationState,
    iteration: number,
  ): Decision | Promise<Decision>;
  code?(call: CodeCall): Promise<StepResult>;
  storage?(access: StorageAccess): StorageAccess;
}
interface Message {
  readonly role: string;
  readonly content?: string | null;
  readonly tool_call_id?: string;
  readonly tool_calls?: readonly {
    readonly id: string;
    readonly type: "function";
    readonly function: { readonly name: string; readonly arguments: string };
  }[];
}

/** Uses actual projects and package entries; only model transport and user answers are controlled, with business Tools and Runtime unchanged. */
export async function executionFixture(
  t: TestContext,
  backend: Backend,
  options: ExecutionOptions,
) {
  const root = await mkdtemp(join(tmpdir(), "intent-execution-"));
  let execution: ProjectExecution | undefined;
  const open = () =>
    backend === "file"
      ? openFileStorage({ directory: join(root, "storage") })
      : openSqliteStorage({
          filename: join(root, "storage.sqlite"),
          projectId: "intent-test",
        });
  const handle = await open();
  const previous = process.env.INTLOOM_INTENT_INTEGRATION_KEY;
  process.env.INTLOOM_INTENT_INTEGRATION_KEY = "fixture-credential";
  t.after(async () => {
    try {
      if (execution) await cancelAllRuns(execution);
      await handle.dispose();
    } finally {
      if (previous === undefined)
        delete process.env.INTLOOM_INTENT_INTEGRATION_KEY;
      else process.env.INTLOOM_INTENT_INTEGRATION_KEY = previous;
      await rm(root, { recursive: true, force: true });
    }
  });
  const installation = join(root, ".intloom/workflows");
  await mkdir(join(installation, "node_modules/@intloom"), { recursive: true });
  const fixturePackage = join(
    installation,
    "node_modules/@intloom/workflow-intent",
  );
  await mkdir(fixturePackage);
  await writeFile(
    join(fixturePackage, "package.json"),
    JSON.stringify({
      name: "@intloom/workflow-intent",
      version: "0.0.1",
      type: "module",
      intloom: { type: "workflow", version: "2026-10-08" },
      exports: {
        ".": { types: "./index.d.ts", default: "./index.js" },
        "./package.json": "./package.json",
      },
    }),
  );
  await writeFile(
    join(fixturePackage, "index.d.ts"),
    'export { blueprint, codes, agentSpecs } from "@intloom/workflow-intent";\n',
  );
  await cp(
    new URL("../dist/skills", import.meta.url),
    join(fixturePackage, "skills"),
    { recursive: true },
  );
  await writeFile(
    join(fixturePackage, "index.js"),
    `import {blueprint as full,codes,agentSpecs as agents} from ${JSON.stringify(new URL("../dist/workflow.generated.js", import.meta.url).href)};
export const blueprint={flowName:full.flowName,entryStageName:"specification",stages:{specification:{...full.stages.specification,on:{complete:{kind:"workflow_end"}}}}};
const ids=Object.values(full.stages.specification.steps).filter(s=>s.execution.kind==="agent").map(s=>s.execution.agentId);
export const agentSpecs=Object.fromEntries(Object.entries(agents).filter(([id])=>ids.includes(id)));
export {codes};`,
  );
  await writeFile(
    join(root, "intloom.yaml"),
    `intent:
  apps: []
workflows:
  - name: "@intloom/workflow-intent"
    version: "0.0.1"
    sha256: "${"a".repeat(64)}"
llms:
  default:
    provider: openai-compatible
    model: intent-test
    secret: ENV.INTLOOM_INTENT_INTEGRATION_KEY
    baseURL: https://intent-model.invalid/v1
`,
  );
  const reads: SpecificationState[] = [];
  const iterations = new Map<string, number>();
  const decisions = new Map<string, Decision>();
  const codeCalls: { name: string; runId: string }[] = [];
  const accesses: CodeExecutionAccess<JsonValue>[] = [];
  const agentTasks: Promise<StepResult>[] = [];
  const requests: { messages: Message[] }[] = [];
  const agentStates = new Map<string, SpecificationState>();
  let sequence = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(
        String(input),
        "https://intent-model.invalid/v1/chat/completions",
      );
      const request = JSON.parse(String(init?.body)) as {
        messages: Message[];
        stream?: boolean;
      };
      assert.equal(request.stream, true);
      requests.push(request);
      const last = request.messages.at(-1);
      let message: Message;
      if (last?.role !== "tool") {
        message = toolCall("read_specification", {}, `read-${++sequence}`);
      } else {
        const call = request.messages
          .flatMap((item) => item.tool_calls ?? [])
          .find((item) => item.id === last.tool_call_id);
        assert.ok(call);
        if (call.function.name === "read_specification") {
          const view = JSON.parse(last.content ?? "null");
          const seed = agentStates.get(view.id);
          assert.ok(seed);
          const state = {
            ...seed,
            id: view.id,
            intent: view.intent,
            questions: view.questions,
            feedbacks: view.feedbacks,
          };
          assert.ok(state.id?.startsWith("RUN-"));
          reads.push(structuredClone(state));
          const iteration = (iterations.get(state.id) ?? 0) + 1;
          iterations.set(state.id, iteration);
          const decision = await options.decide(state, iteration);
          const id = `submit-${++sequence}`;
          decisions.set(id, decision);
          const desired = applyChanges(
            state.baseline?.data ?? emptyArtifact(),
            decision.proposal.changes,
            state.id,
          ).artifact;
          const changed = new Set(
            decision.proposal.changes.map((c) => c.target_ref),
          );
          message = toolCall(
            "edit_specification",
            {
              draftRevision: view.draftRevision,
              edits: [...objects(desired)]
                .filter(([id]) => changed.has(id as never))
                .map(([_id, value]) => ({
                  value: authoring(value),
                  reason: "Apply controlled fixture decision",
                })),
            },
            id,
          );
        } else if (call.function.name === "edit_specification") {
          const saved = JSON.parse(last.content ?? "null");
          assert.equal(saved.saved, true, JSON.stringify(saved));
          const decision = decisions.get(call.id);
          assert.ok(decision);
          const id = `submit-${++sequence}`;
          decisions.set(id, decision);
          decisions.delete(call.id);
          message = toolCall(
            "submit_specification",
            {
              draftRevision: saved.draftRevision,
              questions: decision.proposal.questions,
            },
            id,
          );
        } else {
          assert.equal(call.function.name, "submit_specification");
          const result = JSON.parse(last.content ?? "null");
          if (!result.saved) {
            const priorRead = [...request.messages]
              .reverse()
              .find(
                (m) =>
                  m.role === "tool" &&
                  m.content?.includes('"draftRevision"') &&
                  m.content?.includes('"intent"'),
              );
            const view = JSON.parse(priorRead?.content ?? "null");
            const seed = agentStates.get(view.id);
            assert.ok(seed);
            const state = {
              ...seed,
              id: view.id,
              intent: view.intent,
              questions: view.questions,
              feedbacks: view.feedbacks,
            };
            const iteration = (iterations.get(state.id) ?? 0) + 1;
            iterations.set(state.id, iteration);
            reads.push(structuredClone(state));
            const corrected = await options.decide(state, iteration);
            const desired = applyChanges(
              state.baseline?.data ?? emptyArtifact(),
              corrected.proposal.changes,
              state.id,
            ).artifact;
            const changed = new Set(
              corrected.proposal.changes.map((c) => c.target_ref),
            );
            const id = `correct-${++sequence}`;
            decisions.delete(call.id);
            decisions.set(id, corrected);
            const latestEdit = [...request.messages]
              .reverse()
              .find(
                (m) =>
                  m.role === "tool" &&
                  m.content?.includes('"draftRevision"') &&
                  !m.content?.includes('"intent"'),
              );
            const revision = JSON.parse(
              latestEdit?.content ?? "null",
            ).draftRevision;
            message = toolCall(
              "edit_specification",
              {
                draftRevision: revision,
                edits: [...objects(desired)]
                  .filter(([id]) => changed.has(id as never))
                  .map(([_id, value]) => ({
                    value: authoring(value),
                    reason: "Correct controlled fixture decision",
                  })),
              },
              id,
            );
          } else {
            const decision = decisions.get(call.id);
            assert.ok(decision);
            decisions.delete(call.id);
            message = {
              role: "assistant",
              content: JSON.stringify({ outcome: decision.outcome }),
            };
          }
        }
      }
      const id = `chatcmpl-${++sequence}`;
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
      const frames = [
        {
          id,
          object: "chat.completion.chunk",
          created: 0,
          model: "intent-test",
          choices: [{ index: 0, delta, finish_reason: null }],
        },
        {
          id,
          object: "chat.completion.chunk",
          created: 0,
          model: "intent-test",
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
  const standard = createEffector();
  const names = new Map<ExecutableCode, string>();
  execution = await initializeProject(root, {
    ...(options.recovery
      ? { runtimeDirectory: join(root, ".intloom/runtime") }
      : {}),
    storage: options.storage?.(handle.access) ?? handle.access,
    effector: {
      executeAgent(...args) {
        const current = args[2].state.value as SpecificationState;
        agentStates.set(current.id, structuredClone(current));
        const task = standard.executeAgent(...args);
        agentTasks.push(task);
        return task;
      },
      executeCode(code, input, access) {
        const name = names.get(code);
        assert.ok(name);
        const state = access.state.value;
        assert.ok(
          state &&
            typeof state === "object" &&
            "id" in state &&
            typeof state.id === "string",
        );
        codeCalls.push({ name, runId: state.id });
        accesses.push(access);
        const proceed = (bound = access) =>
          standard.executeCode(code, input, bound);
        return options.code?.({ name, access, proceed }) ?? proceed();
      },
    },
  });
  const blueprint = execution.registries.blueprints.intent;
  assert.ok(blueprint, JSON.stringify(execution.workflows));
  for (const stage of Object.values(blueprint.stages)) {
    for (const step of Object.values(stage.steps)) {
      if (step.execution.kind !== "code") continue;
      const code: ExecutableCode | undefined =
        execution.registries.codes[step.execution.codeId];
      assert.ok(code);
      names.set(code, step.stepName);
    }
  }
  return {
    root,
    execution,
    handle,
    open,
    reads,
    requests,
    codeCalls,
    accesses,
    agentTasks,
  };
}

function toolCall(name: string, input: unknown, id: string): Message {
  return {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id,
        type: "function",
        function: { name, arguments: JSON.stringify(input) },
      },
    ],
  };
}

export function proposal(
  state: SpecificationState,
  description = state.intent,
): SpecificationProposal {
  const id = `SCON-${state.id}` as const;
  return {
    changes: [
      {
        target_ref: id,
        reason: "Save the explicit business constraint",
        patch: [
          {
            op: "add",
            path: "",
            value: { id, status: "active", description, record_refs: [] },
          },
        ],
      },
    ],
    questions: state.questions.map(
      ({ answer: _answer, skipped: _skipped, ...question }) => question,
    ),
    processedFeedbackCount: state.feedbacks.length,
  };
}

export function pending(view: RunView, kind: string, step: string) {
  assert.equal(view.status, "waiting", JSON.stringify(view.lastError));
  assert.equal(view.pendingAction?.kind, kind);
  assert.equal(view.cursor.stepName, step);
  assert.ok(view.pendingAction);
  return view.pendingAction;
}
