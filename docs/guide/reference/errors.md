---
title: Errors and compatibility
description: Interpret classified failures without assuming cancellation, rollback, or safe replay.
---

# Errors and compatibility

User-facing errors expose `code`, `message`, and `retryable`. Internal causes and credentials are not part of the public projection. `retryable` does not authorize replaying a non-idempotent operation such as creating a Run or repeating an uncertain effect.

## Request and service errors

| Code | Interpretation and next step |
| --- | --- |
| `INVALID_REQUEST` | Invalid input, configuration, or required credential; correct it before trying again |
| `NOT_FOUND` | Requested identity or resource is absent |
| `CONFLICT` | Stale revision, competing ownership, duplicate identity, or changed state; reread before deciding |
| `BUSY` | Operation currently has another owner; retry only with the operation's documented identity rules |
| `STORAGE_ERROR` | Storage failed; an uncertain commit must not be blindly replayed |
| `KERNEL_UNAVAILABLE` | Loading, preparation, or execution availability failed; inspect diagnostics |

Error instances can override catalog defaults. Inspect the actual returned code and retryability.

## Run and execution errors

| Code | Interpretation |
| --- | --- |
| `RUN_STOPPED` | Explicitly stopped Run; terminal UI displays Stopped |
| `RUN_INTERRUPTED` | Unsupported or uncertain restart boundary; inspect prior effects |
| `RUN_CHECKPOINT_FAILED` | Recovery checkpoint could not be saved; execution stopped |
| `STAGE_STATE_INVALID` | State violates its Schema or JSON boundary |
| `STAGE_STATE_EXISTS` / `STAGE_STATE_NOT_FOUND` | State create/update precondition failed |
| `STAGE_STATE_INACTIVE` / `EXECUTION_OWNERSHIP_LOST` | Capability/result belongs to an expired execution |
| `STEP_OUTCOME_NOT_HANDLED` / `INVALID_TRANSITION` | No valid route for the returned outcome |
| `STEP_RESULT_INVALID` | Final result is not the required outcome-only object |
| `LLM_REQUEST_FAILED` | Provider request failed; check protocol, endpoint, credentials, and availability |
| `LLM_RESPONSE_INVALID` | Provider response could not be parsed or validated |
| `AGENT_OUTPUT_INVALID` | Structured Agent output failed validation |
| `TOOL_EXECUTION_FAILED` | A declared Tool or bound capability failed |
| `STEP_EXECUTION_FAILED` | Step failed, including a model ending without a complete final response |

These are common categories, not an exhaustive list of all package-defined business errors. Inspect the Run cursor, logs, and Workflow context for the specific cause. Failure after a successful earlier commit does not undo that commit.

## CLI and client errors

`CLI_INIT_TARGET_NOT_EMPTY` protects existing files. Use a new or empty initialization directory.

`CLI_OUTPUT_EXISTS` protects an existing export. Review it before opting into `--overwrite`. `CLI_ARTIFACT_EXPORT_FAILED` means local output publication failed; it does not change stored results.

`PROJECT_CONNECTION_FAILED`, `PROJECT_REQUEST_FAILED`, `PROJECT_RESPONSE_INVALID`, and `PROJECT_CLIENT_CLOSED` belong to the Node.js client boundary. Query existing work after an uncertain request instead of creating another Run automatically.

Compiler errors are documented in [Compiler reference](./compiler.md).

## Compatibility checklist

- Match the Workflow protocol, currently `2026-10-08`, independently of npm versions.
- Restart hosts after CLI or package changes; loaded resources are not hot-reloaded.
- Keep exact Workflow resources for unfinished checkpoints.
- Test the actual provider and model's Tools, output Schema, and output-budget behavior.
- Validate business check commands against the host's executable versions. The obsolete `--experimental-transform-types` flag is not accepted by Node 26.
- Separate native-form UI validation from successful MCP Tool transport.

For the diagnostic sequence, use [Logs and diagnostics](../usage/diagnostics.md). For interrupted work, use [Recovery](../usage/recovery.md).
