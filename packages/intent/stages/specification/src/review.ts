import type { SpecificationState } from "../schema/state.ts";
import { bullets, section, answers } from "../../../src/review.ts";
export function formatReview(s: SpecificationState) {
  const draft = s.draft!,
    scope = s.scope!;
  return [
    section("Round goal", s.prompt),
    section("Analysis", `${s.analysis!.summary}\n\n${s.analysis!.rationale}`),
    section(
      "Requirement baseline",
      s.baseline
        ? `Revision ${s.baseline.revision}`
        : "No previous formal requirements.",
    ),
    section(
      "Features and requirements",
      bullets(
        draft.features.map((feature) => {
          const domain = draft.domains.find(
            (item) => item.id === feature.domainRef,
          );
          return `${feature.name} (${feature.status})${domain ? ` — ${domain.name}` : ""}: ${feature.description}\n${draft.requirements
            .filter((requirement) => requirement.featureRef === feature.id)
            .map(
              (requirement) =>
                `  - Requirement (${requirement.status}): ${requirement.description}\n${draft.acceptances
                  .filter(
                    (acceptance) =>
                      acceptance.requirementRef === requirement.id,
                  )
                  .map(
                    (acceptance) =>
                      `    - Acceptance (${acceptance.status}): ${acceptance.description}`,
                  )
                  .join("\n")}`,
            )
            .join("\n")}`;
        }),
      ),
    ),
    section(
      "Development constraints",
      bullets(
        draft.constraints.map((item) => `${item.description} (${item.status})`),
      ),
    ),
    section(
      "Changes and reasons",
      bullets(
        s.edits.map((edit) => `${edit.kind}: ${edit.id} — ${edit.reason}`),
      ),
    ),
    section(
      "Round work and coverage",
      bullets(
        scope.workItems.map((work) => {
          const coverage = scope.coverage.find(
            (item) => item.workItemRef === work.id,
          )!;
          const targets = [
            ...draft.acceptances.filter((item) =>
              coverage.acceptanceRefs.includes(item.id),
            ),
            ...scope.roundCriteria.filter((item) =>
              coverage.roundCriteriaRefs.includes(item.id),
            ),
            ...draft.constraints.filter((item) =>
              coverage.constraintRefs.includes(item.id),
            ),
          ];
          return `${work.action}: ${work.description}\n${targets.map((target) => `  - ${target.description}`).join("\n")}`;
        }),
      ),
    ),
    section("Excluded work", bullets(scope.excluded)),
    section("Assumptions", bullets(s.analysis!.assumptions)),
    section("User answers", bullets(answers(s))),
    section("Review feedback", bullets(s.feedback)),
  ].join("\n\n");
}
