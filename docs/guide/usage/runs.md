---
title: Observe, answer, and cancel Runs
---

# Observe, answer, and cancel Runs

Create a Run once, retain its ID, and use that ID for every subsequent operation.

```sh
intloom run intent --prompt-file ./request.txt --json
intloom runs --loom intent
intloom attach RUN-example --json
intloom wait RUN-example --timeout 30000
intloom watch RUN-example
```

`wait` defaults to `action_or_terminal`. `--until terminal` waits past questions without answering them. Timeouts and Ctrl+C end observation only. `watch` reconciles snapshots on reconnect without resubmitting execution.

## Answer the current action

Read `pendingAction` and retain its exact ID. A questions action requires every question exactly once:

```json
[
  {"questionId": "platform", "isSkipped": false, "answer": "Web"},
  {"questionId": "notes", "isSkipped": true}
]
```

Use actual question IDs. Skip only questions that allow skipping. A confirmation action uses:

```json
{"isConfirmed": false, "feedback": "Please revise the storage requirement."}
```

```sh
intloom answer RUN-example --action ASK-example --answer-file ./answer.json
```

Stale or invalid answers preserve the pending action. After an uncertain response, inspect the Run before submitting again.

## Cancellation and uncertain writes

```sh
intloom cancel RUN-example
intloom operation OPERATION-UUID --instance INSTANCE-ID --json
```

Cancellation becomes `failed` with `RUN_STOPPED` and preserves committed data and project effects. Query uncertain admission receipts using the original operation and instance. Explicit replay requires the original parameters, `--operation-id` and `--instance`.

Run statuses and receipt outcomes describe different things; see [CMD reference](../reference/cli.md). Resuming a restored mirror is a separate operation described in [mirrors](./mirrors.md).
