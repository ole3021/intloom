import { realpath, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fail } from "../errors.ts";
import { isPathWithin, resolveReference } from "../source/references.ts";
import type {
  AgentModel,
  CodeModel,
  LinkedWorkflow,
  ModuleReference,
  ResourceAsset,
  SkillModel,
  StageModel,
  StepModel,
  WorkflowModel,
} from "./model.ts";
import type {
  SourceLocation,
  SourceResource,
  SourceSet,
} from "../source/types.ts";
import {
  workflowSchema,
  stageSchema,
  metadataSchema,
  packageSchema,
} from "./schemas.ts";
import { sourceLocation } from "../source/locations.ts";
import { validateDocument } from "./validate-document.ts";
import { collectSkillAssets } from "./collect-skill-assets.ts";
import { assignResourceIds } from "./assign-resource-ids.ts";

function resourceFile(resource: SourceResource): string {
  if ("document" in resource) return resource.document.source.file;
  if ("metadata" in resource) return resource.metadata.source.file;
  return resource.source.file;
}

export async function analyzeWorkflow(
  sources: SourceSet,
): Promise<LinkedWorkflow> {
  const root = sources.options.packageRoot;
  const packageInfo = validateDocument(packageSchema, sources.packageJson);
  const source = sources.resources.find((item) => item.kind === "workflow");
  if (!source || !("document" in source))
    fail("INVALID_WORKFLOW", "Missing workflow.yaml");
  const workflow = validateDocument(workflowSchema, source.document).workflow;
  const loaded = new Map(
    sources.resources.map((item) => [resourceFile(item), item]),
  );
  const codes: Record<string, CodeModel> = Object.create(null);
  const agents: Record<string, AgentModel> = Object.create(null);
  const stages: Record<string, StageModel> = Object.create(null);
  const assets = new Map<string, ResourceAsset>();
  const skills = new Map<string, SkillModel>();

  function get(ref: string, kind: SourceResource["kind"], at: SourceLocation) {
    const resolved = resolveReference(root, ref);
    const resource = loaded.get(resolved.file);
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
    return { sourceFile: resolved.file, exportName: resolved.exportName };
  }
  async function skill(ref: string, at: SourceLocation): Promise<SkillModel> {
    const resolved = get(ref, "skill", at);
    const cached = skills.get(resolved.file);
    if (cached) return cached;
    if (!("metadata" in resolved.resource))
      fail("INVALID_REFERENCE", `Invalid Skill: ${ref}`, at);
    const metadata = validateDocument(
      metadataSchema,
      resolved.resource.metadata,
    );
    const files = await collectSkillAssets(root, resolved.file);
    for (const asset of files) {
      const target = resolve(root, asset.outputPath);
      if (
        !isPathWithin(root, await realpath(asset.sourceFile)) ||
        !(await stat(target)).isFile()
      )
        fail("INVALID_REFERENCE", "Invalid Skill asset", at);
      assets.set(asset.outputPath, asset);
    }
    const value: SkillModel = {
      ...metadata,
      location: { file: resolved.file },
      content: resolved.resource.content,
      assets: files,
    };
    skills.set(resolved.file, value);
    return value;
  }

  for (const [stageName, stageRef] of Object.entries(workflow.stages)) {
    const at = sourceLocation(source.document, [
      "workflow",
      "stages",
      stageName,
    ]);
    const resource = get(stageRef.stage, "stage", at).resource;
    if (!("document" in resource))
      fail("INVALID_REFERENCE", "Expected Stage document", at);
    const document = resource.document;
    const stage = validateDocument(stageSchema, document).stage;
    if (stage.name !== stageName)
      fail(
        "INVALID_WORKFLOW",
        `Stage name must match reference key ${stageName}`,
        sourceLocation(document, ["stage", "name"]),
      );
    const steps: Record<string, StepModel> = Object.create(null);
    for (const [stepName, step] of Object.entries(stage.steps)) {
      const stepLocation = sourceLocation(document, [
        "stage",
        "steps",
        stepName,
      ]);
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
        const metadata = validateDocument(
          metadataSchema,
          agent.resource.metadata,
        );
        const outputSchema = module(step.outputSchema, "schema", stepLocation);
        const agentSkills = await Promise.all(
          step.skills.map((ref) => skill(ref, stepLocation)),
        );
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
          "INVALID_WORKFLOW",
          "Step must declare an outcome route",
          stepLocation,
        );
      for (const [outcome, next] of Object.entries(routes)) {
        if (next.kind === "step" && !Object.hasOwn(stage.steps, next.stepName))
          fail(
            "INVALID_WORKFLOW",
            `Unknown target step: ${next.stepName}`,
            stepLocation,
          );
        if (next.kind === "stage_end" && !Object.hasOwn(stageRef.on, outcome))
          fail(
            "INVALID_WORKFLOW",
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
        "INVALID_WORKFLOW",
        `Unknown entry step: ${stage.entry}`,
        sourceLocation(document, ["stage", "entry"]),
      );
    const on = Object.fromEntries(
      Object.entries(stageRef.on).map(([outcome, next]) => [
        outcome,
        "target" in next
          ? { kind: "stage" as const, stageName: next.target }
          : { kind: "workflow_end" as const },
      ]),
    );
    for (const next of Object.values(on))
      if (
        next.kind === "stage" &&
        !Object.hasOwn(workflow.stages, next.stageName)
      )
        fail("INVALID_WORKFLOW", `Unknown target stage: ${next.stageName}`, at);
    stages[stageName] = {
      stageName,
      location: at,
      stateSchema: module(stage.state.schema, "schema", at),
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
  if (!Object.hasOwn(stages, workflow.entry))
    fail(
      "INVALID_WORKFLOW",
      `Unknown entry stage: ${workflow.entry}`,
      sourceLocation(source.document, ["workflow", "entry"]),
    );
  const model: WorkflowModel = {
    ...(workflow.exclusive === undefined
      ? {}
      : { exclusive: workflow.exclusive }),
    options: sources.options,
    flowName: workflow.name,
    version: packageInfo.version,
    entryStageName: workflow.entry,
    stages,
    codes,
    agents,
    assets: [...assets.values()],
  };
  return assignResourceIds(model);
}
