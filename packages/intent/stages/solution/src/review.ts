import type { SolutionState } from "../schema/state.ts";
import { bullets, section, answers } from "../../../src/review.ts";
import { fail } from "../../../src/errors.ts";
export function formatReview(s: SolutionState) {
  const { draft, plan, specification, analysis } = s;
  if (!draft || !plan || !specification || !analysis)
    fail("Missing solution review data.");
  return [
    section("Round goal", s.prompt),
    section(
      "Fixed requirements",
      bullets(specification.scope.workItems.map((item) => item.description)),
    ),
    section(
      "Analysis and trade-offs",
      `${analysis.summary}\n\n${analysis.rationale}`,
    ),
    section(
      "Design baseline",
      s.baseline
        ? `Revision ${s.baseline.revision}`
        : "No previous formal design.",
    ),
    section(
      "Design",
      bullets(
        draft.objects.map(
          (item) =>
            `${item.name} (${item.kind}, ${item.status}): ${item.description}`,
        ),
      ),
    ),
    section(
      "Constraints",
      bullets([
        ...draft.constraints.map(
          (item) => `${item.description} (${item.status})`,
        ),
        ...plan.engineeringTargets.map((item) => item.description),
      ]),
    ),
    section(
      "Changes and reasons",
      bullets(
        s.edits.map((edit) => `${edit.kind}: ${edit.id} — ${edit.reason}`),
      ),
    ),
    section(
      "Implementation plan",
      bullets(
        plan.implementationItems.map(
          (item) =>
            `${item.description}. ${item.explanation}\n  Depends on: ${item.dependsOn.map((ref) => plan.implementationItems.find((previous) => previous.id === ref)?.description).join("; ") || "none"}.`,
        ),
      ),
    ),
    section(
      "Verification responsibilities",
      bullets(
        plan.verifications.map(
          (item) =>
            `${item.purpose} — ${item.executionStage}\n  Method: ${item.method.kind === "command" ? [item.method.command, ...item.method.args].map((value) => JSON.stringify(value)).join(" ") + (item.method.cwd ? ` (directory: ${item.method.cwd})` : "") : item.method.steps.join(" → ")}\n  Preconditions: ${item.preconditions.join("; ") || "none"}. Expected evidence: ${item.expectedEvidence}`,
        ),
      ),
    ),
    section(
      "Coverage",
      bullets(
        plan.coverage.map(
          (item) =>
            `${specification.scope.workItems.find((work) => work.id === item.workItemRef)?.description}: ${item.target.kind}/${item.target.id}. ${item.explanation}`,
        ),
      ),
    ),
    section("Assumptions and risks", bullets(analysis.assumptions)),
    section("User answers", bullets(answers(s))),
    section("Review feedback", bullets(s.feedback)),
  ].join("\n\n");
}
