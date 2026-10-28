import { randomUUID } from "node:crypto";
import type { ServiceAgent } from "./types.ts";
import { getLogger } from "@intloom/utils";
import { toStandardSchema, type PublicSchema } from "@mastra/core/schema";
import { createTool } from "@mastra/core/tools";
import { agentJsonSchema, isAgentToolInputError } from "../agent-tool.ts";
import type { JsonValue, ReadonlyJsonValue } from "@intloom/loom-sdk";
import { ERRORS } from "../../errors.ts";
import { bindAgentContext } from "./agent-context.ts";
import { toolError } from "../errors.ts";
import { safeFinishReason, timeModelRequest } from "./model-timing.ts";
import { parseFinalAgentOutput } from "./final-output.ts";
import {
  agentError,
  incompleteAgentError,
  modelErrorDiagnostics,
} from "./errors.ts";
import type { AgentExecutionAccess } from "@intloom/loom-sdk";
import type { ServiceModelObserver } from "../execution.ts";

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
  "Execute the current Loom step according to your instructions. Read current business State using your assigned Tools and save business changes through those Tools. After the required submissions succeed, supply only the declared outcome through the host completion Tool. Do not use drafts, business Tool arguments/results or a summary as the outcome. User interaction belongs to Loom Code steps.";

export async function executeServiceAgent(
  executable: ServiceAgent,
  input: ReadonlyJsonValue,
  access: AgentExecutionAccess<JsonValue>,
  maxSteps: number,
  observer?: ServiceModelObserver,
): Promise<unknown> {
  access.signal.throwIfAborted();
  if (!executable.capability && input !== null)
    throw ERRORS.create("STEP_EXECUTION_FAILED", {
      message:
        "Agent execution receives null input; business data belongs in Stage State.",
    });
  // The SDK receives only the input JSON Schema; executeAgent validates the original Zod Schema once after this call.
  const outputSchema = agentJsonSchema(executable.outputSchema);
  // Function-call transports require an object even when a capability returns a scalar or null.
  const schema = (
    executable.capability
      ? {
          type: "object",
          properties: { output: outputSchema },
          required: ["output"],
          additionalProperties: false,
        }
      : outputSchema
  ) as PublicSchema;
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
  const toolControl = { closed: false };
  const context = bindAgentContext(access, fail, toolControl, signal);
  const sessionId = executable.zen ? randomUUID() : undefined;
  let completion: { value: unknown } | undefined;
  const log = getLogger();
  const started = performance.now();
  let activeTool:
    | {
        started: number;
        name: string;
        id: string;
        call: number;
        requestId: string;
        modelStep: number;
      }
    | undefined;
  let toolCall = 0;
  let modelStep = 0;
  let stepStarted = started;
  let modelTiming: ReturnType<typeof timeModelRequest> | undefined;
  let requestId = randomUUID();
  let toolCallId = randomUUID();
  let lastFinishReason: string | undefined;
  let callbackError: Error | string | undefined;
  let streamError: (() => Error | undefined) | undefined;
  log.debug("agent_started", { maxSteps });
  try {
    log.assertHealthy();
    access.signal.throwIfAborted();
    const declaredTools = await executable.agent.listTools({
      requestContext: context,
    });
    let completionName = "intloom_complete_step";
    for (let index = 1; Object.hasOwn(declaredTools, completionName); index++)
      completionName = `intloom_complete_step_${index}`;
    const complete = createTool({
      id: completionName,
      description:
        "Complete this Agent invocation with its actual declared outcome after required business submissions. This does not save business data. Call once; omit JSON Schema metadata.",
      inputSchema: toStandardSchema(schema),
      strict: false,
      execute: async (value) => {
        check();
        if (completion)
          throw ERRORS.create("AGENT_OUTPUT_INVALID", {
            message: "The Agent submitted its final outcome more than once.",
          });
        completion = { value: structuredClone(value) };
        toolControl.closed = true;
        return { received: true };
      },
    });
    const stream = await executable.agent.stream(
      executable.capability
        ? `Execute the declared capability using this input: ${JSON.stringify(input)}. Request necessary human decisions through assigned interaction Tools. Complete by calling ${completionName} with an object containing the declared business result in the output field.`
        : `${instruction}\nComplete by calling ${completionName} once with the declared outcome. This host completion Tool remains available after business Tools close; returning an outcome in Loom instructions means supplying its arguments. Do not infer success from a saved draft.`,
      {
        requestContext: context,
        abortSignal: signal,
        maxSteps,
        toolCallConcurrency: 1,
        requireToolApproval: false,
        autoResumeSuspendedTools: false,
        modelSettings: { maxRetries: 3 },
        maxProcessorRetries: 0,
        toolsets: { intloomCompletion: { [completionName]: complete } },
        stopWhen: () => completion !== undefined,
        structuredOutput: {
          schema,
          errorStrategy: "warn",
          jsonPromptInjection: true,
        },
        onError({ error }) {
          callbackError ??= error;
        },
        async prepareStep({ model }) {
          check();
          requestId = randomUUID();
          await observer?.beforeStep({ requestId });
          check();
          stepStarted = performance.now();
          modelTiming = timeModelRequest(
            model,
            signal,
            log,
            { modelRequestId: requestId, modelStep: modelStep + 1 },
            sessionId ? { "x-opencode-session": sessionId } : undefined,
          );
          return {
            model: modelTiming.model,
            ...(toolControl.closed
              ? {
                  activeTools: [completionName],
                  toolChoice: {
                    type: "tool" as const,
                    toolName: completionName,
                  },
                }
              : {}),
          };
        },
        async onStepFinish(step) {
          if (
            safeFinishReason(step.finishReason) !== "error" &&
            ["unknown", "other"].includes(
              modelTiming?.providerFinishReason ?? "",
            )
          ) {
            const error =
              callbackError === undefined
                ? ERRORS.create("LLM_RESPONSE_INVALID", {
                    message:
                      "The opened provider stream ended without a recognized completion reason. No continuation or retry was attempted.",
                  })
                : agentError(callbackError, "error");
            fail(error);
            modelTiming?.report({}, error.code);
            check();
          }
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
          modelStep++;
          modelTiming?.report(
            {
              model: step.model?.modelId,
              finishReason: lastFinishReason,
              ...(inputTokens === undefined ? {} : { inputTokens }),
              ...(outputTokens === undefined ? {} : { outputTokens }),
              textBytes: textBytes(step.text),
              contentTextBytes: contentTextBytes(step.content),
              stepDurationMs: Math.round(performance.now() - stepStarted),
              ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
              ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
              ...(lastFinishReason === "error"
                ? modelErrorDiagnostics(callbackError)
                : {}),
            },
            lastFinishReason === "error" && callbackError !== undefined
              ? agentError(callbackError, lastFinishReason).code
              : undefined,
          );
          if (
            !completion &&
            step.toolCalls.some(
              (call) => call.payload.toolName === completionName,
            )
          ) {
            // SDK schema rejection happens before Tool hooks; it must not start another output attempt.
            fail(
              ERRORS.create("AGENT_OUTPUT_INVALID", {
                message:
                  "The Agent completion does not match its declared output schema.",
              }),
            );
            check();
          }
        },
        hooks: {
          async beforeToolCall({ toolName, input }) {
            access.signal.throwIfAborted();
            toolCall++;
            toolCallId = `${requestId}:${toolCall}`;
            await observer?.beforeTool?.({ toolCallId });
            check();
            activeTool = {
              started: performance.now(),
              name: toolName,
              id: toolCallId,
              call: toolCall,
              requestId,
              modelStep: modelStep + 1,
            };
            log.debug("tool_started", {
              toolName,
              toolCall,
              toolCallId,
              modelRequestId: requestId,
              modelStep: modelStep + 1,
              argumentCount:
                input && typeof input === "object"
                  ? Object.keys(input).length
                  : 0,
            });
            log.assertHealthy();
            access.signal.throwIfAborted();
          },
          async afterToolCall({ error, toolName }) {
            const inputRejected =
              error !== undefined && isAgentToolInputError(error);
            const tool = activeTool;
            const durationMs =
              tool && Math.round(performance.now() - tool.started);
            activeTool = undefined;
            try {
              await observer?.afterTool?.({ toolCallId });
            } finally {
              if (tool)
                log.debug(
                  access.signal.aborted
                    ? "tool_stopped"
                    : inputRejected
                      ? "tool_input_rejected"
                      : error === undefined
                        ? "tool_completed"
                        : "tool_failed",
                  {
                    toolName,
                    toolCall: tool.call,
                    toolCallId: tool.id,
                    modelRequestId: tool.requestId,
                    modelStep: tool.modelStep,
                    durationMs,
                    ...(error === undefined
                      ? {}
                      : {
                          errorCode: inputRejected
                            ? "INVALID_REQUEST"
                            : "TOOL_EXECUTION_FAILED",
                        }),
                  },
                );
            }
            if (error !== undefined && !inputRejected)
              fail(
                toolName === completionName
                  ? ERRORS.create("AGENT_OUTPUT_INVALID", {
                      message:
                        "The Agent completion does not match its declared output schema.",
                    })
                  : error,
                toolName,
              );
          },
        },
      },
    );
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
      completionSubmitted: completion !== undefined,
    });
    if (
      !(completion
        ? ["stop", "tool-calls"].includes(response.finishReason ?? "")
        : response.finishReason === "stop") ||
      !(completion
        ? ["stop", "tool-calls"].includes(finalStep?.finishReason ?? "")
        : finalStep?.finishReason === "stop")
    )
      throw incompleteAgentError(
        response.finishReason !== "stop"
          ? response.finishReason
          : finalStep?.finishReason,
        response.error,
        modelStep >= maxSteps,
      );
    // Mastra 1.67 can cache an object from a Tool round; only the final stop round may authorize an outcome.
    const output = completion
      ? completion.value
      : parseFinalAgentOutput(finalStep?.text);
    log.debug("agent_completed", {
      durationMs: Math.round(performance.now() - started),
      modelSteps: modelStep,
      toolCalls: toolCall,
      ...(modelTiming ? { modelRequestId: requestId } : {}),
    });
    if (executable.capability) {
      if (
        !output ||
        typeof output !== "object" ||
        !Object.hasOwn(output, "output")
      )
        throw ERRORS.create("AGENT_OUTPUT_INVALID");
      return (output as { output: unknown }).output;
    }
    return output;
  } catch (cause) {
    const stopped = access.signal.aborted;
    const error = stopped
      ? access.signal.reason
      : (failure?.cause ?? agentError(cause, lastFinishReason));
    if (activeTool) {
      log.debug(stopped ? "tool_stopped" : "tool_failed", {
        toolName: activeTool.name,
        toolCall: activeTool.call,
        toolCallId: activeTool.id,
        modelRequestId: activeTool.requestId,
        modelStep: activeTool.modelStep,
        durationMs: Math.round(performance.now() - activeTool.started),
        ...(stopped ? {} : { errorCode: "TOOL_EXECUTION_FAILED" }),
      });
      activeTool = undefined;
    }
    modelTiming?.report({}, ERRORS.is(error) ? error.code : undefined);
    const streamObserved =
      failure || callbackError !== undefined ? undefined : streamError?.();
    const observed = callbackError ?? streamObserved;
    log.debug(stopped ? "agent_stopped" : "agent_failed", {
      errorCode: ERRORS.is(error) ? error.code : undefined,
      finishReason: lastFinishReason,
      durationMs: Math.round(performance.now() - started),
      modelSteps: modelStep,
      toolCalls: toolCall,
      ...(modelTiming ? { modelRequestId: requestId } : {}),
      ...(stopped || failure || observed === undefined
        ? {}
        : modelErrorDiagnostics(observed)),
      ...(stopped || failure ? {} : modelErrorDiagnostics(cause)),
      ...(stopped || failure || observed === undefined
        ? {}
        : {
            observedErrorSource:
              callbackError === undefined ? "stream_error" : "on_error",
          }),
    });
    throw error;
  } finally {
    context.clear();
    controller.abort(ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
  }
}
