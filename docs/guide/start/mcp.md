---
title: First Run with MCP
---

# First Run with MCP

Install IntLoom, initialize a project, and install Intent Workflow. With the generated `useMcpAgent: true` setting, the connected Agent client supplies reasoning; project `llms` is not required.

## Connect Codex

```sh
intloom mcp init --ide codex --plan --json
intloom mcp init --ide codex
intloom start
intloom doctor --execution agent_ide
```

The generated project `.codex/config.toml` starts a stdio proxy using installed absolute paths. The proxy discovers an existing Service. Open the same trusted project in Codex and refresh/reconnect its MCP servers. See [Codex setup](../usage/clients/codex.md).

## Ask the client to run the Workflow

```text
Use IntLoom's intent Workflow to build a Todo app with local persistence.
Keep the same Run ID, execute each pending Agent task with its declared tools,
and ask me the Workflow's questions and confirmations before continuing.
At the end, show the Validation report and its evidence.
```

The client calls `run` once, inspects the returned Run, executes pending Agent tasks, and presents human actions. A Tool connection alone does not establish that the client implements this complete protocol.

Keep user questions and confirmations visible. Client reasoning must not manufacture an answer or human approval.

## Inspect from the terminal

```sh
intloom runs --loom intent
intloom artifacts --loom intent
intloom artifact --loom intent --stage validation
```

If the client disconnects, inspect the same Run before deciding how to continue. See [MCP operations](../usage/mcp.md) and [Agent task protocol](../reference/mcp.md).
