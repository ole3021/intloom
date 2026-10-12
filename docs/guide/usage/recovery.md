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

Normal shutdown preserves committed data, connection identity, and unfinished checkpoints. Ordinary crash recovery verifies exact Workflow identity and Stage schemas before continuing supported execution boundaries. Paused mirror branches use the mirror rules below.

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

## Local execution mirrors

Mirrors are disabled by default. When enabled, each reached safe boundary gets a complete independent copy of its Run/Stage checkpoint, all formal project Artifacts/Records, and bytes in the declared business file scope.

```yaml
mirror:
  enabled: true
  files:
    include: ["dist/**"]
    exclude: ["scratch/**"]
```

`dist/` is excluded by default and can be included explicitly. Configuration, credential files, `.git/`, `.intloom/`, dependencies, formal Storage and actually loaded Workflow Code stay protected. `inspect` includes the file scope/exclusions, raw and parsed State, verified routing, formal data, provenance, observation baseline and a simple previous-image diff. Images live under `.intloom/mirrors/runs/<traceId>/`; retention is manual and there is no automatic upload.

```sh
intloom mirror list --project ./source --json
intloom mirror inspect <mirrorId> --project ./source --json
intloom mirror restore <step-before-id> --project ./source --to ../case-step --scope step
intloom start --project ../case-step
intloom run resume <runId> --project ../case-step
intloom run resume <runId> --project ../case-step --scope workflow
intloom mirror export <traceId> --project ./source --to ../mirror-data
```

Prepare the target with its current configuration and Workflow, stop its host, and leave business files, formal Storage and checkpoints empty. Restore does not install Code, overwrite data, switch backend types or accept force. `--dry-run` validates and returns the write plan. Each restore preserves business runId and formal IDs/revisions/timestamps, creates a new traceId, leaves the source unchanged and copies files without writable hard links.

Restore and subsequent host startup leave the Run `paused/restored`. Explicit resume runs the saved scope. After scope completion a new scope is required. Default `wait` returns on pause; `--until terminal` can keep observing.

| Scope | Start and stopping point |
| --- | --- |
| `step` | Actual `step_before` only; one call, then save `step_after` and pause before applying routing |
| `stage` | Workflow entry, before/after initialization or a Step within the visit; stop after this visit exits, before initializing the next Stage |
| `workflow` | Continue the remaining Workflow from any supported nonterminal safe boundary |

`stage_before_init` tests the current initializer. `stage_start` and `step_before` load saved State without initializing again, including an initialized binding cleared to no value. `step_after` applies its saved outcome without repeating the call and therefore rejects step scope. `stage_end` continues from the saved target, treats old State as exited history and rejects stage scope. Terminal images are inspect/export only. Actual completion/failure remains terminal even when a scope ends.

Changed Code identity produces a warning, but current positions, routing, execution policy and Schema must still be compatible. Reparse the saved original input and require structural equality with saved value. `MIRROR_RESTORE_FAILED` reports a concrete cause; there is no migration, repair or automatic restart from the beginning. Manually run the Workflow from the start to generate fresh images. Errors after successful restore and explicit execution retain execution error codes.

Capture failure pauses at the fixed safe boundary with `mirror_capture_failed`. Explicit resume retries capture; an already returned Step is not called again. An unfinished target has `.intloom/restore.lock`: keep the host stopped, inspect its temporary area, plan and created paths, clean only this attempt's new content, then clear the marker. Startup never runs a partial restore.

For exact resume retries retain the original `--instance`, `--operation-id`, `--revision` and scope parameters. The same request returns its original receipt; changed instances/revisions conflict.

Mirrors cover controlled local writes. Avoid editor/other-process writes during capture; detected changes reject publication. Current explicit limits are 64 MiB per file, 1 GiB of file bytes per image and 10,000 entries. No external database/service is copied, and messages or other external effects are not reversed. Replaying a Step may repeat them. Business State and formal data are not anonymized; inspect content before export.

For persistent capture failure, explicitly use `run resume <runId> --scope workflow --abandon-mirror` to stop capture for this Run. The checkpoint retains captureDisabled and its cause; omitted images are never reported as complete. Step/stage scope cannot use abandonment.
