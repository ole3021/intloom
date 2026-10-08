import { createAgentAccess, createCodeAccess } from "./execution-access.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import type { RunEntry } from "./run-entry.ts";
import type { Resolution } from "./routing.ts";
import type { RuntimeOptions } from "./contracts.ts";
import type { StepResult } from "../effector/execution.ts";
import { suspendAgentCall } from "./agent-call.ts";

/** Dispatches to the environment's Effector without advancing the Run, reassembling Agents, or mapping business input. */
export async function executeStep(
  options: RuntimeOptions,
  entry: RunEntry,
  executed: Extract<Resolution, { kind: "execute" }>,
  call: AbortController,
): Promise<StepResult> {
  const execution = executed.step.execution;
  switch (execution.kind) {
    case "code": {
      const code = Object.hasOwn(options.codes, execution.codeId)
        ? options.codes[execution.codeId]
        : undefined;
      if (typeof code !== "function")
        throw RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED", {
          message: `Code ${execution.codeId} is unavailable.`,
        });
      if (entry.recoveredAnswer) {
        const saved = structuredClone(entry.recoveredAnswer);
        const recover = code.recover;
        if (!recover)
          throw RUNTIME_ERRORS.create("RUN_INTERRUPTED", {
            message:
              "This Code does not provide an interaction recovery entry.",
          });
        return options.effector.executeCode(
          (_input, access) => recover(saved, access),
          null,
          createCodeAccess(entry, call, options.storage, options.project),
        );
      }
      return options.effector.executeCode(
        code,
        null,
        createCodeAccess(entry, call, options.storage, options.project),
      );
    }
    case "agent": {
      if (entry.state.execution.agentExecutor === "mcp_client") {
        const resource =
          options.agentResources &&
          Object.hasOwn(options.agentResources, execution.agentId)
            ? options.agentResources[execution.agentId]
            : undefined;
        if (!resource)
          throw RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED", {
            message: "Agent resources are unavailable.",
          });
        return options.effector.executeAgent(
          {
            outputSchema: resource.spec.outputSchema,
            execute: async () =>
              suspendAgentCall(entry, call, resource, (assertTool) =>
                createAgentAccess(
                  entry,
                  call,
                  options.storage,
                  assertTool,
                  options.project,
                ),
              ),
          },
          null,
          createAgentAccess(
            entry,
            call,
            options.storage,
            undefined,
            options.project,
          ),
        );
      }
      const agent = Object.hasOwn(options.agents, execution.agentId)
        ? options.agents[execution.agentId]
        : undefined;
      if (!agent)
        throw RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED", {
          message: `Agent ${execution.agentId} is unavailable.`,
        });
      return options.effector.executeAgent(
        agent,
        null,
        createAgentAccess(
          entry,
          call,
          options.storage,
          undefined,
          options.project,
        ),
      );
    }
    default:
      throw RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED");
  }
}
