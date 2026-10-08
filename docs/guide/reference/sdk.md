---
title: Workflow SDK reference
description: Public execution, State, Storage, interaction, and Agent Tool contracts.
---

# Workflow SDK reference

Import public Workflow contracts from `@intloom/workflow-sdk`. It depends on Utils and Zod, not the private Kernel, model providers, database drivers, or Mastra.

## Definition and execution types

| Export | Contract |
| --- | --- |
| `Blueprint` | `flowName`, optional `exclusive`, entry Stage, and Stage definitions |
| `BlueprintStage` | State Schema, initializer, entry Step, Steps, and Stage outcome routes |
| `BlueprintStep` | Code/Agent execution reference and Step outcome routes |
| `StageStateInitializer` | Receives Run/Workflow/Stage identity and intent; returns JSON Schema input, synchronously or asynchronously |
| `StepResult` | `{ readonly outcome: string }` |
| `ExecutableCode` | `(input, access) => StepResult \| Promise<StepResult>`, with optional `recover(saved, access)` |
| `AgentSpec` | Instructions, model role, output Schema, Skills, and declared Tools |
| `WorkflowModule` | Named `blueprint`, `codes`, and `agentSpecs` resources |

`CodeRecovery` contains the saved action `{ id, kind, request }` and accepted answer. The recovery function uses restored State and fresh capabilities rather than the old function's local variables.

## StateAccess

| Member | Behavior |
| --- | --- |
| `value` | Read-only business value, or `undefined` when absent |
| `create(value)` | Create only when absent; validate with the Stage Schema |
| `update(value)` | Replace the complete existing value; no implicit merge |
| `clear()` | Idempotently remove the value; no automatic reinitialization |

`CodeExecutionAccess` includes State, writable Storage, interaction, cancellation signal, and optional project access. `AgentExecutionAccess` includes State, read-only Storage, signal, and optional project access. Capabilities expire with the execution.

## StorageReadAccess

- `getArtifact(flowName, stageName)` and `getArtifactById(id)` return a stored Artifact or `undefined`.
- `getLatestRecord(flowName, stageName)` and `getRecordById(id)` return a stored Record or `undefined`.
- `listArtifacts(query)` and `listRecords(query)` return `{ data, nextCursor? }`.

`StorageQuery` accepts `flowName`, `stageName`, `ids`, `createdAfter`, `createdBefore`, `order`, `limit`, and `cursor`. Order is `created_asc` or `created_desc` (default). Limit defaults to 50 and cannot exceed 200. Keep cursor query parameters consistent. The public CLI exposes a narrower query surface.

`StoredArtifact` contains `id`, `flowName`, `stageName`, positive `revision`, JSON `data`, and creation/update timestamps. `StoredRecord` contains the same identity/location/data fields and a creation timestamp, without a revision.

## StorageAccess.commit

`commit(operations)` applies an atomic batch. Duplicate targets within the same category and ID are invalid.

| Operation `type` | Required data |
| --- | --- |
| `create_artifact` | `id`, `payload` |
| `replace_artifact` | `id`, `expectedRevision`, `payload` |
| `append_record` | `id`, `payload` |
| `remove_artifact` | `id`, `expectedRevision` |
| `remove_record` | `id` |

`payload` is `{ flowName, stageName, data }`. The result contains `writtenArtifacts`, `appendedRecords`, `removedArtifactIds`, and `removedRecordIds`. Revision checks prevent stale replacement/removal; they do not provide historical reads.

## InteractionAccess

`askQuestions(questions)` accepts a nonempty flat array. Each question has `id`, `question`, `isSkippable`, optional `description`, and optional `{ id, label, description? }` options. Answers use `questionId`, `isSkipped`, and answer text when not skipped.

`confirm(context)` returns `{ isConfirmed, feedback? }`. Exported `userAskQuestionsSchema`, `userAnswerQuestionsSchema`, `userAskConfirmationSchema`, and `userAnswerConfirmationSchema` define the JSON contracts. Business rules such as required feedback remain the Workflow's responsibility.

## AgentTool

`defineAgentTool({ id, description, inputSchema, outputSchema, execute })` preserves Zod type inference. `execute(input, access)` can be synchronous or asynchronous. Original parsers execute in the host; client descriptions contain JSON Schemas.

`AgentTool<Input, Output, RawOutput = Output>` distinguishes parsed input, parsed output, and raw output. `execute` receives the input Schema's parsed value and returns input for the output Schema; the host parses that return value into the final result. For `z.string().transform(Number)` as the output Schema, return a string from `execute`, not the parsed number. The helper infers these types from Schemas without widening them to accommodate an invalid implementation. Existing two-parameter annotations remain suitable when the output Schema's input and output types agree.

An output transform with no representable output shape is advertised as unconstrained. Use an explicit output Schema after the transform, such as `.pipe(z.number())`, when clients need that shape. Tool results and final parsed Agent results must cross the JSON boundary.

`getAgentExecutionAccess(context)` reads the `intloom.execution` binding for adapter integration. It validates every required State/Storage method, the State value member, cancellation signal, and optional Project methods; writable Storage and interaction are rejected. Validation does not read business State or invoke capability methods. Invalid bindings and lookup/inspection failures use `STEP_EXECUTION_FAILED`. Ordinary SDK Tools receive access directly and do not need a framework-specific request context. The host owns capability lifetime enforcement.

## ProjectAccess

Methods are `snapshot()`, `read(path)`, `write(path, content)`, `remove(path)`, and `run(command, signal?)`. Project access is optional; its root and lifetime are host-bound.

`ProjectCommand` contains `command`, `args`, optional `cwd`, and optional `timeoutMs`. Results contain that command, `exitCode`, `stdout`, `stderr`, `timedOut`, and `truncated`. Commands do not use implicit shell parsing.

The CLI host limits text operations to 1 MiB, file snapshots to 10,000 files and 16 MiB per file, and command timeouts to 300 seconds (default 60). It rejects symlinks and excludes generated/private paths from snapshots, including `.git`, `.intloom`, `intloom`, `node_modules`, `dist`, `coverage`, `.turbo`, `.env*`, `.dev.vars*`, and IntLoom configuration. A snapshot is therefore not a complete audit of all process-accessible files.

## Metadata and compatibility

`workflowProtocolVersion` is `2026-10-08`; `workflowMetadataSchema` validates the protocol declaration. Protocol and npm package versions serve different purposes. `Query` and `SnapshotCategory` are deprecated aliases; use `StorageQuery` and `StorageCategory` in new code.
