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

The development launcher uses this checkout's built files and the absolute Node executable used during installation. It does not install an npm release or replace `intloom`. Run `bun run build:dev` again after source or Node changes; the existing `dev` script only watches type checks and does not rebuild runtime/TUI output. Close and reopen TUI to load changes. Kernel/Service changes require explicitly stopping the test project's Service before rebuilding and starting it again; an existing Service keeps its loaded implementation, and `start` reuses it. Stop clears instance-only statistics; terminal Run history and committed results survive restart.

The launcher supports macOS/Linux. Use `bun run build:dev --bin-dir /absolute/bin/directory` for a custom installation directory. Existing unrelated commands and other checkouts' launchers are protected. Remove the printed launcher file to uninstall. If a shell function named `intloom-dev` was previously defined, remove it so it does not shadow the executable. Use isolated tarball installation for distribution acceptance; the development launcher does not validate packaged dependency resolution.

## Project setup

```sh
intloom init my-project -l /absolute/path/loom.tgz --mcp codex
cd my-project
intloom doctor --execution cli
intloom start
intloom looms
intloom tui
```

Initialization reports `scaffold`, `looms`, `mcp`, and `service` separately as completed, failed, or skipped. `--start` is optional. A later failure retains earlier successful steps; inspect its result rather than blindly repeating init. Existing files are never overwritten by scaffold creation.

A Service can start without model configuration. CLI/Studio service Agent execution requires `llms.default` and its credential; external MCP Agent execution uses the existing `useMcpAgent` policy. `ENV.NAME` uses `process.env` first, falling back only when undefined to the selected project root's regular `.env`. Parent directories, the caller's working directory, `.env.local` and symlink files are not loaded. Empty or encrypted environment values are rejected rather than replaced. `DENV.NAME` still requires external decryption into the startup environment. `doctor` reads readiness without calling a real model. Restart the Service after changing configuration or `.env`.

Loom package changes require a stopped Service:

```sh
intloom loom list
intloom loom add @intloom/intent
intloom loom remove @intloom/intent
```

Bare package names resolve the current registry version and persist archive identity. Local archives remain required for restoration. Installation disables package scripts. Formal Artifacts and Records survive package removal and Service stop.

## CMD execution

CMD uses Citty, with Clack for simple setup selection. Execution takes complete arguments and returns immediately; answering questions belongs to explicit `answer` or TUI.

Without `--json`, CMD prints readable summaries, compact Loom/Run/result tables, setup checklists and indented configuration or business data. Empty lists are explicit; errors retain their code and message, partial setup retains step results, and unknown outcomes retain the original operation/instance for inspection. Logs use readable timestamped lines. Artifact file export reports the destination; the exported file still contains JSON. This also applies to redirected command output. Use `--json` for scripts; MCP stdio remains protocol data.

Help uses plain text when stdout is redirected and honors `--no-color`, including when a parent test runner enables colors.

The entry removes inherited `FORCE_COLOR` when `--no-color` is supplied, so Node does not emit a conflicting-color warning on stderr.

```sh
intloom run intent --prompt-file ./request.txt --json
intloom attach RUN-example --json
intloom wait RUN-example --json
intloom answer RUN-example --action ASK-example --answer-file ./answer.json --json
intloom watch RUN-example --json
intloom cancel RUN-example --json
```

`--prompt` preserves the complete string, including whitespace/newlines. `--prompt-file -` reads stdin. Questions use the complete answer array (`questionId`, `isSkipped`, `answer`); confirmation uses `{ "isConfirmed": true }` with optional feedback. Exact pending `actionId` is required.

Run, answer, resume, pause and cancel return admission receipts (`pending`, `accepted`, `rejected`, `indeterminate`), separate from Run status. A new command discovers the Service instance and generates an operation UUID. Explicit replay requires both `--instance` and `--operation-id` and the original parameters; the Service deduplicates within that instance. Query with `intloom operation UUID --instance INSTANCE --json`. Writes are never retried automatically. `outcome: unknown` retains the original identity for investigation.

`wait` defaults to `action_or_terminal`; `--until terminal` waits past questions without answering them. `--timeout` is milliseconds. A timeout or Ctrl+C ends observation only. `watch` uses full SSE snapshots; reconnect reconciles state and never replays execution. Exit from TUI, CMD, or MCP does not stop the Service or cancel a Run.

Normal `--json` output is one `CoreResult` object:

```ts
type CoreResult<T> =
  | { ok: true; data: T; meta: CoreMeta }
  | { ok: false; error: SafeError; outcome: "not_applied" | "applied" | "unknown"; meta: CoreMeta; data?: T };
```

Streams use JSON Lines. `meta` carries request/project/instance/operation/Run identities when known. `ok` describes the client operation; failed Runs retain their own `status` and `lastError`. Explicit cancellation succeeds even though the Run becomes failed with `RUN_STOPPED`. `--info`/`--debug` display safe persisted diagnostics on stderr, keeping machine stdout separate.

## TUI

TUI is a current-project workbench for Loom execution, Run control and read-only resources. Invalid projects direct users to CMD `intloom init`; valid projects reuse Service or automatically start a verified stopped Service. One unfinished Run opens automatically, several open a picker, and none shows the logo/intent composer. Configuration/readiness errors remain visible. Closing TUI leaves Service and Runs running.

Tab cycles **Run → Logs → Assets**. Ctrl+O opens Run selection while retaining the current window; Ctrl+P selects Loom for a new draft. A leading `/` in input immediately opens the full six-command list; continue typing to filter, arrows/Enter select and execute, Esc dismisses. The same entry works from question choices, Logs and Assets. Unavailable commands stay listed with explanations. A slash inside ordinary text remains text. Former global Ctrl navigation bindings are removed.

| MVP command | Action |
| --- | --- |
| `/run [loom]` | Open an intent draft; submitting intent creates the Run. |
| `/loom` | Choose Loom for a new Run; same as Ctrl+P. |
| `/runs` | Search/switch Runs in this Service; same as Ctrl+O. |
| `/resume` | Continue a paused Run with existing or explicit Step/Stage/Loom scope; invalid boundaries are disabled. |
| `/stop` | Confirm stopping an unfinished Run; committed resources remain. |
| `/quit` | Close TUI while background execution continues. |

Enter submits intent/custom answers or confirmation feedback; Shift+Enter inserts a newline, Ctrl+J remains an input-only fallback, and long input wraps. Complete answer sets are reviewed before submission. Esc revisits a question/confirmation choice. Drafts survive window/Run switching and reconnecting. Input modifiers require terminal reporting through the Kitty keyboard protocol.

Run displays logs, human interaction and the status sidebar, compacted below 100 columns. Logs uses arrows/PageUp/PageDown for scrolling and Home/End for beginning/latest. The live log view and Assets remain mounted across window switches to retain position/filters. TUI keeps 200 log entries and reports omissions; older persisted logs remain accessible through CMD. Activity indicators and brief brand-green border transitions retain the existing animation behavior.

Assets shows the selected Run's commit references, or project resources without a selected Run. Left opens local controls for Artifact/Record, project/Run scope, filters and refresh; Right returns to the list. Up/Down switches filter fields and Enter applies. Loom/Stage filters use exact names; text searches loaded IDs/metadata. Lists load 50 entries per page with a next-page action. Enter opens JSON, arrows/PageUp/PageDown scroll, and Esc returns. Unavailable old revisions show `historical_revision_unavailable`; Assets does not export or modify resources.

Kernel Runtime owns Run state and pending actions; operations owns admission receipts. CLI Core exposes client calls. Unknown write outcomes retain original operation/Service identity and block another submission; select **Inspect original operation** to query the original receipt/Run without replay. For a stopped/disconnected Service, select **Inspect and reconnect**, which starts only a verified stopped Service. Stopping uses the existing `failed/RUN_STOPPED` contract and displays cancelled. Metrics belong to the Service instance; Run lists also include retained terminal history. Initialization, configuration, package management, diagnostics, MCP setup and mirror administration remain CMD operations.

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
intloom artifacts --loom intent --limit 50 --json
intloom artifact ART-example --json
intloom artifact --loom intent --stage specification --output ./artifact.json
intloom records --loom intent --limit 50 --json
intloom record REC-example --json
intloom logs RUN-example --debug --json
intloom logs --service --follow --json
intloom config show --json
intloom config set --file ./intloom-next.yaml --revision OBSERVED_REVISION --json
```

Run results use actual Storage commit references, including original cursor and Artifact revision. An Artifact queried later is its current version; TUI reports `historical_revision_unavailable` when it differs from the Run's reference. Failed Runs can retain successful commits. Export uses exclusive creation unless `--overwrite` is supplied.

Metrics, revisions, limits and activities live within the Service instance. Runtime independently owns actual commit facts and whether activity has settled. Checkpoints retain commit references and originating operation identity; recovered Runs get fresh instance statistics/budget. Human waiting pauses execution-time budgets. External Agent reasoning tokens/cost are unavailable; Kernel-visible Tools are counted. Known zero and unknown are different. Price estimates use configured model rates, not supplier billing.

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

`src/cmd` owns argument/file input, command registration, prompts, output and exit codes. `src/tui` owns its controller, operation interaction, drafts, navigation, dialogs and screens. They independently consume `src/core`, whose operation modules return structured results. `src/client` owns connection discovery, HTTP/SSE and the existing MCP ProjectClient. `src/shared/presentation` contains pure formatting used by both terminal adapters; output streams and renderer code remain in their respective adapters. CMD and TUI never import each other, and Core/client code never imports either adapter.

`src/bin.ts` selects the mode and lazily loads its entry, keeping the renderer out of CMD/MCP. `src/index.ts` preserves the package's public exports. The E2E command adapter lives in CMD; `src/e2e` retains the runner, drivers and evidence implementation. `src/service/entry.ts` is only the process entry shim for Kernel Host.

`packages/kernel/src/host` owns process/resources, `operations` owns admission and query contracts, `runtime` owns execution state, and `transport` owns JSON/SSE/MCP adaptation. CLI consumes the explicit Kernel package entries. SDK contracts are imported directly from `@intloom/loom-sdk`.

The public `serviceStatus` and ProjectClient discovery reuse Kernel's status checks: timeouts report `CLI_SERVICE_TIMEOUT`, interrupted connections report `CLI_SERVICE_OFFLINE`, invalid status JSON reports `CLI_RESULT_INVALID`, and mismatched identities report `CLI_SERVICE_METADATA_INVALID`.

Public API regression tests retain runtime export/Core method names and command help snapshots. The independent archive consumer imports all public types from the installed package. Log-format tests live beside the shared formatter; CMD output tests exercise the active output adapter.

Use the repository's Bun scripts for build/typecheck/unit/integration/package validation. Integration fixtures use local model responses; they do not prove real provider behavior or IDE acceptance. No global install, publication, restart/adoption policy or new recovery strategy is implied by local tests.

## Local execution mirrors

Enable `mirror.enabled` explicitly in `intloom.yaml`. Every reached safe boundary captures complete local State, formal Storage and declared business files under `.intloom/mirrors/`.

```sh
intloom mirror list --project ./source --json
intloom mirror inspect <mirrorId> --project ./source --json
intloom mirror restore <step-before-id> --project ./source --to ../case-step --scope step
intloom start --project ../case-step
intloom resume <runId> --project ../case-step
intloom resume <runId> --project ../case-step --scope loom
intloom mirror export <traceId> --project ./source --to ../mirror-data
```

Prepare the target's current config/Loom and stop its service before restore. Restore preserves IDs/revisions/timestamps and starts paused; host startup also remains paused. Step scope requires a real step_before; stage scope ends one visit before the next initializer. step_after never repeats the call and rejects step scope; terminal images are offline only. A completed scope requires an explicit new scope on resume. `mirror restore --dry-run` returns its validated write plan.

For an exact resume retry retain the original instance, operation UUID, revision and scope. CLI and MCP share the application rules; MCP tools are mirror_list, mirror_inspect, mirror_restore, mirror_export and resume_run. Inspect/export work without loading old Loom Code. The [recovery guide](../../docs/guide/usage/recovery.md) describes file exclusions, conservative current-Schema compatibility, capture retry and incomplete-restore diagnostics.

After persistent mirror_capture_failed, `resume <runId> --scope loom --abandon-mirror` explicitly stops capture for this Run and records captureDisabled/cause. There is no automatic downgrade; step/stage scopes keep their saved-boundary guarantees.

## Loom E2E

`intloom e2e [local-loom-path] --case S01 --root /absolute/e2e-results` runs the Loom project's cases against its already-built `dist`. CMD is the default; `--entry mcp` uses independent MCP workers. `--list` discovers cases without starting models. See [the E2E contract](src/e2e/README.md) for knowledge, model profiles, checks, limits and evidence. The runner ships with CLI and does not require the IntLoom repository.

## Pause and operation history

`intloom pause <runId>` requests a pause at the next completed Step boundary. `intloom resume <runId>` routes the saved result without repeating that Step. An accepted receipt is independent of subsequent Run completion.

`intloom operation <operationId> --instance <instanceId> --json` returns `found`, `not_found`, or `instance_changed`. Receipts remain available throughout their host instance. After instance replacement, use `intloom runs --operation-id <operationId> --origin-instance <instanceId>` to locate the original Run, including retained terminal history. An unknown outcome never authorizes a fresh submission. A rejected or indeterminate mutation returns a nonzero command exit code even when receipt retrieval succeeded.
