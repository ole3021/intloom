import type { CompilerDiagnostic } from "../diagnostics.ts";
import type { LoomModel } from "./model.ts";

/** Follow executable routes, including the outcome that actually exits a Stage. Cycles are legal. */
export function checkReachability(model: LoomModel): CompilerDiagnostic[] {
  const visited = new Map<string, Set<string>>();
  const pending = [
    [model.entryStageName, model.stages[model.entryStageName]?.entryStepName],
  ];
  while (pending.length) {
    const [stageName, stepName] = pending.pop() ?? [];
    if (!stageName || !stepName || visited.get(stageName)?.has(stepName))
      continue;
    const stage = model.stages[stageName];
    const step = stage?.steps[stepName];
    if (!stage || !step) continue;
    const steps = visited.get(stageName) ?? new Set<string>();
    steps.add(stepName);
    visited.set(stageName, steps);
    for (const [outcome, next] of Object.entries(step.on)) {
      if (next.kind === "step") pending.push([stageName, next.stepName]);
      else {
        const target = stage.on[outcome];
        if (target?.kind === "stage")
          pending.push([
            target.stageName,
            model.stages[target.stageName]?.entryStepName,
          ]);
      }
    }
  }
  const diagnostics: CompilerDiagnostic[] = [];
  for (const stage of Object.values(model.stages)) {
    const steps = visited.get(stage.stageName);
    if (!steps)
      diagnostics.push({
        severity: "warning",
        code: "UNREACHABLE_STAGE",
        message: `Stage ${stage.stageName} is unreachable from the Loom entry`,
        location: stage.location,
      });
    else
      for (const step of Object.values(stage.steps))
        if (!steps.has(step.stepName))
          diagnostics.push({
            severity: "warning",
            code: "UNREACHABLE_STEP",
            message: `Step ${step.stepName} is unreachable from the Loom entry`,
            location: step.location,
          });
  }
  return diagnostics;
}
