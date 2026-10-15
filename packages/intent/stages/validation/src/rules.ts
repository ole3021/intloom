import type { ValidationState } from "../schema/state.ts";
import type { AssessmentSubmission } from "../schema/submission.ts";
import type * as z from "zod";
import type { evidenceUseSchema } from "../../../src/schema/common.ts";
import {
  executionDataSchema,
  observationDataSchema,
} from "../../../src/schema/verification.ts";
import { contains, unique } from "../../../src/state.ts";
import { linkedEvidence } from "../../../src/project.ts";
import { digest } from "../../../src/json.ts";
import { latestVerificationEvidence } from "../../../src/verification.ts";
import { fail } from "../../../src/errors.ts";
function checkEvidenceUses(
  s: ValidationState,
  uses: z.infer<typeof evidenceUseSchema>[],
) {
  unique(
    uses.map((use) => use.evidenceRef),
    "evidence uses",
  );
  const sources = linkedEvidence(
    s,
    uses.map((use) => use.evidenceRef),
  );
  for (const [index, source] of sources.entries()) {
    const use = uses[index]!;
    if (use.relation === "context") continue;
    if (source.candidateRef !== s.candidate?.id)
      fail(
        "Only current-candidate evidence may support or contradict a judgment; other sources are context only.",
      );
    if (source.kind === "historical_result" || source.kind === "project_write")
      fail(
        "Historical results and write receipts are context, not independent acceptance proof.",
      );
    if (
      source.kind === "user_report" &&
      source.data &&
      typeof source.data === "object" &&
      !Array.isArray(source.data) &&
      (source.data.kind !== "questions" ||
        source.data.purpose !== "clarification")
    )
      fail("Approval and collection choices do not prove acceptance.");
    const execution = executionDataSchema.safeParse(source.data);
    if (
      execution.success &&
      use.relation === "supports" &&
      (execution.data.outcome !== "exited" ||
        execution.data.result.exitCode !== 0 ||
        execution.data.result.timedOut ||
        execution.data.result.truncated ||
        execution.data.after.id !== s.candidate?.id)
    )
      fail(
        "An incomplete, unsuccessful, mutated or truncated command is not sufficient positive proof.",
      );
    if (source.kind === "observation") {
      const observation = observationDataSchema.parse(source.data);
      if (
        use.relation === "supports" &&
        observation.steps.some(
          (step) =>
            step.status !== "observed" || step.assessment !== "supports",
        )
      )
        fail(
          "Incomplete or contradictory observations cannot support a passed judgment.",
        );
    }
  }
  return sources;
}
export function checkAssessment(
  s: ValidationState,
  submission: AssessmentSubmission,
  complete: boolean,
) {
  if (!s.candidate || submission.candidateRef !== s.candidate.id)
    fail("Assessment belongs to another candidate.");
  const targets = s.targets.map((t) => t.id);
  unique(
    submission.assessments.map((a) => a.targetRef),
    "target assessments",
  );
  contains(
    targets,
    submission.assessments.map((a) => a.targetRef),
    "target",
  );
  if (
    complete &&
    (!targets.length || submission.assessments.length !== targets.length)
  )
    fail(
      "Every required target needs an explicit final judgment; empty scope cannot pass.",
    );
  for (const result of submission.assessments) {
    if (result.verdict === "unverified" && !result.missingEvidence.length)
      fail("Unverified targets need an explicit evidence gap.");
    if (
      result.verdict !== "unverified" &&
      result.missingEvidence.length &&
      result.verdict === "passed"
    )
      fail("A passed target cannot retain missing necessary evidence.");
    const uses = result.evidence;
    checkEvidenceUses(s, uses);
    if (complete)
      for (const entry of s.verifications.filter((v) =>
        v.targetRefs.includes(result.targetRef),
      )) {
        const receipt = latestVerificationEvidence(s, entry);
        if (receipt && !uses.some((use) => use.evidenceRef === receipt.id))
          fail(
            `Account for the latest receipt of ${entry.definition.id}, including failures or limitations; use context with an explanation when it is not conclusive.`,
          );
      }
    if (
      result.verdict === "passed" &&
      (!uses.some((u) => u.relation === "supports") ||
        uses.some((u) => u.relation === "contradicts"))
    )
      fail(
        "Passed judgments need sufficient supporting evidence and no unresolved counterexample.",
      );
    if (
      result.verdict === "failed" &&
      !uses.some((u) => u.relation === "contradicts")
    )
      fail("Failed judgments need an applicable counterexample.");
  }
  unique(
    submission.findings.map((f) => f.id),
    "finding IDs",
  );
  unique(
    submission.findingUpdates.map((f) => f.findingRef),
    "finding updates",
  );
  for (const finding of submission.findings) {
    if (!finding.targetRefs.length)
      fail("A finding must identify its affected targets.");
    contains(targets, finding.targetRefs, "finding target");
    checkEvidenceUses(s, finding.evidence);
    if (!finding.evidence.some((use) => use.relation === "contradicts"))
      fail("A finding needs an applicable counterexample.");
  }
  for (const update of submission.findingUpdates) {
    const previous = s.history?.findingIndex.find(
      (f) => f.findingRef === update.findingRef,
    );
    if (
      !previous ||
      previous.latestAssessmentRef !== update.previousAssessmentRef
    )
      fail(
        "Historical finding changed; read the actual latest assessment before updating it.",
      );
    contains(targets, update.targetRefs, "finding target");
    const sources = checkEvidenceUses(s, update.evidence);
    if (update.outcome !== "unverified" && !sources.length)
      fail("A definite finding disposition requires evidence.");
    if (["resolved", "present"].includes(update.outcome)) {
      if (
        !sources.some(
          (e) =>
            e.candidateRef === s.candidate!.id &&
            [
              "execution",
              "observation",
              "project_read",
              "user_report",
            ].includes(e.kind),
        )
      )
        fail("Finding resolution/presence needs current-candidate evidence.");
      if (
        !update.evidence.some(
          (e) =>
            e.relation ===
            (update.outcome === "resolved" ? "supports" : "contradicts"),
        )
      )
        fail("Finding disposition must explain the relevant proof.");
    }
    if (
      update.outcome === "resolved" &&
      update.evidence.some((use) => use.relation === "contradicts")
    )
      fail("Resolution cannot retain an unresolved counterexample.");
    const formalSources = sources
      .filter((e) => e.kind === "historical_result")
      .map((e) =>
        e.data && typeof e.data === "object" && !Array.isArray(e.data)
          ? e.data.recordRef
          : undefined,
      );
    if (
      update.outcome === "no_longer_applicable" &&
      !formalSources.some(
        (ref) =>
          ref === s.implementation?.basis.specification.recordRef ||
          ref === s.implementation?.basis.solution.recordRef,
      )
    )
      fail(
        "Non-applicability requires this Run's formal requirement or design change, not omission.",
      );
    if (
      update.outcome === "invalidated" &&
      (!formalSources.includes(update.previousAssessmentRef.split("#")[0]) ||
        !update.evidence.some((use) => use.relation !== "context"))
    )
      fail(
        "Invalidation requires the original assessment and evidence explaining its error.",
      );
  }
}
export function summary(assessments: AssessmentSubmission["assessments"]) {
  const counts = {
    passed: 0,
    failed: 0,
    unverified: 0,
    total: assessments.length,
  };
  for (const a of assessments) counts[a.verdict]++;
  const verdict = counts.failed
    ? ("failed" as const)
    : counts.passed === counts.total && counts.total > 0
      ? ("passed" as const)
      : counts.passed
        ? ("partial" as const)
        : ("undone" as const);
  return {
    verdict,
    counts,
    limitations: [
      ...new Set(
        assessments.flatMap((a) => [...a.limitations, ...a.missingEvidence]),
      ),
    ],
  };
}
export function checkDigest(s: ValidationState) {
  return digest({
    basis: s.implementationRef,
    candidate: s.candidate,
    targets: s.targets,
    verifications: s.verifications,
    submission: s.submission,
    evidence: s.evidence,
    interactions: s.interactions,
    collectionDecisions: s.collectionDecisions,
  });
}
export function evidenceGaps(s: ValidationState) {
  return (s.submission?.assessments ?? [])
    .filter((item) => item.verdict === "unverified")
    .map((item) => ({
      id: `GAP-${digest({ target: item.targetRef, missing: [...item.missingEvidence].sort() })}`,
      targetRef: item.targetRef,
      missingEvidence: item.missingEvidence,
    }));
}
export function unconfirmedGaps(s: ValidationState) {
  return evidenceGaps(s).filter(
    (gap) =>
      !s.collectionDecisions.some(
        (decision) =>
          decision.candidateRef === s.candidate?.id &&
          decision.basisDigest === s.implementationRef?.digest &&
          (decision.evidenceGapRefs.includes(gap.id) ||
            s.verifications.some(
              (entry) =>
                entry.disposition === "stopped" &&
                entry.targetRefs.includes(gap.targetRef) &&
                decision.verificationRefs.includes(entry.definition.id),
            )),
      ),
  );
}
export function collectionReview(s: ValidationState) {
  const gaps = evidenceGaps(s);
  return {
    basis: s.implementationRef,
    candidate: s.candidate,
    targets: s.targets,
    assessments: s.submission?.assessments ?? [],
    attempts: s.verifications,
    informationRequests: s.questions,
    evidenceGaps: gaps,
    evidenceGapRefs: gaps.map((gap) => gap.id),
    verificationRefs: s.verifications
      .filter((v) =>
        ["pending", "awaiting_observation", "unavailable"].includes(
          v.disposition,
        ),
      )
      .map((v) => v.definition.id),
    informationRequestRefs: s.questions.map((q) => q.key),
    effect:
      "Stopping collection retains known failures and missing evidence. It does not approve acceptance or change goals.",
  };
}
