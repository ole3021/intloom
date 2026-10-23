---
title: Human decisions in Intent
---

# Human decisions in Intent

Questions and confirmations are real Code interactions. Agents propose questions and drafts; they cannot invent user answers or approval.

## Requirements and design

Specification displays the current baseline, full requirement proposal, cumulative changes, round scope, coverage and actual answers. Solution displays its fixed requirements, design changes, implementation dependencies, verification responsibilities and risks.

Confirm only the displayed version. Feedback returns to the uncommitted draft. A changed review or source invalidates the old confirmation. After formal commit, substantive changes start a new Run.

## Partial delivery

When implementation remains incomplete, Code shows the exact candidate, planned items, actual changes, failed or missing checks and remaining work. Explicitly choosing partial delivery allows that candidate to reach Validation. It does not reduce the targets or approve their acceptance. Unknown external edits require a separate decision about including those exact changes.

## Evidence collection

Validation presents the fixed sources/candidate, collected evidence, unknowns and affected collection actions. Choose to continue, pause, or stop only those listed actions. Silence is not permission. Stopping preserves failures and unknowns; the Agent still assembles a complete report and Code checks it before publication.

An original execution without a settled receipt must be reconciled before continuation. Cancelling a Run does not roll back committed Records or product files. Inspect the same Run after interruption rather than starting duplicate work.

See [Run operations](../usage/runs.md) for client interaction and [result interpretation](./results.md).
