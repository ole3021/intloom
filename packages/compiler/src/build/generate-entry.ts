import { relative } from "node:path";
import { fail } from "../errors.ts";
import type { LinkedWorkflow, ModuleReference } from "../analyze/model.ts";

export const entryName = "workflow.generated";

export function generateEntry(workflow: LinkedWorkflow): string {
  const { model } = workflow;
  const imports: string[] = [];
  const bindings = new Map<string, string>();
  const quote = JSON.stringify;
  function reference(
    module: ModuleReference,
    kind: "code" | "schema" | "tool" | "initializer",
  ): string {
    const key = JSON.stringify([module.sourceFile, module.exportName, kind]);
    const cached = bindings.get(key);
    if (cached) return cached;
    const name = `resource${bindings.size}`;
    const path = `./${relative(model.options.packageRoot, module.sourceFile).replaceAll("\\", "/")}`;
    imports.push(
      `import { ${module.exportName} as ${name} } from ${quote(path)};`,
    );
    if (kind === "code")
      imports.push(`${name} satisfies (...args: never[]) => unknown;`);
    if (kind === "initializer")
      imports.push(
        `${name} satisfies (context: { readonly runId: string; readonly flowName: string; readonly stageName: string; readonly intent: string }) => unknown;`,
      );
    if (kind === "schema")
      imports.push(`${name} satisfies import("zod").ZodType;`);
    if (kind === "tool")
      imports.push(
        `${name} satisfies import("@intloom/workflow-sdk").AgentTool;`,
      );
    bindings.set(key, name);
    return name;
  }
  function id(ids: Readonly<Record<string, string>>, key: string): string {
    const value = ids[key];
    if (!value) fail("INVALID_WORKFLOW", `Missing resource ID: ${key}`);
    return value;
  }
  const stages = Object.entries(model.stages).map(([key, stage]) => {
    const steps = Object.entries(stage.steps).map(([stepKey, step]) => {
      const execution =
        step.execution.kind === "code"
          ? {
              kind: "code",
              codeId: id(workflow.codeIds, step.execution.resourceKey),
            }
          : {
              kind: "agent",
              agentId: id(workflow.agentIds, step.execution.resourceKey),
            };
      return `[${quote(stepKey)}]: ${quote({ stepName: step.stepName, execution, on: step.on })}`;
    });
    return `[${quote(key)}]: { stageName: ${quote(stage.stageName)}, stateSchema: ${reference(stage.stateSchema, "schema")}, initializeState: ${reference(stage.initializeState, "initializer")}, entryStepName: ${quote(stage.entryStepName)}, steps: {${steps.join(",")}}, on: ${quote(stage.on)} }`;
  });
  const codes = Object.values(model.codes).map(
    (code) =>
      `[${quote(id(workflow.codeIds, code.resourceKey))}]: ${reference(code.module, "code")}`,
  );
  const agents = Object.values(model.agents).map((agent) => {
    const skills = agent.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      assets: skill.assets.map((asset) => asset.outputPath),
    }));
    return `[${quote(id(workflow.agentIds, agent.resourceKey))}]: { name: ${quote(agent.name)}, description: ${quote(agent.description)}, instructions: ${quote(agent.instructions)}, llm: ${quote(agent.llm)}, outputSchema: ${reference(agent.outputSchema, "schema")}, skills: ${quote(skills)}, tools: [${agent.tools.map((tool) => reference(tool, "tool")).join(",")}] }`;
  });
  return `${imports.join("\n")}\nexport const blueprint = { ${model.exclusive === undefined ? "" : `exclusive: ${model.exclusive},`} flowName: ${quote(model.flowName)}, entryStageName: ${quote(model.entryStageName)}, stages: {${stages.join(",")}} } as const;\nexport const codes = {${codes.join(",")}} as const;\nexport const agentSpecs = {${agents.join(",")}} as const;\n`;
}
