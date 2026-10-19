import { formatReview } from "./review.ts";
import type { CodeRecovery } from "@intloom/loom-sdk";
import type { StageCodeAccess } from "../../../src/access.ts";
import {
  baseline,
  assertBaseline,
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
import { specificationRecordSchema } from "../schema/record.ts";
import { specificationArtifactSchema } from "../schema/artifact.ts";
import { readState } from "./actions.ts";
import {
  emptySpecification,
  checkAnalysis,
  checkSpecification,
  reviewDigest,
} from "./rules.ts";
import { fail } from "../../../src/errors.ts";
export async function prepare(access: StageCodeAccess) {
  const s = readState(access);
  if (await resumeCommitted(access, s.id, "specification"))
    return { outcome: "complete" };
  if (s.baseline === undefined) {
    s.baseline = await baseline(access.storage, "specification");
    s.draft = s.baseline
      ? specificationArtifactSchema.parse(s.baseline.data)
      : emptySpecification();
  }
  s.task = "analyze";
  await save(access, s);
  return { outcome: "ready" };
}
export async function checkScope(access: StageCodeAccess) {
  const s = readState(access);
  try {
    checkAnalysis(s);
    s.task = "draft";
    await save(access, s);
    return { outcome: "ready" };
  } catch (e) {
    s.feedback = [e instanceof Error ? e.message : String(e)];
    if (!s.questions.length)
      s.questions = [
        {
          key: `scope-${s.revision}`,
          question:
            "Intent supports feature additions, adjustments, removals and fixes. Describe the concrete feature goal and separate any independent restructuring.",
        },
      ];
    await save(access, s);
    return { outcome: "needs_input" };
  }
}
export async function check(access: StageCodeAccess) {
  const s = readState(access);
  try {
    checkAnalysis(s);
  } catch (error) {
    s.feedback = [error instanceof Error ? error.message : String(error)];
    s.task = "analyze";
    await save(access, s);
    return { outcome: "analyze" };
  }
  await assertBaseline(access, "specification", s.baseline);
  try {
    checkSpecification(s);
    s.reviewDigest = reviewDigest(s);
    s.task = "confirm";
    await save(access, s);
    return { outcome: "ready" };
  } catch (e) {
    s.feedback = [e instanceof Error ? e.message : String(e)];
    s.task = "draft";
    await save(access, s);
    return { outcome: "draft" };
  }
}
export async function resolve(
  access: StageCodeAccess,
  recovery?: CodeRecovery,
) {
  const s = readState(access);
  await answerQuestions(access, s, recovery);
  s.task = "analyze";
  await save(access, s);
  return { outcome: "ready" };
}
export async function confirm(
  access: StageCodeAccess,
  recovery?: CodeRecovery,
) {
  const s = readState(access);
  checkSpecification(s);
  await assertBaseline(access, "specification", s.baseline);
  if (s.reviewDigest !== reviewDigest(s)) fail("Requirement review is stale.");
  const receipt = await interact(
    access,
    s,
    "confirmation",
    "specification",
    {
      context: `Confirm the round's feature scope, requirement changes and acceptance criteria.
${formatReview(s)}`,
    },
    recovery,
  );
  await assertBaseline(access, "specification", s.baseline);
  if (approved(receipt.answer)) {
    s.approval = { reviewDigest: s.reviewDigest, interactionRef: receipt.id };
    s.task = "commit";
  } else {
    s.feedback.push(feedback(receipt.answer));
    delete s.approval;
    s.task = "draft";
  }
  await save(access, s);
  return { outcome: s.approval ? "confirmed" : "feedback" };
}
export async function commit(access: StageCodeAccess) {
  const s = readState(access);
  if (await resumeCommitted(access, s.id, "specification"))
    return { outcome: "complete" };
  checkSpecification(s);
  const currentBaseline = await assertBaseline(
    access,
    "specification",
    s.baseline,
  );
  if (!s.approval || s.approval.reviewDigest !== reviewDigest(s))
    fail("Requirements need current user confirmation.");
  const record = specificationRecordSchema.parse(
    seal({
      runId: s.id,
      prompt: s.prompt,
      baseline: s.baseline,
      snapshot: s.draft,
      analysis: s.analysis,
      scope: s.scope,
      edits: s.edits,
      evidence: s.evidence,
      interactions: s.interactions,
      approval: s.approval,
    }),
  );
  await publish(access, s.id, "specification", record, {
    data: s.draft,
    baseline: currentBaseline,
  });
  return { outcome: "complete" };
}
