import { randomUUID } from "node:crypto";
import type { LLMStepResult } from "@mastra/core/stream";
import { Agent } from "@mastra/core/agent";
import { createTool, isValidationError } from "@mastra/core/tools";
import {
  modelSupportsStructuredOutput,
  getProviderConfig,
} from "@mastra/core/llm";
import {
  IntloomError,
  type AgentDefinition,
  type ExecutionOrigin,
  type ModelBindingDescription,
  type ModelCapability,
  type ToolDefinition,
} from "@intloom/loom-sdk";
import type { AgentHarnessHost } from "../harness/contracts.ts";
export function checkModelBinding(
  binding: ModelBindingDescription,
  capabilities: readonly ModelCapability[],
) {
  if (binding.provider === "minimax-cn") {
    if (
      !["MiniMax-M3", "MiniMax-M3.1-Flash"].includes(binding.model) ||
      (binding.options?.baseUrl !== undefined &&
        binding.options.baseUrl !== "https://api.minimax.cn/anthropic/v1") ||
      binding.options?.api !== undefined
    )
      throw new IntloomError(
        "BINDING_UNAVAILABLE",
        "MiniMax CN uses its official Anthropic-compatible endpoint and M3 models.",
      );
    if (capabilities.includes("structured_output"))
      throw new IntloomError(
        "MODEL_CAPABILITY_UNSUPPORTED",
        "MiniMax CN has no verified native JSON Schema output support.",
      );
    return;
  }
  if (binding.provider === "alibaba") {
    if (binding.model !== "qwen3.8-flash" || !binding.options?.baseUrl)
      throw new IntloomError(
        "BINDING_UNAVAILABLE",
        "The Alibaba route requires qwen3.8-flash and an explicit OpenAI-compatible base URL.",
      );
  } else if (
    binding.provider !== "openai" ||
    !getProviderConfig("openai")?.models.includes(binding.model) ||
    !/^(gpt-(?:[3-6]|daybreak-)|o[134](?:-|$))/.test(binding.model)
  )
    throw new IntloomError(
      "BINDING_UNAVAILABLE",
      "This adapter requires a known OpenAI text generation model.",
    );
  if (
    capabilities.includes("structured_output") &&
    modelSupportsStructuredOutput(`${binding.provider}/${binding.model}`) !==
      true
  )
    throw new IntloomError(
      "MODEL_CAPABILITY_UNSUPPORTED",
      "The selected model has no verified native structured output support.",
    );
}

export async function executeAgent(
  services: AgentHarnessHost,
  definition: AgentDefinition,
  input: unknown,
  origin: ExecutionOrigin,
  waiting?: () => boolean,
) {
  let failedHere = false;
  const fail = async (error: IntloomError, at = origin): Promise<never> => {
    failedHere = true;
    await services.fail(error, at);
    throw error;
  };
  const binding = services.model;
  if (!binding)
    throw new IntloomError(
      "BINDING_UNAVAILABLE",
      "The Agent model slot is not bound.",
    );
  const context = services.context;
  let instructions =
    typeof definition.instructions === "string"
      ? definition.instructions
      : await context.resources.readText(definition.instructions);
  for (const skill of definition.skills ?? []) {
    const document = await context.resources.readText(skill.instructions);
    const body = skill.instructions.packagePath
      ? document.replace(/^---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*\r?\n/, "")
      : document;
    instructions += `\n\n${skill.id}: ${skill.description}\n${body}`;
  }
  let hasToolResult = false;
  let toolResult: unknown;
  const tools = Object.fromEntries(
    (definition.tools ?? []).map((ref) => {
      const tool = ref as ToolDefinition;
      const toolOrigin = { ...origin, componentId: tool.id };
      const native = createTool({
        id: tool.id,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: (input) =>
          services.observation
            .model(invocationId, origin, () =>
              services.callTool(tool, input, toolOrigin),
            )
            .then((output) => {
              if (definition.resultTool === tool.id) {
                toolResult = output;
                hasToolResult = true;
              }
              return output;
            })
            .catch((error: unknown) => {
              failedHere = true;
              throw error;
            }),
      });
      return [tool.id, native];
    }),
  );
  const agent = new Agent({
    id: `${definition.id}-${randomUUID()}`,
    name: definition.id,
    instructions,
    tools,
    maxRetries: 0,
    model: {
      providerId: binding.provider,
      modelId: binding.model,
      apiKey: await services.credential(),
      ...(binding.provider !== "minimax-cn"
        ? {
            api: binding.options?.api ?? "chat",
            ...(binding.options?.baseUrl
              ? { url: binding.options.baseUrl }
              : {}),
          }
        : {}),
    },
  });
  const prompt = await definition.prompt({ inputData: input, context });
  const invocationId = services.id();
  let stepCount = 0;
  const parentExecutionId = services.observation.fields().executionId;
  const began = performance.now();
  const modelScope = {
    executionId: invocationId,
    origin,
    ...(parentExecutionId ? { parentExecutionId } : {}),
  };
  const options = {
    maxSteps: definition.generation?.maxSteps ?? 5,
    abortSignal: services.signal,
    ...(definition.resultTool || waiting
      ? { stopWhen: () => hasToolResult || Boolean(waiting?.()) }
      : {}),
    modelSettings: { maxRetries: 0, ...definition.generation },
    onStepFinish: async (
      result: Pick<LLMStepResult, "usage" | "toolResults"> & {
        response: Record<string, unknown>;
      },
    ) => {
      const { inputTokens, outputTokens } = result.usage ?? {};
      const body = result.response?.body;
      const raw =
        body && typeof body === "object" && "usage" in body
          ? body.usage
          : undefined;
      const cost =
        raw && typeof raw === "object" && "cost" in raw ? raw.cost : undefined;
      const currency =
        raw && typeof raw === "object" && "currency" in raw
          ? raw.currency
          : undefined;
      await services.recordEvent({
        ...modelScope,
        type: "model.step.finished",
        details: {
          invocationId,
          step: ++stepCount,
          ...(typeof inputTokens === "number" &&
            Number.isSafeInteger(inputTokens) &&
            inputTokens >= 0 && { inputTokens }),
          ...(typeof outputTokens === "number" &&
            Number.isSafeInteger(outputTokens) &&
            outputTokens >= 0 && { outputTokens }),
          ...(typeof cost === "number" &&
            Number.isFinite(cost) &&
            cost >= 0 && {
              reportedCost: cost,
              ...(typeof currency === "string" &&
                /^[A-Z]{3}$/.test(currency) && { currency }),
            }),
        },
      });
      const rejected = result.toolResults.find(
        ({ payload }) => payload.isError || isValidationError(payload.result),
      );
      if (rejected) {
        const tool = definition.tools?.find(
          (t) => t.id === rejected.payload.toolName,
        );
        return fail(
          new IntloomError(
            "TOOL_EXECUTION_FAILED",
            "An Agent tool call failed.",
          ),
          tool ? { ...origin, componentId: tool.id } : origin,
        );
      }
    },
  };
  await services.recordEvent({
    ...modelScope,
    type: "model.invocation.started",
    details: {
      invocationId,
      slot: definition.model.slot,
      provider: binding.provider,
      model: binding.model,
    },
  });
  let completed = false;
  try {
    const result =
      definition.outputMode === "structured" && !definition.resultTool
        ? await agent.generate(prompt, {
            ...options,
            structuredOutput: {
              schema: definition.outputSchema,
              errorStrategy: "strict",
              jsonPromptInjection: false,
            },
          })
        : await agent.generate(prompt, options);
    if (waiting?.()) {
      completed = true;
      return undefined;
    }
    if (result.error || result.tripwire)
      return fail(
        new IntloomError("MODEL_EXECUTION_FAILED", "Agent generation failed."),
      );
    if (definition.resultTool) {
      if (!hasToolResult)
        return fail(
          new IntloomError(
            "MODEL_INCOMPLETE",
            "Agent did not call its result tool.",
          ),
        );
      const output = definition.outputSchema.parse(toolResult);
      completed = true;
      return output;
    }
    if (result.finishReason !== "stop")
      return fail(
        new IntloomError(
          "MODEL_INCOMPLETE",
          "Agent generation stopped before a complete result.",
          {
            finishReason: result.finishReason ?? "unknown",
            maxSteps: definition.generation?.maxSteps ?? 5,
            steps: result.steps.length,
          },
        ),
      );
    if (definition.outputMode === "structured") {
      const object = result.object;
      completed = true;
      return object;
    }
    const parsed = definition.outputSchema.safeParse(result.text);
    if (!parsed.success)
      return fail(
        new IntloomError(
          "MODEL_OUTPUT_INVALID",
          "Model text did not satisfy the output contract.",
        ),
      );
    completed = true;
    return parsed.data as unknown;
  } finally {
    const status =
      !failedHere && services.signal.aborted
        ? "cancelled"
        : completed
          ? "succeeded"
          : "failed";
    await services.recordEvent({
      ...modelScope,
      type: "model.invocation.finished",
      details: {
        invocationId,
        status,
        stepCount,
        durationMs: Math.max(0, Math.round(performance.now() - began)),
      },
    });
  }
}
