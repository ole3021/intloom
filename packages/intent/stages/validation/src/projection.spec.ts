import assert from "node:assert/strict";
import { test } from "node:test";
import { accumulate, emptyValidation, assessmentRef } from "./projection.ts";
import { specification, design, plan } from "../../../test/runtime.ts";
import { solutionTargets } from "../../../src/targets.ts";
import { candidate } from "../../../src/project.ts";
import { seal } from "../../../src/storage.ts";
import { validationRecordSchema } from "../schema/record.ts";
function record(run: string, verdict: "passed" | "failed" | "unverified") {
  const targets = solutionTargets(specification(run), design, plan);
  return validationRecordSchema.parse(
    seal({
      runId: run,
      prompt: "fixture",
      basis: {
        specification: { recordRef: "spec", digest: "spec" },
        solution: { recordRef: "sol", digest: "sol" },
        implementation: { recordRef: "impl", digest: "impl" },
      },
      candidate: candidate({ source: run }),
      scope: { targets },
      verifications: [],
      assessments: targets.map((t) => ({
        targetRef: t.id,
        verdict,
        explanation: "fixture",
        evidence: [],
        limitations: [],
        missingEvidence: verdict === "unverified" ? ["not observed"] : [],
      })),
      findings: [],
      findingUpdates: [],
      evidence: [],
      interactions: [],
      collectionDecisions: [],
      check: { digest: "fixture", issues: [] },
      summary: {
        verdict: verdict === "unverified" ? "undone" : verdict,
        counts: {
          total: 1,
          passed: verdict === "passed" ? 1 : 0,
          failed: verdict === "failed" ? 1 : 0,
          unverified: verdict === "unverified" ? 1 : 0,
        },
        limitations: [],
      },
    }),
  );
}
test("latest unverified supersedes a prior pass; changed definitions create distinct index entries", () => {
  const first = record("R1", "passed");
  let a = accumulate(emptyValidation(), "REC1", first);
  const second = record("R2", "unverified");
  a = accumulate(a, "REC2", second);
  assert.equal(a.targetIndex.length, 1);
  assert.match(a.targetIndex[0]!.latestAssessmentRef, /^REC2/);
  const third = record("R3", "passed");
  third.scope.targets[0]!.definitionDigest = "new-definition";
  a = accumulate(a, "REC3", third);
  assert.equal(a.targetIndex.length, 2);
  assert.deepEqual(accumulate(a, "REC3", third), a);
});
test("round-only targets stay in Records and untouched targets retain old candidate references", () => {
  const first = record("R1", "passed");
  const a = accumulate(emptyValidation(), "REC1", first);
  const second = record("R2", "passed");
  second.scope.targets[0]!.kind = "round_criterion";
  second.scope.targets[0]!.persistent = false;
  const b = accumulate(a, "REC2", second);
  assert.deepEqual(b.targetIndex, a.targetIndex);
});
test("a later unverified finding review preserves the version-qualified prior resolution", () => {
  const first = record("R1", "failed");
  first.findings.push({
    id: "F1",
    description: "Wrong greeting",
    targetRefs: [first.scope.targets[0]!.id],
    evidence: [
      {
        evidenceRef: "fixture",
        relation: "contradicts",
        explanation: "fixture",
      },
    ],
  });
  let a = accumulate(emptyValidation(), "REC1", first);
  const second = record("R2", "passed");
  second.findingUpdates.push({
    findingRef: "F1",
    previousAssessmentRef: a.findingIndex[0]!.latestAssessmentRef,
    outcome: "resolved",
    explanation: "Verified original failure",
    targetRefs: [],
    evidence: [],
  });
  a = accumulate(a, "REC2", second);
  const third = record("R3", "unverified");
  third.findingUpdates.push({
    findingRef: "F1",
    previousAssessmentRef: a.findingIndex[0]!.latestAssessmentRef,
    outcome: "unverified",
    explanation: "Service unavailable",
    targetRefs: [],
    evidence: [],
  });
  a = accumulate(a, "REC3", third);
  assert.equal(
    a.findingIndex[0]!.latestAssessmentRef,
    assessmentRef("REC3", "findingUpdates", "F1"),
  );
  assert.equal(
    a.findingIndex[0]!.lastDefiniteAssessmentRef,
    assessmentRef("REC2", "findingUpdates", "F1"),
  );
});
