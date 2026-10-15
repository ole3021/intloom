import { relative } from "node:path";
import { fail } from "../errors.ts";
import type { LinkedLoom, ModuleReference } from "../analyze/model.ts";

import type { SourceLocation } from "../source/types.ts";

export const entryName = "loom.generated";

export interface GeneratedEntry {
  readonly text: string;
  readonly locations: Readonly<
    Record<number, { location: SourceLocation; resource: SourceLocation }>
  >;
}

export function generateEntry(
  loom: LinkedLoom,
  entryDirectory = loom.model.options.packageRoot,
): GeneratedEntry {
  const { model } = loom;
  const imports: string[] = [];
  const locations: Record<
    number,
    { location: SourceLocation; resource: SourceLocation }
  > = {};
  const bindings = new Map<string, string>();
  const assertions = new Set<string>();
  const quote = JSON.stringify;
  function reference(
    module: ModuleReference,
    kind: "code" | "schema" | "result" | "tool" | "initializer",
  ): string {
    const key = JSON.stringify([module.sourceFile, module.exportName]);
    const cached = bindings.get(key);
    const name = cached ?? `resource${bindings.size}`;
    const assertion = JSON.stringify([key, kind]);
    if (assertions.has(assertion)) return name;
    const relativePath = relative(entryDirectory, module.sourceFile).replaceAll(
      "\\",
      "/",
    );
    const path = relativePath.startsWith(".")
      ? relativePath
      : `./${relativePath}`;
    const source = {
      location: module.location ?? { file: module.sourceFile },
      resource: { file: module.sourceFile },
    };
    locations[imports.length + 1] = source;
    if (!cached) {
      imports.push(
        `import { ${module.exportName} as ${name} } from ${quote(path)};`,
      );
      locations[imports.length + 1] = source;
    }
    assertions.add(assertion);
    if (kind === "code")
      imports.push(
        `${name} satisfies import("@intloom/loom-sdk").ExecutableCode;`,
      );
    if (kind === "initializer")
      imports.push(
        `${name} satisfies import("@intloom/loom-sdk").StageStateInitializer;`,
      );
    if (kind === "schema")
      imports.push(
        `${name} satisfies import("zod").ZodType<import("@intloom/loom-sdk").JsonValue>;`,
      );
    if (kind === "result")
      imports.push(
        `${name} satisfies import("zod").ZodType<import("@intloom/loom-sdk").StepResult>;`,
      );
    if (kind === "tool")
      imports.push(`${name} satisfies import("@intloom/loom-sdk").AgentTool;`);
    bindings.set(key, name);
    return name;
  }
  function id(ids: Readonly<Record<string, string>>, key: string): string {
    const value = ids[key];
    if (!value) fail("INVALID_LOOM", `Missing resource ID: ${key}`);
    return value;
  }
  const stages = Object.entries(model.stages).map(([key, stage]) => {
    const steps = Object.entries(stage.steps).map(([stepKey, step]) => {
      const execution =
        step.execution.kind === "code"
          ? {
              kind: "code",
              codeId: id(loom.codeIds, step.execution.resourceKey),
            }
          : {
              kind: "agent",
              agentId: id(loom.agentIds, step.execution.resourceKey),
            };
      return `[${quote(stepKey)}]: ${quote({ stepName: step.stepName, execution, on: step.on })}`;
    });
    return `[${quote(key)}]: { stageName: ${quote(stage.stageName)}, stateSchema: ${reference(stage.stateSchema, "schema")}, initializeState: ${reference(stage.initializeState, "initializer")}, entryStepName: ${quote(stage.entryStepName)}, steps: {${steps.join(",")}}, on: ${quote(stage.on)} }`;
  });
  const codes = Object.values(model.codes).map(
    (code) =>
      `[${quote(id(loom.codeIds, code.resourceKey))}]: ${reference(code.module, "code")}`,
  );
  const agents = Object.values(model.agents).map((agent) => {
    const skills = agent.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      assets: skill.assets.map((asset) => asset.outputPath),
    }));
    return `[${quote(id(loom.agentIds, agent.resourceKey))}]: { name: ${quote(agent.name)}, description: ${quote(agent.description)}, instructions: ${quote(agent.instructions)}, llm: ${quote(agent.llm)}, outputSchema: ${reference(agent.outputSchema, "result")}, skills: ${quote(skills)}, tools: [${agent.tools.map((tool) => reference(tool, "tool")).join(",")}] }`;
  });
  return {
    locations,
    text: `${imports.join("\n")}\nexport const blueprint = { ${model.exclusive === undefined ? "" : `exclusive: ${model.exclusive},`} loomName: ${quote(model.loomName)}, inputs: ${quote(model.inputs)}, entryStageName: ${quote(model.entryStageName)}, stages: {${stages.join(",")}} } as const satisfies import("@intloom/loom-sdk").Blueprint;\nexport const codes = {${codes.join(",")}} as const satisfies Readonly<Record<string, import("@intloom/loom-sdk").ExecutableCode>>;\nexport const agentSpecs = {${agents.join(",")}} as const satisfies Readonly<Record<string, import("@intloom/loom-sdk").AgentSpec>>;\n`,
  };
}
