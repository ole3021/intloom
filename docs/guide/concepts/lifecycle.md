---
title: Run lifecycle and execution boundaries
---

# Run lifecycle and execution boundaries

A Run is admitted with an immutable original intent and execution policy. Runtime advances its cursor through declared topology.

| Status | Meaning |
| --- | --- |
| `running` | Execution can advance |
| `waiting` | Human action, external Agent task, or another explicit wait |
| `paused` | Controlled mirror/scope execution requires explicit resume |
| `completed` | Workflow reached its declared end |
| `failed` | Execution ended with a classified error |

Admission receipts (`pending`, `accepted`, `rejected`) are operation state, not Run state. A successful client query can describe failed execution.

## Ownership and cancellation

Each call has its own scope, signal and capabilities. Current action IDs bind answers to the waiting call. Late results after cancellation or a transition cannot overwrite newer execution.

Cancellation marks `failed/RUN_STOPPED` and signals current tasks. Known late usage or commit references may still arrive until `settled`, without resuming the Run. Cancellation does not undo completed side effects.

## Restart and observation

Run lists and metrics belong to the current Service instance. Supported business checkpoints can recover into a new instance with fresh statistics and budgets; they do not provide cross-restart terminal history.

Human waiting pauses execution-duration budgets. Model/Tool usage records known information, with unknown external reasoning distinct from zero.

See [Run operations](../usage/runs.md), [recovery](../usage/recovery.md) and [configuration limits](../reference/configuration.md).
