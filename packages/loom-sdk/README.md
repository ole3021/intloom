# @intloom/loom-sdk

Public contracts, Zod schemas, and small stateless helpers for building IntLoom Looms. The SDK depends only on Zod. Compiler owns source definitions and builds; Kernel owns loading, execution, model adapters, capability lifetimes, and storage implementations. Each Loom owns its business schemas, Tools, Artifacts, Records, and confirmation rules.

## Installation

Requires Node.js 26.4.0+ and ESM. Development uses Bun:

```sh
bun add @intloom/loom-sdk zod
bun add --dev @intloom/compiler
```

Import from the package root. Compiled Looms use SDK at runtime; consumers do not need a separate Kernel or Compiler installation.

## Authoring

A Stage initializer receives `runId`, `loomName`, `stageName`, and `input`. Input slots are fixed: `prompt`, `files`, `dirs`, `urls`. A Loom declares required slots; an empty declaration permits no input. Paths and URLs are references, not automatic reads or capability grants.

```ts
import type { ExecutableCode, StageStateInitializer } from "@intloom/loom-sdk";

export const initializeState: StageStateInitializer = ({ runId, input }) => ({
  id: runId,
  prompt: input.prompt ?? "",
});

export const complete: ExecutableCode = (access) => {
  access.signal.throwIfAborted();
  return { outcome: "complete" };
};
```

Code receives one `access` argument. Stage business data lives in State; Code returns only a routing outcome. Agent final output schemas must parse to `StepResult`, also containing only an outcome. Runtime checks actual results and routing.

```ts
import { defineAgentTool } from "@intloom/loom-sdk";
import * as z from "zod";

export const readDraft = defineAgentTool({
  id: "read_draft",
  description: "Read the current draft.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: (_input, access) => z.json().parse(access.state.value ?? null),
});
```

Tools receive their parsed input and invocation access explicitly. `defineAgentTool` preserves schema inference without executing parsers or constructing an Agent. `AgentTool<Input, Output, RawOutput = Output>` distinguishes parsed input, parsed output, and the raw value returned by `execute`. For an output schema such as `z.string().transform(Number)`, return a string; the host produces the parsed number. Use an explicit output shape such as `.pipe(z.number())` when advertising transformed results to a model.

Optional `endsAgent(output)` receives the validated Tool result. Returning true closes further Tools for that invocation; the Agent must still return its final outcome. This synchronous, side-effect-free predicate does not commit data or determine business completion.

Agents select a project model purpose: `thinking`, `working`, or `coding`. The host falls back to its default model when a purpose is not configured. Framework contexts and model instances belong to Kernel.

## Execution capabilities

| Contract | Responsibility |
| --- | --- |
| `StateAccess` | Current Stage State. `value` is a recursive read-only view; `create` requires absence, `update` replaces the entire value, and `clear` is idempotent without reinitialization. The host validates writes. |
| `StorageReadAccess` | Read/list formal Artifacts and Records. Missing reads return `undefined`; lists return `{ data, nextCursor? }`. |
| `StorageAccess` | Code-only atomic `commit`. Artifact replacement/removal requires `expectedRevision`. Atomicity does not cover State updates or project effects. |
| `InteractionAccess` | Code-only questions and confirmation. The host checks action ownership, complete answers, unique IDs, and skip permissions; Loom Code checks business approval rules. |
| `ProjectAccess` | Optional host-bound snapshots, text reads/writes/removal, and command execution. Commands use argument arrays. Results preserve exit status, output, timeout, and truncation. |

Agent access has writable State, read-only Storage, optional Project, and a cancellation signal. Code additionally receives writable Storage and interaction. Await all capability operations; access is valid only during its owning call. Read-only TypeScript views do not replace host enforcement. Project access is trusted local access, not an OS sandbox. Exit codes 126/127 represent failed command attempts, never successful checks.

`ExecutableCode.recover(saved, access)` continues a persisted interaction after restart using fresh access. `CodeRecovery` is a read-only discriminated union with `actionId`, `kind`, `request`, and `answer`. Narrow `kind` to obtain the matching question or confirmation types. The host validates the envelope; Loom Code must still verify that the request and current business State match. In-process answers resume the original call. Recovery cannot restore local variables, and must not replay effects performed before waiting.

Storage snapshots, runtime cursors, and framework context bindings are host internals. The SDK has no compatibility aliases for those interfaces.

## Compiled protocol

A compiled module has exactly three named exports: `blueprint`, `codes`, and `agentSpecs`, described by `LoomModule`. Its package manifest contains:

```json
{ "loom": { "type": "loom", "version": "2026-10-15" } }
```

`loomProtocolVersion` is independent of npm versions. `loomMetadataSchema` validates shape; Compiler and Kernel check supported versions. The source package's additional `loom` definition fields belong to Compiler. Rebuild and reinstall older artifacts after changing protocol versions; this version removes the Code input argument and revises recovery payloads.

`loomModuleSchema` validates compiled structure without executing Code, Tools, initializers, or business parsers. It preserves function and schema references. `codeIdSchema`, `agentIdSchema`, and `loomNameSchema` define shared identifier rules; Compiler generates namespaced IDs. Kernel additionally checks graph references, packaged assets, registration conflicts, and runtime results. Types cannot prove what an arbitrary function or schema will return.

## Source organization

| File | Responsibility |
| --- | --- |
| `protocol.ts` | Version, metadata, names and resource IDs |
| `blueprint.ts` | Stage/Step topology, routing and initialization |
| `module.ts` | Compiled exports and structural validation |
| `agent.ts` | Agent/Skill/Tool contracts, model purposes and Tool inference |
| `execution.ts` | Code, access, routing results and typed recovery |
| `inputs.ts`, `json.ts` | Fixed inputs and JSON/read-only types |
| `state.ts`, `storage.ts` | Business State and formal data capabilities |
| `interaction.ts`, `project.ts` | User interaction and host project capabilities |
| `index.ts` | Explicit public exports |

## Verification

Run `bun run --cwd packages/loom-sdk typecheck` and `bun run --cwd packages/loom-sdk test`. After building and packing the SDK, `test:package` verifies its public declarations and installs its archive into an isolated Node.js consumer, with no Kernel, Utils, or repository links. Registry access is required for external dependencies. Kernel tests separately validate runtime ownership, recovery, and model adapters.

See [Create a Loom](../../docs/guide/development/create.md), [SDK reference](../../docs/guide/reference/sdk.md), and [recoverable waits](../../docs/guide/development/interaction.md).
