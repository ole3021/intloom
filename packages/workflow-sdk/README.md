# @intloom/workflow-sdk

Public TypeScript contracts, Zod Schemas, and stateless helpers for authoring compiled IntLoom Workflows. The SDK depends on Utils and Zod. The private Kernel owns execution, Agent construction, capability lifetimes, and Storage implementations.

## Installation

Requires Node.js 24+ and ESM. Add the SDK and any packages imported by your Workflow to runtime dependencies; add Compiler to development dependencies:

```sh
bun add @intloom/workflow-sdk zod
bun add --dev @intloom/compiler
```

Repository workspaces use `workspace:*` for IntLoom dependencies. Consumers import from the package root; subpath exports are not provided.

## Usage

Initialize Stage State and implement Code with the public contracts:

```ts
import type {
  ExecutableCode,
  StageStateInitializer,
} from "@intloom/workflow-sdk";

export const initializeState: StageStateInitializer = ({ runId, intent }) => ({
  id: runId,
  intent,
});

export const complete: ExecutableCode = (_input, access) => {
  access.signal.throwIfAborted();
  return { outcome: "complete" };
};
```

The initializer returns JSON input for the Stage Schema. Code returns a routing outcome; business data is read and written through `access.state`.

Define Agent Tools with input/output Schemas and explicit invocation access:

```ts
import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";

export const readDraft = defineAgentTool({
  id: "read_draft",
  description: "Read the current draft.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: (_input, access) => access.state.value ?? null,
});
```

Code receives State, writable Storage, interaction, a cancellation signal, and optional project access. Agent Tools receive State, read-only Storage, a signal, and optional project access. Await all capability operations and use access only during the current call.

Client and service execution run Tool functions and their original Zod parsers in the host. MCP carries JSON Schemas and JSON values. Workflows use the SDK Tool contract directly; the host supplies framework adapters.

See [Create a Workflow](../../docs/guide/development/create.md) for source setup, [execution resources](../../docs/guide/development/execution.md) for Code and Tools, [State and Storage](../../docs/guide/development/state-storage.md) for data access, and [interaction](../../docs/guide/development/interaction.md) for questions, confirmation, and restartable waits.

## Contract semantics

`flowName` identifies a registered Workflow; `runId` identifies an execution. Blueprint describes Stage/Step topology and outcome routing. `exclusive: true` requests exclusion against other active Runs in the same host; omission permits concurrent Workflow behavior.

| Contract | Behavior |
| --- | --- |
| `StateAccess` | Current Stage business State; `value` is a read view, `create` requires absence, `update` replaces the complete value, and `clear` is idempotent without reinitialization. The host validates writes with the Stage Schema. |
| `StorageReadAccess` | Read and list formal Artifacts and Records; missing entries return `undefined`, and lists return `{ data, nextCursor? }`. |
| `StorageAccess` | Add atomic `commit` for Code. Atomicity covers the supplied Artifact/Record operations, separately from State updates and project effects. |
| `InteractionAccess` | Ask a flat list of questions or request confirmation from Code. Schemas validate shape; the host checks ownership, unique IDs, complete answers, and skip permissions. Workflow Code owns business rules such as required feedback. |
| `ProjectAccess` | Optional host-bound snapshots, text reads/writes/removal, and command execution. The host selects the root, limits, and lifetime. Commands use argument arrays; results record the command, exit code, output, timeout, and truncation. |

Project operations provide trusted local access; they do not create an OS sandbox. TypeScript read-only views describe access at compile time; the host enforces runtime ownership and data boundaries.

`ExecutableCode.recover(saved, access)` continues a persisted interaction with restored State and fresh capabilities. In-process answers resume the original call. Recovery cannot restore its Promise or local variables, so the continuation must avoid replaying earlier effects. See [restartable waits](../../docs/guide/development/interaction.md).

`defineAgentTool` infers the parsed input and raw output from the Schemas. `AgentTool<Input, Output, RawOutput = Output>` preserves the first two generic meanings: `execute` receives `Input` and returns `RawOutput`, which the host parses into `Output`. The helper constructs no Agent and runs no parsers. For example, an output Schema of `z.string().transform(Number)` requires `execute` to return a string; the host produces the final number. Ordinary Tools whose input/output shapes do not change can continue using `AgentTool<Input, Output>`.

The host parses input before calling `execute`, parses its result afterward, and enforces the JSON boundary. Transport descriptions use input shape for final Agent tasks and parsed output shape for Tool results. Opaque output transforms need an explicit output Schema, such as `.pipe(z.number())`, to advertise a concrete result shape.

`getAgentExecutionAccess(context)` reads the shared `intloom.execution` binding for adapter integration and retains no Run in module state. It checks the State value member and all State/Storage methods, the cancellation signal, and optional Project methods without reading business State or calling capabilities. Missing, incomplete, or overprivileged bindings fail with `STEP_EXECUTION_FAILED`; lookup/inspection failures retain their cause. Ordinary SDK Tools receive access explicitly. The host enforces capability lifetimes; this helper does not create or revoke access.

## Workflow exports and compatibility

Compiler generates the named ESM exports `blueprint`, `codes`, and `agentSpecs`, described by `WorkflowModule`. Compiled Workflows use the SDK at runtime and are loaded by the host. Compiler is a build-time dependency; a separate public Kernel installation is not required.

The Workflow manifest declares the artifact protocol:

```json
{
  "intloom": {
    "type": "workflow",
    "version": "2026-10-08"
  }
}
```

`workflowProtocolVersion` is independent of npm package versions. `workflowMetadataSchema` validates metadata shape; Compiler and the host check protocol compatibility. The explicit Tool signature requires rebuilding and reinstalling artifacts using the older `2026-09-20` protocol.

Use `StorageQuery` and `StorageCategory` in new code; `Query` and `SnapshotCategory` remain deprecated compatibility aliases. See the [SDK reference](../../docs/guide/reference/sdk.md) for public contracts and [Build and distribute](../../docs/guide/development/build.md) for generated exports and packaging.

## Directory organization

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | Public package root exports |
| `src/json.ts` | JSON values and recursive read-only views that preserve concrete business fields |
| `src/blueprint.ts` | Workflow/Stage/Step topology, routing, resource IDs, and State initialization |
| `src/module.ts` | Compiled Workflow exports, Agent specifications, and Skill content/assets |
| `src/execution.ts` | Code/Agent capabilities, Step outcomes, and Code recovery |
| `src/state-access.ts` | Current Stage State reads, creation, replacement, and clearing |
| `src/storage-access.ts`, `src/storage-types.ts` | Formal data access, stored data, queries, pages, revisions, operations, and commit results |
| `src/interaction.ts`, `src/user-ask.ts` | Code-owned interaction contracts, strict question/answer Schemas, and inferred types |
| `src/project-access.ts` | Optional host-bound file and command capabilities |
| `src/agent-tool.ts` | Framework-independent Tool contract and schema-inference helper |
| `src/agent-context.ts` | Read and check the current Agent capability binding |
| `src/metadata.ts` | Artifact protocol version and strict metadata shape validation |
| `src/*.spec.ts` | Capability binding validation, question/answer Schemas, and metadata shape validation |
| `test/package.intg.ts` | Built package exports, protocol/dependency boundary, and exclusion of tests and Kernel/framework/database imports from emitted JavaScript and declarations |
| `test/fixtures/consumer/` | Declaration type assertions and a separate Node.js consumer for installed archives |
| `dist/` | Generated ESM, declarations, and source maps included in the published package |

Source filenames are organizational details; consumers use the package root entry.

## Validation

Run from the repository root:

```sh
bun run typecheck --filter=@intloom/workflow-sdk
bun run test --filter=@intloom/workflow-sdk
bun run test:intg --filter=@intloom/workflow-sdk
```

Unit tests import adjacent source modules. Integration tests import the built package through its public entry; Turbo builds dependencies first and does not cache integration results. Declaration consumers disable source path mappings and check Tool inference, read-only views, capability permissions, and Workflow exports. An isolated consumer installs SDK/Utils archives with npm and verifies declarations and Node.js execution without repository links or Kernel. Installation uses the npm registry for external dependencies.

Kernel tests separately exercise Tool parsing, service/client dispatch, interaction ownership, and capability lifetimes. SDK tests validate the public contracts and helpers, rather than implementing a host.

See [AGENTS.md](../../AGENTS.md) for engineering conventions.
