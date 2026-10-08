import type { SpecificationQuestion } from "../../schemas/specification-state.ts";

/** Skipping is a user response; analysis and checks still determine requirement sufficiency and deferred-item completeness. */
export function hasUserResponse(question: SpecificationQuestion): boolean {
  return question.answer !== undefined || question.skipped === true;
}
