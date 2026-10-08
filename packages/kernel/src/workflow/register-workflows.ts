import type { AgentId, Blueprint, CodeId } from "./blueprint.ts";
import type { ExecutableCode } from "../effector/execution.ts";
import { fail } from "./errors.ts";
import type { LoadedAgent, LoadedWorkflow, WorkflowPackage } from "./types.ts";
import type { WorkflowRegistries } from "./registries.ts";

/** Validates and registers in new registries; failure preserves previous successful registrations. */
export function registerWorkflows(
  workflows: readonly LoadedWorkflow[],
  agents: readonly LoadedAgent[],
  existing?: WorkflowRegistries,
): WorkflowRegistries {
  const blueprints: Record<string, Blueprint> = Object.assign(
    Object.create(null),
    existing?.blueprints,
  );
  const codes: Record<CodeId, ExecutableCode> = Object.assign(
    Object.create(null),
    existing?.codes,
  );
  const agentRegistry: Record<AgentId, LoadedAgent> = Object.assign(
    Object.create(null),
    existing?.agents,
  );
  const sources: Record<string, WorkflowPackage> = Object.assign(
    Object.create(null),
    existing?.sources,
  );
  const expected = new Map<AgentId, string>();

  for (const workflow of workflows) {
    const { source, blueprint } = workflow;
    const name = source.packageName;
    if (Object.hasOwn(blueprints, blueprint.flowName)) {
      fail(
        "WORKFLOW_CONFLICT",
        `${name}: Workflow already registered: ${blueprint.flowName} (${sources[blueprint.flowName]?.packageName})`,
      );
    }
    for (const [id, code] of Object.entries(workflow.codes)) {
      if (Object.hasOwn(codes, id)) {
        fail("WORKFLOW_CONFLICT", `${name}: Code already registered: ${id}`);
      }
      codes[id] = code;
    }
    for (const id of Object.keys(workflow.agentSpecs)) {
      if (Object.hasOwn(agentRegistry, id) || expected.has(id)) {
        fail("WORKFLOW_CONFLICT", `${name}: Agent already registered: ${id}`);
      }
      expected.set(id, name);
    }
    blueprints[blueprint.flowName] = blueprint;
    sources[blueprint.flowName] = source;
  }

  const supplied = new Set<AgentId>();
  for (const agent of agents) {
    const { agentId, spec } = agent;
    if (!expected.has(agentId) || supplied.has(agentId)) {
      fail(
        "WORKFLOW_REGISTRATION_FAILED",
        `Unexpected or duplicate loaded Agent: ${agentId}`,
      );
    }
    if (!spec || typeof spec.outputSchema?.safeParse !== "function") {
      fail(
        "WORKFLOW_REGISTRATION_FAILED",
        `Incomplete loaded Agent: ${agentId}`,
      );
    }
    agentRegistry[agentId] = agent;
    supplied.add(agentId);
  }
  for (const [id, name] of expected) {
    if (!supplied.has(id)) {
      fail(
        "WORKFLOW_REGISTRATION_FAILED",
        `${name}: Missing loaded Agent: ${id}`,
      );
    }
  }

  return { blueprints, codes, agents: agentRegistry, sources };
}
