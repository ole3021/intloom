---
title: Error codes
---

# Error codes

Safe errors contain code, message and retryable. Interpret the current operation and Run together; retryable is not permission to repeat an uncertain effect.

| Code | Interpretation |
| --- | --- |
| INVALID_REQUEST | Input/configuration/credential precondition failed |
| NOT_FOUND | Identity/resource absent |
| CONFLICT | Stale revision, changed state or competing identity |
| BUSY | Another operation owns the resource |
| STORAGE_ERROR | Formal persistence failed |
| KERNEL_UNAVAILABLE | Resources/execution unavailable |
| RUN_STOPPED | Explicit cancellation |
| RUN_INTERRUPTED | Unsupported or uncertain restart boundary |
| RUN_CHECKPOINT_FAILED | Could not save continuation |
| STAGE_STATE_INVALID | Schema/JSON validation failed |
| STAGE_STATE_EXISTS / STAGE_STATE_NOT_FOUND | State write precondition failed |
| STAGE_STATE_INACTIVE / EXECUTION_OWNERSHIP_LOST | Expired capability or result |
| STEP_OUTCOME_NOT_HANDLED / INVALID_TRANSITION | Invalid outcome routing |
| STEP_RESULT_INVALID | Code result is not outcome-only |
| LLM_REQUEST_FAILED / LLM_RESPONSE_INVALID | Provider request/response failed |
| AGENT_OUTPUT_INVALID | Final structured output failed validation |
| TOOL_EXECUTION_FAILED / STEP_EXECUTION_FAILED | Tool or Step failed |
| CLI_SERVICE_PROTOCOL_MISMATCH | Expected Service API returned non-JSON HTTP 404; check CLI/Service compatibility and explicitly stop/start to reload |
| CLI_RESULT_INVALID | Response JSON, envelope or requested project/instance/request identity is invalid |
| CLI_SERVICE_UNAVAILABLE | HTTP rejection without a valid business result |
| CLI_SERVICE_OFFLINE / CLI_SERVICE_TIMEOUT | Connection failed / response timed out |
| REQUEST_OUTCOME_UNKNOWN | Transmitted write has no valid receipt; query the original operation before another submission |
| CLI_INIT_TARGET_NOT_EMPTY | Initialization target contains files |
| CLI_OUTPUT_EXISTS / CLI_ARTIFACT_EXPORT_FAILED | Local export failed |
| MCP_CONFIG_INVALID / MCP_CONFIG_CONFLICT | Invalid or conflicting client config |
| MIRROR_RESTORE_FAILED | Image cannot restore into prepared target |

These are common categories, not all Workflow-defined business codes. Inspect lastError, cursor, logs and prior commits.

Transport errors can report `outcome: unknown` while execution continues. Query the original Run or operation identity before retrying. A commit or file change before failure can remain applied.

For Compiler codes, see [Compiler](./compiler.md). Follow [troubleshooting](../help/troubleshooting.md) for diagnostic steps.
