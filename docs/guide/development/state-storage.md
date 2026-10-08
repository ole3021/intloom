---
title: State and formal Storage
description: Validate drafts, commit formal outputs atomically, and handle revision conflicts.
---

# State and formal Storage

Use Stage State for work in progress. Use Storage when a result must become formal project data. Updating State does not automatically save an Artifact or Record.

## Define JSON State

```ts
import * as z from "zod";

export default z.strictObject({
  runId: z.string(),
  intent: z.string(),
  approved: z.boolean().default(false),
});
```

The initializer returns Schema input. Creation, updates, and recovery enforce the Schema and JSON boundary. Use strings for serialized dates and omit undefined fields; functions, class instances, and execution capabilities do not belong in State.

`access.state.value` is a read view. `update(next)` replaces the whole existing value; it does not merge a patch. `create` requires absence, and `clear` is idempotent. A failed update preserves the previous value. Clearing does not restart the initializer.

Separate model proposals from Code-owned fields. Zod can validate structure, but application Code still needs to validate references, source versions, confirmation ownership, and business rules.

## Commit Artifacts and Records

A Code Step can write related results in one atomic batch:

```ts
await access.storage.commit([
  {
    type: "create_artifact",
    id: artifactId,
    payload: { flowName, stageName, data: result },
  },
  {
    type: "append_record",
    id: recordId,
    payload: { flowName, stageName, data: changeRecord },
  },
]);
```

This is a fragment inside an `ExecutableCode`; the Workflow defines the identifiers and JSON payloads. An Artifact is unique for its Workflow/Stage location. To replace one, read its current revision and use `replace_artifact` with `expectedRevision`. Do not remove and recreate it to bypass conflict checks.

An immutable Record can be appended or explicitly removed, but not replaced. Agent Tools receive only `StorageReadAccess`; formal commit belongs to Code.

## Handle failure boundaries

Atomicity covers the Storage batch. It does not include project file edits, model requests, State updates, or checkpoint writes. A successful commit followed by another failure remains committed.

If a workflow supports a repeatable finalize path, use deterministic identities and verify any existing committed payload before treating a retry as already complete. Do not blindly replay a commit after an unknown result. The framework does not expose automatic failed-Run retry.

Keep the baseline revision or digest in State when an operation depends on an earlier Artifact. Revalidate it after waits and before committing; another actor may have changed formal data.

## Query deliberately

Storage reads return `undefined` for missing entries. The CLI and ProjectClient normalize missing detail queries to `null`. Lists return `{ data, nextCursor? }`, with default limit 50 and maximum 200. Keep a cursor's filters and limit unchanged.

A later Stage should read committed upstream data, not depend on the previous Stage's released in-memory value. See [SDK reference](../reference/sdk.md) for operations and [Results](../usage/results.md) for user-facing queries.
