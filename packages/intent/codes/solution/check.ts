import type { ExecutableCode } from "@intloom/workflow-sdk";
import { reviewSolution } from "../../src/solution/changes.ts";
import {
  readSolution,
  saveSolution,
  assertSolutionBasis,
} from "../../src/solution/state.ts";
import { digest } from "../../src/flow/shared.ts";
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
    state.feedbacks.push({
      source: "check",
      content:
        error instanceof Error ? error.message : "Invalid Solution draft",
    });
    await saveSolution(access, state);
    return { outcome: "repair_required" };
  }
  state.confirmation = { digest: digest(state), confirmed: false };
  await saveSolution(access, state);
  return { outcome: "ready" };
}) satisfies ExecutableCode;
export default check;
