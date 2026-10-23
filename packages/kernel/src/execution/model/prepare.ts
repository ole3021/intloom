import type { Blueprint } from "@intloom/loom-sdk";
import type { AgentRegistry } from "../../loom/registries.ts";
import { referencedAgentIds } from "../../loom/agent-ids.ts";
import type { ModelConfiguration } from "./configuration.ts";
import type { ExecutableAgent } from "../execution.ts";
import { ERRORS } from "../../errors.ts";
import { resolveModelConfig } from "./agent-model.ts";
import type { createAgent } from "./create-agent.ts";
import { createCredentialResolver } from "./credentials.ts";

/** Owns only service model preparation; entry policy belongs to Core. */
export function createServicePreparation(
  config: ModelConfiguration,
  resources: AgentRegistry,
  assemble: typeof createAgent = async (...args) =>
    (await import("./create-agent.ts")).createAgent(...args),
  projectRoot?: string,
) {
  const credentials = createCredentialResolver(projectRoot);
  const agents: Record<string, ExecutableAgent> = Object.create(null);
  const preparing = new Map<string, Promise<ExecutableAgent>>();
  function resourceFor(id: string) {
    const resource = Object.hasOwn(resources, id) ? resources[id] : undefined;
    if (!resource)
      throw ERRORS.create("KERNEL_UNAVAILABLE", {
        message: `Agent resource ${id} is unavailable.`,
        retryable: false,
      });
    return resource;
  }
  function check(blueprint: Blueprint) {
    if (!config.llms)
      throw ERRORS.create("INVALID_REQUEST", {
        message:
          "Service execution requires llms.default in intloom.yaml. Configure the model and referenced credentials, then restart the service.",
      });
    for (const id of referencedAgentIds(blueprint)) {
      const resource = resourceFor(id);
      resolveModelConfig(
        resource.spec.llm,
        config,
        `${resource.source.packageName}/${id}`,
        credentials,
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
              credentials,
            })
              .then((result) => result.executable)
              .catch((cause) => {
                preparing.delete(id);
                throw ERRORS.wrap("KERNEL_UNAVAILABLE", cause, {
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
