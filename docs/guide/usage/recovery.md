---
title: Stop, restart, and recover
description: Distinguish stale-resource cleanup from supported Run recovery and uncertain effects.
---

# Stop, restart, and recover

Recovery has two separate responsibilities: releasing stale service resources after a crash, and restoring supported Run checkpoints on a new host. `recover` performs the first; `start` handles the second.

## Normal restart

```sh
intloom stop
intloom start
intloom runs
intloom attach <runId>
```

Normal shutdown preserves committed data, connection identity, and unfinished checkpoints. A new host verifies Workflow identity and Stage schemas before restoring supported execution boundaries.

| Interrupted location | Behavior on restart |
| --- | --- |
| Safe Stage/Step boundary | Resume from the saved boundary |
| Completed Step with a saved outcome | Advance routing without repeating that Step |
| Code question/confirmation with `ExecutableCode.recover` | Restore the wait or continue its saved accepted answer |
| Code wait without `recover` | Fail with `RUN_INTERRUPTED` |
| In-flight effect with uncertain outcome | Fail with `RUN_INTERRUPTED`; no automatic replay |
| Client Agent task | Fail with `RUN_INTERRUPTED`; claim ownership and Tool receipts are not restored |
| Terminal Run | Keep the checkpoint for diagnostics, but do not reload it into `runs` |

Normal in-process answers resume the original Promise. Cross-process recovery uses a separate Code entry and saved business State. They are different mechanisms.

## After a crash

```sh
intloom doctor
intloom recover --dry-run
intloom recover
intloom start
```

Cleanup requires verifiably absent owners and valid connection metadata. Active or unknown PIDs, occupied ports, invalid metadata, and unsafe locks block it. Startup does not automatically remove stale locks or kill saved PIDs.

`recover` does not replay Steps, repair business data, undo file edits, or validate formal Storage. Use the resulting Run diagnostics and committed data to decide the next action.

## Preserve the original resources

Checkpoints live under `.intloom/runtime/`. Recovery verifies package/protocol versions and resource contents. Keep the exact installed Workflow available until its Runs finish; recompiling or replacing it can prevent recovery.

Corrupt or incompatible checkpoints are reported and retained. Unfinished files are not automatically removed. Deleting them and then terminating the host abandons those executions; logs and Artifacts cannot reconstruct missing Run State.

`cancel` explicitly ends a Run and does not schedule recovery. There is no public retry-failed-Run command. When an effect's outcome is uncertain, inspect formal data and actual project files before beginning another Run.

If checkpoint saving fails with `RUN_CHECKPOINT_FAILED`, execution stops. A successful earlier business commit is not rolled back by a checkpoint error.

Workflow authors should read [Restartable interaction](../development/interaction.md) before promising resumable waits.
