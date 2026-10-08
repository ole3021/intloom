import { fail } from "./errors.ts";
import { workflowModuleSchema } from "./schemas/workflow-module.ts";
import type { LoadedWorkflow, WorkflowPackage } from "./types.ts";

/** Validates structure and references without IO, function calls, or sample execution of business Schemas. */
export function validateWorkflow(
  source: WorkflowPackage,
  module: unknown,
): LoadedWorkflow {
  const result = workflowModuleSchema.safeParse(module);
  if (!result.success)
    fail(
      "INVALID_WORKFLOW",
      `Invalid Workflow exports: ${source.packageName}`,
      result.error,
    );
  const output = result.data;
  const { blueprint, codes, agentSpecs } = output;
  function invalid(message: string): never {
    fail("INVALID_WORKFLOW", `${source.packageName}: ${message}`);
  }
  if (!Object.hasOwn(blueprint.stages, blueprint.entryStageName))
    invalid("Missing entry Stage");
  for (const [stageName, stage] of Object.entries(blueprint.stages)) {
    if (stage.stageName !== stageName)
      invalid(`Stage key mismatch: ${stageName}`);
    if (!Object.hasOwn(stage.steps, stage.entryStepName))
      invalid(`Missing entry Step: ${stageName}`);
    for (const [stepName, step] of Object.entries(stage.steps)) {
      if (step.stepName !== stepName)
        invalid(`Step key mismatch: ${stageName}/${stepName}`);
      const execution = step.execution;
      if (execution.kind === "code" && !Object.hasOwn(codes, execution.codeId))
        invalid(`Missing Code: ${execution.codeId}`);
      if (
        execution.kind === "agent" &&
        !Object.hasOwn(agentSpecs, execution.agentId)
      )
        invalid(`Missing Agent: ${execution.agentId}`);
      if (Object.keys(step.on).length === 0)
        invalid(`Missing Step routes: ${stageName}/${stepName}`);
      for (const [outcome, target] of Object.entries(step.on)) {
        if (
          target.kind === "step" &&
          !Object.hasOwn(stage.steps, target.stepName)
        )
          invalid(`Unknown Step target: ${stageName}/${target.stepName}`);
        if (target.kind === "stage_end" && !Object.hasOwn(stage.on, outcome))
          invalid(`Missing Stage outcome route: ${stageName}/${outcome}`);
      }
    }
    for (const target of Object.values(stage.on)) {
      if (
        target.kind === "stage" &&
        !Object.hasOwn(blueprint.stages, target.stageName)
      )
        invalid(`Unknown Stage target: ${target.stageName}`);
    }
  }
  for (const [id, agent] of Object.entries(agentSpecs)) {
    const ids = agent.tools.map((tool) => tool.id);
    if (new Set(ids).size !== ids.length)
      invalid(`Duplicate Tool ID in Agent: ${id}`);
  }
  // Schema and function references remain executable objects; actual State and output are validated at runtime.
  return { source, ...output };
}
