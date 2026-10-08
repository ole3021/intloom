import type { ServiceAgent } from "./types.ts";
import { getLogger } from "@intloom/utils";
import type { PublicSchema } from "@mastra/core/schema";
import { agentJsonSchema } from "../agent-tool.ts";
import type { JsonValue, ReadonlyJsonValue } from "../../shared/json.ts";
import { RUNTIME_ERRORS } from "../../errors/runtime.ts";
import { bindAgentContext } from "./agent-context.ts";
import { toolError } from "../errors.ts";
import { agentError } from "./errors.ts";
import type { AgentExecutionAccess } from "../execution.ts";

const instruction =
  "Execute the current Workflow step according to your instructions. Read current business State using your assigned Tools, save business changes through those Tools, then return the required outcome object. User interaction belongs to Workflow Code steps.";

export async function executeServiceAgent(
  executable: ServiceAgent,
  input: ReadonlyJsonValue,
  access: AgentExecutionAccess<JsonValue>,
  maxSteps: number,
): Promise<unknown> {
  access.signal.throwIfAborted();
  if (input !== null)
    throw RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED", {
      message:
        "Agent execution receives null input; business data belongs in Stage State.",
    });
  // The SDK receives only the input JSON Schema; this layer parses with the original Zod Schema once to avoid repeated transforms.
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
  log.debug("agent_started", { maxSteps });
  try {
    log.assertHealthy();
    access.signal.throwIfAborted();
    const response = await executable.agent.generate(instruction, {
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
        errorStrategy: "strict",
        jsonPromptInjection: "auto",
      },
      onStepFinish(step) {
        log.debug("model_step_completed", {
          modelStep: ++modelStep,
          model: step.model?.modelId,
          finishReason: step.finishReason,
          inputTokens: step.usage?.inputTokens,
          outputTokens: step.usage?.outputTokens,
        });
      },
      hooks: {
        beforeToolCall({ toolName, input }) {
          access.signal.throwIfAborted();
          toolStarted = performance.now();
          toolCall++;
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
        afterToolCall({ error, toolName }) {
          log.debug(error === undefined ? "tool_completed" : "tool_failed", {
            toolName,
            toolCall,
            durationMs: Math.round(performance.now() - toolStarted),
          });
          if (error !== undefined) fail(error, toolName);
        },
      },
    });
    check();
    if (response.finishReason !== "stop")
      throw RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED", {
        message: "Agent execution ended without a complete final response.",
      });
    log.debug("agent_completed", {
      durationMs: Math.round(performance.now() - started),
      modelSteps: modelStep,
      toolCalls: toolCall,
    });
    return response.object;
  } catch (cause) {
    access.signal.throwIfAborted();
    throw failure?.cause ?? agentError(cause);
  } finally {
    context.clear();
    controller.abort(RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
  }
}
