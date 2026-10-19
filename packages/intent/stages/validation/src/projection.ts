import type { ValidationArtifact } from "../schema/artifact.ts";
import type { ValidationRecord } from "../schema/record.ts";
export const emptyValidation = (): ValidationArtifact => ({
  records: [],
  latestRound: null,
  targetIndex: [],
  findingIndex: [],
});
export const assessmentRef = (
  recordRef: string,
  collection: string,
  id: string,
) => `${recordRef}#${collection}/${encodeURIComponent(id)}`;
export function accumulate(
  previous: ValidationArtifact,
  recordRef: string,
  record: ValidationRecord,
): ValidationArtifact {
  if (previous.records.some((r) => r.recordRef === recordRef)) return previous;
  const next = structuredClone(previous);
  next.records.push({ recordRef, publicationOrder: next.records.length + 1 });
  next.latestRound = {
    recordRef,
    candidateRef: record.candidate.id,
    verdict: record.summary.verdict,
  };
  for (const target of record.scope.targets.filter(
    (t) => t.persistent && t.kind !== "round_criterion",
  )) {
    const targetKey = `${target.kind}:${target.entityId}:${target.definitionDigest}`;
    const value = {
      targetKey,
      latestAssessmentRef: assessmentRef(recordRef, "assessments", target.id),
    };
    const index = next.targetIndex.findIndex((t) => t.targetKey === targetKey);
    if (index < 0) next.targetIndex.push(value);
    else next.targetIndex[index] = value;
  }
  for (const finding of record.findings) {
    const ref = assessmentRef(recordRef, "findings", finding.id);
    next.findingIndex.push({
      findingRef: finding.id,
      latestAssessmentRef: ref,
      lastDefiniteAssessmentRef: ref,
    });
  }
  for (const update of record.findingUpdates) {
    const index = next.findingIndex.findIndex(
      (f) => f.findingRef === update.findingRef,
    );
    const finding = next.findingIndex[index];
    if (!finding)
      throw new Error(`Unknown historical finding ${update.findingRef}`);
    const ref = assessmentRef(recordRef, "findingUpdates", update.findingRef);
    next.findingIndex[index] = {
      ...finding,
      latestAssessmentRef: ref,
      ...(update.outcome !== "unverified"
        ? { lastDefiniteAssessmentRef: ref }
        : {}),
    };
  }
  return next;
}
