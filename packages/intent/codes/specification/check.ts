import type { ExecutableCode } from "@intloom/workflow-sdk";
import { LoomError } from "@intloom/utils";
import { isDeepStrictEqual } from "node:util";
import {
  readInitializedState,
  saveState,
} from "../../src/specification/state.ts";
import { confirmationContext } from "../../src/specification/confirmation.ts";
import { loadBaseline } from "../../src/specification/baseline.ts";
import { review } from "../../src/specification/review.ts";
import { hasUserResponse } from "../../src/specification/questions.ts";

const check = (async (_input, access) => {
  const state = readInitializedState(access);
  if (state.feedbacks.length >= 12)
    throw new Error("Specification feedback budget exceeded");
  delete state.confirmation;
  const baseline = await loadBaseline(access);
  if (!isDeepStrictEqual(baseline, state.baseline)) {
    state.baseline = baseline;
    state.feedbacks.push({
      source: "check",
      content:
        "The committed specification baseline changed. Review cumulative Changes before submitting the draft again.",
    });
    await saveState(access, state);
    return { outcome: "repair_required" };
  }
  if (state.questions.some((q) => !hasUserResponse(q))) {
    await saveState(access, state);
    return { outcome: "clarification_required" };
  }
  try {
    review(state);
  } catch (error) {
    if (!LoomError.is(error) || error.code !== "INVALID_SPECIFICATION")
      throw error;
    state.feedbacks.push({ source: "check", content: error.message });
    await saveState(access, state);
    return { outcome: "repair_required" };
  }
  state.confirmation = {
    context: confirmationContext(state),
    confirmed: false,
  };
  await saveState(access, state);
  return { outcome: "ready" };
}) satisfies ExecutableCode;
export default check;
