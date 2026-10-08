---
title: About IntLoom
description: Understand the framework, its public packages, and the path from intent to recorded results.
---

# About IntLoom

IntLoom is a local workflow framework for coordinating agents, code, and human decisions. A project service loads installed Workflow packages, executes their steps, handles questions and confirmations, and stores the results that those workflows commit.

Use it when a task needs an explicit process: reasoning, deterministic checks, human review, and recorded outputs. A Workflow defines that process. The framework runs it; it does not prescribe the business stages every package must contain.

## What you work with

- **A project** holds configuration, installed Workflow declarations, source files, and saved results.
- **A Workflow** describes executable stages and steps. Installing a package makes its registered workflow available to the host.
- **A Run** is one execution of a Workflow for an original intent. Questions and feedback continue that Run.
- **Artifacts and Records** are formal results saved by Workflow Code. Their meaning belongs to the package that creates them.

See [Core concepts](./workflow.md) for the execution and data boundaries.

## Choose how to work

| Goal | Start here |
| --- | --- |
| Use a connected IDE's reasoning environment | [Run through MCP](./quickstart/mcp.md) |
| Run from a terminal with a project-configured model | [Run through CLI](./quickstart/cli.md) |
| Define a process of your own | [Create a Workflow](./development/create.md) |
| Build a trusted Node.js client | [ProjectClient reference](./reference/project-client.md) |

Both execution paths use the same local service and business Tools. The executor is fixed when the Run is created; changing project configuration does not switch an existing Run to another model environment.

## Public package boundaries

| Package | Purpose |
| --- | --- |
| `intloom` | Lightweight command entry, depending on the matching CLI version |
| `@intloom/cli` | CLI, project service, MCP endpoints, and Node.js ProjectClient |
| `@intloom/workflow-sdk` | Public Workflow contracts and Agent Tool helpers |
| `@intloom/compiler` | Build-time Workflow compiler |
| `@intloom/utils` | Shared logging, errors, and identifiers |

`@intloom/kernel` is private and included with the CLI. Workflow authors depend on the SDK at runtime and the Compiler during development. They do not need a public Kernel installation. Workflow packages are installed separately from the CLI.

## Documentation scope

These pages describe the framework: setup, operation, extension, and reference. Package-specific business manuals and a gallery of complete applications are outside this documentation set. Check [Current capabilities](./status.md) before treating a supported interface as proof of a particular model, client, or deployment environment.

Continue with [Getting started](./getting-started.md).
