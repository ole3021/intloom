---
title: MCP operation guide
---

# MCP operation guide

MCP connects an external Agent client to the project's Service. `intloom mcp serve` is a stdio bridge to an existing process; start the Service explicitly.

The default external policy `useMcpAgent: true` lets the client execute Agent Steps. Setting it false selects project Service models. The policy is fixed per Run.

## Follow the returned Run

1. Call `list_looms` and choose an available `loomName`.
2. Call `run` once with the complete intent.
3. Inspect `pendingAgentCall`; claim and execute its declared task.
4. Inspect `pendingAction`; present questions/confirmation and submit the user's actual answer.
5. Follow the returned Run until terminal, then query committed results.

External clients need the claim/Tool/completion protocol in [MCP reference](../reference/mcp.md). Merely exposing an arbitrary chat Agent to the server does not establish interoperability.

## Native interaction and fallback

`interact` attempts negotiated native forms. When unavailable, present its returned action in the client and submit through `answer_ask`. Dismissing a form preserves waiting. A reasoning Agent cannot approve a human confirmation.

## Client-specific setup

[Codex](./clients/codex.md) has a generated configuration and dedicated presentation profile. Other clients can use the generic protocol if they implement it; this release supplies no additional named adapter.

Disconnecting does not cancel the Run. Retain its ID and inspect it on reconnect. In-flight Agent ownership does not survive Service restart. See [recovery](./recovery.md).
