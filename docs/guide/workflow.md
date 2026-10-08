---
title: Core concepts
description: Projects, Workflows, Runs, stages, execution capabilities, and formal results.
---

# Core concepts

A project hosts installed Workflows. Calling `flow` selects one by its `flowName` and creates a Run with a new `runId`. The Runtime enters the first Stage, initializes its business State, executes Steps, and follows their outcomes.

```text
Project service
  → installed Workflow / Blueprint
    → Run
      → Stage → Step → outcome → next Step or Stage
        → waiting for an Agent task or a human action
        → completed or failed
```

## Definitions and executions

| Term | Meaning |
| --- | --- |
| Workflow package | Installable ESM package containing executable resources |
| Blueprint | The compiled topology: entry Stage, Steps, and outcome routes |
| Stage | A part of the process with its own Schema and initialized State |
| Step | One Code or Agent execution |
| Run | One execution with an original intent, identity, status, and cursor |
| Cursor | The current `{ stageName, stepName }` location |

The package name, `flowName`, and `runId` identify different things. Use `workflow list` for installed package declarations, `flows` for loaded Workflows, and `runs` for executions in the current host.

## Code, Agents, and humans

**Code** performs deterministic operations. It can read and write Stage State, commit formal data, and ask the user questions or request confirmation.

**Agents** reason within a Step. Their declared Tools execute in the host, with access to Stage State and read-only formal Storage. The Agent cannot directly commit formal results or use the Code interaction API. It returns an outcome after using its Tools.

**Humans** answer explicit pending actions. A model's final response is not a human confirmation. The host matches answers to the original Run and action.

Every Step returns only `{ outcome: "..." }`. Business values travel through Stage State and committed data, not arbitrary Step result fields. See [Stages and routing](./development/stages.md).

## Three different kinds of data

| Data | Owner and lifetime |
| --- | --- |
| Run control state | Runtime-owned status, cursor, and pending action/task |
| Stage State | Current Stage's Schema-validated business draft; released when leaving the Stage |
| Artifacts and Records | Explicitly committed formal data that survives service restart |

An Artifact is the current result for a Workflow/Stage, with a revision used for conflict detection. A Record is an immutable stored entry; its ID is chosen by Workflow Code. Do not assume it equals the Run ID. Artifact revision does not provide historical-version lookup.

Recovery checkpoints preserve selected execution boundaries for a later host startup. They are separate from formal Storage and do not make every interrupted operation restartable.

## Execution paths

CLI uses the project's service model configuration. External MCP clients use client Agent tasks when `useMcpAgent: true`, the default; `false` selects the service model path. Transport alone does not select the executor: the CLI also communicates with the host through an internal MCP endpoint.

## Completion and failure

`completed` means the Workflow reached its configured end. A workflow may save a report containing incomplete or failed checks and still complete its own process. Inspect its outputs to decide whether the business goal was met.

A failed or cancelled Run may already have committed data or edited files. Cancellation revokes future execution access; it does not undo previous effects. Read [Results](./usage/results.md) and [Recovery](./usage/recovery.md) before starting replacement work.
