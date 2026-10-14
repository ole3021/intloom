---
title: CMD command reference
---

# CMD command reference

Use `intloom COMMAND --help` for positional arguments and installed-version help.

## Global flags

`--project PATH` selects the exact root. `--json` selects machine output. `--no-interactive` disables setup choices; `--no-color` disables colors. `--info`/`--debug` enable safe diagnostics on stderr. `--version` and `--help` inspect the entry.

## Commands

| Command | Inputs and behavior |
| --- | --- |
| `init [directory]` | New/empty directory; repeatable `--workflow SOURCE`, `--mcp codex`, optional `--start`; reports each setup step |
| `start` | Optional `--port 0..65535`; starts or reuses Service |
| `stop` | Optional `--instance ID`; verifies shutdown |
| `status` | Verified project Service state |
| `doctor` | `--execution cli\|studio\|agent_ide`, default cli; readiness only |
| `recover` | Optional `--dry-run`; eligible stale resources |
| `workflow list` | Installed package identities |
| `workflow add SOURCE` | Registry package or local archive; stopped Service required |
| `workflow remove PACKAGE` | Removes package; stopped Service required |
| `flows` | Loaded Workflow definitions and availability |
| `flow NAME` | `--intent TEXT` or `--intent-file FILE`; `-` reads stdin; admission receipt |
| `runs` | Optional `--flow NAME`; current-instance Runs |
| `attach RUN` | Current Run snapshot; optional `--instance ID` |
| `answer RUN` | Required `--action ID` and `--answer JSON` or `--answer-file FILE`; admission receipt |
| `cancel RUN` | Optional `--instance ID`; explicit cancellation |
| `operation UUID` | Optional `--instance ID`; immutable admission receipt |
| `wait RUN` | `--until action_or_terminal\|terminal`, positive millisecond `--timeout`, optional `--instance` |
| `watch [RUN]` | Project or Run snapshots; optional `--instance`; Ctrl+C ends observation |
| `artifacts` / `records` | Optional `--flow`, `--stage`, `--limit 1..200`, `--cursor` |
| `artifact [ID]` | ID or `--flow` plus `--stage`; `--output FILE`, optional `--overwrite` |
| `record ID` | Read Record details |
| `config show` | Safe configuration with revision |
| `config set` | Required `--file FILE --revision HASH`; complete replacement |
| `config codex` | Preview Codex configuration plan |
| `mcp init` | `--ide codex` and optional `--plan` |
| `mcp serve` | Stdio proxy; optional `--ide codex`; connects to existing Service |
| `logs [RUN]` | Optional `--service`, `--follow`; text or JSON Lines |
| `mirror list` / `mirror inspect ID` | List boundaries or inspect raw image |
| `mirror restore ID` | Required `--to PROJECT`; `--scope step\|stage\|workflow`, default workflow; optional `--dry-run` |
| `mirror export TRACE` | Required `--to NEW-DIRECTORY` |
| `run resume RUN` | Optional `--scope`, `--revision`; `--abandon-mirror` requires workflow scope |
| `tui` | Persistent TUI; also the no-command entry |

## Write identity and output

`flow`, `answer` and `run resume` accept `--instance` and `--operation-id` together for explicit replay. Preserve original parameters. Resume also binds an observed Run revision.

Ordinary JSON is `{ ok: true, data, meta }` or `{ ok: false, error, outcome, meta, data? }`. Error outcome is `not_applied`, `applied` or `unknown`. Meta retains known request/project/instance/operation/Run identities. Receipt state is independent from Run status.

Streams use JSON Lines. Non-JSON output is readable text. Default query page size is 50. Export writes JSON locally with exclusive creation unless overwrite is explicit.

See [CMD usage](../usage/cmd.md), [Run actions](../usage/runs.md) and [mirrors](../usage/mirrors.md).
