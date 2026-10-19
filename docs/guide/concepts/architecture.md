---
title: Service and Kernel architecture
---

# Service and Kernel architecture

The project Service owns one Kernel environment. CMD, TUI and MCP connect to it; they do not create separate copies of Run or Stage State.

| Module | Responsibility and owned state |
| --- | --- |
| Host | Project configuration, loaded resources, model preparation, process and storage lifetime |
| Operations | Trusted entry policy, mutation admissions, instance-scoped operation receipts and queries |
| Runtime | Run/Stage state, Calls, routing, waiting, pause/cancel and recovery |
| Execution | Code/Agent/Tool execution; delegated tasks, claims and execution receipts |
| Access | Bind SDK capabilities to the current Call and Tool; no business state copy |
| Loom loader | Discover and validate built Loom package resources |
| Storage | Formal Artifact/Record transactions and queries |
| Mirror | Immutable historical execution images and explicit restore |
| Transport | HTTP/JSON, SSE, MCP and human-interaction adapters |

Host prepares a fixed execution policy. Operations admits the request, Runtime creates the Run and advances its Steps, Execution evaluates Code/Agents, and Access checks authority for each capability use. Host supplies only the ports Operations needs. Run mutations use the receipt-bearing `admit` entry; waiting is a separate observer operation. Runtime alone decides the next transition. Execution and Access have no dependency on Runtime implementations.

Mutation acceptance is separate from completion. An operation receipt records admission; a Run snapshot records current progress. Observation disconnects never cancel or replay execution. Human waits save the action before publication and accepted answers before continuation. Agent waiting persists only the recovery boundary; process-local claims cannot survive restart.

Actual commit references and pending activity are independent of optional model metrics. A stopped Run can still have `settled: false` while an already accepted external operation finishes. Exclusive Runs retain their project reservation until this work settles; paused Runs retain it too. Shutdown rejects new mutations before effects, while known receipts remain queryable within that instance. Terminal checkpoints are retained as read-only history; uncertain external effects are never replayed automatically.

Model adaptation preserves Tool capability bindings; a returned Tool cannot continue writing State. Delegated Tool receipts include post-execution checks, so retries preserve the same success or failure. Runtime supplies independent recovery validation; Host offline mirror restore does not construct an executor.

Use `@intloom/loom-sdk` to author Looms and `intloom build` to compile them. Kernel is private and bundled with CLI. Its ownership, dependency and recovery details live in the [Kernel contract](https://github.com/ole3021/intloom/blob/main/packages/kernel/README.md).

See [execution resources](./execution.md), [lifecycle](./lifecycle.md), [recovery](../usage/recovery.md) and [ProjectClient](../reference/project-client.md).
