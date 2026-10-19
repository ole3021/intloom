# Loom E2E

`intloom e2e [path]` is the CLI's built-in Agent-driven integration test runner. `path` is a local Loom project and defaults to the current directory. Cases belong to that project's `e2e/`. The runner consumes its existing `dist/package.json` and compiled entry; it never builds the Loom or CLI. Registry package names and archives are not case-discovery inputs in this version.

```sh
intloom build ./my-loom
intloom e2e ./my-loom --list
intloom e2e ./my-loom --case S01 --root /absolute/e2e-results
intloom e2e ./my-loom --case S01 --entry mcp --root /absolute/e2e-results
```

CMD is the default. It uses the real CLI and service model. MCP connects through `intloom mcp serve` and executes host Agent tasks in independent client sessions. Both use the same cases and real Run/answer/result interfaces. Setup, polling, task dispatch, checks and cleanup are deterministic code; the simulated user submits the fixed round input and answers actual questions from authorized knowledge. Its private knowledge is never supplied to the MCP worker. Future-round knowledge is withheld until that round.

`--case` is case-insensitive. Omission selects one case using the recorded `--seed` (random by default). The seed reproduces selection, not model output. `--root` is required for execution and must be outside the suite's `e2e/` directory. `--list` needs no model configuration or build. Each case gets one fresh project; its rounds execute sequentially in that project. A failed round stops subsequent rounds.

## Suite and case contract

```text
my-loom/
  package.json
  dist/                  # already-built distribution
  e2e/
    config.yaml
    checks/check.mjs
    cases/Alpha/
      case.yaml
      knowledge.md       # optional shared knowledge
      rounds/change.md   # optional additional knowledge for a later round
      workspace/         # optional initial business files
```

```yaml
# e2e/config.yaml
version: 1
models:
  user:
    provider: openai-compatible
    model: ENV.INTLOOM_E2E_MODEL
    secret: ENV.INTLOOM_E2E_API_KEY
    baseURL: ENV.INTLOOM_E2E_BASE_URL
storage: file
limits:
  maxDurationMs: 7200000
  maxUserSteps: 80
  maxAgentSteps: 64
  modelIdleTimeoutMs: 180000
checks:
  - checks/check.mjs
```

`models.worker` optionally selects the MCP worker model. `models.service` accepts `default`, `thinking`, `working`, and `coding`. Omitted worker/service settings use the user model in separate sessions. Supported transports are `openai-compatible` and `anthropic`. Models may specify `parameters` and `providerOptions`. `--profile FILE` replaces the models mapping with a local YAML/JSON mapping containing `user` and optional `worker/service`; it does not change case requirements. Credentials use environment references only. The runner does not search `.env` files or bind authors to a specific provider.

```yaml
# cases/Alpha/case.yaml
id: Alpha
version: 1
name: Two feature rounds
description: Preserve existing behavior while adding a later requirement.
rounds:
  - id: create
    input:
      prompt: Create the initial feature.
  - id: change
    input:
      prompt: Adjust the feature.
    knowledge: rounds/change.md
```

`input` follows the SDK's fixed `prompt/files/dirs/urls` slots and the installed Loom's declared inputs. File/directory references are relative to the generated project and must exist when the round begins. They are not read or fetched just by passing them. Paths cannot escape the project or traverse symlinks. Workspace fixtures cannot contain `.intloom`, formal `intloom` storage, model credentials or project configuration.

Shared and already-introduced round knowledge remains available. Optional `## K01` headings provide answer references; otherwise the reference is `knowledge`. Describe facts and decision authority, not predetermined question/answer pairs. Partial-delivery or stop-collection consent must be explicitly authorized by the case. Missing knowledge blocks the attempt.

## Preparation and independent checks

Optional `preparation: [checks/prepare.mjs]` runs after CLI initialization, workspace seeding, installation and configuration, before the service starts. `checks` run after each completed, settled Run and before the next round. Use self-contained executable Node files and relative helper imports inside `e2e/`; no framework adapter or private CLI import is required. Resources are copied into execution evidence; author `node_modules` is not attached to the check environment.

Scripts receive `node SCRIPT CONTEXT_JSON`. Preparation context version 1 contains `project`, `execution`, `caseDirectory`, and `entry`. Check context additionally contains:

- `caseId`, `round: { id, index, input }`, and the authoritative `run`.
- `results: { artifacts, records }`, read through the selected public entry from that Run's exact references before the next round.
- `previousRounds`, including original result snapshots; `previousRecords`, freshly queried for immutability checks.
- Accepted `confirmations` and the `mirrors` directory.

A zero script exit means its assertions passed. A nonzero exit stops the case and preserves stdout/stderr. Run completion is reported separately from case checks: no scripts means `not_configured`. The runner has no fixed stage counts, Artifact meanings, or expected validation verdicts. Loom authors define those expectations. Scripts must not repair the project or mutate formal data. Output-check commands that write files should operate on a separate copy so the next round's candidate is not changed by the test harness.

## Evidence and limits

Each execution creates `e2e-ENTRY-TIMESTAMP-ID` with `result.json`, `report.md`, `case/`, `suite/`, `candidate/`, `project/`, and `evidence/actions.jsonl`. It records case hashes, selected seed, CLI identity, built-package/dependency archive identities, actual questions/answers, model/tool receipts, per-round formal results and failures. The local candidate preserves installed runtime dependencies without compiling them; install/build missing dependencies beforehand. This exercises the preserved local dependency graph, not npm publication.

Reports and progress are English. Stdout contains the final JSON summary; stderr reports progress and a 30-second heartbeat. Credentials and ownership tokens are redacted. Exit codes: `0` passed, `1` failed, `2` blocked, `130` interrupted. CLI argument errors use the CLI's standard error handling.

`commandTimeoutMs` defaults to 120000, `modelConnectionTimeoutMs` to 60000, and `modelConnectionRetries` to 0. Duration, idle, and step limits are optional. Explicit connection retries are limited to pre-stream establishment; accepted mutations and opened streams are never replayed. Failed, paused or interrupted attempts preserve evidence, cancel unfinished test Runs and stop their service. E2E does not repair, restore or resume Runs.

## Development ownership

CLI tests use the generic probe in `apps/cli/test/fixtures/e2e/` and controlled local models. Intent owns its [S01/M01 suite](../../../../packages/intent/e2e/README.md) and business assertions. Live-provider cases are explicit executions, independent of ordinary `test:intg` and `verify`. TUI and real external-client compatibility are outside this command's scope.
