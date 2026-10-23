---
title: TUI workbench
---

# TUI workbench

TUI runs Workflows, controls Runs and browses resources in the current project. It reuses Service or starts it only when verified stopped; non-project directories direct you to CMD `intloom init`. One unfinished Run opens automatically; several unfinished Runs open a picker. With none, the first screen shows the logo, intent composer and Workflow selector.

## Windows and commands

Tab cycles **Run → Logs → Assets**. Ctrl+O searches/switches Runs while retaining the current window. Ctrl+P chooses a Workflow for a new intent draft. Window switching preserves answer drafts, resource filters and log position. Workflow selection applies to new Run drafts.

Type `/` to immediately list six MVP commands: `/run`, `/loom`, `/runs`, `/resume`, `/stop`, `/quit`. Continue typing to filter, use arrows/Enter to select/execute, and Esc to dismiss. Unavailable commands remain visible with explanations. A slash inside ordinary text remains text.

## Answers and execution control

Run shows logs, stage/step, questions or confirmation, and a status sidebar; narrow terminals use compact status. Enter submits intent/custom answers, Shift+Enter inserts a newline, and long text wraps automatically. Select options or write answers, then review the complete answer set before sending. Esc revisits the previous question/confirmation choice without discarding drafts. Feedback continues the same Run.

`/stop` confirms the target before stopping an unfinished Run. It follows the existing `failed/RUN_STOPPED` contract, displays cancelled, and retains committed resources. `/resume` supports the current scope or explicit Step/Stage/Workflow scope; completed scopes require a new choice and invalid boundaries are disabled. Mirror capture failure supports retry or explicit abandonment for this Run.

Pending/unknown writes retain original operation/Service identity and block another submission. Select the contextual **Inspect original operation** action to query the receipt/Run. For a disconnected Service, select **Inspect and reconnect**; only a verified stopped Service is started. `/quit` closes the client while background execution continues.

## Logs and Assets

In Logs, arrows and PageUp/PageDown scroll, Home goes to the beginning, and End returns to the latest entry and resumes following. TUI keeps 200 recent entries and reports omissions; older persisted logs remain available through CMD.

Assets defaults to the selected Run's actual commit references, or project resources without a selected Run. Left opens local controls for Artifact/Record, project/Run scope, filters and refresh; Right returns to the list. Up/Down switches Workflow/Stage/text filter fields and Enter applies. Workflow/Stage use exact names; text searches loaded IDs/metadata. Project pages contain 50 entries with a next-page action.

Enter opens JSON, arrows/PageUp/PageDown scroll, and Esc goes back. Unavailable old Artifact revisions show `historical_revision_unavailable`. Resource browsing does not advance Runs or modify files.

Activity animation indicates connection, submission or execution; borders briefly fade during transitions. Execution and human-wait durations are separate, unknown tokens/cost differ from zero, and Run lists/statistics belong to the current Service instance.

Initialization, configuration, package management, diagnostics, MCP setup and mirror administration use CMD. See [shortcuts and commands](../reference/tui.md), [Run semantics](./runs.md), and [results](./results.md).
