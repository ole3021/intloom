import type { SolutionState } from "../schema/state.ts";
import type { SolutionArtifact } from "../schema/artifact.ts";
import { contains, unique } from "../../../src/state.ts";
import { digest } from "../../../src/json.ts";
import { fail } from "../../../src/errors.ts";
import { linkedEvidence } from "../../../src/project.ts";
import { solutionTargets } from "../../../src/targets.ts";
export const emptySolution = (): SolutionArtifact => ({
  objects: [],
  constraints: [],
});
export function checkObjects(draft: SolutionArtifact, requirements: string[]) {
  unique(
    [...draft.objects, ...draft.constraints].map((o) => o.id),
    "design IDs",
  );
  for (const object of draft.objects) {
    contains(requirements, object.requirementRefs, "Requirement");
    contains(
      draft.objects.map((x) => x.id),
      object.relatedRefs,
      "design object",
    );
  }
  for (const constraint of draft.constraints)
    contains(
      draft.objects.map((x) => x.id),
      constraint.designRefs,
      "constraint design object",
    );
}
export function checkAnalysis(state: SolutionState) {
  if (
    !state.specification ||
    !state.analysis ||
    state.analysis.scope !== "feature_development"
  )
    fail("A feature solution must analyze its fixed requirements.");
  for (const fact of state.analysis.facts)
    linkedEvidence(state, fact.evidenceRefs);
  if (state.questions.length)
    fail("Required design questions remain unanswered.");
}
export function checkSolution(
  state: SolutionState,
): asserts state is SolutionState & {
  [K in "draft" | "plan" | "specification"]: NonNullable<SolutionState[K]>;
} {
  checkAnalysis(state);
  if (!state.draft || !state.plan || !state.specification)
    fail("Design and implementation/verification plans are required.");
  const { draft, plan, specification: spec } = state;
  checkObjects(
    draft,
    spec.snapshot.requirements.map((x) => x.id),
  );
  unique(
    [
      ...plan.implementationItems,
      ...plan.verifications,
      ...plan.engineeringTargets,
    ].map((x) => x.id),
    "plan IDs",
  );
  const items = new Map(
    plan.implementationItems.map((item) => [item.id, item]),
  );
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) fail("Implementation dependencies must be acyclic.");
    if (visited.has(id)) return;
    const item = items.get(id);
    if (!item) fail(`Unknown implementation dependency: ${id}`);
    visiting.add(id);
    for (const ref of item.dependsOn) visit(ref);
    visiting.delete(id);
    visited.add(id);
  }
  for (const item of plan.implementationItems) {
    contains(
      draft.objects.map((x) => x.id),
      item.designRefs,
      "design object",
    );
    unique(item.dependsOn, "dependencies");
    visit(item.id);
  }
  const changed = new Set(state.edits.map((edit) => edit.id));
  const plannedDesign = new Set(
    plan.implementationItems.flatMap((item) => item.designRefs),
  );
  const scopeRequirements = new Set(
    spec.scope.workItems.flatMap((item) => item.requirementRefs),
  );
  for (const object of draft.objects)
    if (changed.has(object.id)) {
      if (!plannedDesign.has(object.id))
        fail("Changed design objects need an implementation disposition.");
      const requirements = [
        ...object.requirementRefs,
        ...object.relatedRefs.flatMap(
          (ref) =>
            draft.objects.find((item) => item.id === ref)?.requirementRefs ??
            [],
        ),
      ];
      if (!requirements.some((ref) => scopeRequirements.has(ref)))
        fail(
          "Design changes must serve this round's requirements, not independent restructuring.",
        );
    }
  for (const constraint of draft.constraints)
    if (
      changed.has(constraint.id) &&
      !constraint.designRefs.some((ref) => plannedDesign.has(ref))
    )
      fail("Changed design constraints need an affected implementation item.");
  const targets = solutionTargets(spec, draft, plan);
  unique(
    targets.map((x) => x.id),
    "targets",
  );
  for (const coverage of plan.coverage) {
    contains(
      spec.scope.workItems.map((x) => x.id),
      [coverage.workItemRef],
      "work item",
    );
    contains(
      targets.map((x) => x.id),
      [`${coverage.target.kind}:${coverage.target.id}`],
      "target",
    );
    contains(
      [...items.keys()],
      coverage.implementationRefs,
      "implementation item",
    );
    contains(
      plan.verifications.map((x) => x.id),
      coverage.verificationRefs,
      "verification item",
    );
    const source = spec.scope.coverage.find(
      (x) => x.workItemRef === coverage.workItemRef,
    );
    if (!source) fail(`Missing work-item coverage: ${coverage.workItemRef}`);
    if (
      coverage.target.kind === "acceptance" &&
      !source.acceptanceRefs.includes(coverage.target.id)
    )
      fail("Coverage cannot move acceptance to another work item.");
    if (
      coverage.target.kind === "round_criterion" &&
      !source.roundCriteriaRefs.includes(coverage.target.id)
    )
      fail("Round criterion belongs to another work item.");
  }
  for (const target of targets)
    if (
      !plan.coverage.some(
        (c) => `${c.target.kind}:${c.target.id}` === target.id,
      )
    )
      fail(`Missing target Coverage: ${target.id}`);
  for (const work of spec.scope.workItems)
    if (!plan.coverage.some((c) => c.workItemRef === work.id))
      fail(`Missing work-item Coverage: ${work.id}`);
  const coveredItems = new Set<string>();
  function cover(id: string) {
    if (coveredItems.has(id)) return;
    coveredItems.add(id);
    const item = items.get(id);
    if (!item) fail(`Unknown implementation dependency: ${id}`);
    for (const ref of item.dependsOn) cover(ref);
  }
  for (const c of plan.coverage)
    for (const id of c.implementationRefs) cover(id);
  for (const item of items.values())
    if (!coveredItems.has(item.id))
      fail(`Unaccounted implementation item: ${item.id}`);
  for (const v of plan.verifications)
    if (!plan.coverage.some((c) => c.verificationRefs.includes(v.id)))
      fail(`Unaccounted verification item: ${v.id}`);
}
export function solutionReview(state: SolutionState) {
  return {
    prompt: state.prompt,
    specificationRef: state.specificationRef,
    baseline: state.baseline,
    analysis: state.analysis,
    snapshot: state.draft,
    plan: state.plan,
    changes: state.edits,
    feedback: state.feedback,
    answers: state.interactions.filter((x) => x.kind === "questions"),
  };
}
export const reviewDigest = (state: SolutionState) =>
  digest(solutionReview(state));
