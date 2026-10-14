---
title: Questions, confirmation, and feedback
---

# Questions, confirmation, and feedback

Intent uses human interaction to resolve uncertainty and agree requirements/design.

## Answer questions

Read every question and its context. Suggested options are convenience choices; free text is allowed. Each question has one text answer or an explicit permitted skip. Skipping leaves uncertainty that business rules still evaluate.

CMD answers use the actual question IDs and current action ID. TUI reviews the complete answer array before sending. MCP clients present native forms where available, otherwise collect the real answers and call `answer_ask`.

## Confirm a version

Confirmation concerns the displayed cumulative Specification or Solution and its matching context. Accept it when it reflects your decision. Decline with actionable feedback when scope, design, checks or assumptions need revision.

```json
{"isConfirmed": false, "feedback": "Add offline behavior to the acceptance criteria."}
```

Feedback revises the current draft rather than starting another Run. New pending actions get new IDs; submitting an old ID cannot approve a later version.

## Separate responsibilities

Agents may propose questions or incorporate feedback. They cannot populate real user responses, self-confirm, or save formal results as a substitute for Code.

Cancelling a form preserves the waiting action. Cancelling the Run is explicit and does not roll back committed data. Use [Run operations](../usage/runs.md) for command forms and [recovery](../usage/recovery.md) before stopping a waiting Service.
