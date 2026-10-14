# IntLoom E2E

This private development workspace exercises the whole system through real CLI commands or MCP. A simulated user initializes a new project, submits each case Intent in order and answers actual questions from knowledge. MCP Agent tasks run in isolated worker sessions with the original host instructions, Skills, Tools and output schema. The framework never repairs, restores, resumes or automatically replays a Run.

MCP workers receive the host's output schema through their client completion Tool. The actual outcome must match that exact schema and pass host validation. A complete final text response is also accepted, including one unambiguous trailing JSON value after narration. Multiple candidates, truncated responses, wrong fields or a missing outcome fail. Earlier SDK objects or saved business Tool receipts cannot replace the outcome.

The worker requests required Tool calls and uses the completion Tool for its outcome. Host-provided Skill contents are already available; declared assets remain accessible through `read_skill_asset`. Original business Tools, Skill content and the host output schema are preserved.

The simulated user also completes each iteration through a typed local Tool (`finished` or an explicit knowledge/environment block). Successful model narration cannot finish an iteration. The runner still requires the original authoritative Run to be completed and settled before recording success or advancing to the next Intent.

Each MCP user iteration receives the discovered public input Schemas even when it reuses an existing connection. Reconnecting is idempotent and returns the same catalog. The `mcp_flow` helper invokes the real public `flow` with a plain object Schema; `mcp_tool` exposes only user-role queries. Malformed admission arguments are reported as schema errors before checking the fixed case Intent. The helpers avoid top-level union Schemas, which some compatible models render as empty arguments.

## Run

```sh
bun run e2e:cmd --root /absolute/e2e-root --case s01
bun run e2e:mcp --root /absolute/e2e-root --case m01
bun run e2e:cmd --root /absolute/e2e-root --case l01 --workflow @intloom/workflow-intent@VERSION
bun run e2e:mcp --root /absolute/e2e-root --suite /absolute/workflow/e2e --case Alpha
```

Omit `--case` to select randomly. `--seed VALUE` repeats selection in the same case catalog. Explicit missing IDs block execution. IDs are case-insensitive and are not restricted to S/M/L. `--cli FILE` selects a prepared candidate CLI. `--workflow PACKAGE|FILE` selects a published package/version or local archive. Without it, the suite's current source and installed runtime dependencies are built in an isolated copy inside the execution directory. Current-source build packages must belong to this checkout; external authors can supply a prepared archive or published package with their own suite.

The default suite is [Intent E2E](../packages/intent/e2e/README.md). E2E is independent of `test:intg` and `verify`. TUI has no E2E entry yet. `e2e:cmd`, `e2e:mcp` and `e2e:codex` are distinct entries.

## Workflow-owned inputs

```text
workflow/e2e/
  config.yaml
  cases/
    Alpha/
      case.yaml
      knowledge.md
      workspace/       # optional initial files
  acceptance.md        # optional user instructions
  checks/              # optional Node scripts and helpers
```

No executable suite adapter is required. A minimal configuration is:

```yaml
workflow:
  source: ..
  flowName: example
models:
  user: glm-5.3-flash
  cmd:
    default: glm-5.3-flash
  mcp:
    worker: minimax-m3
```

`workflow.source` is the current package directory relative to config.yaml. CMD model roles are Workflow-owned arbitrary keys; `default` is required for CMD. MCP requires its separate `models.mcp.worker`. Each model can be a Zen model ID, or `{model, provider, parameters, providerOptions}`; provider defaults to `openai-compatible`, and `anthropic` uses the pinned SDK message protocol. `zen.baseURL` optionally selects a compatible endpoint, primarily for controlled tests. Defaults use `https://opencode.ai/inference/v1`, as listed in the [current Console model endpoints](https://opencode.ai/v2/docs/console/models/).

Set **one** `ZEN_API_KEY` in the shell or repository-root `.env`. Defined shell values take precedence. The runner does not search case/project/parent `.env` files or copy credentials into projects. Model availability is established by actual calls; there is no connectivity preflight or silent fallback. Known credentials and ownership tokens are filtered from E2E output.

Zen requests identify this client with a User-Agent and an opaque session ID that remains stable within each Agent conversation. These routing/cache headers contain no project path or credential. The Kernel's service Agents supply their own per-invocation Zen session ID.

A minimal case.yaml contains only ordered inputs:

```yaml
intents:
  - Create the initial local application.
  - Extend it with the next requirement.
```

The directory supplies the ID. Optional metadata: `id`, `version`, `name`, `description`, `scale`. Optional `models` overrides merge user/CMD role/MCP worker settings with the suite defaults. knowledge.md contains business facts and authorized decisions, not canned question-to-answer mappings. Numbered `## K01` sections are supported; plain knowledge uses the reference `knowledge`. No framework rule assigns a number of iterations based on scale.

## Optional limits

Limits belong in Workflow E2E config.yaml, not model presets, Kernel code or case-size logic:

```yaml
limits:
  maxDurationMs: 7200000
  maxUserSteps: 160
  maxAgentSteps: 64
  commandTimeoutMs: 30000
  modelConnectionTimeoutMs: 60000
  modelIdleTimeoutMs: 180000
  modelConnectionRetries: 0
```

All fields are optional. `modelIdleTimeoutMs` bounds inactivity in simulated-user and MCP-worker model responses; decoded output renews the deadline, while SSE keepalives do not. Omission adds no idle deadline. A stall fails with `MODEL_STREAM_IDLE_TIMEOUT`, preserves evidence and never replays the opened request or accepted Tools. It does not configure the Kernel's own CMD Agent transport. `maxDurationMs` is one overall execution deadline beginning before candidate preparation; `maxUserSteps` bounds each simulated-user session, and `maxAgentSteps` bounds each worker and configures the service host's Agent limit when explicitly supplied. Omission adds no E2E duration/step cap; the product's own host limits still apply. CLI/MCP/script calls default to 30 seconds and model stream opening defaults to 60 seconds. Preparation uses ordinary bounded build/package subprocesses. These are time/step controls, with no fee or spending-budget subsystem. Zero model connection retries is the default; an explicitly enabled retry applies only before any response stream opens. Accepted operations and opened streams are never replayed. A stream closing without an explicit provider finish fails as `MODEL_STREAM_INCOMPLETE`; partial Tool arguments cannot silently start further model requests. An original failed Run remains primary when the simulated user later also fails to produce a decision or connect.

## Optional Workflow acceptance

Workflow-owned project preparation is optional:

```yaml
preparation:
  scripts:
    - checks/prepare.ts
```

These Node scripts run once after the simulated user seeds and configures the newly initialized project, before its first Service startup. The command is `node SCRIPT CONTEXT_JSON`; the context supplies `entry`, `project`, `execution`, `cli`, `flowName`, `storage` and the copied `caseDirectory`. Files needed by a script belong to that case. Preparation uses the configured command timeout, records its receipt, and stops on failure without replaying the script or admitting a Run. The framework interprets no baseline format. For example, Intent owns a small script copying prepared formal Storage from case inputs while preserving IDs and versions; it leaves configuration and runtime files for the new CLI setup.

```yaml
acceptance:
  instructions: acceptance.md
  scripts:
    - checks/results.ts
```

Instructions extend the simulated user's prompt. Scripts execute after each completed, settled Run and before the next Intent. The command is `node SCRIPT CONTEXT_JSON`, with the project as working directory. Scripts receive `entry`, `project`, `execution`, `cli`, `flowName`, `storage`, `round`, `intent`, the authoritative `run`, prior Run snapshots, accepted `confirmations`, the mirror directory and an `output` path. They may inspect known commit references or paginate public queries. Nonzero exit fails acceptance and stops later intents. Relative helper files beside a script are preserved; already installed owner dependencies are reused. Keep scripts and helpers together under a dedicated directory.

The MCP worker has a local `e2e_complete_task` Tool bound to the host's outcome schema. Calling it ends the worker session without another model request, then sends that actual outcome through `complete_agent_call` for host validation. It does not derive an outcome from a saved business submission. Fatal host errors terminate the worker; truncated responses remain failures.

MCP Tool errors may contain plain text; the runner preserves their actual diagnostics without replaying the call. Successful responses still require structured or JSON data. Artifact queries select either `artifactId` alone or `flowName` and `stageName` together.

The generic runner checks execution completion, ordering and entry/executor identity. It enables mirror by default and reports capture failures, but contains no fixed stage/Artifact/Record/baseline/quality checks and performs no per-image inspection. `status: passed` means successful execution plus any configured scripts. `acceptance.status: not_configured` explicitly means no scripted business acceptance was run. Configured scripts that cannot run are reported as not_run; partially checked iteration lists are reported as partial. Workflow authors own what acceptance checks mean; E2E does not claim product correctness or quality.

## Execution directory and output

Each invocation creates `e2e-ENTRY-CASE-TIMESTAMP-ID` beneath `--root`:

```text
result.json / report.md   # English outcome, Run references and paths
case/ / suite/           # selected inputs and acceptance resources
project/                 # real new project, storage, logs, outputs and mirrors
  .intloom/mirrors/
evidence/actions.jsonl   # E2E operations, decisions and failures
workspace-source/        # current candidate build, when needed
workspace-candidate/     # preserved runtime archives, when needed
.npm-cache/ / tmp/       # execution-local preparation resources
```

Temporary packaging copies are removed after archives are preserved. CLI/system logs remain in the project. Console stderr contains independent English E2E progress: setup, iteration, state changes, answers (including confirmation or revision requests), optional acceptance and failures, with a 30-second heartbeat. SDK console diagnostics are redacted into E2E evidence and emit only a brief progress line. Stdout is the final English JSON summary. All rounds run in the same project; failures stop future rounds and preserve prior Run references. External repair processes can inspect this directory without E2E attempting recovery.

Internal polling records changes to the Run, Step visit, pending action/Agent task, settlement and capture/error state. It retains the newest snapshot without saving every successful query body or timing tick. Explicit simulated-user operations and failed queries keep their receipts; final Run snapshots and mirrors preserve the result references.

Opened-stream read failures preserve the underlying transport code (when supplied by the runtime), stop the Agent immediately, and are reported as environment failures. A socket termination is distinct from missing provider completion; neither is retried after a response has opened. HTTP request failures retain their status even when the provider message is empty; up to 4 KiB of response text is kept in redacted evidence, not console output. Request headers and credentials are not added to diagnostics.

## Actual Codex compatibility

```sh
bun run e2e:codex --root /absolute/e2e-root --case s01
```

This separate entry uses actual Codex CLI authentication and a small compatibility Workflow to check connection, one Agent task, a human question/confirmation and result queries. It uses the case's first Intent and knowledge, not the full Intent iteration list. `--codex FILE` and `--codex-model MODEL` remain available. It does not validate desktop/IDE UI or native forms, and does not replace the complete CMD/MCP suite.

## Developer checks

```sh
bun run --cwd e2e typecheck
bun run --cwd e2e test
bun run --cwd e2e test:runner
```

Unit checks cover configuration, case selection, protocols, progress and failures. The separately invoked runner acceptance builds current candidates in an isolated directory and uses controlled local models with actual CLI/Service/Tools, unmodified four-stage Intent, File/SQLite, a distinct iterative Workflow and optional scripts. `INTLOOM_E2E_TEST_CLI` optionally selects a prepared CLI for this check. No Zen requests are needed. Real model reliability requires explicitly running the desired suite; controlled checks are not live-provider or product-quality evidence.
