---
title: CLI reference
description: CMD, TUI, project operations and JSON output.
---

# CLI reference

Requires Node.js >=26.4.0. `intloom` and `intloom tui` open the persistent TUI; the entry automatically enables experimental FFI. Other commands use CMD. Run `intloom <command> --help` for detailed arguments. Both interfaces call the same JSON Core; closing a client never cancels a Run or stops Service.

Global options: `--project`, `--json`, `--no-interactive`, `--no-color`, `--info`, `--debug`, `--version`. Explicit project paths require an exact root; otherwise CMD discovers the nearest marker. Execution is argument-driven; simple setup choices may use Clack.

CMD defaults to readable text, including when redirected: status summaries, compact lists, setup/check results, indented configuration and business data, and timestamped log lines. Empty results are explicit. Errors retain their code, partial setup results and original operation identity when the outcome is unknown. Artifact export reports the destination and writes JSON to the selected file. Add `--json` for structured results or JSON Lines; MCP stdio continues to use its wire protocol.

| Command | Behavior |
| --- | --- |
| `init [directory]` | Create a new/empty scaffold; repeat `--workflow`, optionally `--mcp codex`, `--start`. Report each step and retain partial successes. |
| `start`, `stop`, `status` | Start/reuse, verify release, or report running/stopped/unavailable Service. `stop --instance` pins a target. |
| `doctor --execution cli\|studio\|agent_ide` | Read-only readiness checks; no real model call. |
| `recover [--dry-run]` | Explicit eligible stale-resource cleanup. |
| `workflow list/add/remove` | Offline package management; changes require Service stopped. |
| `flows` | Loaded Workflow names, loading diagnostics and CLI readiness. |
| `flow <flowName>` | Full `--intent` or `--intent-file` (`-` for stdin); immediate admission receipt. |
| `runs [--flow name]`, `attach <runId>` | Current-instance list/snapshot; never implicitly answer. |
| `answer <runId> --action ID` | Complete `--answer` JSON or `--answer-file`; preserves actual answer and action identity. |
| `operation <UUID> --instance ID` | Inspect immutable admission receipt. |
| `wait <runId>` | Default action_or_terminal; `--until terminal`, `--timeout` milliseconds. No execution control. |
| `watch [runId]` | Run/project snapshots; Ctrl+C closes local observation. |
| `cancel <runId>` | Explicit cancellation; committed effects remain. |
| `artifacts`, `records` | Pages with flow/stage/limit/cursor; Artifact lists omit data. |
| `artifact [ID]`, `record <ID>` | Read committed data; Artifact also supports flow+stage selector and explicit file export. |
| `config show`, `config set --file FILE --revision HASH` | Safe configuration projection; optimistic full-file update for next Service start. |
| `mcp init --ide codex [--plan]` | Plan/apply project stdio configuration, preserving unrelated settings. |
| `mcp serve [--ide codex]` | Bidirectional stdio proxy to an existing Service; no private Runtime. |
| `config codex` | Preview the Codex plan. |
| `logs [runId] [--service] [--follow]` | Read/follow persisted logs; readable lines by default, JSON/JSON Lines with `--json`; works offline. |

Flow/answer generate a UUID and capture the Service instance. Explicit replay requires original `--operation-id`, `--instance` and parameters. No write is automatically retried. `outcome: unknown` retains identity for receipt inspection.

Normal JSON is `{ ok: true, data, meta }` or `{ ok: false, error, outcome, meta, data? }`. Streams use JSON Lines. Errors expose safe code/message/retryable only. `ok` describes the operation; Run status describes execution. Failed Run inspection may return nonzero; explicit successful cancel returns zero. Waiting and accepted receipts do not establish completion.

Run statistics/revisions/results are authoritative Kernel snapshots, scoped to Service lifetime. Human waiting pauses execution budget; external Agent reasoning usage remains unknown. TUI displays actual commit references and flags historical Artifact versions that are no longer available. See the [package guide](https://github.com/ole3021/intloom/blob/main/apps/cli/README.md) for configuration, UI controls and ownership.
