import { relative } from "node:path";
import { fail } from "../errors.ts";
import type { ResourceKind } from "../source/references.ts";
import type {
  AgentModel,
  CodeModel,
  LinkedLoom,
  ModuleReference,
  ResourceAsset,
  SkillModel,
  StageModel,
  StepModel,
  LoomModel,
} from "./model.ts";
import type {
  SourceLocation,
  SourceResource,
  SourceSet,
  SourceReference,
} from "../source/types.ts";
import { sourceLocation } from "../source/locations.ts";
import { checkReachability } from "./check-reachability.ts";
import { assignResourceIds } from "./assign-resource-ids.ts";

function resourceFile(resource: SourceResource): string {
  if ("document" in resource) return resource.document.source.file;
  if ("metadata" in resource) return resource.metadata.source.file;
  return resource.source.file;
}

export function analyzeLoom(sources: SourceSet): LinkedLoom {
  const root = sources.options.packageRoot;
  const packageInfo = sources.packageJson.value;
  const loom = packageInfo.loom;
  const loaded = new Map(
    sources.resources.map((item) => [
      `${item.kind}:${resourceFile(item)}`,
      item,
    ]),
  );
  const references = new Map<string, SourceReference[]>();
  for (const item of sources.references) {
    const key = JSON.stringify([item.fromFile, item.kind, item.reference]);
    const uses = references.get(key) ?? [];
    uses.push(item);
    references.set(key, uses);
  }
  const codes: Record<string, CodeModel> = Object.create(null);
  const agents: Record<string, AgentModel> = Object.create(null);
  const stages: Record<string, StageModel> = Object.create(null);
  const assets = new Map<string, ResourceAsset>();
  const skills = new Map<string, SkillModel>();

  function get(ref: string, kind: ResourceKind, at: SourceLocation) {
    const uses = references.get(JSON.stringify([at.file, kind, ref]));
    const resolved =
      uses?.find((item) => item.location.stepName === at.stepName) ?? uses?.[0];
    if (!resolved) fail("INVALID_REFERENCE", `Unloaded reference: ${ref}`, at);
    const resource = loaded.get(`${kind}:${resolved.file}`);
    if (resolved.kind !== kind || !resource || resource.kind !== kind)
      fail("INVALID_REFERENCE", `Expected ${kind}: ${ref}`, at);
    return { ...resolved, resource };
  }
  function module(
    ref: string,
    kind: "code" | "schema" | "tool" | "initializer",
    at: SourceLocation,
  ): ModuleReference {
    const resolved = get(ref, kind, at);
    return {
      sourceFile: resolved.file,
      exportName: resolved.exportName,
      location: resolved.location,
    };
  }
  function skill(ref: string, at: SourceLocation): SkillModel {
    const resolved = get(ref, "skill", at);
    const cached = skills.get(resolved.file);
    if (cached) return cached;
    if (resolved.resource.kind !== "skill")
      fail("INVALID_REFERENCE", "Invalid Skill document", at);
    const metadata = resolved.resource.metadata.value;
    const files = resolved.resource.assets;
    for (const asset of files) assets.set(asset.outputPath, asset);
    const value: SkillModel = {
      ...metadata,
      location: { file: resolved.file },
      content: resolved.resource.content,
      assets: files,
    };
    skills.set(resolved.file, value);
    return value;
  }

  for (const [stageName, stageRef] of Object.entries(loom.stages)) {
    const at = {
      ...sourceLocation(sources.packageJson, ["loom", "stages", stageName]),
      stageName,
    };
    const resource = get(stageRef.stage, "stage", at).resource;
    if (!("document" in resource))
      fail("INVALID_REFERENCE", "Expected Stage document", at);
    const document = resource.document;
    const stage = document.value.stage;
    if (stage.name !== stageName)
      fail(
        "INVALID_LOOM",
        `Stage name must match reference key ${stageName}`,
        sourceLocation(document, ["stage", "name"]),
      );
    const steps: Record<string, StepModel> = Object.create(null);
    for (const [stepName, step] of Object.entries(stage.steps)) {
      const stepLocation = {
        ...sourceLocation(document, ["stage", "steps", stepName]),
        stageName,
        stepName,
      };
      let resourceKey: string;
      if (step.type === "code") {
        const codeModule = module(step.code, "code", stepLocation);
        resourceKey = `${relative(root, codeModule.sourceFile).replaceAll("\\", "/")}:${codeModule.exportName}`;
        codes[resourceKey] ??= {
          resourceKey,
          location: stepLocation,
          module: codeModule,
        };
      } else {
        const agent = get(step.agent, "agent", stepLocation);
        if (!("metadata" in agent.resource))
          fail("INVALID_REFERENCE", "Invalid Agent document", stepLocation);
        const metadata = agent.resource.metadata.value;
        const outputSchema = module(step.outputSchema, "schema", stepLocation);
        const agentSkills = step.skills.map((ref) => skill(ref, stepLocation));
        const tools = step.tools.map((ref) =>
          module(ref, "tool", stepLocation),
        );
        const keyModule = (value: ModuleReference) => [
          relative(root, value.sourceFile).replaceAll("\\", "/"),
          value.exportName,
        ];
        resourceKey = JSON.stringify([
          relative(root, agent.file).replaceAll("\\", "/"),
          step.llm,
          keyModule(outputSchema),
          agentSkills.map((item) =>
            relative(root, item.location.file).replaceAll("\\", "/"),
          ),
          tools.map(keyModule),
        ]);
        agents[resourceKey] ??= {
          ...metadata,
          resourceKey,
          location: stepLocation,
          instructions: agent.resource.content,
          llm: step.llm,
          outputSchema,
          skills: agentSkills,
          tools,
        };
      }
      const routes = Object.fromEntries(
        Object.entries(step.on).map(([outcome, next]) => [
          outcome,
          "target" in next
            ? { kind: "step" as const, stepName: next.target }
            : { kind: "stage_end" as const },
        ]),
      );
      if (Object.keys(routes).length === 0)
        fail(
          "INVALID_LOOM",
          "Step must declare an outcome route",
          stepLocation,
        );
      for (const [outcome, next] of Object.entries(routes)) {
        if (next.kind === "step" && !Object.hasOwn(stage.steps, next.stepName))
          fail(
            "INVALID_LOOM",
            `Unknown target step: ${next.stepName}`,
            stepLocation,
          );
        if (next.kind === "stage_end" && !Object.hasOwn(stageRef.on, outcome))
          fail(
            "INVALID_LOOM",
            `Stage is missing outcome route: ${outcome}`,
            stepLocation,
          );
      }
      steps[stepName] = {
        stepName,
        location: stepLocation,
        execution: { kind: step.type, resourceKey },
        on: routes,
      };
    }
    if (!Object.hasOwn(steps, stage.entry))
      fail(
        "INVALID_LOOM",
        `Unknown entry step: ${stage.entry}`,
        sourceLocation(document, ["stage", "entry"]),
      );
    const on = Object.fromEntries(
      Object.entries(stageRef.on).map(([outcome, next]) => [
        outcome,
        "target" in next
          ? { kind: "stage" as const, stageName: next.target }
          : { kind: "loom_end" as const },
      ]),
    );
    for (const next of Object.values(on))
      if (next.kind === "stage" && !Object.hasOwn(loom.stages, next.stageName))
        fail("INVALID_LOOM", `Unknown target stage: ${next.stageName}`, at);
    stages[stageName] = {
      stageName,
      location: at,
      stateSchema: module(
        stage.state.schema,
        "schema",
        sourceLocation(document, ["stage", "state", "schema"]),
      ),
      initializeState: module(
        stage.state.initialize,
        "initializer",
        sourceLocation(document, ["stage", "state", "initialize"]),
      ),
      entryStepName: stage.entry,
      steps,
      on,
    };
  }
  if (!Object.hasOwn(stages, loom.entry))
    fail(
      "INVALID_LOOM",
      `Unknown entry stage: ${loom.entry}`,
      sourceLocation(sources.packageJson, ["loom", "entry"]),
    );
  const model: LoomModel = {
    manifest: packageInfo,
    ...(loom.exclusive === undefined ? {} : { exclusive: loom.exclusive }),
    options: sources.options,
    loomName: loom.name,
    inputs: loom.inputs,
    version: packageInfo.version,
    entryStageName: loom.entry,
    stages,
    codes,
    agents,
    assets: [...assets.values()],
  };
  return { ...assignResourceIds(model), diagnostics: checkReachability(model) };
}
