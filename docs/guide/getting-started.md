---
title: Getting started
description: Set up a project and choose the CLI or MCP execution path.
---

# Getting started

IntLoom runs a local project service. Install the CLI, initialize an empty project, and install a compatible Workflow package before asking the service to execute it.

## Choose your path

| Path | Agent reasoning happens in | Model setup |
| --- | --- | --- |
| [MCP](./quickstart/mcp.md) | Connected IDE or other capable MCP client | No project `llms` required with default `useMcpAgent: true` |
| [CLI](./quickstart/cli.md) | The project service | Configure `llms.default` and provide credentials before execution |

Start with [Installation and project setup](./quickstart/installation.md). It covers both the source checkout and the release installation path. The CLI does not bundle a business Workflow.

## The first-run sequence

1. Install or build the CLI.
2. Initialize a new or empty project directory.
3. Install the Workflow package you want to run.
4. Choose MCP or CLI and prepare that entry's execution environment.
5. Start the service, inspect `flows`, and create one Run.
6. Answer its questions and confirmations using the same Run.
7. Inspect the outputs the Workflow actually committed.

`start` starts a service. `flow` starts a Workflow Run. A successfully started service can have no installed Workflows, or Workflows that still need model configuration for the selected entry.

## After your first Run

- [Run management](./usage/runs.md): continue, inspect, and cancel work.
- [Results](./usage/results.md): query and export committed data.
- [Diagnostics](./usage/diagnostics.md): investigate loading or execution failures.
- [Create a Workflow](./development/create.md): define a process of your own.
