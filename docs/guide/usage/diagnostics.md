---
title: Logs and diagnostics
description: Diagnose configuration, package loading, service ownership, and execution failures.
---

# Logs and diagnostics

Start by identifying whether the issue is installation, service startup, entry readiness, or an existing Run.

```sh
intloom status
intloom doctor --execution cli
intloom workflow list
```

For external MCP, use `doctor --execution agent_ide`. Offline checks inspect saved configuration and installation integrity without importing Workflow code or calling models. Online checks ask the current host for the selected entry's readiness.

Doctor can finish successfully while reporting `attention` or `not_checked`. Inspect individual checks in text or JSON. `available` readiness does not validate a remote model response.

## Read retained logs

```sh
intloom logs <runId>
intloom logs <runId> --debug
intloom logs --service --follow --info
intloom logs --service --json --debug
```

Logs work offline. `--follow` observes new files after restart without starting a service. Run ID and `--service` are mutually exclusive. Stop following with Ctrl+C.

For progress during a command, add `--info` or `--debug`. Default commands do not display service logs. Business JSON remains on stdout and progress goes to stderr; explicit `logs --json` emits JSONL on stdout.

Each service instance keeps one `.intloom/logs/LOG-<timestamp>.jsonl` file. Logs contain identifiers, events, timings, usage, and classified errors rather than original intents, answers, prompts, raw Tool payloads, or credentials. They are diagnostics, not recoverable execution state.

## Common situations

| Symptom | Next step |
| --- | --- |
| No Workflows | Install a package while the service is stopped |
| Installed package but no executable Workflow | Read `flows` loading diagnostics; check metadata, protocol, and generated exports |
| CLI lacks model configuration | Add `llms.default`, supply startup credentials, and restart |
| MCP is ready but CLI is not | Check execution selection; the entries have different model requirements |
| Service reports `recovery_required` | Inspect owners with doctor; follow [Recovery](./recovery.md) |
| Service reports `blocked` | Resolve unknown/active owners, occupied port, or invalid metadata; do not force-delete locks |
| Agent wait appears idle | Check that the MCP client claims and completes tasks; the connection does not wake it automatically |
| Model request or structured output fails | Inspect the Run error and logs; check endpoint, model, Tool support, and output limits |
| Request timed out | Query the original Run; timeout does not imply cancellation |
| Host check fails only on another machine | Verify executable versions and arguments inherited by the host |
| Failed after saving data | Read Records/Artifacts before creating replacement work |

## Logging failures

A log write failure rejects new work and stops active execution at boundaries. Status reports `logError`, and `stop` remains available. Already committed effects are preserved. Retention removes closed files older than 14 days or to make room within a 1 GiB directory budget; the active service file does not rotate.

See [Error reference](../reference/errors.md) for error categories and [Recovery](./recovery.md) for safe restart behavior.
