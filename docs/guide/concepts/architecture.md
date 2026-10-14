---
title: Service and Kernel architecture
---

# Service and Kernel architecture

IntLoom separates project execution from user interfaces.

| Layer | Responsibility |
| --- | --- |
| CMD / TUI / MCP proxy | Input, presentation, observation and explicit operations |
| CLI Core | Shared client operations, local setup and safe result envelopes |
| Project Service | Independent process, discovery, configuration, APIs and resource lifetime |
| Kernel Core / Workflow loader | Initialize the project and load/register compiled definitions |
| Runtime | Run state, scheduling, routing, waits, ownership and recovery |
| Effector | Dispatch Code/Agent calls and bind current capabilities |
| Storage | Formal Artifact/Record persistence |

The Service uses the private Kernel, bundled in the CLI. It owns one Runtime/Storage environment per project. Clients connect to that environment rather than executing their own copy.

## One execution

A request resolves the project Service, validates source policy and prerequisites, admits a Run, initializes Stage State, dispatches a Step, validates its outcome and advances routing. Human interaction publishes a wait; answering continues the original call or supported recovery continuation. Code commits formal results explicitly.

JSON operations, snapshot SSE and MCP are Service adapters over shared project operations. Snapshot streams show current state and may coalesce intermediate changes; they are not an audit history.

## Public development boundary

Use `@intloom/workflow-sdk` to author Workflows and `@intloom/compiler` to build them. Kernel internals are private and are not a separately installed public dependency.

See [execution resources](./execution.md), [lifecycle](./lifecycle.md), and [ProjectClient](../reference/project-client.md).
