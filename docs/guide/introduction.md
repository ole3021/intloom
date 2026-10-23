---
title: What is IntLoom?
---

# What is IntLoom?

IntLoom is a local Workflow framework that coordinates Agents, executable Code, and human decisions. A project Service loads installed Workflow packages, executes their declared stages and steps, presents questions and confirmations, and retains the results that Workflow Code commits.

A Workflow defines the process; a Run executes that process for one intent. Code performs deterministic operations, Agents reason with declared Tools and Skills, and people supply decisions at explicit interaction points. You can inspect execution and results through CMD, TUI, or MCP.

## Start with your goal

| Goal | Read next |
| --- | --- |
| Run IntLoom for the first time | [Installation](./start/installation.md) |
| Develop software from an intent | [Intent Workflow](./intent/overview.md) |
| Connect an external Agent | [MCP quick start](./start/mcp.md) |
| Define your own process | [Create a Workflow](./development/create.md) |
| Understand execution and data | [Architecture](./concepts/architecture.md) |

## Framework and Workflow packages

The CLI supplies the project Service and user interfaces. Business Workflows are installed separately. `@intloom/intent` provides Specification → Solution → Implementation → Validation; these four stages belong to that package, rather than every IntLoom Workflow.

Workflow authors use `@intloom/loom-sdk` at runtime and `@intloom/compiler` at build time. The private Kernel ships inside the CLI.

Continue with [why IntLoom exists](./about/why.md) or [choose a usage mode](./about/choose.md).
