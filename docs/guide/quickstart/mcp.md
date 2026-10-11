---
title: Run through MCP
description: Use a connected client's reasoning environment with IntLoom's local project host.
---

# Run through MCP

Complete [project setup](./installation.md) and install a compatible Workflow first. The client must be able to execute IntLoom's Agent task protocol, including claiming tasks, invoking business Tools, and submitting results. Connecting an MCP endpoint alone does not complete tasks automatically.

## Start the project host

Keep the generated `workflows` declarations and `useMcpAgent: true`. This is the default. Project `llms` configuration is not required for this entry.

```sh
intloom start
intloom doctor --execution agent_ide
intloom flows
```

`flows` is a CLI query: any readiness it reports is for the CLI entry. Use `doctor --execution agent_ide` for the MCP execution path. Loading availability and entry readiness are different checks.

## Connect Codex

```sh
intloom mcp init --ide codex --plan
intloom mcp init --ide codex
```

The first command previews the plan; the second applies the project's `.codex/config.toml` entry while preserving unrelated settings. It starts the installed stdio proxy, which discovers the existing Service and forwards full MCP messages. It contains no token or dynamic port. Project trust and client permissions still apply; configuration generation alone does not prove IDE acceptance. See [official Codex MCP configuration](https://developers.openai.com/codex/mcp/).

## Run and continue

Ask the client to list Workflows, select the intended `flowName`, and call `flow` once with your intent. It should continue according to each returned Run snapshot:

| Snapshot | Next action |
| --- | --- |
| `pendingAgentCall` | Claim and execute that Agent task, then submit its result |
| `pendingAction` | Show the question or confirmation and obtain your real answer |
| `completed` | Inspect committed outputs |
| `failed` | Read the error and inspect any earlier effects |

The client uses `call_agent_tool` for declared business Tools and `complete_agent_call` for the final structured result. Human interaction uses `interact`, or `answer_ask` after showing the actual question if native forms are unavailable. It must not invent answers or call `flow` again to continue a wait.

## Verify the result

```sh
intloom runs
intloom artifacts
```

Read the returned Run and relevant Artifacts/Records. Terminal queries work regardless of which entry created the Run. `completed` describes process completion; evaluate the stored business results separately.

Keep the host running during client Agent tasks. Reconnecting a client with its original claim identity can continue a live task, but restarting the host interrupts it. See [Recovery](../usage/recovery.md).

To use a project model from MCP instead, set `useMcpAgent: false`, configure [models](../usage/configuration.md), and restart. No automatic service-model fallback occurs.
