import type { Blueprint } from "../../workflow/blueprint.ts";
import type { AgentRegistry } from "../../workflow/registries.ts";
import { referencedAgentIds } from "../../workflow/agent-ids.ts";
import type { LoomConfig } from "../../core/schemas/loom-config.ts";
import type { ExecutableAgent } from "../execution.ts";
import { KERNEL_ERRORS } from "../../errors/kernel.ts";
import { resolveModelConfig } from "./agent-model.ts";
import type { createAgent } from "./create-agent.ts";

/** Owns only service model preparation; entry policy belongs to Core. */
export function createServicePreparation(
  config: LoomConfig,
  resources: AgentRegistry,
  assemble: typeof createAgent = async (...args) =>
    (await import("./create-agent.ts")).createAgent(...args),
) {
  const agents: Record<string, ExecutableAgent> = Object.create(null);
  const preparing = new Map<string, Promise<ExecutableAgent>>();
  function resourceFor(id: string) {
    const resource = Object.hasOwn(resources, id) ? resources[id] : undefined;
    if (!resource)
      throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE", {
        message: `Agent resource ${id} is unavailable.`,
        retryable: false,
      });
    return resource;
  }
  function check(blueprint: Blueprint) {
    if (!config.llms)
      throw KERNEL_ERRORS.create("INVALID_REQUEST", {
        message:
          "Service execution requires llms.default in intloom.yaml. Configure the model and referenced credentials, then restart the service.",
      });
    for (const id of referencedAgentIds(blueprint)) {
      const resource = resourceFor(id);
      resolveModelConfig(
        resource.spec.llm,
        config,
        `${resource.source.packageName}/${id}`,
      );
    }
  }
  return {
    agents,
    check,
    async prepare(blueprint: Blueprint) {
      check(blueprint);
      const ids = referencedAgentIds(blueprint);

      const initialized = await Promise.all(
        ids.map((id) => {
          let promise = preparing.get(id);
          if (!promise) {
            const resource = resourceFor(id);
            promise = assemble(resource.spec, {
              agentId: id,
              source: resource.source,
              config,
            })
              .then((result) => result.executable)
              .catch((cause) => {
                preparing.delete(id);
                throw KERNEL_ERRORS.wrap("KERNEL_UNAVAILABLE", cause, {
                  message: `Cannot prepare service Agent ${id}.`,
                  retryable: false,
                });
              });
            preparing.set(id, promise);
          }
          return promise.then((agent) => [id, agent] as const);
        }),
      );
      for (const [id, agent] of initialized) agents[id] = agent;
    },
  };
}
