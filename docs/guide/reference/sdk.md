---
title: Workflow SDK reference
---

# Workflow SDK reference

Import public contracts from `@intloom/workflow-sdk`. No subpath or private Kernel dependency is needed.

## Definitions and execution

| Contract | Meaning |
| --- | --- |
| `Blueprint`, `BlueprintStage` | Initialized topology, entries, routing, Stage Schema/initializer |
| `StageStateInitializer` | Run context to JSON Schema input on Stage entry |
| `WorkflowModule` | Named `blueprint`, `codes` and `agentSpecs` exports |
| `ExecutableCode` | Code call plus optional recovery continuation |
| `StepResult` | Only `outcome: string` |
| `CodeExecutionAccess` | State, writable Storage, interaction, signal, optional Project |
| `AgentExecutionAccess` | State, read-only Storage, signal, optional Project |

## StateAccess

`value` is a recursive read view or undefined. `create(value)` requires absence. `update(value)` replaces existing State. `clear()` is idempotent. The host parses writes and preserves prior values on failure.

## Storage

Read access provides getArtifact(flowName, stageName), getArtifactById, getLatestRecord, getRecordById, listArtifacts and listRecords. Missing SDK reads return undefined. Lists use `{ data, nextCursor? }`.

Writable access adds `commit(operations)`. Operations are create_artifact, replace_artifact, append_record, remove_artifact and remove_record. Replace/remove Artifact requires expectedRevision. Results report writtenArtifacts, appendedRecords and removed IDs.

`StorageQuery` supports flowName, stageName, ids, createdAfter/Before, order, limit and cursor. These SDK queries are broader than client list flags.

## Interaction and Tools

`InteractionAccess.askQuestions` returns the complete answer array; `confirm` returns isConfirmed/optional feedback. Runtime owns action identity and lifetime. Workflow Code owns business confirmation rules.

`defineAgentTool` infers parsed input and raw output. `AgentTool<Input, Output, RawOutput = Output>` separates parser output from execute's result. Host parsers and JSON checks enforce the boundary.

`getAgentExecutionAccess` checks a framework adapter's `intloom.execution` binding; ordinary Tools receive access explicitly.

## ProjectAccess and lifetime

`snapshot`, `read`, `write`, `remove` and `run` provide host-bound engineering operations. Commands use argument arrays and optional cwd/timeoutMs; results retain exitCode, stdout/stderr, timeout and truncation.

Every access belongs to a current call. Await operations and do not retain capabilities afterward. See [authoring](../development/create.md) and [State/Storage](../development/state-storage.md).
