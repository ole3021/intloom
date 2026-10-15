import type { Blueprint } from "./blueprint.ts";

/** Includes every declared branch so missing resources cannot surface after earlier business effects. */
export function referencedAgentIds(blueprint: Blueprint): string[] {
  return [
    ...new Set(
      Object.values(blueprint.stages).flatMap((stage) =>
        Object.values(stage.steps).flatMap((step) =>
          step.execution.kind === "agent" ? [step.execution.agentId] : [],
        ),
      ),
    ),
  ];
}
