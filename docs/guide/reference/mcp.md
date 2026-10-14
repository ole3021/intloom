---
title: MCP tools and Agent task protocol
---

# MCP tools and Agent task protocol

External Service endpoints are `/mcp` and `/mcp/codex` on authenticated loopback. The installed stdio proxy handles discovery and credentials. Internal CLI/Studio entries select different source policies; do not use external endpoints as a substitute.

## Workflow and result Tools

| Tool | Input | Result |
| --- | --- | --- |
| `flow` | `flowName, intent` | `run` |
| `list_workflows` | Empty object | `workflows` |
| `get_run` | `runId` | `run` |
| `list_runs` | Optional `flowName` | `runs` |
| `answer_ask` | `runId, actionId, answer` | `run` |
| `interact` | `runId, actionId` | Native interaction or action/Run |
| `cancel_run` | `runId` | `run` |
| `status` | Empty object | `service` |
| `get_artifact` | `artifactId` or `flowName, stageName` | `artifact` |
| `list_artifacts` | Optional `flowName, stageName, limit, cursor` | `artifacts` page |
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

After all Tools finish, submit raw final JSON matching the task output Schema's input shape. Follow the returned Run rather than creating another flow. Claim/Tool receipts are live-process guarantees, not durable replay across restart.

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
