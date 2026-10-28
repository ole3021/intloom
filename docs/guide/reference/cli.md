---
title: CMD command reference
---

# CMD command reference

See [Loom Package 0.10](./loom-package.md) for JSON input, formal output, model profiles, named interactions and new/check/inspect commands. Legacy calls and configuration remain supported.


Use `intloom COMMAND --help` for positional arguments and installed-version help.

## Global flags

`--project PATH` selects the exact root. `--json` selects machine output. `--no-interactive` disables setup choices; `--no-color` disables colors. `--info`/`--debug` enable safe diagnostics on stderr. `--version` and `--help` inspect the entry.

## Commands

| Command | Inputs and behavior |
| --- | --- |
| `init [directory]` | New/empty directory; repeatable `--loom SOURCE`, `--mcp codex`, optional `--start`; reports each setup step |
| `start` | Optional `--port 0..65535`; starts or reuses Service |
| `stop` | Optional `--instance ID`; verifies shutdown |
| `status` | Verified project Service state |
| `doctor` | `--execution cli\|studio\|agent_ide`, default cli; readiness only |
| `recover` | Optional `--dry-run`; eligible stale resources |
| `loom list` | Installed package identities |
| `loom add SOURCE` | Registry package or local archive; stopped Service required |
| `loom remove PACKAGE` | Removes package; stopped Service required |
| `looms` | Loaded Loom definitions and availability |
| `run NAME` | `--prompt TEXT` or `--prompt-file FILE`; `-` reads stdin; admission receipt |
| `runs` | Optional `--loom NAME`; active Runs and retained terminal history |
| `attach RUN` | Current Run snapshot; optional `--instance ID` |
| `answer RUN` | Required `--action ID` and `--answer JSON` or `--answer-file FILE`; admission receipt |
| `cancel RUN` | Optional `--instance ID`; explicit cancellation |
| `operation UUID` | Optional `--instance ID`; admission receipt lookup |
| `wait RUN` | `--until action_or_terminal\|terminal`, positive millisecond `--timeout`, optional `--instance` |
| `watch [RUN]` | Project or Run snapshots; optional `--instance`; Ctrl+C ends observation |
| `artifacts` / `records` | Optional `--loom`, `--stage`, `--limit 1..200`, `--cursor` |
| `artifact [ID]` | ID or `--loom` plus `--stage`; `--output FILE`, optional `--overwrite` |
| `record ID` | Read Record details |
| `config show` | Safe configuration with revision |
| `config set` | Required `--file FILE --revision HASH`; complete replacement |
| `config codex` | Preview Codex configuration plan |
| `mcp init` | `--ide codex` and optional `--plan` |
| `mcp serve` | Stdio proxy; optional `--ide codex`; connects to existing Service |
| `logs [RUN]` | Optional `--service`, `--follow`; text or JSON Lines |
| `mirror list` / `mirror inspect ID` | List boundaries or inspect raw image |
| `mirror restore ID` | Required `--to PROJECT`; `--scope step\|stage\|loom`, default loom; optional `--dry-run` |
| `mirror export TRACE` | Required `--to NEW-DIRECTORY` |
| `resume RUN` | Optional `--scope`, `--revision`; `--abandon-mirror` requires loom scope |
| `tui` | Persistent TUI; also the no-command entry |

## Write identity and output

`run`, `answer`, `resume`, `cancel` and `pause` accept `--instance` and `--operation-id` together for explicit replay. Preserve original parameters. Resume also binds an observed Run revision.

Ordinary JSON is `{ ok: true, data, meta }` or `{ ok: false, error, outcome, meta, data? }`. Error outcome is `not_applied`, `applied` or `unknown`. Meta retains known request/project/instance/operation/Run identities. Receipt state is independent from Run status.

Streams use JSON Lines. Non-JSON output is readable text. Default query page size is 50. Export writes JSON locally with exclusive creation unless overwrite is explicit.

See [CMD usage](../usage/cmd.md), [Run actions](../usage/runs.md) and [mirrors](../usage/mirrors.md).

## e2e

```sh
intloom build ./my-loom
intloom e2e ./my-loom --list
intloom e2e ./my-loom --case S01 --root /absolute/e2e-results
intloom e2e ./my-loom --case M01 --entry mcp --root /absolute/e2e-results
```

Runs a local Loom project's `e2e/` cases against its existing `dist`. Omitted path uses the current directory; CMD is the default. No compilation or registry-case discovery occurs. `--profile` selects a YAML/JSON model mapping; secrets are environment references. Cases contain ordered `rounds`, SDK `input` slots and user knowledge. The simulated user answers real questions; separate MCP workers execute host tasks. Independent Loom-owned checks run after each settled Run. Results, actual Run IDs and evidence are retained under `--root`; failed attempts are not automatically repaired or replayed. `--seed` reproduces case selection only. `--list` requires neither a model nor a build.

E2E progress goes to stderr; its final summary is JSON on stdout. Exit codes are 0 passed, 1 failed, 2 blocked, and 130 interrupted. No case checks means `not_configured`, not business acceptance.

## Kernel operation identity and recovery queries

`run`, `answer`, `resume`, `cancel` and `pause` accept `--instance` and `--operation-id`. A matching identity can only repeat the identical request. `pause RUN` requests a pause after the active Step settles.

Receipts are `pending`, `accepted`, `rejected` or `indeterminate`. Indeterminate means effects may have occurred: inspect before further work. Receipts live for the entire Service instance. `operation UUID --instance OLD` distinguishes `found`, `not_found` and `instance_changed`; an old-instance mutation is never replayed on the new instance.

`runs` includes retained terminal history. `runs --operation-id UUID --origin-instance OLD` finds the originating Run across restarts. Agent completion returns a submission receipt; query the Run separately.
