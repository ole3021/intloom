import type { Blueprint } from "@intloom/loom-sdk";
import type { AgentRegistry } from "../../loom/registries.ts";
import { referencedAgentIds } from "../../loom/agent-ids.ts";
import type { ModelConfiguration } from "./configuration.ts";
import type { ExecutableAgent } from "../execution.ts";
import { ERRORS } from "../../errors.ts";
import { resolveAgentModel } from "./agent-model.ts";
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
    // Keep the old source protocol's admission policy until its consumers migrate.
    if (!blueprint.capability && !config.llms)
      throw ERRORS.create("INVALID_REQUEST", {
        message: "Service execution requires llms.default in intloom.yaml.",
      });
    for (const id of eagerAgentIds(blueprint)) {
      const resource = resourceFor(id);
      resolveAgentModel(
        resource.spec,
        config,
        `${resource.source.packageName}/${id}`,
        credentials,
      );
    }
  }
  function eagerAgentIds(blueprint: Blueprint) {
    if (!blueprint.capability) return referencedAgentIds(blueprint);
    const conditional = new Set(
      blueprint.capability.plan.steps
        .filter((step) => step.kind === "agent" && step.when)
        .map((step) => step.id),
    );
    return [
      ...new Set(
        Object.values(blueprint.stages).flatMap((stage) =>
          Object.values(stage.steps).flatMap((step) =>
            step.execution.kind === "agent" && !conditional.has(step.stepName)
              ? [step.execution.agentId]
              : [],
          ),
        ),
      ),
    ];
  }
  function prepareAgent(id: string): Promise<ExecutableAgent> {
    let promise = preparing.get(id);
    if (!promise) {
      const resource = resourceFor(id);
      resolveAgentModel(
        resource.spec,
        config,
        `${resource.source.packageName}/${id}`,
        credentials,
      );
      promise = assemble(resource.spec, {
        agentId: id,
        source: resource.source,
        config,
        credentials,
      })
        .then((result) => {
          agents[id] = result.executable;
          return result.executable;
        })
        .catch((cause) => {
          preparing.delete(id);
          throw ERRORS.wrap("KERNEL_UNAVAILABLE", cause, {
            message: `Cannot prepare service Agent ${id}.`,
            retryable: false,
          });
        });
      preparing.set(id, promise);
    }
    return promise;
  }
  return {
    agents,
    check,
    prepareAgent,
    async prepare(blueprint: Blueprint) {
      check(blueprint);
      await Promise.all(eagerAgentIds(blueprint).map(prepareAgent));
    },
  };
}
