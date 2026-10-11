export * from "../core/doctor.ts";
import type { ProjectDoctorResult } from "../core/doctor.ts";
import { renderDiagnosis, renderWorkflows } from "../ui/render.ts";
export function renderDoctor(result: ProjectDoctorResult) {
  return [
    renderDiagnosis(result),
    `Execution entry: ${result.source}`,
    ...result.checks.flatMap((c) => [
      `${c.name} · ${c.status}: ${c.message}`,
      ...(c.nextStep ? [c.nextStep] : []),
    ]),
    ...(result.workflows ? [renderWorkflows(result.workflows)] : []),
  ].join("\n");
}
