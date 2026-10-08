import { Agent } from "@mastra/core/agent";
import type { ToolsInput } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import * as z from "zod";
import type { JsonValue } from "../src/shared/json.ts";
import type {
  AgentExecutionAccess,
  CodeExecutionAccess,
} from "../src/effector/execution.ts";
import type { ServiceAgent } from "../src/effector/service/types.ts";
import { executeServiceAgent } from "../src/effector/service/execute-agent.ts";
import { runtimeFixture } from "./runtime-fixture.ts";

type Model = Extract<MastraModelConfig, { specificationVersion: "v2" }>;
export type ModelRequest = Parameters<Model["doStream"]>[0];
type StreamResult = Awaited<ReturnType<Model["doStream"]>>;
type StreamPart =
  StreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;
export type ModelReply = {
  readonly text?: string;
  readonly calls?: readonly { name: string; input: unknown }[];
  readonly reason?: "stop" | "tool-calls" | "length";
};

/** Replaces only the model boundary; Agent.generate, SDK Tool dispatch, and structured output run unchanged. */
export function scriptedAgent(
  script: (request: ModelRequest) => ModelReply | Promise<ModelReply>,
  tools: ToolsInput = {},
): ServiceAgent & { readonly requests: ModelRequest[] } {
  const requests: ModelRequest[] = [];
  let sequence = 0;
  async function respond(request: ModelRequest) {
    requests.push(request);
    const reply = await script(request);
    const content = [
      ...(reply.text === undefined
        ? []
        : [{ type: "text" as const, text: reply.text }]),
      ...(reply.calls ?? []).map((call) => ({
        type: "tool-call" as const,
        toolCallId: `tool-${++sequence}`,
        toolName: call.name,
        input: JSON.stringify(call.input),
      })),
    ];
    return {
      content,
      finishReason:
        reply.reason ?? (reply.calls?.length ? "tool-calls" : "stop"),
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    };
  }
  const model = {
    specificationVersion: "v2" as const,
    provider: "fixture",
    modelId: "fixture-model",
    supportedUrls: {},
    doGenerate: respond,
    async doStream(request: ModelRequest): Promise<StreamResult> {
      const reply = await respond(request);
      const parts: StreamPart[] = [{ type: "stream-start", warnings: [] }];
      for (const content of reply.content) {
        if (content.type === "text")
          parts.push(
            { type: "text-start", id: "text" },
            { type: "text-delta", id: "text", delta: content.text },
            { type: "text-end", id: "text" },
          );
        else parts.push(content);
      }
      parts.push({
        type: "finish",
        finishReason: reply.finishReason,
        usage: reply.usage,
      });
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
  } satisfies Model;
  return {
    agent: new Agent({
      id: "fixture-agent",
      name: "Fixture",
      instructions: "Use your assigned business Tools, then return an outcome.",
      model,
      tools,
    }),
    outputSchema: z.strictObject({ outcome: z.string() }),
    requests,
    execute(input, access, maxSteps) {
      return executeServiceAgent(this, input, access, maxSteps);
    },
  };
}

export function executionAccess(initial: JsonValue = { value: 0 }) {
  let value: JsonValue | undefined = initial;
  const controller = new AbortController();
  const storage = runtimeFixture().storage;
  const state = {
    get value() {
      return structuredClone(value);
    },
    async create(next: JsonValue) {
      value = structuredClone(next);
    },
    async update(next: JsonValue) {
      value = structuredClone(next);
    },
    async clear() {
      value = undefined;
    },
  };
  const { commit: _commit, ...read } = storage;
  const agent: AgentExecutionAccess<JsonValue> = {
    state,
    storage: read,
    signal: controller.signal,
  };
  const code: CodeExecutionAccess<JsonValue> = {
    ...agent,
    storage,
    interaction: {
      async askQuestions() {
        throw new Error("Unexpected interaction");
      },
      async confirm() {
        throw new Error("Unexpected interaction");
      },
    },
  };
  return { agent, code, controller, storage, state };
}

export function latestToolResult(
  request: ModelRequest,
): { name: string; output: unknown } | undefined {
  for (const message of [...request.prompt].reverse()) {
    if (message.role !== "tool") continue;
    const result = message.content.at(-1);
    if (result?.type !== "tool-result") continue;
    return { name: result.toolName, output: result.output };
  }
  return undefined;
}
