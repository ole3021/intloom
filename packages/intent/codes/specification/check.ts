import type { ExecutableCode } from "@intloom/workflow-sdk";
import { LoomError } from "@intloom/utils";
import { isDeepStrictEqual } from "node:util";
import {
  readInitializedState,
  saveState,
} from "../../src/specification/state.ts";
import { confirmationContext } from "../../src/specification/confirmation.ts";
import { loadBaseline } from "../../src/specification/baseline.ts";
import {
  applyChanges,
  emptyArtifact,
} from "../../src/specification/changes.ts";
import { review } from "../../src/specification/review.ts";
import { hasUserResponse } from "../../src/specification/questions.ts";
import { fail, repeatedCheckFailure } from "../../src/flow/shared.ts";

const check = (async (_input, access) => {
  const state = readInitializedState(access);
  if (state.feedbacks.length >= 12)
    throw new Error("Specification feedback budget exceeded");
  delete state.confirmation;
  const baseline = await loadBaseline(access);
  if (!isDeepStrictEqual(baseline, state.baseline)) {
    state.previousDraft = applyChanges(
      state.baseline?.data ?? emptyArtifact(),
      state.changes,
      state.id,
    ).artifact;
    state.changes = [];
    state.baseline = baseline;
    state.feedbacks.push({
      source: "check",
      content:
        "The committed specification baseline changed. The draft now starts from that baseline; reconcile previousDraft with the current draft before submitting.",
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
    const stalled = repeatedCheckFailure(state.feedbacks, error.message);
    state.feedbacks.push({ source: "check", content: error.message });
    await saveState(access, state);
    if (stalled)
      fail(
        "Specification repair repeated the same Check failure. Inspect the saved feedback before another execution.",
        "INTENT_REPAIR_STALLED",
      );
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
