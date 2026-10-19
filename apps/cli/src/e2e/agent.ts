import { Agent, type AgentExecutionOptionsBase } from "@mastra/core/agent";
import { createHash } from "node:crypto";
import { Mastra } from "@mastra/core/mastra";
import { noopLogger } from "@mastra/core/logger";
import { createTool, type Tool } from "@mastra/core/tools";
import type { PublicSchema } from "@mastra/core/schema";
import { createAnthropic } from "@ai-sdk/anthropic";
import { E2eError, type ModelConfig } from "./contracts.ts";
import type { Evidence } from "./evidence.ts";
import type { ModelToolCall } from "./answers.ts";
import { resolveModelConfig } from "@mastra/core/llm";
import { modelTransport } from "./transport.ts";
import {
  parseFinalResponse,
  parseStructuredResponse,
} from "./final-response.ts";
import { toolSchema } from "./schema.ts";

export async function runAgent(input: {
  id: string;
  instructions: string;
  prompt: string;
  model: ModelConfig;
  tools: Record<string, Tool>;
  outputSchema?: PublicSchema;
  taskCompletion?: boolean;
  maxSteps?: number | undefined;
  signal: AbortSignal;
  evidence: Evidence;
  environment?: NodeJS.ProcessEnv;
  onToolCalls?: (calls: ModelToolCall[]) => Promise<void>;
  connectionTimeoutMs?: number;
  connectionRetries?: number;
  idleTimeoutMs?: number | undefined;
  allowDecisionPreamble?: boolean;
}) {
  const apiKey = (input.environment ?? process.env)[
    input.model.secret.slice(4)
  ];
  if (!apiKey)
    throw new E2eError(
      "MODEL_CREDENTIAL_MISSING",
      "The model credential is unavailable.",
      "environment",
      "blocked",
    );
  const headers = {
    "User-Agent": "intloom-e2e/dev",
    "x-intloom-session": createHash("sha256")
      .update(input.evidence.directory)
      .update("\0")
      .update(input.id)
      .digest("hex"),
  };
  const model =
    input.model.provider === "anthropic"
      ? createAnthropic({
          apiKey,
          headers,
          ...(input.model.baseURL ? { baseURL: input.model.baseURL } : {}),
        })(input.model.model)
      : {
          providerId: "openai",
          modelId: input.model.model,
          apiKey,
          headers,
          ...(input.model.baseURL ? { url: input.model.baseURL } : {}),
        };
  let transportFailure: E2eError | undefined;
  let completionFailure: E2eError | undefined;
  const completionController = new AbortController();
  const signal = AbortSignal.any([input.signal, completionController.signal]);
  let taskCompleted = false;
  let taskResult: unknown;
  const tools = { ...input.tools };
  let completionName = "e2e_complete_task";
  for (let index = 1; Object.hasOwn(tools, completionName); index++)
    completionName = `e2e_complete_task_${index}`;
  if (input.taskCompletion) {
    if (!input.outputSchema)
      throw new E2eError(
        "MODEL_CONFIGURATION_MISSING",
        "Client task completion requires the host output schema.",
        "runner",
      );
    tools[completionName] = createTool({
      id: completionName,
      description:
        "Return your assigned task outcome using the exact host result schema. Call once after required business submissions. This completes the client task without another model request. Do not include JSON Schema metadata.",
      inputSchema: toolSchema(input.outputSchema),
      strict: false,
      execute: async (value) => {
        if (taskCompleted)
          throw new E2eError(
            "MODEL_OUTPUT_INVALID",
            "The client task outcome was submitted more than once.",
            "model",
          );
        taskResult = value;
        taskCompleted = true;
        return { received: true };
      },
    });
  }
  const transported = modelTransport(await resolveModelConfig(model), {
    actor: input.id,
    signal,
    evidence: input.evidence,
    timeoutMs: input.connectionTimeoutMs ?? 60000,
    retries: input.connectionRetries ?? 0,
    idleTimeoutMs: input.idleTimeoutMs,
    onFailure(cause) {
      transportFailure = cause;
      completionController.abort(cause);
    },
  });
  const agent = new Agent({
    mastra: new Mastra({ logger: false, __ephemeral: true }),
    id: input.id,
    name: input.id,
    instructions: input.taskCompletion
      ? `${input.instructions}\nClient completion protocol: call ${completionName} exactly once with the declared outcome when the task is finished. The host's instruction to return an outcome means passing it to this client completion Tool, not producing a plain-text final answer. This Tool is allowed after host business Tools close and does not submit business changes. Never substitute narration or Schema metadata for the outcome.`
      : input.instructions,
    model: transported,
    tools,
    defaultOptions: {
      modelSettings: {
        ...(input.model.parameters?.temperature === undefined
          ? {}
          : { temperature: input.model.parameters.temperature }),
        ...(input.model.parameters?.maxOutputTokens === undefined
          ? {}
          : { maxOutputTokens: input.model.parameters.maxOutputTokens }),
        ...(input.model.parameters?.topP === undefined
          ? {}
          : { topP: input.model.parameters.topP }),
      },
      ...(input.model.providerOptions
        ? { providerOptions: input.model.providerOptions }
        : {}),
    },
  });
  agent.__setLogger(noopLogger);
  let failed = false;
  try {
    await input.evidence.event("model_started", {
      actor: input.id,
      model: input.model.model,
    });
    const streamOptions: AgentExecutionOptionsBase<unknown> = {
      // Mastra defaults to five steps, which cannot cover project setup. Omission must not inherit that cap.
      maxSteps: input.maxSteps ?? Number.MAX_SAFE_INTEGER,
      abortSignal: signal,
      toolCallConcurrency: 1,
      requireToolApproval: false,
      autoResumeSuspendedTools: false,
      modelSettings: { maxRetries: 0 },
      maxProcessorRetries: 0,
      ...(input.taskCompletion
        ? { toolChoice: "required" as const, stopWhen: () => taskCompleted }
        : {}),
      onError() {
        failed = true;
      },
      async onStepFinish(step) {
        const calls = step.toolCalls.map((call) => ({
          ...call.payload,
          args: call.payload.args,
        }));
        const completions = calls.filter(
          (call) => call.toolName === completionName,
        );
        if (
          input.taskCompletion &&
          (completions.length > 1 || (completions.length && !taskCompleted))
        ) {
          completionFailure = new E2eError(
            "MODEL_OUTPUT_INVALID",
            "The client task completion must contain one outcome matching the host schema. No output attempt was retried.",
            "model",
          );
          completionController.abort(completionFailure);
          await input.evidence.event("model_completion_rejected", {
            actor: input.id,
            calls,
            code: completionFailure.code,
          });
          throw completionFailure;
        }
        if (calls.length)
          await input.evidence.event("model_tools", {
            actor: input.id,
            calls,
            results: step.toolResults.map((result) => result.payload),
          });
        await input.onToolCalls?.(calls);
        await input.evidence.event("model_step", {
          actor: input.id,
          model: input.model.model,
          finishReason: step.finishReason,
          usage: step.usage,
        });
      },
    };
    const stream = await (input.outputSchema && !input.taskCompletion
      ? agent.stream(input.prompt, {
          ...streamOptions,
          structuredOutput: {
            schema: input.outputSchema,
            errorStrategy: "warn",
            jsonPromptInjection: true,
          },
        })
      : agent.stream(input.prompt, streamOptions));
    const response = await stream.getFullOutput();
    input.signal.throwIfAborted();
    if (completionFailure) throw completionFailure;
    if (transportFailure) throw transportFailure;
    const final = response.steps.at(-1);
    await input.evidence.event("model_final", {
      actor: input.id,
      finishReason: response.finishReason,
      text: final?.text?.slice(0, 65536),
      truncated: (final?.text?.length ?? 0) > 65536,
      taskCompleted,
    });
    if (
      failed ||
      response.error ||
      !(taskCompleted
        ? ["stop", "tool-calls"].includes(response.finishReason ?? "")
        : response.finishReason === "stop") ||
      !(taskCompleted
        ? ["stop", "tool-calls"].includes(final?.finishReason ?? "")
        : final?.finishReason === "stop")
    )
      throw new E2eError(
        "MODEL_EXECUTION_INCOMPLETE",
        "The test AI did not produce a complete final response. See model-step evidence.",
        "model",
      );
    if (taskCompleted) {
      await input.evidence.event("model_task_completed", {
        actor: input.id,
        value: taskResult,
      });
      return taskResult;
    }
    const decoded = input.outputSchema
      ? await parseStructuredResponse(final?.text ?? "", input.outputSchema)
      : parseFinalResponse(final?.text ?? "", input.allowDecisionPreamble);
    await input.evidence.event("model_final_decoded", {
      actor: input.id,
      format: decoded.format,
    });
    return decoded.value;
  } catch (cause) {
    input.signal.throwIfAborted();
    if (completionFailure) throw completionFailure;
    if (transportFailure) throw transportFailure;
    if (cause instanceof E2eError) throw cause;
    const details = cause as {
      statusCode?: unknown;
      code?: unknown;
      responseBody?: unknown;
    } | null;
    const statusCode =
      typeof details?.statusCode === "number" ? details.statusCode : undefined;
    const code = typeof details?.code === "string" ? details.code : undefined;
    const diagnostic =
      cause instanceof Error && cause.message.trim()
        ? cause.message
        : `Model request failed${statusCode ? ` (HTTP ${statusCode})` : ""}${code ? `: ${code}` : ""}.`;
    await input.evidence.event("model_error", {
      actor: input.id,
      diagnostic,
      statusCode,
      code,
      responseBody:
        typeof details?.responseBody === "string"
          ? details.responseBody.slice(0, 4096)
          : undefined,
    });
    throw new E2eError(
      "MODEL_REQUEST_FAILED",
      `The test AI request failed${statusCode ? ` (HTTP ${statusCode})` : ""}. See model-error evidence.`,
      statusCode === 401 || statusCode === 403 ? "environment" : "model",
    );
  } finally {
    await input.evidence.flush();
  }
}
