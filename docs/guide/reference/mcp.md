---
title: MCP reference
description: Host endpoints, business tools, Agent task ownership, human actions, and retry rules.
---

# MCP reference

The local host provides authenticated Streamable HTTP endpoints on loopback. `/mcp` is the generic external Agent IDE entry; `/mcp/codex` adds the Codex presentation profile. Both use the same business handlers and Agent task protocol.

Internal `/internal/mcp` and `/internal/mcp/studio` bind CLI and Studio backend source policies. Do not use an external endpoint as a fallback for a missing internal endpoint: source selects execution policy.

Use generated connection metadata and the supported client helpers. Keep Bearer credentials and task ownership tokens private. Sessions stay bound to their original endpoint.

## Workflow and result tools

| Tool | Input | Result field |
| --- | --- | --- |
| `flow` | `flowName`, `intent` | `run` |
| `list_workflows` | Empty object | `workflows` |
| `get_run` | `runId` | `run` |
| `list_runs` | Optional `flowName` | `runs` |
| `interact` | `runId`, `actionId` | Native interaction or current/continued Run |
| `answer_ask` | `runId`, `actionId`, `answer` | `run` |
| `cancel_run` | `runId` | `run` |
| `status` | Empty object | `service` |
| `get_record` | `recordId` | `record` |
| `get_artifact` | `artifactId`, or both `flowName` and `stageName` | `artifact` |
| `list_artifacts` | Optional `flowName`, `stageName`, `limit`, `cursor` | `artifacts` page |

Artifact lists contain metadata; details contain business data. Missing Record/Artifact details return `null`. Business errors return `isError: true` with a classified error payload. Clients should handle structured content or JSON text content, and native interaction responses where applicable.

## Agent task tools

External entries expose six additional tools. A task reference is `{ runId, callId }`; an owned reference adds `ownerToken`.

| Tool | Additional input | Result |
| --- | --- | --- |
| `get_agent_call` | Task reference | `agentCall` |
| `claim_agent_call` | Task reference plus `claimId` | `task`, `ownerToken` |
| `call_agent_tool` | Owned reference plus `toolCallId`, `toolId`, `input` | `output` |
| `read_agent_asset` | Owned reference plus `assetId` | Declared asset content and encoding |
| `complete_agent_call` | Owned reference plus `result` | Continued `run` |
| `fail_agent_call` | Owned reference plus `message` | Failed `run` |

Use the current `pendingAgentCall.id` as `callId`. Generate and retain a stable unique `claimId`. Another claimant conflicts; reconnecting with the same identity recovers the live claim. The returned task contains instructions, Skills, declared Tools, and final output Schema.

Tools are serial. Retrying the same `toolCallId` with the same input returns the retained receipt; changing its input conflicts. Each task retains at most 256 receipts. Finish in-flight Tools before completion. Assets accept declared IDs rather than arbitrary paths and are limited to 1 MiB per read.

Submit raw final JSON matching the task's advertised input shape for its output parser. The host parses it and resumes the original Step. Follow the returned Run; do not call `flow` to advance to the next task.

## Human answers

For a `user_ask_questions` action, the `answer` is the complete answer array:

```json
[
  { "questionId": "destination", "isSkipped": false, "answer": "Local project" },
  { "questionId": "notes", "isSkipped": true }
]
```

Use the actual question IDs and allow skips only where permitted. For confirmation:

```json
{ "isConfirmed": false, "feedback": "Please revise the proposed scope." }
```

`interact` attempts the negotiated native interaction. If unavailable, present the returned action yourself and submit the user's exact answer through `answer_ask`. Client form cancellation preserves waiting; it is not cancellation of the Run. Agent execution cannot authorize a human confirmation.

## Retry and restart rules

Creating a Run is not idempotent. Query an uncertain result instead of replaying `flow`. Claims and Agent Tool operations have explicit identities for live-process retries. Completion retries are bounded by the current call's retained result; they are not durable replay across subsequent tasks or restarts.

Cancellation invalidates ownership and rejects late results. Host restart does not restore active Agent tasks, their original Promise, or receipts; interrupted work becomes `RUN_INTERRUPTED`. There is no lease stealing, automatic model fallback, or connection-triggered client wakeup.

See [MCP quick start](../quickstart/mcp.md) for user setup and [Recovery](../usage/recovery.md) for process boundaries.
