---
title: Manage Workflow packages
description: Install, inspect, replace, and restore project Workflow dependencies.
---

# Manage Workflow packages

Workflow packages are independent of the CLI. The package name identifies an installation; its compiled `flowName` identifies what `flow` executes.

## Install and inspect

Stop the project service before changing packages:

```sh
intloom stop
intloom workflow add /absolute/path/to/workflow.tgz
intloom workflow list
intloom start
intloom flows
```

You can also pass a registry package name, version, or tag. A bare name selects registry `latest` once. IntLoom records the actual version and distribution archive checksum in `intloom.yaml`.

| Command | What it establishes |
| --- | --- |
| `workflow list` | Declared packages and installation integrity; works offline |
| `flows` | Host-loaded Workflows, loading diagnostics, and readiness for the CLI entry |
| `doctor --execution agent_ide` | Readiness for external MCP execution |

`ready` installation does not prove executable exports, model compatibility, or successful business behavior.

## Replace or remove

There is no update command or hot reload. A duplicate package name is rejected, including an attempt to add a newer version. To replace an installed package:

```sh
intloom stop
intloom workflow remove @your-scope/workflow
intloom workflow add @your-scope/workflow@1.2.3
intloom start
```

These names and versions are placeholders. Removal and addition are separate operations, not one atomic upgrade. Keep the old package source available if the new installation fails. Removing a package preserves committed Artifacts and Records.

Finish or cancel unfinished Runs before changing their Workflow resources. Recovery requires the same package identity and compiled resource contents; a rebuilt package can be incompatible even when its npm version is unchanged.

## Installation and restoration

Projects install into `.intloom/workflows/`. The CLI maintains only the `workflows` declarations; other YAML fields and comments remain user-owned. Add/remove and startup share an operation lock. A failed preparation preserves the previous installation, and concurrent edits to YAML cause publication to stop rather than overwrite the edit.

Startup checks the installation against saved declarations and restores missing or damaged content. Local archive declarations include an absolute `source` path; keep that archive available, or update the path when moving it. The original checksum must still match.

npm installation scripts are disabled. Packages that require install-time scripts are outside this installer. Runtime dependencies must remain resolvable, even when the Workflow itself came from a local archive.

The archive checksum pins that Workflow distribution. It does not pin the complete transitive dependency graph after cache deletion; the cache's npm lockfile is not a durable project dependency-lock guarantee.

For failed startup or stale locks, use [Diagnostics](./diagnostics.md). Do not remove live-owner locks to force a package change.
