import type {
  ComponentManifest,
  InstalledLoomRef,
  JsonObject,
  JsonValue,
  LoomContracts,
  LoomManifest,
} from "../index.ts";
import { nodeRequirements } from "../contracts/package.ts";
import { checkOutcome } from "../contracts/outcome.ts";
import { stableJson } from "../schema/json.ts";
import { PackageError } from "./package.ts";
import type { z } from "zod";
import { projectContracts, projectSchema } from "./projection.ts";

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PackageError(
      "DEFINITION_INVALID",
      `${path}: expected a definition object.`,
    );
  return value as Record<string, unknown>;
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value))
    throw new PackageError(
      "DEFINITION_INVALID",
      "Invalid stable definition id.",
    );
  return value;
}
function list(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new PackageError(
      "DEFINITION_INVALID",
      "Expected a declaration list.",
    );
  return value;
}
function callback(value: unknown, path: string): void {
  if (typeof value !== "function")
    throw new PackageError("DEFINITION_INVALID", `${path}: missing callback.`);
}
export interface Inspection {
  readonly manifest: LoomManifest;
  readonly resourcePaths: Record<string, string>;
  readonly dependencyRefs: readonly {
    readonly ref: InstalledLoomRef;
    readonly contracts: LoomContracts;
  }[];
  readonly declarations: Record<string, { id: string; version: string }>;
}
export function inspectDefinition(
  value: unknown,
  target: LoomManifest["build"]["target"] = "node22",
): Inspection {
  const loom = record(value, "entry");
  if (loom.kind !== "loom")
    throw new PackageError(
      "ENTRY_INVALID",
      "Default export must be a Loom definition.",
    );
  const components: Record<string, ComponentManifest> = Object.create(null);
  const resources: Record<string, { path: string }> = Object.create(null);
  const resourcePaths: Record<string, string> = Object.create(null);
  const objects = new Map<string, object>();
  const dependencyRefs: { ref: InstalledLoomRef; contracts: LoomContracts }[] =
    [];
  const models: Record<string, ("tool_use" | "structured_output")[]> =
    Object.create(null);
  const profiles = new Map<string, string>();
  const tools = new Set<string>();
  const workflowTypes = new Set<"mastra">();
  function resource(value: unknown): string {
    const r = record(value, "resource");
    const id = identifier(r.id);
    if (r.kind !== "resource" || typeof r.path !== "string")
      throw new PackageError("RESOURCE_INVALID", id);
    if (resourcePaths[id] !== undefined && resourcePaths[id] !== r.path)
      throw new PackageError("RESOURCE_ID_DUPLICATE", id);
    resourcePaths[id] = r.path;
    if (typeof r.packagePath === "string")
      resources[id] = { path: r.packagePath };
    return id;
  }
  function contracts(d: Record<string, unknown>, path: string): LoomContracts {
    const projected = projectContracts(
      d.inputSchema as z.ZodType,
      d.outputSchema as z.ZodType,
      path,
    );
    return projected;
  }
  function uses(
    value: unknown,
  ): NonNullable<ComponentManifest["uses"]> | undefined {
    if (value === undefined) return undefined;
    const u = record(value, "uses");
    const references = (kind: "agent" | "tool", values: unknown) =>
      list(values).map((value) => {
        const d = record(value, "uses");
        if (d.kind !== kind)
          throw new PackageError(
            "REFERENCE_INVALID",
            `Expected ${kind} reference.`,
          );
        return component(value);
      });
    return {
      ...(u.agents !== undefined
        ? { agents: references("agent", u.agents) }
        : {}),
      ...(u.tools !== undefined ? { tools: references("tool", u.tools) } : {}),
      ...(u.resources !== undefined
        ? { resources: list(u.resources).map(resource) }
        : {}),
    };
  }
  function step(value: unknown, seen: Set<string>): JsonObject {
    const d = record(value, "step");
    const id = identifier(d.id);
    if (d.kind !== "step")
      throw new PackageError("ENTRY_INVALID", `Invalid Step ${id}.`);
    if (seen.has(id)) throw new PackageError("STEP_ID_DUPLICATE", id);
    seen.add(id);
    if (d.source === "component")
      return { id, source: "component", component: component(d.resource) };
    if (d.source === "loom") {
      const child = record(d.resource, "loom_ref");
      if (
        child.kind === "loom_command" &&
        typeof child.packageName === "string" &&
        typeof child.command === "string"
      )
        return {
          id,
          source: "loom",
          packageName: child.packageName,
          command: child.command,
        };
      if (child.kind !== "loom_ref")
        throw new PackageError("DEPENDENCY_UNRESOLVED", id);
      const ref = {
        id: child.id,
        version: child.version,
        artifactDigest: child.artifactDigest,
      } as InstalledLoomRef;
      const io = child.contracts as LoomContracts;
      dependencyRefs.push({ ref, contracts: io });
      return { id, source: "loom", ref: { ...ref } };
    }
    if (d.source !== "inline")
      throw new PackageError(
        "DEFINITION_INVALID",
        `Unknown Step source for ${id}.`,
      );
    callback(d.execute, `${id}.execute`);
    const io = contracts(d, id);
    const declared = uses(d.uses);
    const result: JsonObject = {
      id,
      source: "inline",
      contracts: io as unknown as JsonObject,
    };
    if (declared) result.uses = declared as unknown as JsonObject;
    if (d.description !== undefined) result.description = String(d.description);
    if (d.suspendSchema)
      result.suspend = projectSchema(
        d.suspendSchema as z.ZodType,
        "suspend",
        "output",
        `${id}.suspendSchema`,
      );
    if (d.resumeSchema)
      result.resume = {
        input: projectSchema(
          d.resumeSchema as z.ZodType,
          "resume",
          "input",
          `${id}.resumeSchema`,
        ),
        normalizedInput: projectSchema(
          d.resumeSchema as z.ZodType,
          "resume",
          "output",
          `${id}.resumeSchema`,
        ),
      };
    if (d.interaction) {
      const interaction = record(d.interaction, "interaction");
      if (
        !d.suspendSchema ||
        !d.resumeSchema ||
        (interaction.kind !== undefined &&
          !["ask", "approval"].includes(String(interaction.kind))) ||
        (interaction.kind === "approval" &&
          interaction.responsePolicy !== "human") ||
        !["any", "human"].includes(String(interaction.responsePolicy))
      )
        throw new PackageError(
          "DEFINITION_INVALID",
          `${id}: invalid interaction.`,
        );
      callback(interaction.message, `${id}.message`);
      if (interaction.context !== undefined)
        callback(interaction.context, `${id}.context`);
      result.interaction = {
        ...(interaction.kind === undefined
          ? {}
          : { kind: String(interaction.kind) }),
        responsePolicy: String(interaction.responsePolicy),
        context: interaction.context !== undefined,
      };
    }
    return result;
  }
  function component(value: unknown): string {
    const d = record(value, "component");
    const id = identifier(d.id);
    if (objects.has(id)) {
      if (objects.get(id) !== value)
        throw new PackageError("COMPONENT_ID_DUPLICATE", id);
      return id;
    }
    if (
      !["code", "agent", "tool", "skill", "workflow"].includes(String(d.kind))
    )
      throw new PackageError("ENTRY_INVALID", `Invalid component ${id}.`);
    objects.set(id, d);
    const kind = d.kind as ComponentManifest["kind"];
    const descriptor: {
      -readonly [K in keyof ComponentManifest]: ComponentManifest[K];
    } = { kind };
    if (d.description !== undefined)
      descriptor.description = String(d.description);
    if (kind !== "skill") descriptor.contracts = contracts(d, id);
    const declared = uses(d.uses);
    if (declared) descriptor.uses = declared;
    if (kind === "code") callback(d.execute, `${id}.execute`);
    if (kind === "tool") {
      if (d.summarize !== undefined) callback(d.summarize, `${id}.summarize`);
      if ((typeof d.execute === "function") === (typeof d.binding === "string"))
        throw new PackageError(
          "DEFINITION_INVALID",
          `${id}: exactly one Tool implementation is required.`,
        );
      if (d.binding !== undefined) {
        descriptor.binding = identifier(d.binding);
        tools.add(descriptor.binding);
      }
    }
    if (kind === "agent" || kind === "skill") {
      descriptor.instructions =
        typeof d.instructions === "string"
          ? { text: d.instructions }
          : { resource: resource(d.instructions) };
    }
    if (kind === "skill")
      descriptor.resources = list(d.resources).map(resource);
    if (kind === "agent") {
      callback(d.prompt, `${id}.prompt`);
      if (d.outputMode !== "text" && d.outputMode !== "structured")
        throw new PackageError("DEFINITION_INVALID", `${id}.outputMode`);
      descriptor.outputMode = d.outputMode;
      if (typeof d.resultTool === "string")
        descriptor.resultTool = d.resultTool;
      descriptor.tools = list(d.tools).map((tool) => {
        if (record(tool, "tool").kind !== "tool")
          throw new PackageError("REFERENCE_INVALID", id);
        return component(tool);
      });
      descriptor.skills = list(d.skills).map((skill) => {
        if (record(skill, "skill").kind !== "skill")
          throw new PackageError("REFERENCE_INVALID", id);
        return component(skill);
      });
      const model = record(d.model, "model");
      const slot = identifier(model.slot);
      if (model.profile !== undefined) {
        const profile = identifier(model.profile);
        if (profiles.has(slot) && profiles.get(slot) !== profile)
          throw new PackageError(
            "DEFINITION_INVALID",
            `Conflicting profiles for slot ${slot}`,
          );
        profiles.set(slot, profile);
      }
      const capabilities = new Set(
        model.capabilities as ("tool_use" | "structured_output")[],
      );
      if (descriptor.tools.length) capabilities.add("tool_use");
      if (d.outputMode === "structured" && !d.resultTool)
        capabilities.add("structured_output");
      descriptor.model = {
        slot,
        ...(typeof model.profile === "string"
          ? { profile: model.profile }
          : {}),
        capabilities: [...capabilities].sort(),
      };
      models[slot] = [
        ...new Set([...(models[slot] ?? []), ...capabilities]),
      ].sort();
      descriptor.generation = d.generation as NonNullable<
        ComponentManifest["generation"]
      >;
    }
    if (kind === "workflow") {
      if (d.type !== "mastra")
        throw new PackageError("TARGET_UNSUPPORTED", `${id}.type`);
      workflowTypes.add("mastra");
      descriptor.workflowType = "mastra";
      const seen = new Set<string>();
      descriptor.structure = list(d.nodes).map((value): JsonValue => {
        const node = record(value, "node");
        if (node.kind === "map") {
          callback(node.map, `${id}.map`);
          return { kind: "map" };
        }
        if (node.kind === "parallel")
          return {
            kind: "parallel",
            steps: list(node.steps).map((value) => step(value, seen)),
          };
        if (node.kind === "branch")
          return {
            kind: "branch",
            steps: list(node.branches).map((branch) => {
              const pair = list(branch);
              callback(pair[0], `${id}.condition`);
              return step(pair[1], seen);
            }),
          };
        if (
          !["then", "foreach", "dowhile", "dountil"].includes(String(node.kind))
        )
          throw new PackageError(
            "DEFINITION_INVALID",
            `${id}: unsupported Workflow construct.`,
          );
        if (node.kind === "dowhile" || node.kind === "dountil")
          callback(node.condition, `${id}.condition`);
        return {
          kind: String(node.kind),
          step: step(node.step, seen),
          ...(node.kind === "foreach"
            ? { concurrency: node.concurrency as number }
            : {}),
        };
      });
    }
    components[id] = descriptor;
    return id;
  }
  const entry = record(loom.entry, "entry");
  if (!["code", "agent", "workflow"].includes(String(entry.kind)))
    throw new PackageError(
      "ENTRY_INVALID",
      "Loom entry must be Code, Agent, or a committed Workflow.",
    );
  const entryId = component(entry);
  if (loom.outcome)
    checkOutcome(loom.outcome as NonNullable<LoomManifest["outcome"]>);
  const manifest: LoomManifest = {
    formatVersion: 1,
    id: loom.id as string,
    name: (loom.name ?? loom.id) as string,
    version: loom.version as string,
    description: loom.description as string,
    storage: (loom.storage ?? "global") as "global" | "project",
    entry: {
      id: entryId,
      kind: entry.kind as "code" | "agent" | "workflow",
      ...(entry.kind === "workflow" ? { workflowType: "mastra" as const } : {}),
    },
    module: { path: "./runtime.mjs", export: "default" },
    contracts: components[entryId]?.contracts as LoomContracts,
    components,
    dependencies: {},
    resources,
    requirements: {
      node: nodeRequirements[target],
      workflowTypes: [...workflowTypes],
      models,
      tools: [...tools].sort(),
    },
    ...(loom.outcome
      ? { outcome: loom.outcome as NonNullable<LoomManifest["outcome"]> }
      : {}),
    build: { compilerVersion: "0.4.0", target },
  };
  // The worker serializes only descriptive data; no callback or Zod instance crosses this boundary.
  return JSON.parse(
    stableJson({
      manifest,
      resourcePaths,
      dependencyRefs,
      declarations: loom.dependencies ?? {},
    }),
  ) as Inspection;
}
