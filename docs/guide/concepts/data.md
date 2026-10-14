---
title: State, Artifacts, Records, and Storage
---

# State, Artifacts, Records, and Storage

| Data | Purpose and lifetime |
| --- | --- |
| Stage State | Mutable business workspace for the current Stage visit |
| Artifact | Current formal Workflow/Stage output with a revision |
| Record | Appended immutable business entry |
| Run observation | Instance-local status, activity, metrics and result references |

State writes are validated by the Stage Schema. `create` requires absence; `update` replaces a complete value; `clear` is idempotent. State is not automatically copied into another Stage or committed as an Artifact.

## Formal persistence

Workflow Code commits Artifact and Record operations atomically within one Storage batch. The host supplies File or SQLite implementation. This atomicity is separate from State updates, project files, model calls and other external effects.

Artifacts can be replaced with revision checks; their current value is not a complete version archive. Records preserve appended entries. A Workflow chooses IDs and business payloads.

## Checkpoints and mirrors

Runtime checkpoints preserve supported continuation boundaries and business State. They exclude old metrics and cannot restore the original promise. Mirrors add formal Storage and declared local files for independent paused replay.

Logs provide diagnostics, not State reconstruction. See [results](../usage/results.md), [State/Storage authoring](../development/state-storage.md) and [mirrors](../usage/mirrors.md).
