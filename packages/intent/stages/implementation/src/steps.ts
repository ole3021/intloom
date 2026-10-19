import { formatReview } from "./review.ts";
import type { CodeRecovery } from "@intloom/loom-sdk";
import type { StageCodeAccess } from "../../../src/access.ts";
import {
  inputRecord,
  loadRecord,
  resumeCommitted,
  publish,
  seal,
} from "../../../src/storage.ts";
import { save } from "../../../src/state.ts";
import {
  interact,
  approved,
  feedback,
  answerQuestions,
} from "../../../src/interaction.ts";
import { specificationRecordSchema } from "../../specification/schema/record.ts";
import { solutionRecordSchema } from "../../solution/schema/record.ts";
import { implementationRecordSchema } from "../schema/record.ts";
import { snapshot, assertCandidate, changes } from "../../../src/project.ts";
import { verifyQueue, assertSettled } from "../../../src/verification.ts";
import { readState } from "./actions.ts";
import {
  checkSubmission,
  unexplainedChanges,
  gaps,
  deliveryReview,
  reviewDigest,
  checkDigest,
} from "./rules.ts";
import { fail } from "../../../src/errors.ts";
export async function prepare(access: StageCodeAccess) {
  const s = readState(access);
  if (await resumeCommitted(access, s.id, "implementation"))
    return { outcome: "complete" };
  if (!s.solution) {
    const input = await inputRecord(access.storage, s.id, "solution");
    s.solutionRef = input.ref;
    s.solution = solutionRecordSchema.parse(input.data);
    s.specification = specificationRecordSchema.parse(
      await loadRecord(
        access.storage,
        s.solution.basis.specification,
        "specification",
        s.id,
      ),
    );
    s.baseline = await snapshot(access);
    s.candidate = s.baseline;
    const solution = s.solution;
    s.verifications = solution.plan.verifications
      .filter((v) => v.executionStage !== "validation")
      .map((v) => ({
        definition: v,
        origin: "solution",
        targetRefs: solution.plan.coverage
          .filter((c) => c.verificationRefs.includes(v.id))
          .map((c) => `${c.target.kind}:${c.target.id}`),
        disposition: "pending",
        evidenceRefs: [],
        reason: "",
        attempts: 0,
      }));
  }
  s.task = "implement";
  await save(access, s);
  return { outcome: "ready" };
}
export async function verify(access: StageCodeAccess) {
  const s = readState(access);
  checkSubmission(s);
  s.task = "verify";
  return verifyQueue(access, s, "check");
}
export async function check(access: StageCodeAccess) {
  const s = readState(access);
  assertSettled(s);
  await assertCandidate(access, s.candidate);
  await loadRecord(access.storage, s.solutionRef, "solution", s.id);
  try {
    checkSubmission(s);
  } catch (e) {
    s.feedback = [String(e)];
    s.task = "implement";
    await save(access, s);
    return { outcome: "implement" };
  }
  s.changes = changes(s.baseline, s.candidate, s.evidence);
  if (
    unexplainedChanges(s).length &&
    s.externalApproval?.reviewDigest !== reviewDigest(s)
  ) {
    s.task = "resolve";
    await save(access, s);
    return { outcome: "needs_input" };
  }
  if (
    s.verifications.some((v) =>
      ["pending", "awaiting_observation"].includes(v.disposition),
    )
  )
    return { outcome: "verify" };
  if (gaps(s).length && s.partialApproval?.reviewDigest !== reviewDigest(s)) {
    const message = `Delivery gaps: ${gaps(s).join("; ")}`;
    const alreadySeen = s.feedback.includes(message);
    s.feedback.push(message);
    s.task =
      s.submission.kind === "needs_attention" || alreadySeen
        ? "resolve"
        : "implement";
    await save(access, s);
    return { outcome: s.task === "resolve" ? "needs_input" : "implement" };
  }
  s.checkedDigest = checkDigest(s);
  s.task = "commit";
  await save(access, s);
  return { outcome: "ready" };
}
export async function resolve(
  access: StageCodeAccess,
  recovery?: CodeRecovery,
) {
  const s = readState(access);
  assertSettled(s);
  await assertCandidate(access, s.candidate);
  if (s.questions.length) {
    await answerQuestions(access, s, recovery);
    s.task = s.resumeTask === "observe" ? "observe" : "implement";
    delete s.resumeTask;
    await save(access, s);
    return { outcome: s.task };
  }
  const external =
    unexplainedChanges(s).length &&
    s.externalApproval?.reviewDigest !== reviewDigest(s);
  const purpose = external ? "adopt_external_changes" : "partial_delivery";
  const message = external
    ? "These changes include edits not attributable to recorded operations. Confirm only if these exact changes should be included in this delivery; this does not approve unrelated future edits."
    : "Choose partial delivery of this exact candidate to Validation. All unmet targets, failed checks and missing evidence remain in scope; this does not approve acceptance.";
  const receipt = await interact(
    access,
    s,
    "confirmation",
    purpose,
    {
      context: `${message}
${formatReview(s)}`,
    },
    recovery,
  );
  await assertCandidate(access, s.candidate);
  if (approved(receipt.answer)) {
    const approval = {
      reviewDigest: reviewDigest(s),
      interactionRef: receipt.id,
    };
    if (external) s.externalApproval = approval;
    else s.partialApproval = approval;
    s.task = "check";
  } else {
    s.feedback.push(feedback(receipt.answer));
    s.task = "implement";
  }
  await save(access, s);
  return { outcome: s.task === "check" ? "ready" : "implement" };
}
export async function commit(access: StageCodeAccess) {
  const s = readState(access);
  if (await resumeCommitted(access, s.id, "implementation"))
    return { outcome: "complete" };
  assertSettled(s);
  await assertCandidate(access, s.candidate);
  await loadRecord(access.storage, s.solutionRef, "solution", s.id);
  checkSubmission(s);
  if (s.checkedDigest !== checkDigest(s))
    fail("Implementation must pass a current handoff check.");
  if (gaps(s).length && s.partialApproval?.reviewDigest !== reviewDigest(s))
    fail("Partial delivery requires an explicit current user choice.");
  if (
    unexplainedChanges(s).length &&
    s.externalApproval?.reviewDigest !== reviewDigest(s)
  )
    fail("Unknown change provenance must be reconciled.");
  const record = implementationRecordSchema.parse(
    seal({
      runId: s.id,
      prompt: s.prompt,
      basis: {
        specification: s.solution.basis.specification,
        solution: s.solutionRef,
      },
      workspace: { baseline: s.baseline, candidate: s.candidate },
      submission: s.submission,
      changes: s.changes,
      verifications: s.verifications,
      evidence: s.evidence,
      interactions: s.interactions,
      check: { digest: s.checkedDigest, issues: gaps(s) },
      delivery: gaps(s).length
        ? {
            kind: "partial",
            approval: s.partialApproval,
            review: deliveryReview(s),
          }
        : { kind: "complete" },
    }),
  );
  await publish(access, s.id, "implementation", record);
  return { outcome: "complete" };
}
