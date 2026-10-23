---
title: Manage the project Service
---

# Manage the project Service

Each project has one independent local Service process. CMD, TUI, and MCP discover it and share its Runtime and Storage.

```sh
intloom status
intloom start
intloom looms
intloom stop
```

`start` creates a Service or reuses the verified existing instance. `status` distinguishes running, stopped, and unavailable. `stop` closes admission, suspends execution, waits for known tasks, releases resources, and verifies shutdown.

## Restart deliberately

Restart after configuration, credentials, CLI, or Workflow changes. Before stopping, inspect active Runs and their recovery boundaries. An in-flight model request or unsupported interaction cannot be automatically reconstructed after restart.

Closing a TUI, MCP connection, watch stream, or wait command leaves execution active. Use `cancel` for one Run, `stop` for the project process.

## Bind a specific instance

When diagnosing a race, retain the observed instance ID and use `stop --instance INSTANCE`. A replacement process must not receive an operation intended for the old process.

Stale locks and discovery resources are handled explicitly:

```sh
intloom recover --dry-run
intloom recover
```

Read the plan before cleanup. `recover` cleans eligible stale resources; it does not rerun Workflow business logic. See [recovery](./recovery.md) and [troubleshooting](../help/troubleshooting.md).
