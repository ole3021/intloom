---
title: First Run with TUI
---

# First Run with TUI

Prepare a project, install Intent Workflow, and configure the Service model as described in [CMD setup](./cmd.md). CMD and TUI use the same service executor.

```sh
intloom tui
```

Running `intloom` without a command also opens TUI. Use an interactive terminal; the launcher enables the renderer's experimental Node FFI flag automatically.

## Complete the first flow

1. TUI checks the project, reuses an existing Service or automatically starts a verified stopped Service. Non-project directories direct you to `intloom init` in CMD.
2. With no unfinished Run, use **Ctrl+P** to choose `intent` in the Workflow picker. An unfinished Run opens automatically; use `/run` for a new draft.
3. Enter your intent; **Enter** submits, **Shift+Enter** inserts a newline, and long text wraps automatically.
4. Inspect the Run's stage, step, activity, and pending interaction.
5. Select question options or enter text, review the complete answers, and submit. For confirmation, read the proposed requirements or design before accepting or giving feedback.
6. Continue through Implementation and Validation, then use **Tab** to reach Assets and inspect committed Artifacts/Records.

Use **Ctrl+O** to open Runs and select the existing Run after reconnecting. Type `/` for the six-command menu, `/stop` to stop a Run and `/resume` to continue a paused Run. `/quit` closes TUI while leaving Service and Run active; Escape closes pickers or goes back in resources.

Known tokens and estimated costs describe visible service usage. They are not supplier billing. A completed Run still requires reading its Validation findings.

See [TUI operations](../usage/tui.md) and [shortcut reference](../reference/tui.md).
