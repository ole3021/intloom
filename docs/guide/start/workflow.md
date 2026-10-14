---
title: Install your first Workflow
---

# Install your first Workflow

The CLI and business Workflow packages have separate installation lifecycles. In the initialized project, stop the Service before adding or removing packages.

```sh
intloom stop
intloom workflow add @intloom/workflow-intent
intloom workflow list
```

A bare package name resolves its current registry version. Installation retains package name, exact version, archive hash, and local source where applicable. It disables package scripts.

If you have a compatible local archive, use it instead of the registry package:

```sh
intloom workflow add /absolute/path/intloom-workflow-intent.tgz
```

Retain that archive so the installation can be restored. The Workflow artifact protocol must match the host; its protocol version is separate from its npm version.

## Verify loading

```sh
intloom start
intloom flows
```

`workflow list` shows installed packages. `flows` shows the Workflows loaded by the running Service, their availability and diagnostics. A package may be installed but fail loading; inspect its phase and error.

For CMD/TUI, configure the model before executing a Run. For external MCP, prepare the connected Agent client. Continue with [CMD](./cmd.md), [TUI](./tui.md), or [MCP](./mcp.md).
