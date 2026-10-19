import { formatReview } from "./review.ts";
import type { CodeRecovery } from "@intloom/loom-sdk";
import type { StageCodeAccess } from "../../../src/access.ts";
import {
  baseline,
  assertBaseline,
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
import { solutionRecordSchema } from "../schema/record.ts";
import { solutionArtifactSchema } from "../schema/artifact.ts";
import { solutionTargets } from "../../../src/targets.ts";
import { readState } from "./actions.ts";
import {
  emptySolution,
  checkAnalysis as reviewAnalysis,
  checkSolution,
  reviewDigest,
} from "./rules.ts";
import { fail } from "../../../src/errors.ts";
export async function prepare(access: StageCodeAccess) {
  const s = readState(access);
  if (await resumeCommitted(access, s.id, "solution"))
    return { outcome: "complete" };
  if (!s.specification) {
    const input = await inputRecord(access.storage, s.id, "specification");
    s.specificationRef = input.ref;
    s.specification = specificationRecordSchema.parse(input.data);
  }
  if (s.baseline === undefined) {
    s.baseline = await baseline(access.storage, "solution");
    s.draft = s.baseline
      ? solutionArtifactSchema.parse(s.baseline.data)
      : emptySolution();
  }
  s.task = "analyze";
  await save(access, s);
  return { outcome: "ready" };
}
export async function checkAnalysis(access: StageCodeAccess) {
  const s = readState(access);
  try {
    reviewAnalysis(s);
    s.task = "design";
    await save(access, s);
    return { outcome: "ready" };
  } catch (e) {
    s.feedback = [e instanceof Error ? e.message : String(e)];
    s.task = "analyze";
    await save(access, s);
    return { outcome: "analyze" };
  }
}
export async function check(access: StageCodeAccess) {
  const s = readState(access);
  try {
    reviewAnalysis(s);
  } catch (e) {
    s.feedback = [String(e)];
    s.task = "analyze";
    await save(access, s);
    return { outcome: "analyze" };
  }
  await assertBaseline(access, "solution", s.baseline);
  await loadRecord(access.storage, s.specificationRef, "specification", s.id);
  try {
    checkSolution(s);
    s.reviewDigest = reviewDigest(s);
    s.task = "confirm";
    await save(access, s);
    return { outcome: "ready" };
  } catch (e) {
    s.feedback = [e instanceof Error ? e.message : String(e)];
    s.task = "design";
    await save(access, s);
    return { outcome: "design" };
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
  checkSolution(s);
  await assertBaseline(access, "solution", s.baseline);
  if (s.reviewDigest !== reviewDigest(s)) fail("Design review is stale.");
  const receipt = await interact(
    access,
    s,
    "confirmation",
    "solution",
    {
      context: `Confirm the design, implementation dependencies and verification responsibilities.
${formatReview(s)}`,
    },
    recovery,
  );
  await assertBaseline(access, "solution", s.baseline);
  if (approved(receipt.answer)) {
    s.approval = { reviewDigest: s.reviewDigest, interactionRef: receipt.id };
    s.task = "commit";
  } else {
    s.feedback.push(feedback(receipt.answer));
    delete s.approval;
    s.task = "design";
  }
  await save(access, s);
  return { outcome: s.approval ? "confirmed" : "feedback" };
}
export async function commit(access: StageCodeAccess) {
  const s = readState(access);
  if (await resumeCommitted(access, s.id, "solution"))
    return { outcome: "complete" };
  checkSolution(s);
  const currentBaseline = await assertBaseline(access, "solution", s.baseline);
  await loadRecord(access.storage, s.specificationRef, "specification", s.id);
  if (!s.approval || s.approval.reviewDigest !== reviewDigest(s))
    fail("Design requires current confirmation.");
  const record = solutionRecordSchema.parse(
    seal({
      runId: s.id,
      prompt: s.prompt,
      basis: { specification: s.specificationRef },
      baseline: s.baseline,
      snapshot: s.draft,
      analysis: s.analysis,
      plan: s.plan,
      targets: solutionTargets(s.specification, s.draft, s.plan),
      edits: s.edits,
      evidence: s.evidence,
      interactions: s.interactions,
      approval: s.approval,
    }),
  );
  await publish(access, s.id, "solution", record, {
    data: s.draft,
    baseline: currentBaseline,
  });
  return { outcome: "complete" };
}
