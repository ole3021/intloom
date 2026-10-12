# @intloom/kernel

`@intloom/kernel` is IntLoom's private execution layer. It loads compiled Workflow artifacts, creates an in-process Runtime, and coordinates Code, Agents, interaction, and formal Storage. It is shipped inside the CLI; application and Workflow authors should use the [`intloom` CLI](../../apps/cli/README.md) and [`@intloom/workflow-sdk`](../workflow-sdk/README.md), not install Kernel directly.

## Project Service

`src/service` owns the independent per-project process and its JSON/SSE/MCP interfaces. CLI Core, MCP proxies and future Studio connect to the same Service. See [Service ownership](src/service/README.md) and [CLI usage](../../apps/cli/README.md). Kernel remains private and bundled in CLI.

## Host integration

Kernel is for the local host that owns a project service. The host creates an Effector and a Storage handle, initializes one project environment, presents waiting actions, and releases its resources when it stops.

```ts
import {
  answerAsk,
  cancelAllRuns,
  createEffector,
  flow,
  initializeProject,
} from "@intloom/kernel";
import { openFileStorage } from "@intloom/kernel/storage/file";

const storage = await openFileStorage({ directory: ".intloom/storage" });
try {
  const execution = await initializeProject(process.cwd(), {
    effector: createEffector(),
    storage: storage.access,
  });

  try {
    let view = await flow(execution, "intent", "Design a Todo app");
    if (view.pendingAction?.kind === "user_ask_confirmation") {
      view = await answerAsk(
        execution,
        view.runId,
        view.pendingAction.id,
        { isConfirmed: true },
      );
    }
  } finally {
    await cancelAllRuns(execution);
  }
} finally {
  await storage.dispose();
}
```

The example uses internal, monorepo-only imports. A real host must keep the same `ProjectExecution` while a Run waits, render `pendingAction`, submit the answer with its exact action ID, and dispose of the Storage handle only after stopping or suspending execution. `flow` returns at a human or Agent wait, or at a terminal state; `getRun`, `listRuns`, `listWorkflows`, and `cancelRun` provide the remaining coordination operations.

Project configuration lives in `intloom.yaml`; compiled Workflow packages are declared there and loaded during `initializeProject`. Kernel does not compile Workflow source, install packages, resolve credentials during initialization, or own host resources. Optional `runtimeDirectory` enables restart checkpoints; recovery has explicit Code opt-in and never replays an in-flight effect.

## Boundaries

| Concern | Owner |
| --- | --- |
| Workflow authoring contracts, State, Storage capability types, and Agent Tools | [`@intloom/workflow-sdk`](../workflow-sdk/README.md) |
| Workflow source compilation and generated ESM artifacts | [`@intloom/compiler`](../compiler/README.md) |
| Project service, configuration, CLI, and MCP presentation | [`@intloom/cli`](../../apps/cli/README.md) |
| Project initialization and coordination functions | [Core](./src/core/README.md) |
| Run lifecycle, waiting, cancellation, recovery, and views | [Runtime](./src/runtime/README.md) |
| Code/Agent dispatch and capability binding | [Effector](./src/effector/README.md) |
| Compiled Workflow discovery, validation, assembly, and registration | [Workflow loader](./src/workflow/README.md) |
| File and SQLite persistence implementations | [Storage](./src/storage/README.md) |

The Runtime owns transient Run and Stage State. A host owns the Effector and Storage handle; Code receives writable Storage and interaction, while Agent Tools receive read-only Storage and no human-interaction capability. Storage commit atomicity does not roll back model requests, project effects, State changes, or later failures.

## Development

Use Node.js 26.4.0+ with Bun from the repository root:

```sh
bun run typecheck --filter=@intloom/kernel
bun run test --filter=@intloom/kernel
bun run test:intg --filter=@intloom/kernel
```

Unit tests cover Kernel modules beside their source. Integration tests use source modules for detailed filesystem/SDK boundaries and built public entries for project initialization, Workflow loading, Runtime, service lifecycle and formal Storage contracts. Service tests belong here even when CLI consumes the same modules. They do not establish live model quality or a particular CLI/IDE user interface.

## Distribution

Kernel is not a public npm product. The CLI packaging step stages its compiled files, declarations, migrations, README, and license beneath the CLI distribution. Public package publication is maintained by the repository [release scripts](../../scripts/release.ts); Workflow artifact packaging is described in [Build and distribute](../../docs/guide/development/build.md).
