import type { ExecutableCode } from "@intloom/workflow-sdk";
import { reviewSolution } from "../../src/solution/changes.ts";
import {
  readSolution,
  saveSolution,
  assertSolutionBasis,
} from "../../src/solution/state.ts";
import { digest, fail, repeatedCheckFailure } from "../../src/flow/shared.ts";
const check = (async (_input, access) => {
  const state = readSolution(access);
  if (state.feedbacks.length >= 12)
    throw new Error("Solution feedback budget exceeded");
  await assertSolutionBasis(access, state);
  delete state.confirmation;
  if (
    state.questions.some((q) => q.answer === undefined && q.skipped !== true)
  ) {
    await saveSolution(access, state);
    return { outcome: "clarification_required" };
  }
  try {
    reviewSolution(state);
  } catch (error) {
    const content =
      error instanceof Error ? error.message : "Invalid Solution draft";
    const stalled = repeatedCheckFailure(state.feedbacks, content);
    state.feedbacks.push({
      source: "check",
      content,
    });
    await saveSolution(access, state);
    if (stalled)
      fail(
        "Solution repair repeated the same Check failure. Inspect the saved feedback before another execution.",
        "INTENT_REPAIR_STALLED",
      );
    return { outcome: "repair_required" };
  }
  state.confirmation = { digest: digest(state), confirmed: false };
  await saveSolution(access, state);
  return { outcome: "ready" };
}) satisfies ExecutableCode;
export default check;
