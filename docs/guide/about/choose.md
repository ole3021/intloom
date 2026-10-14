---
title: Choose CMD, TUI, or MCP
---

# Choose CMD, TUI, or MCP

Choose the interface by how you want to work and where the Agent should reason.

| Mode | Interaction | Agent executor |
| --- | --- | --- |
| CMD | Commands, files, JSON, scripts | Project Service |
| TUI | Persistent terminal screens and forms | Project Service |
| External MCP with `useMcpAgent: true` | Connected Agent client | External client |
| External MCP with `useMcpAgent: false` | Connected Agent client | Project Service |

CMD and TUI need `llms.default` plus its startup credential for service execution. The default external MCP policy uses the connected client's Agent environment and needs no project model configuration. A Service can start before either execution environment is ready.

## Suggested routes

Start with [installation](../start/installation.md) and [project initialization](../start/project.md), then choose [CMD](../start/cmd.md), [TUI](../start/tui.md), or [MCP](../start/mcp.md). The dedicated client adapter currently provided by IntLoom is [Codex](../usage/clients/codex.md).

All interfaces share execution and formal data. Closing a client ends its observation; use an explicit cancel or stop operation to control work. The executor is fixed when a Run is created.

For custom processes, follow [Workflow development](../development/create.md). For embedding a trusted Node.js client, see [ProjectClient](../reference/project-client.md).
