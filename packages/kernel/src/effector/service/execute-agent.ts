import { randomUUID } from "node:crypto";
import type { ServiceAgent } from "./types.ts";
import { getLogger } from "@intloom/utils";
import type { PublicSchema } from "@mastra/core/schema";
import { agentJsonSchema } from "../agent-tool.ts";
import type { JsonValue, ReadonlyJsonValue } from "../../shared/json.ts";
import { RUNTIME_ERRORS } from "../../errors/runtime.ts";
import { bindAgentContext } from "./agent-context.ts";
import { toolError } from "../errors.ts";
import {
  agentError,
  incompleteAgentError,
  modelErrorDiagnostics,
} from "./errors.ts";
import type {
  ServiceModelObserver,
  AgentExecutionAccess,
} from "../execution.ts";

const finishReasons = new Set([
  "stop",
  "length",
  "tool-calls",
  "content-filter",
  "error",
  "other",
  "unknown",
]);

function safeFinishReason(reason: unknown): string {
  return typeof reason === "string" && finishReasons.has(reason)
    ? reason
    : "unknown";
}

function safeUsageNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function textBytes(text: unknown): number {
  return typeof text === "string" ? Buffer.byteLength(text, "utf8") : 0;
}

function contentTextBytes(content: unknown): number {
  if (!Array.isArray(content)) return 0;
  return content.reduce(
    (bytes, part) => bytes + (part?.type === "text" ? textBytes(part.text) : 0),
    0,
  );
}

const instruction =
  "Execute the current Workflow step according to your instructions. Read current business State using your assigned Tools and save business changes through those Tools. After the required submissions succeed, your final response must contain only the required JSON outcome object. Do not return drafts, Tool arguments, Tool results or a summary as the final response. User interaction belongs to Workflow Code steps.";

function finalObjectText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```json\s*\n?([\s\S]*?)\n?\s*```\s*$/);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseFinalAgentOutput(text: string | undefined): unknown {
  if (!text?.trim())
    throw RUNTIME_ERRORS.create("AGENT_OUTPUT_INVALID", {
      message:
        "The final model response is empty. Return the required JSON result.",
    });
  try {
    return JSON.parse(finalObjectText(text)) as unknown;
  } catch {
    throw RUNTIME_ERRORS.create("AGENT_OUTPUT_INVALID", {
      message:
        "The final model response is not complete JSON. Return the required JSON result.",
    });
  }
}

export async function executeServiceAgent(
  executable: ServiceAgent,
  input: ReadonlyJsonValue,
  access: AgentExecutionAccess<JsonValue>,
  maxSteps: number,
  observer?: ServiceModelObserver,
): Promise<unknown> {
  access.signal.throwIfAborted();
  if (input !== null)
    throw RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED", {
      message:
        "Agent execution receives null input; business data belongs in Stage State.",
    });
  // The SDK receives only the input JSON Schema; executeAgent validates the original Zod Schema once after this call.
  const schema = agentJsonSchema(executable.outputSchema) as PublicSchema;
  const controller = new AbortController();
  const signal = AbortSignal.any([access.signal, controller.signal]);
  let failure: { cause: unknown } | undefined;
  const fail = (cause: unknown, toolName?: string) => {
    failure ??= { cause: toolError(cause, toolName) };
    controller.abort(failure.cause);
  };
  const check = () => {
    access.signal.throwIfAborted();
    if (failure) throw failure.cause;
  };
  const context = bindAgentContext({ ...access, signal }, fail);
  const log = getLogger();
  const started = performance.now();
  let toolStarted = started;
  let toolCall = 0;
  let modelStep = 0;
  let requestId = randomUUID();
  let toolCallId = randomUUID();
  let lastFinishReason: string | undefined;
  let callbackError: Error | string | undefined;
  let streamError: (() => Error | undefined) | undefined;
  log.debug("agent_started", { maxSteps });
  try {
    log.assertHealthy();
    access.signal.throwIfAborted();
    const stream = await executable.agent.stream(instruction, {
      requestContext: context,
      abortSignal: signal,
      maxSteps,
      toolCallConcurrency: 1,
      requireToolApproval: false,
      autoResumeSuspendedTools: false,
      modelSettings: { maxRetries: 0 },
      maxProcessorRetries: 0,
      structuredOutput: {
        schema,
        errorStrategy: "warn",
        jsonPromptInjection: true,
      },
      onError({ error }) {
        callbackError ??= error;
      },
      async prepareStep() {
        check();
        requestId = randomUUID();
        await observer?.beforeStep({ requestId });
        check();
      },
      async onStepFinish(step) {
        lastFinishReason = safeFinishReason(step.finishReason);
        const reasoningTokens = safeUsageNumber(step.usage?.reasoningTokens);
        const cachedInputTokens = safeUsageNumber(
          step.usage?.cachedInputTokens,
        );
        const inputTokens = safeUsageNumber(step.usage?.inputTokens);
        const outputTokens = safeUsageNumber(step.usage?.outputTokens);
        await observer?.afterStep({
          requestId,
          ...(step.model?.modelId === undefined
            ? {}
            : { modelId: step.model.modelId }),
          ...(inputTokens === undefined ? {} : { inputTokens }),
          ...(outputTokens === undefined ? {} : { outputTokens }),
        });
        log.debug("model_step_completed", {
          modelStep: ++modelStep,
          model: step.model?.modelId,
          finishReason: lastFinishReason,
          inputTokens: step.usage?.inputTokens,
          outputTokens: step.usage?.outputTokens,
          textBytes: textBytes(step.text),
          contentTextBytes: contentTextBytes(step.content),
          ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
          ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
        });
      },
      hooks: {
        async beforeToolCall({ toolName, input }) {
          access.signal.throwIfAborted();
          toolStarted = performance.now();
          toolCall++;
          toolCallId = `${requestId}:${toolCall}`;
          await observer?.beforeTool?.({ toolCallId });
          log.debug("tool_started", {
            toolName,
            toolCall,
            argumentCount:
              input && typeof input === "object"
                ? Object.keys(input).length
                : 0,
          });
          log.assertHealthy();
          access.signal.throwIfAborted();
        },
        async afterToolCall({ error, toolName }) {
          await observer?.afterTool?.({ toolCallId });
          log.debug(error === undefined ? "tool_completed" : "tool_failed", {
            toolName,
            toolCall,
            durationMs: Math.round(performance.now() - toolStarted),
          });
          if (error !== undefined) fail(error, toolName);
        },
      },
    });
    streamError = () => stream.error;
    const response = await stream.getFullOutput();
    check();
    if (response.error) throw response.error;
    const finalStep = response.steps.at(-1);
    log.debug("agent_final_output", {
      modelSteps: response.steps.length,
      finishReason: safeFinishReason(finalStep?.finishReason),
      finalTextBytes: textBytes(finalStep?.text),
      finalContentTextBytes: contentTextBytes(finalStep?.content),
      structuredObjectPresent: response.object !== undefined,
    });
    if (response.finishReason !== "stop" || finalStep?.finishReason !== "stop")
      throw incompleteAgentError(
        response.finishReason !== "stop"
          ? response.finishReason
          : finalStep?.finishReason,
        response.error,
        modelStep >= maxSteps,
      );
    // Mastra 1.67 can cache an object from a Tool round; only the final stop round may authorize an outcome.
    const output = parseFinalAgentOutput(finalStep.text);
    log.debug("agent_completed", {
      durationMs: Math.round(performance.now() - started),
      modelSteps: modelStep,
      toolCalls: toolCall,
    });
    return output;
  } catch (cause) {
    access.signal.throwIfAborted();
    const error = failure?.cause ?? agentError(cause, lastFinishReason);
    const streamObserved =
      failure || callbackError !== undefined ? undefined : streamError?.();
    const observed = callbackError ?? streamObserved;
    log.debug("agent_failed", {
      errorCode: RUNTIME_ERRORS.is(error) ? error.code : undefined,
      finishReason: lastFinishReason,
      durationMs: Math.round(performance.now() - started),
      modelSteps: modelStep,
      toolCalls: toolCall,
      ...(failure || observed === undefined
        ? {}
        : modelErrorDiagnostics(observed)),
      ...(failure ? {} : modelErrorDiagnostics(cause)),
      ...(failure || observed === undefined
        ? {}
        : {
            observedErrorSource:
              callbackError === undefined ? "stream_error" : "on_error",
          }),
    });
    throw error;
  } finally {
    context.clear();
    controller.abort(RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
  }
}
