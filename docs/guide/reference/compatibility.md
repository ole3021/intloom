---
title: Versions and compatibility
---

# Versions and compatibility

## Runtime and package boundary

IntLoom packages require Node.js 26.4.0+. Repository development uses Bun 1.4.0+. TUI's launcher enables experimental FFI. Installed client configuration binds executable paths, so regenerate it after path changes.

CLI, its lightweight launcher package, and bundled private Kernel form a coordinated release unit. Workflow packages have independent npm versions.

## Workflow artifact protocol

The current protocol is **2026-10-08**. It is declared in `package.json.intloom.version` and checked by Compiler and host independently from npm version.

Compiled Workflows must expose blueprint/codes/agentSpecs, valid Stage initializers and compatible resources. Source/schema changes require rebuilding and reinstalling artifacts. Stop the Service before replacing packages; restart to adopt the new installation.

Keep compatible Workflow resources for unfinished checkpoints. An incompatible saved State or topology is not migrated automatically.

## Execution compatibility

Provider syntax, endpoint availability, Tool support, structured output and output budgets all affect real execution. A valid YAML file or successful doctor does not prove a real model call.

Codex has the dedicated named adapter. Other clients need the complete external Agent task protocol and human interaction. Verify actual client behavior, including fallback presentation and reconnection.

Local archive validation does not establish public registry availability. Read the actual Validation report rather than inferring delivery from version numbers.

See [configuration](./configuration.md), [recovery](../usage/recovery.md), and [package management](../usage/packages.md).
