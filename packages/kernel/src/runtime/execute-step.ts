import { observeExternalTool } from "./run-observation.ts";
import { createAgentAccess, createCodeAccess } from "./execution-access.ts";
import { ERRORS } from "../errors.ts";
import type { RunEntry } from "./run-entry.ts";
import type { Resolution } from "./routing.ts";
import type { RuntimeOptions } from "./contracts.ts";
import { stepResultSchema } from "@intloom/loom-sdk";
import {
  capabilityStepInput,
  capabilityStepSkipped,
  saveCapabilityAgentOutput,
} from "../loom/capability.ts";
import type { ExecutableAgent } from "../execution/execution.ts";
import type { StepResult } from "@intloom/loom-sdk";
import { beginAgentWait } from "./agent-call.ts";

/** Dispatches to the environment's Execution without advancing the Run, reassembling Agents, or mapping business input. */
export async function executeStep(
  options: RuntimeOptions,
  entry: RunEntry,
  executed: Extract<Resolution, { kind: "execute" }>,
  call: import("./call-scope.ts").RuntimeCall,
): Promise<StepResult> {
  const execution = executed.step.execution;
  switch (execution.kind) {
    case "code": {
      const code = Object.hasOwn(options.codes, execution.codeId)
        ? options.codes[execution.codeId]
        : undefined;
      if (typeof code !== "function")
        throw ERRORS.create("STEP_EXECUTION_FAILED", {
          message: `Code ${execution.codeId} is unavailable.`,
        });
      if (entry.recoveredAnswer) {
        const { action, answer } = entry.recoveredAnswer;
        return options.executor.recoverCode(
          code,
          {
            actionId: action.id,
            kind: action.kind,
            request: action.request,
            answer,
          },
          createCodeAccess(entry, call, options.storage, options.project),
        );
      }
      return options.executor.executeCode(
        code,
        createCodeAccess(entry, call, options.storage, options.project),
      );
    }
    case "agent": {
      if (entry.recoveredAnswer && execution.recoveryCodeId) {
        const code = options.codes[execution.recoveryCodeId];
        if (!code) throw ERRORS.create("RUN_STATE_INVALID");
        const { action, answer } = entry.recoveredAnswer;
        return options.executor.recoverCode(
          code,
          {
            actionId: action.id,
            kind: action.kind,
            request: action.request,
            answer,
          },
          createCodeAccess(entry, call, options.storage, options.project),
        );
      }
      const access = createAgentAccess(
        entry,
        call,
        options.storage,
        undefined,
        options.project,
      );
      if (
        capabilityStepSkipped(
          entry.blueprint,
          executed.step.stepName,
          access.state.value,
        )
      )
        return { outcome: "complete" };
      const capability = capabilityStepInput(
        entry.blueprint,
        executed.step.stepName,
        access,
      );
      const dispatch = (agent: ExecutableAgent) =>
        options.executor.executeAgent(
          capability
            ? {
                outputSchema: stepResultSchema,
                async execute(_input, boundAccess, maxSteps, observer) {
                  const value = await agent.execute(
                    capability.input,
                    boundAccess,
                    maxSteps,
                    observer,
                  );
                  boundAccess.signal.throwIfAborted();
                  return saveCapabilityAgentOutput(
                    entry.blueprint,
                    capability.step,
                    value,
                    boundAccess,
                  );
                },
              }
            : agent,
          null,
          access,
        );
      if (entry.state.execution.agentExecutor === "mcp_client") {
        const resource =
          options.agentResources &&
          Object.hasOwn(options.agentResources, execution.agentId)
            ? options.agentResources[execution.agentId]
            : undefined;
        if (!resource)
          throw ERRORS.create("STEP_EXECUTION_FAILED", {
            message: "Agent resources are unavailable.",
          });
        return dispatch({
          outputSchema: resource.spec.outputSchema,
          execute: async (input) =>
            options.executor.delegated.begin(resource, {
              input,
              scope: call,
              cursor: { ...entry.state.cursor },
              logger: entry.activeLog ?? entry.logger,
              closedAndSettled: call.closedAndSettled,
              beginWait: (pending) => beginAgentWait(entry, call, pending),
              observeTool: (toolCallId) => {
                const settled = call.trackActivity();
                const observed = observeExternalTool(entry, toolCallId);
                return () => {
                  observed();
                  settled();
                };
              },
              access: (assertTool) =>
                createAgentAccess(
                  entry,
                  call,
                  options.storage,
                  assertTool,
                  options.project,
                ),
            }),
        });
      }
      let agent = Object.hasOwn(options.agents, execution.agentId)
        ? options.agents[execution.agentId]
        : undefined;
      if (!agent && options.prepareAgent) {
        agent = await options.prepareAgent(execution.agentId);
        call.assertCurrent();
      }
      if (!agent)
        throw ERRORS.create("STEP_EXECUTION_FAILED", {
          message: `Agent ${execution.agentId} is unavailable.`,
        });
      return dispatch(agent);
    }
    default:
      throw ERRORS.create("STEP_EXECUTION_FAILED");
  }
}
