---
title: Human interaction and recovery
description: Implement questions, confirmations, and explicit restartable Code waits.
---

# Human interaction and recovery

Questions and confirmations belong to Code Steps. The Runtime records the owning Run, cursor, and action ID and pauses that same execution until a valid answer arrives.

## Ask questions

Inside an `ExecutableCode`:

```ts
const answers = await access.interaction.askQuestions([
  {
    id: "destination",
    question: "Where should the result be used?",
    options: [
      { id: "local", label: "Local project" },
      { id: "shared", label: "Shared service" },
    ],
    isSkippable: false,
  },
]);
```

Answers contain `questionId` and either `{ isSkipped: true }` or `{ isSkipped: false, answer: "..." }`. Option selection resolves to answer text. Code decides how to store and interpret it; a model cannot submit a human answer as part of its proposal.

## Request confirmation

```ts
const answer = await access.interaction.confirm(readableProposal);
if (!answer.isConfirmed) {
  // Save any feedback in Stage State before routing back to revision.
  return { outcome: "revise" };
}
return { outcome: "confirmed" };
```

`readableProposal` should show the business result the user is approving. Revalidate the draft and its upstream basis after the wait. A confirmation is about the displayed proposal, not any newer content another operation may have written while waiting.

Cancelling the client form is different from submitting `isConfirmed: false`: form cancellation preserves the wait. A negative answer follows your business route.

## Make a wait restartable

In-process answers resume the original function. After process exit, that Promise and its local variables no longer exist. Add `ExecutableCode.recover(saved, access)` to continue the saved interaction without rerunning earlier effects.

For a Stage whose State includes `approved: boolean`, a confirmation-only Code can use the same continuation in both paths:

```ts
import type {
  CodeExecutionAccess,
  ExecutableCode,
  JsonValue,
  UserAnswerConfirmation,
} from "@intloom/workflow-sdk";
import { userAnswerConfirmationSchema } from "@intloom/workflow-sdk";
import * as z from "zod";

const stateSchema = z.strictObject({ approved: z.boolean() });

async function accept(
  answer: UserAnswerConfirmation,
  access: CodeExecutionAccess<JsonValue>,
) {
  const state = stateSchema.parse(access.state.value);
  await access.state.update({ ...state, approved: answer.isConfirmed });
  return { outcome: answer.isConfirmed ? "confirmed" : "revise" };
}

const confirm: ExecutableCode = async (_input, access) =>
  accept(await access.interaction.confirm("Approve this operation?"), access);

confirm.recover = async (saved, access) => {
  if (saved.action.kind !== "user_ask_confirmation") {
    throw new Error("Unexpected recovery action.");
  }
  return accept(userAnswerConfirmationSchema.parse(saved.answer), access);
};

export default confirm;
```

A real proposal workflow must also persist the proposal identity, relevant baseline, and enough continuation information in State before waiting. Distinguish multiple possible waits using saved state and the saved action request. Never rely on a lost local variable or recreate the original external effect.

Recovery receives fresh capabilities and the saved action/answer. It is not an instruction to ask the same question again. Code without `recover` remains executable, but its pending wait becomes `RUN_INTERRUPTED` after host restart. See [Operational recovery](../usage/recovery.md).
