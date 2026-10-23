---
title: Troubleshoot by symptom
---

# Troubleshoot by symptom

| Symptom | Check and next step |
| --- | --- |
| Wrong command version | Executable resolution, Node version, development launcher versus release |
| init rejects the directory | Use a new/empty target; inspect partial setup before retry |
| Service unavailable | status, service logs, verified process identity; plan recover for stale resources |
| Installed Workflow missing from flows | Loader phase/error, protocol, generated exports and assets |
| CMD/TUI cannot execute | doctor cli, llms.default, startup environment; restart after config change |
| MCP has no connection | Existing Service, generated paths, same trusted project, client diagnostics |
| MCP stops at Agent wait | Client claim/Tool/completion protocol and current pendingAgentCall |
| Answer rejected | Current action ID, exact question IDs, complete array, permitted skips |
| Model/Tool failure | Run lastError and execution logs; provider/output/Tool Schema |
| Artifact differs from old Run | Actual commit revision; current value is not historical |
| mirror restore fails | Prepared stopped target, compatible topology/Schema, image kind and scope |
| Capture failure pauses Run | Resolve cause, explicitly resume capture; workflow-only abandonment when chosen |

## Diagnose before repeating effects

First identify project, installed version, Service instance and original Run. Read status, doctor, flows, attach and logs. Determine whether the failure is local setup, transport, admission, runtime, business validation or output export.

An unknown command result can leave work active. Query the original operation/Run instead of creating another flow. Preserve committed files/data and inspect them before deciding how to retry.

See [error reference](../reference/errors.md), [diagnostics](../usage/diagnostics.md) and [reporting](./reporting.md).
