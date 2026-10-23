import type { ImplementationState } from "../schema/state.ts";
import { contains, unique } from "../../../src/state.ts";
import { linkedEvidence } from "../../../src/project.ts";
import { verificationFailures } from "../../../src/verification.ts";
import { digest } from "../../../src/json.ts";
import { fail } from "../../../src/errors.ts";
export function checkSubmission(
  s: ImplementationState,
): asserts s is ImplementationState & {
  [K in "submission" | "candidate" | "solution" | "baseline"]: NonNullable<
    ImplementationState[K]
  >;
} {
  if (!s.submission || !s.candidate || !s.solution || !s.baseline)
    fail("Missing implementation submission or fixed basis.");
  if (s.submission.candidateRef !== s.candidate.id)
    fail("Submission describes another candidate.");
  const items = s.solution.plan.implementationItems;
  unique(
    s.submission.items.map((i) => i.implementationRef),
    "implementation submissions",
  );
  contains(
    items.map((i) => i.id),
    s.submission.items.map((i) => i.implementationRef),
    "implementation item",
  );
  if (items.length !== s.submission.items.length)
    fail("Every planned item needs a disposition.");
  for (const item of s.submission.items) {
    contains(
      s.changes.map((c) => c.id),
      item.changeRefs,
      "actual change",
    );
    const sources = linkedEvidence(s, item.sourceRefs, s.candidate.id);
    if (
      item.outcome === "implemented" &&
      !item.changeRefs.length &&
      !sources.some((e) => e.kind === "execution" || e.kind === "observation")
    )
      fail("Implemented work requires actual changes or execution evidence.");
    if (
      item.outcome === "reused" &&
      !sources.some((e) => e.kind === "project_read")
    )
      fail("Reuse needs current source evidence.");
    if (item.outcome === "incomplete" && !item.remaining.trim())
      fail("Incomplete work needs an explicit remaining scope.");
    if (item.outcome !== "incomplete") {
      const planned = items.find((i) => i.id === item.implementationRef);
      if (!planned)
        fail(`Unknown implementation item: ${item.implementationRef}`);
      for (const dependency of planned.dependsOn)
        if (
          s.submission.items.find((i) => i.implementationRef === dependency)
            ?.outcome === "incomplete"
        )
          fail("Completed work depends on incomplete work.");
    }
  }
  for (const change of s.changes)
    if (!s.submission.items.some((i) => i.changeRefs.includes(change.id)))
      fail(`Unaccounted actual change: ${change.path}`);
}
export function unexplainedChanges(s: ImplementationState) {
  return s.changes.filter((change) => {
    let expected = change.beforeDigest;
    for (const ref of change.operationRefs) {
      const raw = s.evidence.find((e) => e.id === ref)?.data;
      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw) ||
        raw.beforeDigest !== expected
      )
        return true;
      expected = typeof raw.afterDigest === "string" ? raw.afterDigest : null;
    }
    return expected !== change.afterDigest;
  });
}
export function gaps(s: ImplementationState) {
  return [
    ...(s.submission?.items
      .filter((i) => i.outcome === "incomplete")
      .map((i) => `${i.implementationRef}: ${i.remaining}`) ?? []),
    ...(s.submission?.issues ?? []),
    ...verificationFailures(s).map(
      (v) => `${v.definition.id}: ${v.reason || v.disposition}`,
    ),
  ];
}
export function deliveryReview(s: ImplementationState) {
  return {
    basis: s.solutionRef,
    candidate: s.candidate,
    submission: s.submission,
    changes: s.changes,
    verification: s.verifications,
    remaining: gaps(s),
  };
}
export const reviewDigest = (s: ImplementationState) =>
  digest(deliveryReview(s));
export const checkDigest = (s: ImplementationState) =>
  digest({
    review: deliveryReview(s),
    evidence: s.evidence,
    interactions: s.interactions,
    externalApproval: s.externalApproval,
    partialApproval: s.partialApproval,
  });
