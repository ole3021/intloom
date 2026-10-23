---
title: Restart and recovery
---

# Restart and recovery

Stopping the Service suspends execution and preserves checkpoints under `.intloom/runtime/`. Startup validates the entire recovery set before launching compatible unfinished Runs.

| Saved boundary | Restart behavior |
| --- | --- |
| Completed Step result | Apply its validated route without executing that Step again |
| Human wait with `ExecutableCode.recover` | Preserve action identity; accepted answers enter recovery with a fresh Call |
| Accepted answer awaiting delivery | Deliver through the explicit recovery entry, never repeat the Code prefix |
| Human wait without recovery support | Report `RUN_INTERRUPTED` |
| Executing Code, model or delegated Agent wait | Report uncertain execution; do not replay external effects |
| Terminal Run | Load a read-only historical view; retain formal data and known commit references |

Recovery restores Stage State and new capabilities. It cannot restore JavaScript locals, Promises, old Access objects, Agent claims or old-instance metrics. An accepted answer is saved before delivery; a checkpoint marks execution before continuation starts. Loom authors must provide `ExecutableCode.recover` at supported human-interaction boundaries.

Preserve the original operation and Service instance IDs. Receipt queries distinguish a found receipt, a missing receipt and a changed instance. Use `runs --operation-id UUID --origin-instance OLD` to find the Run created by that operation after restart; do not replay an old-instance mutation.

Checkpoint format 3 is intentionally incompatible with older formats. Corrupt or incompatible checkpoints can block startup and are preserved for inspection. There is no automatic migration or speculative replay. `recover --dry-run` and `recover` handle stale process resources, not business State or uncertain side effects.

Deleting `.intloom/` or formal `intloom/` data can discard identity, recovery or committed results. Logs cannot reconstruct these resources. For an explicit historical experiment, use [execution mirrors](./mirrors.md); the restored branch stays paused until `resume`.
