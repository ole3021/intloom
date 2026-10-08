import { isLoomError } from "@intloom/utils";
import type { Blueprint } from "../workflow/blueprint.ts";
import type { AgentRegistry } from "../workflow/registries.ts";
import { createServicePreparation } from "../effector/service/prepare.ts";
import {
  resolveRunExecution,
  type RunSource,
} from "../runtime/execution-policy.ts";
import type { LoomConfig } from "./schemas/loom-config.ts";
import type { ExecutionReadiness } from "./contracts.ts";

/** Common admission policy; model assembly and instance ownership remain inside service. */
export function createExecutionPreparation(
  config: LoomConfig,
  resources: AgentRegistry,
) {
  const service = createServicePreparation(config, resources);
  function inspect(blueprint: Blueprint, source: RunSource) {
    const execution = resolveRunExecution(source, config.useMcpAgent);
    if (execution.agentExecutor === "service") service.check(blueprint);
    return execution;
  }
  return {
    agents: service.agents,
    status() {
      return {
        useMcpAgent: config.useMcpAgent,
        serviceConfigured: config.llms !== undefined,
        preparedServiceAgents: Object.keys(service.agents).length,
      };
    },
    readiness(blueprint: Blueprint, source: RunSource): ExecutionReadiness {
      const execution = resolveRunExecution(source, config.useMcpAgent);
      try {
        inspect(blueprint, source);
        return { ...execution, status: "available" };
      } catch (cause) {
        if (!isLoomError(cause)) throw cause;
        return {
          ...execution,
          status:
            cause.code === "INVALID_REQUEST"
              ? "configuration_required"
              : "unavailable",
          error: {
            code: cause.code,
            message: cause.message,
            retryable: cause.retryable,
          },
        };
      }
    },
    async prepare(blueprint: Blueprint, source: RunSource) {
      const execution = inspect(blueprint, source);
      if (execution.agentExecutor === "service")
        await service.prepare(blueprint);
      return execution;
    },
  };
}
