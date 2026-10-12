---
title: Current capabilities
description: Implemented framework behavior, validation boundaries, and compatibility expectations.
---

# Current capabilities

This documentation describes the current development tree. Local builds and package tests do not establish that a version is available from the public registry. Follow [Installation](./quickstart/installation.md) for source use and release prerequisites.

## Implemented framework behavior

| Area | Available behavior |
| --- | --- |
| Projects | Initialization, local service lifecycle, configuration, package installation and diagnostics |
| Workflow execution | ESM loading, Stage initialization, Code/Agent Steps, outcome routing, human interaction, cancellation |
| Execution paths | Project-configured service models and external MCP client Agent tasks |
| Formal Storage | File and SQLite backends, atomic operation batches, Artifact/Record queries |
| Recovery | Checkpoints, safe Step boundaries, and explicit Code interaction recovery |
| Authoring | YAML definitions, SDK contracts, Tools and Skills, compiled JS/declarations and assets |
| Clients | CLI, generic MCP, Codex profile, and trusted Node.js ProjectClient |

The compiled Workflow protocol is `2026-10-08`. It is separate from npm package versions. Rebuild and reinstall packages targeting an older protocol.

## Boundaries to account for

- Real model behavior must be validated with the intended provider, endpoint, model, and workflow. Configuration readiness does not call a model or prove successful reasoning or Tool use.
- A real Codex MCP session has completed a four-stage package workflow. This does not establish desktop native-form usability, all MCP clients, or every model configuration. A separate real service-model attempt failed after output truncation.
- Active client Agent tasks and uncertain in-flight effects do not resume after a host restart. Code waits need an explicit `recover` function. See [Recovery](./usage/recovery.md).
- Studio is planned. A Node.js client contract for a future UI is available; a finished Studio application is not.
- Hot reload, automatic package upgrades, automatic storage-backend migration, and automatic replay of failed Runs are not provided.
- Project file and command capabilities run with the host process's authority. They are not an operating-system sandbox.

## Runtime compatibility

All packages require Node.js >=26.4.0. Repository, product and consumer type checks use Node.js 26 types. Prepared archive consumers and post-publication registry consumers run on Linux/macOS with minimum 26.4.0 and latest 26. These checks do not establish real remote model behavior.

Workflow commands use the Node executable inherited by the host. Use ordinary erasable TypeScript with `node --test`; Node 26 does not accept the retired `--experimental-transform-types` option. npm consumers resolve their own dependency graph, so local builds do not replace isolated installation checks.

Use the installed CLI's `--version` and `--help` when comparing a deployed environment to these development docs. Restart an existing host after upgrading the CLI; an already running process continues using its loaded resources.
