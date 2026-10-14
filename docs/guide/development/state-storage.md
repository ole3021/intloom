---
title: Develop State and formal Storage
---

# Develop State and formal Storage

Define each Stage's business Schema and initializer. The host validates initializer input and each State write.

## Update complete State

Parse `access.state.value` with your Schema, construct a replacement JSON value, and await `state.update`. `create` requires an absent value; `clear` removes it without automatic reinitialization. Read views must not be mutated.

Cross-stage context should be initialized from deliberately saved Artifacts/Records and the actual Run identity.

## Commit formal data

Only Code receives writable Storage. For example, create one Artifact and append one Record atomically:

```ts
await access.storage.commit([
  {
    type: "create_artifact",
    id: "draft-1",
    payload: {
      flowName: "review",
      stageName: "review",
      data: { approved: true },
    },
  },
  {
    type: "append_record",
    id: "review-1",
    payload: {
      flowName: "review",
      stageName: "review",
      data: { decision: "approved" },
    },
  },
]);
```

This is a Code-body fragment. Choose unique IDs for real execution; these fixed IDs cannot be reused for repeated creation.

Replacing/removing an Artifact requires its observed `expectedRevision`. A batch rejects duplicate category/ID targets. Record payloads remain immutable, though Code can explicitly remove a Record.

Commit atomicity covers supplied Storage operations, not State updates, file changes, model calls or subsequent steps. Keep prior successful commit evidence after failure rather than assuming rollback.

See [SDK operations](../reference/sdk.md) and [data concepts](../concepts/data.md).
