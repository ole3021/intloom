---
title: Run, answer, and cancel
description: Manage Run identity, human waits, Agent tasks, and terminal results.
---

# Run, answer, and cancel

Create one Run for an intent. Continue it with its returned identity. Repeating `flow` creates new work; it is not a resume operation.

```sh
intloom flow your_flow --intent-file intent.txt
intloom runs
intloom runs --flow your_flow
intloom attach <runId>
```

Replace `your_flow` and `<runId>` with values returned by the service. An intent file of `-` reads stdin.

## Read a Run

| Field | Meaning |
| --- | --- |
| `runId` | Execution identity |
| `flowName` | Registered Workflow name |
| `status` | `running`, `waiting`, `completed`, or `failed` |
| `cursor` | Current Stage and Step |
| `execution` | Fixed source and Agent executor |
| `pendingAction` | Human question or confirmation, when present |
| `pendingAgentCall` | Client Agent task, when present |
| `lastError` | Terminal failure code, message, and retryability |

A waiting Run has one kind of pending work at a time. A client Agent wait does not authorize a human answer, and an ordinary CLI `attach` cannot perform the connected IDE's reasoning task.

## Answer and review

In an interactive CLI, `flow` or `attach` displays the current questions or confirmation. Options resolve to actual answer text. Skip is available only when the Workflow permits it. Confirmation displays the Workflow-provided context before asking you to confirm or request changes.

Cancelling an unsubmitted form leaves the Run waiting. Requesting changes submits a business answer and follows the package's feedback route. Closing the terminal does not by itself stop the project service.

MCP clients use `interact`; when native forms are unavailable, they show the real question and use `answer_ask`. Programmatic Node.js clients use `answerAsk(runId, actionId, answer)`. Always use the current action ID and preserve the actual human answer. See [MCP](../reference/mcp.md) for answer shapes.

## JSON and noninteractive use

```sh
intloom flow your_flow --intent "Describe the result" --json
intloom attach <runId> --json
intloom runs --json
```

Non-TTY, `--json`, and `--no-interactive` modes do not prompt. A waiting `flow` returns normally, so inspect the status instead of treating exit 0 as completion. Failures return nonzero. JSON business output is separate from progress and logs on stderr.

A request timeout or client disconnect can leave the original Run executing. Query it before retrying; requests are not automatically replayed.

## Cancel one Run or stop the host

```sh
intloom cancel <runId>
intloom stop
```

`cancel` explicitly ends a Run, revokes its current execution access, and prevents future recovery. Cancellation is represented as `failed` with `RUN_STOPPED`; the terminal UI displays Stopped. Repeated cancellation of an existing terminal Run succeeds without changing its snapshot. A missing Run is an error.

`stop` shuts down the project service and preserves unfinished recovery checkpoints. It does not promise that every interrupted Run can resume. See [Recovery](./recovery.md).

Neither action rolls back committed Storage data or prior file edits. Independently running native IDE commands may continue outside the host's control.

## Concurrency and retained Runs

An exclusive Workflow rejects competing active Runs in the same host, including waits. This does not lock external editors or coordinate unrelated hosts. Completed Runs remain queryable in the current host; terminal checkpoint files are not reloaded as Runs after restart. Use formal results for durable history.
