---
title: Connect Codex
---

# Connect Codex

Codex is IntLoom's currently supported named MCP adapter. It adds a project configuration generator and Codex interaction presentation; Workflow behavior remains owned by the Service.

## Generate project configuration

Run inside the initialized IntLoom project:

```sh
intloom mcp init --ide codex --plan --json
intloom mcp init --ide codex
intloom start
```

The plan targets `.codex/config.toml` and reports create/update/unchanged/conflict. Applying checks file fingerprints. Managed IntLoom entries can update; an unmanaged conflicting entry requires manual resolution.

The generated entry uses absolute Node and CLI paths, the exact project root, `--ide codex`, a 20-second startup timeout and 300-second Tool timeout. It contains no dynamic Service port or private connection token.

## Connect and verify

Open the same project in Codex. Project-scoped MCP configuration is loaded for trusted projects; Codex CLI can inspect configured servers with `codex mcp list` and active connections with `/mcp`. These client-side requirements are described in [official Codex MCP documentation](https://developers.openai.com/codex/mcp/).

Verify `list_looms` through the connected client, then complete [the MCP quick start](../../start/mcp.md), including an Agent task, a real human answer and saved results.

If connection fails, check Service status, generated executable paths, project trust, and client MCP diagnostics. After reinstalling or changing Node paths, regenerate configuration and reconnect. Successful generation alone does not prove client acceptance.
