---
title: MCP tools and Agent task protocol
---

# MCP tools and Agent task protocol

External Service endpoints are `/mcp` and `/mcp/codex` on authenticated loopback. The installed stdio proxy handles discovery and credentials. Internal CLI/Studio entries select different source policies; do not use external endpoints as a substitute.

## Loom and result Tools

| Tool | Input | Result |
| --- | --- | --- |
| `run` | `loomName, input, operationId, serviceInstanceId` | `receipt, run?` |
| `list_looms` | Empty object | `looms` |
| `get_run` | `runId` | `run` |
| `list_runs` | Optional `loomName` | `runs` |
| `answer_ask` | `runId, actionId, answer, operationId, serviceInstanceId` | `receipt, run?` |
| `interact` | `runId, actionId, operationId, serviceInstanceId` | Native interaction or action/Run |
| `cancel_run` | `runId, operationId, serviceInstanceId` | `receipt, run?` |
| `status` | Empty object | `service` |
| `get_artifact` | `artifactId` or `loomName, stageName` | `artifact` |
| `list_artifacts` | Optional `loomName, stageName, limit, cursor` | `artifacts` page |
| `get_record` | `recordId` | `record` |

Missing Artifact/Record details return `null`. Lists contain Artifact metadata; detail contains business data. Business errors set `isError: true`. Clients should handle structured content or JSON text and negotiated native interaction.

## External Agent Tools

| Tool | Additional fields |
| --- | --- |
| `get_agent_call` | `runId, callId` |
| `claim_agent_call` | Task reference plus `claimId` |
| `call_agent_tool` | Owned reference plus `toolCallId, toolId, input` |
| `read_agent_asset` | Owned reference plus `assetId` |
| `complete_agent_call` | Owned reference plus `result` |
| `fail_agent_call` | Owned reference plus `message` |

An owned reference is `{ runId, callId, ownerToken }`. Use `pendingAgentCall.id` as callId. Generate a stable unique claimId; the claim returns task instructions, Skills, Tools, output Schema and private ownerToken.

Execute declared Tools serially. Retain each toolCallId; retrying it with identical input returns its receipt, while changed input conflicts. Each task retains at most 256 receipts. Declared asset reads are limited to 1 MiB.

After all Tools finish, submit raw final JSON matching the task output Schema's input shape. Completion returns `{ receipt: { runId, callId, status: "accepted" } }`; query `get_run` for subsequent progress. An `endTool` closes business Tools for that call but still requires final output submission.

Active receipts are never evicted; new Tool calls are rejected at the 256-receipt capacity. Closed receipts remain available for 30 minutes after the call closes and outstanding Tool activity settles. Cancellation revokes execution authority without undoing effects. Restart never replays an external Agent.

## Human actions

Questions use a complete array of `{ questionId, isSkipped, answer? }`. Confirmation uses `{ isConfirmed, feedback? }`. `interact` attempts native presentation; fallback collects actual user answers and calls `answer_ask`. Dismissal preserves waiting.

## Mirror Tools

| Tool | Input |
| --- | --- |
| `mirror_list` | Empty object |
| `mirror_inspect` | `mirrorId` |
| `mirror_restore` | `mirrorId, targetProject, scope`; optional `dryRun` |
| `mirror_export` | `traceId, targetProject` |
| `resume_run` | `runId, operationId, expectedRevision, serviceInstanceId`; optional `scope, abandonMirror` |

Mirror/trace IDs are UUIDs. Resume binds the current instance and observed revision; retain its exact identity after an uncertain response.

Cancellation invalidates Agent ownership. Restart cannot restore an in-flight external task. See [MCP usage](../usage/mcp.md), [human answers](../usage/runs.md) and [mirrors](../usage/mirrors.md).

## Operation receipts and history

Read `status` first and use its `service.instanceId`. `run`, `answer_ask`, `cancel_run`, `pause_run`, and `resume_run` share the operations ledger. `interact` admits an answer only after receiving the human response. Generate a UUID operationId; retries of that identity must preserve parameters and source entry.

| Tool | Input | Result |
| --- | --- | --- |
| `pause_run` | `runId, operationId, serviceInstanceId` | `receipt, run?` |
| `get_operation` | `operationId, serviceInstanceId` | `found` with receipt, `not_found`, or `instance_changed` |
| `find_run` | Original `operationId, serviceInstanceId` | `run` or null |

Receipts have status `pending`, `accepted`, `rejected`, or `indeterminate`, and remain queryable for the Service instance lifetime. `accepted` confirms admission only; an attached Run is an independent current view. `rejected` means not applied. `indeterminate` means effects are uncertain and must not trigger a new submission.

Pause takes effect after the current Step completes and saves its result. Resume routes that saved result without repeating Code. After restart, an old receipt lookup returns `instance_changed`, never permission to replay. `find_run` locates the original Run by its persisted originating identity. `list_runs` includes retained terminal history marked `historical: true`; historical Runs are read-only.
