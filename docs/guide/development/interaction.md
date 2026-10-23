---
title: Human interaction and recoverable waits
---

# Human interaction and recoverable waits

Only Code calls `interaction.askQuestions` or `interaction.confirm`. Await the returned response before selecting an outcome.

Question requests are a flat nonempty list with unique IDs, text, optional options and `isSkippable`. Answers cover every question once, using nonblank text or an allowed skip. Workflow Code owns business rules such as required rejection feedback.

## Confirmation with recovery

```ts
import {
  type ExecutableCode,
  type UserAnswerConfirmation,
} from "@intloom/loom-sdk";

const finish = (answer: UserAnswerConfirmation) => ({
  outcome: answer.isConfirmed ? "confirmed" : "feedback",
});

const confirm: ExecutableCode = async (access) => {
  access.signal.throwIfAborted();
  return finish(await access.interaction.confirm("Review the current draft."));
};

confirm.recover = (saved, access) => {
  access.signal.throwIfAborted();
  if (saved.kind !== "user_ask_confirmation")
    throw new Error("Expected a confirmation reply.");
  return finish(saved.answer);
};

export default confirm;
```

Declare both `confirmed` and `feedback` routes. For business work, prepare the displayed context from validated State and verify that recovery matches the saved action kind/context.

## Continuation rules

In-process answers resume the original call. After restart, `recover` receives the saved action and accepted answer with fresh access. It cannot restore local variables or earlier effects. Persist required continuation data before waiting and avoid repeating those effects.

A Code without recovery remains executable, but its unsupported restart wait becomes `RUN_INTERRUPTED`. Stale answers preserve waiting rather than affecting a later call.

See [interaction contracts](../reference/sdk.md) and [operational recovery](../usage/recovery.md).

`CodeRecovery` uses `actionId`, `kind`, `request`, and `answer`. Narrow `kind` before reading the typed request/answer. The host checks structure and action ownership; the Loom checks that the request still matches the current business revision.
