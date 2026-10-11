# IntLoom CLI

`intloom` is a terminal client for the project's independent Kernel Service. It contains JSON Core operations, a command interface (CMD), and a persistent terminal interface (TUI). MCP and future Studio clients share the same Service state.

Requires **Node.js >=26.4.0**. Development uses Bun. Install either `intloom` or `@intloom/cli`; both provide the same command. The private Kernel is bundled inside the CLI.

```sh
npm install -g intloom
intloom
```

`intloom` and `intloom tui` open OpenTUI + Solid. The entry enables Node's experimental FFI flag automatically for TUI. CMD and MCP do not load the renderer. Redirected input/output requires CMD; run `intloom --help` to inspect commands.

## Local development

From the repository root, run:

```sh
bun install --frozen-lockfile
bun run build:dev
```

This builds the CLI and its workspace dependencies, then installs `intloom-dev` into Bun's global bin directory (normally `~/.bun/bin`). With that directory on PATH, use it from your test project:

```sh
cd /absolute/path/to/test-project
intloom-dev
intloom-dev status --json
intloom-dev doctor --execution cli
```

The development launcher uses this checkout's built files and the absolute Node executable used during installation. It does not install an npm release or replace `intloom`. Run `bun run build:dev` again after source or Node changes; the existing `dev` script only watches type checks and does not rebuild runtime/TUI output. Close and reopen TUI to load changes. Kernel/Service changes require explicitly stopping the test project's Service before rebuilding and starting it again; an existing Service keeps its loaded implementation, and `start` reuses it. Stop clears instance-only Run statistics.

The launcher supports macOS/Linux. Use `bun run build:dev --bin-dir /absolute/bin/directory` for a custom installation directory. Existing unrelated commands and other checkouts' launchers are protected. Remove the printed launcher file to uninstall. If a shell function named `intloom-dev` was previously defined, remove it so it does not shadow the executable. Use isolated tarball installation for distribution acceptance; the development launcher does not validate packaged dependency resolution.

## Project setup

```sh
intloom init my-project --workflow /absolute/path/workflow.tgz --mcp codex
cd my-project
intloom doctor --execution cli
intloom start
intloom flows
intloom tui
```

Initialization reports `scaffold`, `workflows`, `mcp`, and `service` separately as completed, failed, or skipped. `--start` is optional. A later failure retains earlier successful steps; inspect its result rather than blindly repeating init. Existing files are never overwritten by scaffold creation.

A Service can start without model configuration. CLI/Studio service Agent execution requires `llms.default` and its environment credential; external MCP Agent execution uses the existing `useMcpAgent` policy. `doctor` reads readiness without calling a real model. Running Services retain their startup configuration and environment.

Workflow package changes require a stopped Service:

```sh
intloom workflow list
intloom workflow add @intloom/workflow-intent
intloom workflow remove @intloom/workflow-intent
```

Bare package names resolve the current registry version and persist archive identity. Local archives remain required for restoration. Installation disables package scripts. Formal Artifacts and Records survive package removal and Service stop.

## CMD execution

CMD uses Citty, with Clack for simple setup selection. Execution takes complete arguments and returns immediately; answering questions belongs to explicit `answer` or TUI.

Without `--json`, CMD prints readable summaries, compact Workflow/Run/result tables, setup checklists and indented configuration or business data. Empty lists are explicit; errors retain their code and message, partial setup retains step results, and unknown outcomes retain the original operation/instance for inspection. Logs use readable timestamped lines. Artifact file export reports the destination; the exported file still contains JSON. This also applies to redirected command output. Use `--json` for scripts; MCP stdio remains protocol data.

Help uses plain text when stdout is redirected and honors `--no-color`, including when a parent test runner enables colors.

The entry removes inherited `FORCE_COLOR` when `--no-color` is supplied, so Node does not emit a conflicting-color warning on stderr.

```sh
intloom flow intent --intent-file ./request.txt --json
intloom attach RUN-example --json
intloom wait RUN-example --json
intloom answer RUN-example --action ASK-example --answer-file ./answer.json --json
intloom watch RUN-example --json
intloom cancel RUN-example --json
```

`--intent` preserves the complete string, including whitespace/newlines. `--intent-file -` reads stdin. Questions use the complete answer array (`questionId`, `isSkipped`, `answer`); confirmation uses `{ "isConfirmed": true }` with optional feedback. Exact pending `actionId` is required.

Flow and answer return admission receipts (`pending`, `accepted`, `rejected`), separate from Run status. A new command discovers the Service instance and generates an operation UUID. Explicit replay requires both `--instance` and `--operation-id` and the original parameters; the Service deduplicates within that instance. Query with `intloom operation UUID --instance INSTANCE --json`. Writes are never retried automatically. `outcome: unknown` retains the original identity for investigation.

`wait` defaults to `action_or_terminal`; `--until terminal` waits past questions without answering them. `--timeout` is milliseconds. A timeout or Ctrl+C ends observation only. `watch` uses full SSE snapshots; reconnect reconciles state and never replays execution. Exit from TUI, CMD, or MCP does not stop the Service or cancel a Run.

Normal `--json` output is one `CoreResult` object:

```ts
type CoreResult<T> =
  | { ok: true; data: T; meta: CoreMeta }
  | { ok: false; error: SafeError; outcome: "not_applied" | "applied" | "unknown"; meta: CoreMeta; data?: T };
```

Streams use JSON Lines. `meta` carries request/project/instance/operation/Run identities when known. `ok` describes the client operation; failed Runs retain their own `status` and `lastError`. Explicit cancellation succeeds even though the Run becomes failed with `RUN_STOPPED`. `--info`/`--debug` display safe persisted diagnostics on stderr, keeping machine stdout separate.

## TUI

The home screen shows project and connection state. Select Start Service explicitly, then choose a Workflow or Run. Ctrl+N opens Workflows, Ctrl+L Runs, Ctrl+H Home, Ctrl+G Settings, Ctrl+R refreshes the connection. Ctrl+Enter submits complete multiline intent or the current custom answer. Question options require selection; complete answers are reviewed before submission. Escape/Ctrl+C closes the interface.

The execution area stays visible with stage/step, activity, sampled execution/human wait time, model/Tool counts, known tokens, estimated cost and completeness. Settings provide initialization, Workflow package changes, safe config inspection/editing, diagnostics and Codex MCP setup. UI connection/selection/drafts are local; execution data comes from Core.

## MCP setup

```sh
intloom mcp init --ide codex --plan --json
intloom mcp init --ide codex
intloom start
```

Codex's project `.codex/config.toml` points to `intloom mcp serve --project … --ide codex` through the installed Node/bin paths. Configuration contains no private token or dynamic port. The proxy discovers an existing Service and forwards full bidirectional MCP messages. Offline connection asks for explicit Service start. Generated configuration is not evidence of IDE acceptance; project configuration still requires Codex trust. Other IDE adapters remain future work. See [official Codex MCP configuration](https://developers.openai.com/codex/mcp/) for client-side fields and trust requirements.

Plans include file fingerprints; applying a changed plan rejects concurrent edits. Managed IntLoom entries can update, unrelated configuration/comments remain. An unmanaged conflicting IntLoom entry is reported without overwriting it.

## Results and statistics

```sh
intloom artifacts --flow intent --limit 50 --json
intloom artifact ART-example --json
intloom artifact --flow intent --stage specification --output ./artifact.json
intloom records --flow intent --limit 50 --json
intloom record REC-example --json
intloom logs RUN-example --debug --json
intloom logs --service --follow --json
intloom config show --json
intloom config set --file ./intloom-next.yaml --revision OBSERVED_REVISION --json
```

Run results use actual Storage commit references, including original cursor and Artifact revision. An Artifact queried later is its current version; TUI reports `historical_revision_unavailable` when it differs from the Run's reference. Failed Runs can retain successful commits. Export uses exclusive creation unless `--overwrite` is supplied.

Metrics, revisions, limits, activities and `settled` belong to Runtime RunState and live only within the Service instance. Checkpoints exclude them; recovered Runs get fresh instance statistics/budget. Human waiting pauses execution-time budgets. External Agent reasoning tokens/cost are unavailable; Kernel-visible Tools are counted. Known zero and unknown are different. Price estimates use configured model rates, not supplier billing.

Optional `intloom/host.json`:

```json
{
  "maxAgentSteps": 64,
  "run": { "maxModelCalls": 100, "maxDurationMs": 600000 },
  "prices": [{ "modelId": "example", "inputPerMillion": 1, "outputPerMillion": 2, "pricingId": "local-estimate" }]
}
```

All limits are positive integers. Other supported Run limits are `maxKnownInputTokens` and `maxKnownOutputTokens`. Cost is estimated in USD; there is no monetary hard limit. Cancelled Runs may receive known late usage/commit references until `settled`, without resuming execution or changing terminal status.

## Ownership and validation

`src/core` owns client calls/local data operations; `src/cmd` owns parsing and command output; `src/tui` owns terminal state/rendering. `packages/kernel/src/service` owns the independent process, resources, JSON/SSE contracts and MCP server. Former CLI Service modules are forwarding imports during internal migration, not additional owners.

Use the repository's Bun scripts for build/typecheck/unit/integration/package validation. Integration fixtures use local model responses; they do not prove real provider behavior or IDE acceptance. No global install, publication, restart/adoption policy or new recovery strategy is implied by local tests.
