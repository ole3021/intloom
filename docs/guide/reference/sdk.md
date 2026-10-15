---
title: Loom SDK reference
---

# Loom SDK reference

Import public contracts from `@intloom/loom-sdk`. No subpath or private Kernel dependency is needed.

## Definitions and execution

| Contract | Meaning |
| --- | --- |
| `Blueprint`, `BlueprintStage` | Initialized topology, entries, routing, Stage Schema/initializer |
| `StageStateInitializer` | Run context to JSON Schema input on Stage entry |
| `LoomModule` | Named `blueprint`, `codes` and `agentSpecs` exports |
| `ExecutableCode` | `code(access)` plus optional `recover(saved, access)` |
| `StepResult` | Only `outcome: string` |
| `CodeExecutionAccess` | State, writable Storage, interaction, signal, optional Project |
| `AgentExecutionAccess` | State, read-only Storage, signal, optional Project |

## StateAccess

`value` is a recursive read view or undefined. `create(value)` requires absence. `update(value)` replaces existing State. `clear()` is idempotent. The host parses writes and preserves prior values on failure.

## Storage

Read access provides getArtifact(loomName, stageName), getArtifactById, getLatestRecord, getRecordById, listArtifacts and listRecords. Missing SDK reads return undefined. Lists use `{ data, nextCursor? }`.

Writable access adds `commit(operations)`. Operations are create_artifact, replace_artifact, append_record, remove_artifact and remove_record. Replace/remove Artifact requires expectedRevision. Results report writtenArtifacts, appendedRecords and removed IDs.

`StorageQuery` supports loomName, stageName, ids, createdAfter/Before, order, limit and cursor. These SDK queries are broader than client list flags.

## Interaction and Tools

`InteractionAccess.askQuestions` returns the complete answer array; `confirm` returns isConfirmed/optional feedback. Runtime owns action identity and lifetime. Loom Code owns business confirmation rules.

`defineAgentTool` infers parsed input and raw output. `AgentTool<Input, Output, RawOutput = Output>` separates parser output from execute's result. Host parsers and JSON checks enforce the boundary.

Tools receive `access` explicitly. Framework context bindings belong to Kernel and are not public SDK exports.

## ProjectAccess and lifetime

`snapshot`, `read`, `write`, `remove` and `run` provide host-bound engineering operations. Commands use argument arrays and optional cwd/timeoutMs; results retain exitCode, stdout/stderr, timeout and truncation.

Every access belongs to a current call. Await operations and do not retain capabilities afterward. See [authoring](../development/create.md) and [State/Storage](../development/state-storage.md).

## Inputs, Agents and compiled protocol

The SDK depends only on Zod. Inputs are fixed to `prompt`, `files`, `dirs`, and `urls`. Every declared slot is required; undeclared slots are rejected. `parseLoomInput` validates and detaches values without reading file, directory, or URL references.

Model purposes are `thinking`, `working`, and `coding`. `AgentSpec.outputSchema` must parse to `StepResult`; the host still validates actual results and routing. `endsAgent(output)` can close subsequent Tools after a successful temporary submission, but neither commits formal data nor replaces the final outcome.

The current artifact protocol is `2026-10-15`, declared by `type: loom` and `version` inside `package.json.loom`. `loomModuleSchema` checks structure without executing Code, Tools, initializers, or business schemas. Shared identifier rules are `loomNameSchema`, `codeIdSchema`, and `agentIdSchema`. Compiler generates stable IDs; Kernel checks references, assets, and registration conflicts.

## Recovery and boundaries

`CodeRecovery` discriminates questions and confirmation by `kind`, with `actionId` and matching `request`/`answer` types. `codeRecoverySchema` checks this structure. The host also validates ownership and complete answers; the Loom must check that its business revision still matches the original request. Recovery must not replay earlier effects.

Runtime cursors, storage snapshot types, and framework contexts belong to Kernel. Deprecated `Query` and `SnapshotCategory` aliases are removed. Rebuild and reinstall artifacts using older protocols.
