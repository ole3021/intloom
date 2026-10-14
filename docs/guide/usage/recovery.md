---
title: Restart and recover execution
---

# Restart and recover execution

A normal Service stop suspends execution and preserves checkpoints under `.intloom/runtime/`. Startup restores compatible unfinished Runs at supported boundaries.

## What can continue

| Boundary | Behavior |
| --- | --- |
| Saved Step result | Advance routing without repeating that Step |
| Code waiting with `ExecutableCode.recover` | Deliver the saved action/answer to the recovery continuation |
| Code waiting without recovery support | Becomes `RUN_INTERRUPTED` |
| In-flight uncertain effect or external Agent call | Cannot reconstruct the original call |
| Terminal Run | Formal data remains; terminal checkpoint is not loaded as live history |

Recovery restores Stage business State and fresh capabilities. It cannot recreate JavaScript local variables, promises, Agent claims, or old instance statistics. Intent's Specification question/confirmation waits support recovery; its Solution waits currently require the live Service.

## Operational sequence

Inspect existing work before stopping, retain exact compatible Workflow resources, restart, then query the recovered Run. Damaged or incompatible checkpoint files can block startup without being deleted.

`recover --dry-run` and `recover` address stale process resources. They do not repair business State or retry an unknown effect.

Keep `.intloom/` and formal `intloom/` data. Deleting either can remove connection identity, unfinished recovery, or committed outputs. No reconstruction from logs is provided.

For a deliberately restored experiment, use [local execution mirrors](./mirrors.md); those Runs remain paused until explicit `run resume`.
