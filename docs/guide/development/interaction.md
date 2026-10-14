---
title: Human interaction and recoverable waits
---

# Human interaction and recoverable waits

Only Code calls `interaction.askQuestions` or `interaction.confirm`. Await the returned response before selecting an outcome.

Question requests are a flat nonempty list with unique IDs, text, optional options and `isSkippable`. Answers cover every question once, using nonblank text or an allowed skip. Workflow Code owns business rules such as required rejection feedback.

## Confirmation with recovery

```ts
import {
  userAnswerConfirmationSchema,
  type ExecutableCode,
  type UserAnswerConfirmation,
} from "@intloom/workflow-sdk";

const finish = (answer: UserAnswerConfirmation) => ({
  outcome: answer.isConfirmed ? "confirmed" : "feedback",
});

const confirm: ExecutableCode = async (_input, access) => {
  access.signal.throwIfAborted();
  return finish(await access.interaction.confirm("Review the current draft."));
};

confirm.recover = (saved, access) => {
  access.signal.throwIfAborted();
  return finish(userAnswerConfirmationSchema.parse(saved.answer));
};

export default confirm;
```

Declare both `confirmed` and `feedback` routes. For business work, prepare the displayed context from validated State and verify that recovery matches the saved action kind/context.

## Continuation rules

In-process answers resume the original call. After restart, `recover` receives the saved action and accepted answer with fresh access. It cannot restore local variables or earlier effects. Persist required continuation data before waiting and avoid repeating those effects.

A Code without recovery remains executable, but its unsupported restart wait becomes `RUN_INTERRUPTED`. Stale answers preserve waiting rather than affecting a later call.

See [interaction contracts](../reference/sdk.md) and [operational recovery](../usage/recovery.md).
