---
title: CLI reference
description: Commands, global options, offline behavior, and output conventions.
---

# CLI reference

Syntax: `intloom [global options] <command>`. Use `intloom --help` or `intloom <command> --help` for the installed version.

## Global options

| Option | Behavior |
| --- | --- |
| `--project <directory>` | Select the exact project root; otherwise discover from the current directory |
| `--json` | Emit structured output without interactive prompts |
| `--no-interactive` | Disable terminal prompts |
| `--no-color` | Disable color |
| `--info` | Display service logs at info level and above |
| `--debug` | Display debug and above; takes precedence over info |
| `--version` | Print CLI version |

## Project and service

| Command | Options and behavior |
| --- | --- |
| `init [directory]` | New/empty target only; repeat `--workflow <package-or-tgz>` to install packages. Positional directory and explicit `--project` are mutually exclusive. Does not start the host. |
| `start` | Start or reuse a project host. `--port <n>` selects a port. Select `localStorage` in `intloom.yaml`. |
| `stop` | Stop the observed service instance. Normal offline state succeeds idempotently; unsafe/stale resources can fail. |
| `status` | Report service state and Run counts; distinguish offline, recovery-required, and blocked states. |
| `doctor` | Inspect diagnostics; `--execution cli\|studio\|agent_ide` selects readiness, default `cli`. |
| `recover` | Clean eligible stale resources after owner exit; `--dry-run` previews only. |
| `config codex` | Print project connection configuration without modifying IDE files. |

## Installed packages and loaded Workflows

| Command | Behavior |
| --- | --- |
| `workflow add <package-or-tgz>` | Install into an `intloom.yaml` project with its service stopped |
| `workflow remove <package>` | Remove a declaration while retaining formal results |
| `workflow list` | Inspect declarations and installation integrity offline |
| `flows` | Query loaded names, loading diagnostics, and CLI readiness from the live host |

A package name is not necessarily the execution `flowName`. There is no update command; stop, remove, add, and restart when replacing a package.

## Runs

| Command | Options and behavior |
| --- | --- |
| `flow [flowName]` | Create a Run. `--intent <text>` or `--intent-file <file>` supplies intent; `-` reads stdin. Interactive mode can prompt for missing values. |
| `runs` | List current-host Runs; optional `--flow <flowName>` |
| `attach <runId>` | Inspect and answer an existing Run |
| `cancel <runId>` | Explicitly stop that Run; repeated cancellation preserves terminal state |

## Results

| Command | Options and behavior |
| --- | --- |
| `record <recordId>` | Read one immutable Record |
| `artifacts` | List metadata. `--flow`, `--stage`, `--limit` (1–200; default 50), `--cursor` |
| `artifact [artifactId]` | Read by ID, or by both `--flow` and `--stage`; do not combine selectors |
| `artifact … --output <file>` | Export the complete object locally; parent must exist, and `--overwrite` is required for an existing file |

Result queries require a running host. Artifact list entries omit business data; detail queries include it.

## Logs

`logs [runId]` accepts `--service`, `--follow`, and the global logging/JSON options. Run ID and `--service` are mutually exclusive. Logs are available offline. Follow observes retained files and restarts without opening a service connection.

## Output and exit status

Noninteractive `flow` requires both the Workflow name and nonempty intent. A waiting Run returns normally; exit 0 is not evidence of completion. Failed or stopped `flow`/`attach` returns nonzero. Successful queries and cancellation return 0.

Common JSON envelopes are `{ run }`, `{ artifact }`, `{ artifacts: { data, nextCursor? } }`, and `{ record }`. Initialization returns `{ projectRoot, status: "scaffolded" }`; stop returns `{ projectRoot, stopped }`. Missing detail results can be `null`. Business errors expose a classified error with `code`, `message`, and `retryable`.

Business JSON goes to stdout, progress to stderr. `logs --json` is the exception that intentionally streams log JSONL to stdout. Automation should inspect returned states and fields, not parse colored presentation text.
