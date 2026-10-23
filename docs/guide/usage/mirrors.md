---
title: Local execution mirrors
---

# Local execution mirrors

Mirrors capture supported safe execution boundaries for local inspection and controlled replay. Enable them explicitly in the source project's configuration:

```yaml
mirror:
  enabled: true
  files:
    include: []
    exclude: []
```

Declare business-file rules for your project; automatic exclusions protect host-owned paths. A published image includes Stage State, formal Storage and its declared file scope. Images live under `.intloom/mirrors/`.

## Restore into another project

Prepare an independent initialized target with the current compatible Workflow and config, stopped Service, and empty business data. Obtain actual IDs from list/inspect:

```sh
intloom mirror list --json
intloom mirror inspect MIRROR-ID --json
intloom mirror restore MIRROR-ID --to ../experiment --scope loom --dry-run
intloom mirror restore MIRROR-ID --to ../experiment --scope loom
intloom start --project ../experiment
intloom resume RUN-example --project ../experiment
intloom mirror export TRACE-ID --to ../mirror-export
```

Restore and startup leave the Run paused. After a scope completes, explicitly choose the next scope with `resume --scope loom`.

| Scope | Stop boundary |
| --- | --- |
| `step` | One Step; requires a real `step_before` image |
| `stage` | Current Stage visit, before the next initializer |
| `loom` | Remaining supported execution |

`step_after` routes the saved result without repeating the call. Terminal images support inspection/export only. Current position, routing, Schema, and execution policy must remain compatible.

Capture failure pauses the Run; resume retries capture. Persistent failure can be explicitly abandoned with `resume RUN-example --scope loom --abandon-mirror`. No automatic downgrade occurs.

Mirrors omit external services and cannot reverse messages or remote writes. They contain raw business data. File limits are 64 MiB per file, 1 GiB per image, and 10,000 entries. Retain any incomplete restore marker until that attempt's created content is inspected and cleaned.
