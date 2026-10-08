import { isDeepStrictEqual } from "node:util";
import {
  specificationConfirmationContextSchema,
  type SpecificationState,
} from "../../schemas/specification-state.ts";
import { fail } from "./errors.ts";

export function confirmationContext(state: SpecificationState) {
  return specificationConfirmationContextSchema.parse({
    id: state.id,
    intent: state.intent,
    baseline: state.baseline,
    changes: state.changes,
    questions: state.questions
      .filter((q) => q.answer !== undefined)
      .map((q) => ({
        id: q.id,
        question: q.question,
        ...(q.description === undefined ? {} : { description: q.description }),
        answer: q.answer,
      })),
    feedbacks: state.feedbacks,
  });
}
export function assertConfirmation(state: SpecificationState) {
  if (
    !state.confirmation?.confirmed ||
    !isDeepStrictEqual(state.confirmation.context, confirmationContext(state))
  )
    fail("Missing or stale user confirmation", "SPECIFICATION_NOT_CONFIRMED");
}
