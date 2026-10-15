import type { AgentId, Blueprint, CodeId } from "./blueprint.ts";
import type { ExecutableCode } from "../effector/execution.ts";
import { fail } from "./errors.ts";
import type { LoadedAgent, LoadedLoom, LoomPackage } from "./types.ts";
import type { LoomRegistries } from "./registries.ts";

/** Validates and registers in new registries; failure preserves previous successful registrations. */
export function registerLooms(
  looms: readonly LoadedLoom[],
  agents: readonly LoadedAgent[],
  existing?: LoomRegistries,
): LoomRegistries {
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
  const sources: Record<string, LoomPackage> = Object.assign(
    Object.create(null),
    existing?.sources,
  );
  const expected = new Map<AgentId, string>();

  for (const loom of looms) {
    const { source, blueprint } = loom;
    const name = source.packageName;
    if (Object.hasOwn(blueprints, blueprint.loomName)) {
      fail(
        "LOOM_CONFLICT",
        `${name}: Loom already registered: ${blueprint.loomName} (${sources[blueprint.loomName]?.packageName})`,
      );
    }
    for (const [id, code] of Object.entries(loom.codes)) {
      if (Object.hasOwn(codes, id)) {
        fail("LOOM_CONFLICT", `${name}: Code already registered: ${id}`);
      }
      codes[id] = code;
    }
    for (const id of Object.keys(loom.agentSpecs)) {
      if (Object.hasOwn(agentRegistry, id) || expected.has(id)) {
        fail("LOOM_CONFLICT", `${name}: Agent already registered: ${id}`);
      }
      expected.set(id, name);
    }
    blueprints[blueprint.loomName] = blueprint;
    sources[blueprint.loomName] = source;
  }

  const supplied = new Set<AgentId>();
  for (const agent of agents) {
    const { agentId, spec } = agent;
    if (!expected.has(agentId) || supplied.has(agentId)) {
      fail(
        "LOOM_REGISTRATION_FAILED",
        `Unexpected or duplicate loaded Agent: ${agentId}`,
      );
    }
    if (!spec || typeof spec.outputSchema?.safeParse !== "function") {
      fail("LOOM_REGISTRATION_FAILED", `Incomplete loaded Agent: ${agentId}`);
    }
    agentRegistry[agentId] = agent;
    supplied.add(agentId);
  }
  for (const [id, name] of expected) {
    if (!supplied.has(id)) {
      fail("LOOM_REGISTRATION_FAILED", `${name}: Missing loaded Agent: ${id}`);
    }
  }

  return { blueprints, codes, agents: agentRegistry, sources };
}
