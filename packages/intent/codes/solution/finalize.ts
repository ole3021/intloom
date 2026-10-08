import type { ExecutableCode } from "@intloom/workflow-sdk";
import { solutionRecordSchema } from "../../schemas/solution-state.ts";
import { readSolution, assertSolutionBasis } from "../../src/solution/state.ts";
import { reviewSolution } from "../../src/solution/changes.ts";
import {
  commitStage,
  digest,
  fail,
  recordId,
  sameBasis,
} from "../../src/flow/shared.ts";
const finalize = (async (_input, access) => {
  const state = readSolution(access);
  const { confirmation, ...snapshot } = state;
  if (!confirmation?.confirmed || confirmation.digest !== digest(snapshot))
    fail("Solution needs current user confirmation.");
  if (!state.specification) fail("Missing specification basis.");
  await sameBasis(access, "specification", state.specification);
  if (!(await access.storage.getRecordById(recordId(state.id, "solution"))))
    await assertSolutionBasis(access, state);
  const { artifact, originRefs } = reviewSolution(state);
  const record = solutionRecordSchema.parse({
    id: state.id,
    intent: state.intent,
    basis: state.specification,
    resultDigest: digest(artifact),
    changes: state.changes,
    origin_refs: originRefs,
    questions: state.questions
      .filter((q) => q.answer !== undefined)
      .map(({ id, question, description, answer }) => ({
        id,
        question,
        description,
        answer,
      })),
    feedbacks: state.feedbacks,
    checks: state.checks,
  });
  await commitStage(
    access,
    state.id,
    "solution",
    artifact,
    record,
    state.baseline ?? null,
  );
  return { outcome: "complete" };
}) satisfies ExecutableCode;
export default finalize;
