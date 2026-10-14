---
title: TUI shortcuts and input
---

# TUI shortcuts and input

A leading `/` opens the command list immediately. Continue typing to filter, select with arrows, execute with Enter, and dismiss with Esc. A slash inside ordinary text remains text. Question choices, Logs and Assets also accept `/`. All six commands remain listed; unavailable actions are disabled with an explanation.

| Key | Action |
| --- | --- |
| Tab | Cycle Run → Logs → Assets → Run; dialogs block window switching |
| Ctrl+O | Search/switch Runs in this Service, retaining the current window |
| Ctrl+P | Choose a Workflow for a new Run |
| Enter | Submit intent/custom answers, select options, or execute menu actions |
| Shift+Enter | Newline in input; long text wraps automatically |
| Esc | Close dialogs, revisit the previous question/confirmation choice, or go back in Assets |
| Arrows, PageUp/PageDown | Scroll Logs or resource content |
| Home / End | Go to the beginning/latest entry in Logs |

Shift+Enter requires modifier reporting through the Kitty keyboard protocol; input retains Ctrl+J as a newline fallback. Other former Ctrl navigation bindings are removed. Complete answer sets are reviewed before submission.

| MVP command | Action |
| --- | --- |
| `/run [workflow]` | Create an intent draft; submitting intent creates the Run |
| `/workflow` | Choose Workflow, equivalent to Ctrl+P |
| `/runs` | Switch Run, equivalent to Ctrl+O |
| `/resume` | Continue a paused Run under existing scope/boundary rules |
| `/stop` | Confirm stopping an unfinished Run, retaining committed resources |
| `/quit` | Close TUI while Service and Runs continue |

Window navigation, logs, filters and resource browsing use their windows rather than slash commands. In Assets, Left opens local controls for Artifact/Record, project/Run scope, filters and refresh; Right returns to the list. Up/Down switches filter fields and Enter applies them.

For pending/unknown writes, select **Inspect original operation** to query the original receipt/Run without resubmitting. For disconnected/stopped Service, select **Inspect and reconnect**; startup occurs only when Service is verified stopped.

Start with `intloom` or `intloom tui`. Initialization, configuration, package management, MCP setup and mirror administration use CMD. See [TUI operations](../usage/tui.md) and [Run operations](../usage/runs.md).
