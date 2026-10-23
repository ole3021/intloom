import type { SpecificationState } from "../schema/state.ts";
import type { SpecificationArtifact } from "../schema/artifact.ts";
import { contains, unique } from "../../../src/state.ts";
import { digest } from "../../../src/json.ts";
import { fail } from "../../../src/errors.ts";
import { linkedEvidence } from "../../../src/project.ts";
export const emptySpecification = (): SpecificationArtifact => ({
  domains: [],
  features: [],
  requirements: [],
  acceptances: [],
  constraints: [],
});
export function checkObjects(draft: SpecificationArtifact) {
  unique(
    Object.values(draft)
      .flat()
      .map((o) => o.id),
    "object IDs",
  );
  for (const feature of draft.features)
    if (feature.domainRef)
      contains(
        draft.domains
          .filter((x) => x.status === "active" || feature.status === "retired")
          .map((x) => x.id),
        [feature.domainRef],
        "Domain",
      );
  for (const requirement of draft.requirements)
    contains(
      draft.features
        .filter(
          (x) => x.status === "active" || requirement.status === "retired",
        )
        .map((x) => x.id),
      [requirement.featureRef],
      "Feature",
    );
  for (const acceptance of draft.acceptances)
    contains(
      draft.requirements
        .filter((x) => x.status === "active" || acceptance.status === "retired")
        .map((x) => x.id),
      [acceptance.requirementRef],
      "Requirement",
    );
}
export function checkAnalysis(state: SpecificationState) {
  if (state.analysis?.scope !== "feature_development")
    fail(
      "Intent requires a feature-development scope; independent restructuring needs another Loom.",
    );
  for (const fact of state.analysis.facts)
    linkedEvidence(state, fact.evidenceRefs);
  if (state.questions.length) fail("Required questions remain unanswered.");
}
export function checkSpecification(state: SpecificationState) {
  checkAnalysis(state);
  if (!state.draft || !state.scope)
    fail("A requirement draft and explicit round scope are required.");
  const { draft, scope } = state;
  checkObjects(draft);
  unique(
    scope.workItems.map((x) => x.id),
    "work items",
  );
  unique(
    scope.roundCriteria.map((x) => x.id),
    "round criteria",
  );
  unique(
    scope.coverage.map((x) => x.workItemRef),
    "work-item coverage",
  );
  contains(
    scope.workItems.map((x) => x.id),
    scope.coverage.map((x) => x.workItemRef),
    "work-item coverage",
  );
  if (scope.coverage.length !== scope.workItems.length)
    fail("Every work item requires Coverage.");
  for (const item of scope.workItems) {
    contains(
      draft.requirements.map((x) => x.id),
      item.requirementRefs,
      "Requirement",
    );
    const coverage = scope.coverage.find((x) => x.workItemRef === item.id);
    if (!coverage) fail(`Missing work-item coverage: ${item.id}`);
    contains(
      draft.acceptances.filter((x) => x.status === "active").map((x) => x.id),
      coverage.acceptanceRefs,
      "active Acceptance",
    );
    contains(
      scope.roundCriteria.map((x) => x.id),
      coverage.roundCriteriaRefs,
      "round criterion",
    );
    contains(
      draft.constraints.filter((x) => x.status === "active").map((x) => x.id),
      coverage.constraintRefs,
      "active constraint",
    );
    if (
      !coverage.acceptanceRefs.length &&
      !coverage.roundCriteriaRefs.length &&
      !coverage.constraintRefs.length
    )
      fail("Each work item requires a verifiable target.");
    for (const ref of coverage.acceptanceRefs) {
      const acceptance = draft.acceptances.find((x) => x.id === ref);
      if (!acceptance) fail(`Missing acceptance: ${ref}`);
      if (!item.requirementRefs.includes(acceptance.requirementRef))
        fail("Acceptance must belong to the work item's Requirements.");
    }
    if (item.action === "remove" && !coverage.roundCriteriaRefs.length)
      fail("Removal requires a round-specific completion criterion.");
  }
  for (const requirement of draft.requirements.filter(
    (item) => item.status === "active",
  ))
    if (
      !draft.acceptances.some(
        (item) =>
          item.status === "active" && item.requirementRef === requirement.id,
      )
    )
      fail("Every active requirement needs an acceptance condition.");
  for (const feature of draft.features.filter(
    (item) => item.status === "active",
  ))
    if (
      !draft.requirements.some(
        (item) => item.status === "active" && item.featureRef === feature.id,
      )
    )
      fail("Every active feature needs a requirement.");
  const touched = new Set(state.edits.map((x) => x.id));
  for (const feature of draft.features)
    if (
      touched.has(feature.id) &&
      !scope.workItems.some((item) =>
        item.requirementRefs.some(
          (ref) =>
            draft.requirements.find((requirement) => requirement.id === ref)
              ?.featureRef === feature.id,
        ),
      )
    )
      fail(
        "Changed features must be accounted for by their requirements in this round.",
      );
  for (const constraint of draft.constraints)
    if (touched.has(constraint.id)) {
      if (
        constraint.status === "active" &&
        !scope.coverage.some((item) =>
          item.constraintRefs.includes(constraint.id),
        )
      )
        fail("Changed constraints need explicit round coverage.");
      if (constraint.status === "retired" && !scope.roundCriteria.length)
        fail(
          "Retiring a constraint requires an explicit round completion criterion.",
        );
    }
  for (const requirement of draft.requirements)
    if (
      touched.has(requirement.id) &&
      !scope.workItems.some((x) => x.requirementRefs.includes(requirement.id))
    )
      fail("Changed requirements must be accounted for in this round's scope.");
  for (const acceptance of draft.acceptances)
    if (
      touched.has(acceptance.id) &&
      !scope.workItems.some((x) =>
        x.requirementRefs.includes(acceptance.requirementRef),
      )
    )
      fail("Changed acceptances must be accounted for in scope.");
  for (const criterion of scope.roundCriteria)
    if (!scope.coverage.some((x) => x.roundCriteriaRefs.includes(criterion.id)))
      fail("Orphan round criterion.");
}
export function specificationReview(state: SpecificationState) {
  return {
    prompt: state.prompt,
    baseline: state.baseline,
    analysis: state.analysis,
    snapshot: state.draft,
    scope: state.scope,
    changes: state.edits,
    feedback: state.feedback,
    answers: state.interactions.filter((x) => x.kind === "questions"),
  };
}
export const reviewDigest = (state: SpecificationState) =>
  digest(specificationReview(state));
