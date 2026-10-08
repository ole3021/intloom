import type { SpecificationState } from "../../schemas/specification-state.ts";
import { applyChanges, emptyArtifact } from "./changes.ts";
import { fail } from "./errors.ts";
import { hasUserResponse } from "./questions.ts";

export function review(state: SpecificationState) {
  if (state.baseline === undefined) fail("Missing initialized baseline");
  if (new Set(state.questions.map((q) => q.id)).size !== state.questions.length)
    fail("Duplicate question IDs");
  if (state.questions.some((q) => !hasUserResponse(q)))
    fail("Questions still require user responses");
  if (state.questions.some((q) => q.isBlock && q.skipped === true))
    fail("Blocking questions cannot be skipped");
  if (state.processedFeedbackCount !== state.feedbacks.length)
    fail("Feedback has not been processed");
  const result = applyChanges(
    state.baseline?.data ?? emptyArtifact(),
    state.changes,
    state.id,
  );
  for (const q of state.questions) {
    if (
      q.skipped === true &&
      !result.artifact.deferreds.some(
        (d) =>
          d.status === "active" &&
          d.question === q.question &&
          state.changes.some((c) => c.target_ref === d.id),
      )
    )
      fail(`Unanswered question requires an explicit Deferred change: ${q.id}`);
  }
  return result;
}
