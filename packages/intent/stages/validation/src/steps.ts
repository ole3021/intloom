import { formatReview } from "./review.ts";
import type { CodeRecovery } from "@intloom/loom-sdk";
import { userAnswerQuestionsSchema } from "@intloom/loom-sdk";
import type { StageCodeAccess } from "../../../src/access.ts";
import {
  baseline,
  inputRecord,
  loadRecord,
  resumeCommitted,
  publish,
  seal,
  recordId,
} from "../../../src/storage.ts";
import { save } from "../../../src/state.ts";
import { interact, answerQuestions } from "../../../src/interaction.ts";
import { solutionRecordSchema } from "../../solution/schema/record.ts";
import { implementationRecordSchema } from "../../implementation/schema/record.ts";
import { validationRecordSchema } from "../schema/record.ts";
import { validationArtifactSchema } from "../schema/artifact.ts";
import { assertCandidate } from "../../../src/project.ts";
import { verifyQueue, assertSettled } from "../../../src/verification.ts";
import { readState } from "./actions.ts";
import {
  checkAssessment,
  summary,
  collectionReview,
  unconfirmedGaps,
  checkDigest,
} from "./rules.ts";
import { emptyValidation, accumulate } from "./projection.ts";
import { digest, json } from "../../../src/json.ts";
import { fail } from "../../../src/errors.ts";
export async function prepare(access: StageCodeAccess) {
  const s = readState(access);
  if (await resumeCommitted(access, s.id, "validation"))
    return { outcome: "complete" };
  if (!s.implementation) {
    const input = await inputRecord(access.storage, s.id, "implementation");
    s.implementationRef = input.ref;
    s.implementation = implementationRecordSchema.parse(input.data);
    const solution = solutionRecordSchema.parse(
      await loadRecord(
        access.storage,
        s.implementation.basis.solution,
        "solution",
        s.id,
      ),
    );
    await loadRecord(
      access.storage,
      s.implementation.basis.specification,
      "specification",
      s.id,
    );
    if (
      digest(solution.basis.specification) !==
      digest(s.implementation.basis.specification)
    )
      fail("Handoff basis chain mismatch.");
    s.candidate = s.implementation.workspace.candidate;
    await assertCandidate(access, s.candidate);
    s.targets = solution.targets;
    s.evidence = structuredClone(s.implementation.evidence);
    s.baseline = await baseline(access.storage, "validation");
    s.history = s.baseline
      ? validationArtifactSchema.parse(s.baseline.data)
      : emptyValidation();
    s.verifications = solution.plan.verifications.map((v) => {
      const prior = s.implementation!.verifications.find(
        (p) => p.definition.id === v.id,
      );
      const adopted =
        v.executionStage === "implementation" &&
        prior?.candidateRef === s.candidate!.id &&
        prior.disposition === "executed";
      return {
        definition: v,
        origin: "solution" as const,
        targetRefs: [
          ...new Set(
            solution.plan.coverage
              .filter((c) => c.verificationRefs.includes(v.id))
              .map((c) => `${c.target.kind}:${c.target.id}`),
          ),
        ],
        disposition:
          v.executionStage !== "implementation"
            ? ("pending" as const)
            : adopted
              ? ("adopted" as const)
              : ("unavailable" as const),
        evidenceRefs:
          v.executionStage === "implementation"
            ? [...(prior?.evidenceRefs ?? [])]
            : [],
        reason:
          v.executionStage !== "implementation"
            ? ""
            : adopted
              ? "Evidence adopted from the fixed Implementation Record; not executed in Validation."
              : "Implementation did not supply completed applicable evidence.",
        attempts: 0,
        ...(adopted ? { candidateRef: s.candidate!.id } : {}),
      };
    });
  }
  s.task = "verify";
  await save(access, s);
  return { outcome: "ready" };
}
export async function verify(access: StageCodeAccess) {
  const s = readState(access);
  return verifyQueue(access, s, "assess");
}
export async function check(access: StageCodeAccess) {
  const s = readState(access);
  assertSettled(s);
  await assertCandidate(access, s.candidate!);
  await loadRecord(
    access.storage,
    s.implementationRef!,
    "implementation",
    s.id,
  );
  if (s.stopRequested || s.questions.length) return { outcome: "needs_input" };
  if (
    s.verifications.some((v) =>
      ["pending", "awaiting_observation"].includes(v.disposition),
    )
  )
    return { outcome: "verify" };
  try {
    if (!s.submission || s.submission.kind !== "ready")
      fail("A complete final assessment is required.");
    checkAssessment(s, s.submission, true);
    if (unconfirmedGaps(s).length) {
      s.stopRequested = true;
      s.task = "resolve";
      await save(access, s);
      return { outcome: "needs_input" };
    }
    for (const v of s.verifications.filter(
      (v) =>
        v.disposition === "stopped" && !v.reason.startsWith("Replaced by "),
    ))
      if (
        !s.collectionDecisions.some(
          (d) =>
            d.candidateRef === s.candidate!.id &&
            d.basisDigest === s.implementationRef!.digest &&
            d.verificationRefs.includes(v.definition.id),
        )
      )
        fail("Stopped collection is not covered by a real user decision.");
    s.checkedDigest = checkDigest(s);
    s.task = "commit";
    await save(access, s);
    return { outcome: "ready" };
  } catch (e) {
    s.feedback = [e instanceof Error ? e.message : String(e)];
    s.task = "assess";
    await save(access, s);
    return { outcome: "assess" };
  }
}
export async function resolve(
  access: StageCodeAccess,
  recovery?: CodeRecovery,
) {
  const s = readState(access);
  assertSettled(s);
  await assertCandidate(access, s.candidate!);
  if (s.resolutionChoice === "continue_collection") {
    await answerQuestions(access, s, recovery);
    delete s.resolutionChoice;
    s.task = s.resumeTask === "observe" ? "observe" : "assess";
    delete s.resumeTask;
    s.stopRequested = false;
    await save(access, s);
    return { outcome: s.task };
  }
  const review = collectionReview(s);
  const receipt = await interact(
    access,
    s,
    "questions",
    "collection_choice",
    [
      {
        id: "collection_action",
        question: `Choose the next action for these exact evidence gaps.
${formatReview(s)}`,
        isSkippable: false,
        options: [
          {
            id: "continue_collection",
            label: "continue_collection",
            description:
              "Provide the missing information or retry the listed collection actions.",
          },
          {
            id: "stop_collection",
            label: "stop_collection",
            description:
              "Stop only the listed collection actions and report failures and missing evidence truthfully.",
          },
          {
            id: "pause",
            label: "pause",
            description:
              "Keep this Run waiting; do not publish a final report.",
          },
        ],
      },
    ],
    recovery,
  );
  await assertCandidate(access, s.candidate!);
  const answer = userAnswerQuestionsSchema.parse(receipt.answer)[0];
  if (!answer || answer.isSkipped)
    fail("A real collection decision is required.");
  if (answer.answer === "stop_collection") {
    s.collectionDecisions.push({
      id: `STOP-${receipt.id}`,
      interactionRef: receipt.id,
      reviewRef: receipt.id,
      reviewDigest: digest(review),
      review: json(review),
      basisDigest: s.implementationRef!.digest,
      candidateRef: s.candidate!.id,
      verificationRefs: review.verificationRefs,
      informationRequestRefs: review.informationRequestRefs,
      evidenceGapRefs: review.evidenceGapRefs,
      decision: "stop_collection",
      decidedAt: receipt.at,
    });
    for (const v of s.verifications)
      if (review.verificationRefs.includes(v.definition.id)) {
        v.disposition = "stopped";
        v.reason =
          "The user explicitly stopped this collection action; missing evidence is retained.";
      }
    s.questions = [];
    s.stopRequested = false;
    s.task = "assess";
    await save(access, s);
    return { outcome: "assess" };
  }
  if (answer.answer === "continue_collection") {
    if (s.questions.length) {
      s.resolutionChoice = "continue_collection";
      await save(access, s);
      await answerQuestions(access, s);
      delete s.resolutionChoice;
      s.task = s.resumeTask === "observe" ? "observe" : "assess";
      delete s.resumeTask;
      s.stopRequested = false;
      await save(access, s);
      return { outcome: s.task };
    }
    for (const v of s.verifications)
      if (review.verificationRefs.includes(v.definition.id)) {
        v.disposition = "pending";
        v.reason = "The user chose another evidence collection attempt.";
      }
    s.stopRequested = false;
    s.task = "verify";
    await save(access, s);
    return { outcome: "verify" };
  }
  s.feedback.push(
    answer.answer === "pause"
      ? "Collection paused by the user; a new explicit choice is required to continue or close."
      : "Choose continue_collection, stop_collection, or pause explicitly.",
  );
  await save(access, s);
  return { outcome: "needs_input" };
}
export async function commit(access: StageCodeAccess) {
  const s = readState(access);
  if (await resumeCommitted(access, s.id, "validation"))
    return { outcome: "complete" };
  assertSettled(s);
  await assertCandidate(access, s.candidate!);
  await loadRecord(
    access.storage,
    s.implementationRef!,
    "implementation",
    s.id,
  );
  if (
    !s.submission ||
    s.submission.kind !== "ready" ||
    s.checkedDigest !== checkDigest(s)
  )
    fail("Validation requires a current final check.");
  checkAssessment(s, s.submission, true);
  if (unconfirmedGaps(s).length)
    fail("Ending evidence collection requires a real choice for these gaps.");
  const record = validationRecordSchema.parse(
    seal({
      runId: s.id,
      prompt: s.prompt,
      basis: {
        ...s.implementation!.basis,
        implementation: s.implementationRef,
      },
      candidate: s.candidate,
      scope: { targets: s.targets },
      verifications: s.verifications,
      assessments: s.submission.assessments,
      findings: s.submission.findings,
      findingUpdates: s.submission.findingUpdates,
      evidence: s.evidence,
      interactions: s.interactions,
      collectionDecisions: s.collectionDecisions,
      check: { digest: s.checkedDigest, issues: [] },
      summary: summary(s.submission.assessments),
    }),
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await baseline(access.storage, "validation"),
      history = current
        ? validationArtifactSchema.parse(current.data)
        : emptyValidation();
    const changed = s.submission.findingUpdates.some(
      (update) =>
        history.findingIndex.find((f) => f.findingRef === update.findingRef)
          ?.latestAssessmentRef !== update.previousAssessmentRef,
    );
    if (changed) {
      s.baseline = current;
      s.history = history;
      s.feedback.push(
        "A concurrent Run updated a referenced finding. Reassess that update using the new history.",
      );
      delete s.checkedDigest;
      s.task = "assess";
      await save(access, s);
      return { outcome: "assess" };
    }
    try {
      await publish(access, s.id, "validation", record, {
        data: accumulate(history, recordId(s.id, "validation"), record),
        baseline: current,
      });
      return { outcome: "complete" };
    } catch (error) {
      if (await access.storage.getRecordById(recordId(s.id, "validation"))) {
        await resumeCommitted(access, s.id, "validation");
        return { outcome: "complete" };
      }
      if (
        digest(await baseline(access.storage, "validation")) === digest(current)
      )
        throw error;
    }
  }
  fail(
    "Concurrent validation publication did not settle; retry the original commit.",
    "STALE_INTENT_BASIS",
  );
}
