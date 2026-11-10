# Development and verification

The three framework and two CLI npm packages support Node `^22.22.0 || ^24.0.0 || ^26.0.0`. CI installs the framework tarballs with strict npm engine checks and runs the package-consumer suite at the minimum of each supported major.

The workspace uses Node 26.13.0 and Bun 1.4.4. Select the Node version in
`.node-version`; `check` rejects an unsupported Node or Bun version. Bun manages
dependencies and scripts, while builds produce Node ESM JavaScript and
declarations. Production code and tests use standard JavaScript and Node APIs.

## Commands

| Command | Behavior |
| --- | --- |
| `bun install --frozen-lockfile` | Install the exact workspace dependency graph from `bun.lock` |
| `bun run clean` | Remove `dist` outputs under `apps/*` and `packages/*` |
| `bun run check` | Check the toolchain, formatting, workspace and test types, and engineering constraints |
| `bun run build` | Build the workspaces in dependency order |
| `bun run build:dev` | Build the CLI and its dependencies, then bind this checkout to the local `intloom-dev` command |
| `bun run test` | Run component tests and repeatable cross-package scenarios locally or in CI, without personal configuration. |
| `bun run test:intg` | Run configured live model tasks against the workspace, including CLI report delivery. |
| `bun run test:e2e` | Install the five npm archives in isolated projects and verify their public types, CLI and delivered results. |
| `bun run verify` | Run workspace checks, build, daily regression and npm artifact acceptance in sequence. |
| `bun run release:prepare` | Clean outputs, force fresh verification and retain its exact tested archives with an inventory, hashes and log |

`test` and `test:intg` build the CLI and its framework dependencies. Component
tests live in the workspaces that own them. Root `test/integration/*.test.ts`
covers repeatable interactions across components, including IPC, database
recovery and MCP. The daily suite runs these with temporary services and fixed
inputs. `test/integration/live/` contains the explicitly configured tasks.
The SDK's compile-time author cases run during type checking.

For local npm acceptance, `test:e2e` prepares current build outputs and packs
them. To test a prepared candidate, set `INTLOOM_CANDIDATE_DIR` to its directory
and `INTLOOM_REQUIRE_ARCHIVES=1`. The Node compatibility jobs use
`npm run test:e2e` on those same archives. Studio installer acceptance runs in
the desktop release workflow for the target platform. Set `TURBO_FORCE=true`
to re-execute build and type tasks. Test results are never taken from Turbo's cache.

## Use the development CLI from any directory

On macOS or Linux, run `bun run build:dev` from the repository root, then
run `intloom-dev --version` from any directory. The launcher goes in the
directory printed by `bun pm bin -g`. Add that directory to your shell's
`PATH` if needed, or use `bun run build:dev --bin-dir /path/on/your/PATH`.
The launcher uses the absolute paths of this checkout's built CLI and the
Node executable selected at build time. Commands such as `intloom-dev dev build`
use the caller's working directory. Rerun `bun run build:dev` after editing
the framework or switching Node versions. Restart the running Intloom service to load
the rebuilt code.

To switch checkouts, move the existing launcher aside before binding the new
one. To uninstall, remove the printed launcher file. Both CLI names use the
same per-user service. The public CLI has no data-directory override. Automated integration tests inject a temporary service root and port through the internal `runCli` entry; the packaged executable has no such switches.

## Kernel responsibilities

`serve.ts` assembles and closes the host. `api.ts` owns public argument validation
and forwarding; `api-contracts.ts` owns its interface. `packages/catalog.ts` owns
discovery, selection and installation before Run creation. `query/events.ts`
owns event observation and cancellation; `query/activity.ts` projects a complete
persisted snapshot without an additional cache.

`lifecycle/coordinator.ts` orders Run commands and commits. `transitions.ts`
owns execution boundary settlement and `recovery.ts` reconciles persisted work
before exposing the host. `execution/` owns preparation and executable types;
`mastra/` adapts those types to the engine. `outcomes/` owns artifact references,
acceptance policy and final delivery checks; `persistence/artifacts.ts` owns
immutable bytes and integrity verification.

Integration and package-consumer fixtures use capability names: compilation,
lifecycle, execution, recovery, outcomes and MCP. `kernel-boundaries.test.ts`
checks preparation/commit scheduling; `storage-queries.test.ts` checks indexed
lookup, paging and compatibility with existing records.

## CLI presentation responsibilities

CLI commands own queries, lifecycle operations and exit codes. UI copy is English; data supplied by Looms or users is displayed verbatim. Menu actions use stable values independent of their visible labels. `apps/cli/src/command-spec.ts` owns command metadata; `ui/help.ts` renders it; `overview.ts` formats grouped Run snapshots shared by status and the foreground service observer. `theme.ts` owns colors, display paths, command identity and terminal wrapping; `activity.ts` owns the brand glyph, direction and timing. `live.ts` is the single owner of persistent lines, transient frames and timer cleanup. Its frame callbacks receive elapsed animation time only on an interactive output stream. `overview-observer.ts` owns status overview polling, bounded activity hydration and session cleanup; `run-observer.ts` owns individual Run observation screens. `service/background.ts` records diagnostics independently of observers; `ui/service-observer.ts` tails the service log and `ui/service.ts` renders it. Keep animated displays closed before opening an input form, and keep protocol/JSON/raw-byte output outside the presentation layer.

## Package-consumption evidence

The SDK-only consumer installs the actual `@intloom/loom-sdk` tarball, Zod and
TypeScript, plus esbuild for an author-bundling check. It compiles positive and negative type cases with `skipLibCheck`
disabled and verifies that the declaration graph does not load Mastra or LibSQL.
The same author type cases run against source during workspace typechecking and
against emitted declarations in the isolated consumer. They cover components,
context access, normalized inputs, optional branch results, loops, committed
entries, duplicate IDs and external Loom inputs. An actual esbuild bundle carries
its own Zod/SDK code; Node loads it and checks default metadata, constant copies,
JSON Schema conversion and rejection of native default functions without calling them.

The full consumer installs five local tarballs in a temporary npm project: the
SDK, Compiler, Kernel, CLI and the version-matched `intloom` launcher. It checks
their exact dependencies outside the workspace. CI consumes the same five
release archives on each supported Node version.

The Node process imports all exposed package paths, executes the installed CLI,
runs the TypeScript binary, transforms and executes TypeScript through esbuild,
and performs a file-backed LibSQL transaction. It also compiles real author
Looms, generates child dependency types, packs a complete archive, installs it in
another SQLite-backed catalog, and loads delivered definitions after removing
author sources and hiding node_modules. This checks packaged compiler tools and
workers, bundled Zod/SDK/CommonJS code, copied resources and static installation.
The consumer also checks SDK declaration types with `skipLibCheck` disabled and
executes a delivered Code Loom through both `serve` and the installed CLI, after
removing author sources. It verifies default application, persisted results,
IPC control and graceful shutdown while work is active. These tests use real
temporary databases and Unix sockets; the environment must permit local socket
creation. A packaged Mastra Workflow consumer executes native control constructs,
nested scopes and a bound Tool after removing author sources, then reopens the
Kernel to read the saved result. SDK declarations still exclude Mastra/LibSQL types.
The installed CLI also initializes/builds a minimal Loom, starts the shared service, and
serves discovery, execution, results and resources to the official SDK client
over authenticated Streamable HTTP. Temporary consumers are
removed after each test.

The installed compiler builds the `order-total` and `reviewed-report` fixtures. Local candidate preparation packs their archives once. With required archives supplied, the compatibility jobs install those exact files. Their source and build directories are
removed before archive installation. Tests execute the Code default and both
report approval/rejection paths across Kernel reopenings, verify one saved draft,
and retain test-source answers and immutable acceptance associations.

## Maintenance scripts

| File | Responsibility |
| --- | --- |
| `scripts/check-dev-toolchain.ts` | Validate the active Node and Bun versions. |
| `scripts/prepare-release-candidate.ts` | Verify and retain the consumer-tested archives. Pass `--base <sha>` to check each unit's version and notes and include the release plan in the inventory. |
| `apps/cli/scripts/install-dev-cli.ts` | Install the development executable for this checkout. |
| `apps/cli/scripts/build-npm-launcher.mjs` | Generate the thin npm launcher at the CLI's version for packing. |
| `.github/scripts/release-npm-packages.mjs` | Inspect archives, publish a release unit or verify its registry integrity and installation. |
| `.github/scripts/publish-github-release.mjs` | Attach the verified assets and release notes to the tested commit. |
| `apps/app/test/verify-installer.mjs` | Match the installer and full update bundle, verify their release metadata, launch the packaged webview and stage the files with the installer checksum. |

The minimal Loom inputs required for verification live in
`test/integration/fixtures` and `test/e2e/npm/fixtures/looms`. Studio checks
its catalog against two contract snapshots in `apps/app/test/fixtures`. The
ignored root `examples/` directory is for local projects.

## Preparing a candidate

Run frozen dependency installation first, then `bun run release:prepare`. The
command creates a unique ignored `.release/` directory and runs clean followed
by the full verification with `TURBO_FORCE=true`. Package tests retain their
exact tarballs there; both SDK-only and full consumers use the same SDK
archive. The two consumer fixtures produce the included Loom archives. No model
requests or publishing operations run. `candidate.json` is written only after
all gates pass, with runtime/platform, packed file lists and SHA-256 values;
`SHA256SUMS` also covers that manifest. Failure retains the verification log.

The bundle includes an installable local `package.json` using archive overrides
and [self-contained instructions](candidate.md). It still downloads third-party
dependencies. Registry publication and registry install verification are separate
steps requiring an actual release. Local hash checking establishes integrity,
not a publisher signature. The private website is not a framework deliverable.

The CI workflow runs frozen installation and candidate preparation
on Linux x64 and macOS arm64 runners. Workflow configuration is not evidence
that a remote run has passed. A platform is verified only after its job or an
equivalent real environment actually completes.

## Scope of current checks

Current tests cover the package foundation, author types and constructors,
supported schemas, constant defaults, CLI bootstrap and dependency binaries.
Package integration covers deterministic/rebased artifact identity, all declared
component/Workflow constructs, raw/normalized/output dependency types, explicit
lock updates, complete transitive archives, damaged/path/link input rejection,
same-version coexistence, static discovery, and exclusive ownership across real
processes including abrupt owner exit.
Definition tests prove graph construction, not execution of that graph. Tests
also check that constructors and compilation do not invoke business callbacks.
Code Kernel integration checks create-without-execution, input normalization once,
repeated start, immutable package/resource binding across installs and reopening,
cooperative cancellation, independent Runs, query cursors and ordered logs.
Real-process checks cover CLI dev build/install/run, authenticated service access,
observer disconnect, graceful draining and interruption after a forced service exit.
A real SQLite trigger rejects the final result write to prove it cannot report
success or replay work after reopening.

Mastra integration executes every supported Workflow construct, nested result
scopes and boundary parse counters. Local HTTP response fixtures exercise actual
Agent loops, strict structured output, tool argument/output failure and step
limits, through OpenAI / Alibaba Qwen Chat/Responses and MiniMax Messages routes. These fixtures
are not live-model evidence. Cancellation tests drain parallel callbacks as well
as asynchronous maps and conditions. A separate native-engine feasibility probe
suspends, inspects and resumes in three Node processes using a real file store,
without replaying the completed preceding step; it does not prove Kernel recovery.

Kernel recovery checks use real SQLite/LibSQL stores and separate Node processes.
They cover unpublished engine checkpoints, accepted answers before dispatch,
process death after an atomic resume claim, parallel/nested/foreach and loop
identities, child Run reuse, cancellation drain, missing bindings and snapshots,
and credential rotation. A parse counter proves accepted answers are normalized
once, including after restart. Actual tarball consumers exercise SDK and CLI
interaction/resume commands across service processes. Injected database failures are
confined to tests; production code has no recovery fault-injection switches.

Outcome integration checks immutable files/digests, range reads, canonical
subject identity, exact criteria coverage, retained report iterations, and
separate rejected/error states. Real filesystem and SQLite failures verify that
unsaved files/reports cannot become formal output. Child file ownership and
parent report ownership are tested independently. New Node processes repair
complete native results after an injected final-write failure, using saved
records without author packages or re-evaluation. A counter verifies one business
report parse. Actual tarballs exercise archive installation, SDK result queries,
CLI base64/raw reads, full multi-range binary export and overwrite protection.
These deterministic quality fixtures do not claim new live-model evaluation.

MCP integration covers all 19 tools, strict protocol arguments, resource paging,
UTF-8/blob selection, size errors, source policy, MRTR association/replay, decline
and dismiss, unsupported-form fallback, shared-service ownership and EOF recovery.
Simulated native responses use `test / mcp`; they do not prove human input.
CLI tests cover full raw reads, prepared-file digest verification, preserved
destinations on failure, quality exit 5 and interrupted observer exit 130. Additional regressions check command-scoped options, rejection of removed commands and options, lightweight version/help imports, observer cancellation through run/status/dev entry points, and projection query counts for a bounded live overview versus static/plain listings of all unfinished Runs and the latest 10 finished Runs.

Earlier stdio Inspector and human-form evidence does not validate the HTTP transport introduced by the global-service refactor. Current automated HTTP tests use the official SDK client and record form responses as `test / mcp`. Real human submission and third-party HTTP client compatibility require their own evidence.

Before the adapter merged into Kernel, clean source copies on macOS arm64 and Linux x64 completed frozen installation
and candidate preparation with Node 26.13.0 / Bun 1.4.4. Each passed 77 regular
tests and two isolated package-consumption tests, including the public examples;
all ten type/dependency tasks and five build tasks executed without cache hits.
The Linux environment used `node:26.13.0-bookworm-slim` and Bun 1.4.4 under
Docker `--platform linux/amd64` on an arm64 host. This is executed Linux x64
container evidence, not a native x64 machine or a remote GitHub Actions result.
The delivered local candidate was also installed from its relative archive
overrides and exercised through the CLI: output `42`, report wait, explicit
program answer, passed quality and verified Markdown export. Candidate logs
do not replace the separately recorded real-model or human-client acceptance.

## Configured integration tasks

Set `INTLOOM_E2E_CONFIG` to a JSON `ModelBindingDescription` with an
explicit environment credential reference and run `bun run test:intg`. The command
checks configuration before sending requests and stops on the first failed task.
It runs `text,structured,tool,report` in order by default. Select a subset with
`INTLOOM_E2E_SCENARIOS`; the evidence records exactly which scenarios ran.
Set `INTLOOM_E2E_MAX_REQUESTS` to a positive integer to enforce a request budget
before network dispatch, including any provider retry. Generations have a 2,048-token output limit.

The `report` scenario builds the incident-report Loom, installs it in a temporary project, runs its named command through the CLI and exports `handover.txt`. The test checks the incident ID, site and combined failure count in the exported text. To run only this task set `INTLOOM_E2E_SCENARIOS=report`. The existing `INTLOOM_E2E_*` variables configure these live tasks.

The command loads the checkout’s optional `.env`. For MiniMax CN, select its supported text/tool paths:

```sh
INTLOOM_E2E_PROVIDER=minimax-cn INTLOOM_E2E_SCENARIOS=text,tool \
  bun run test:intg
```

That file provides `LOOM_TEST_LLM_HOST=https://api.minimax.cn/anthropic/v1`,
`LOOM_TEST_LLM_MODEL=MiniMax-M3`, and the user's `LOOM_TEST_LLM_KEY`. Never commit
or copy its secret into examples. The adapter rejects MiniMax native structured
output before dispatch; validate that path separately with a supported binding.

Each run saves `evidence.json`, its compiled Loom and file databases under a
printed temporary path, or `INTLOOM_E2E_DIR`. Evidence includes provider/model,
credential reference, selected scenarios, request endpoint/status and Run result,
the requested native JSON Schema/strict mode, output limit and reported token
usage and provider-reported USD cost when available, not request headers or
credentials. The cost's estimate flag is retained separately. Rejected responses
also retain their content type, provider request ID and up to 4,096 characters
of error text, with the configured environment credential and bearer tokens
redacted. A failed scenario stops later scenarios; the command retains its
evidence. The observation deadline requests cooperative
cancellation; it does not replay or forcibly terminate callbacks.

Live-provider acceptance on macOS arm64 with Node 26.13.0 and MiniMax-M3 covered
text and tools: `READY`, then one `add(19,23)` call and output `42`; three HTTP
200 responses, no retries. Separate native structured-output acceptance with
Qwen3.8 Flash through OpenCode Console passed in one HTTP 200 request: the actual
request used `response_format.type=json_schema` and `strict=true`, and the Run
returned `{value:42}` with no tool calls. The response reported 71 input tokens,
71 output tokens and $0.00004402 (not marked as an estimate). This verifies that
specific model/route, not every Qwen endpoint or model; local fixtures separately
cover text, tool loops, invalid structured output and both compatible protocols.

For an OpenCode Console key, a separate binding file selects the Alibaba model
over Console's compatible Chat Completions endpoint without changing the Loom:

```json
{
  "provider": "alibaba",
  "model": "qwen3.8-flash",
  "credentialRef": "env:LOOM_TEST_LLM_KEY",
  "options": { "api": "chat", "baseUrl": "https://opencode.ai/inference/openai/v1" }
}
```

```sh
INTLOOM_E2E_CONFIG=./model-binding.json INTLOOM_E2E_SCENARIOS=structured \
  INTLOOM_E2E_MAX_REQUESTS=1 bun run test:intg
```

A rejected request is not structured-output acceptance or billing evidence.
Use the retained error text and provider request ID to investigate before
another attempt. Console service account keys need Models → Request permission
to call a model; Read only allows listing. See the
[Console permissions](https://opencode.ai/v2/docs/console/api/#permissions) and
[Inference API](https://opencode.ai/v2/docs/console/api/inference/) documentation.

Published package contents are controlled by each `package.json` files/exports
list. Private discussion records, credentials and runtime state are outside the
deliverable directories. Public docs describe available behavior only.

## Version PRs and delivery

Framework CI tests pull requests and the resulting main-branch commits. When a unit's version increases, add an English note at `releases/<unit>/<version>.md` to the version PR. Use `framework`, `cli`, `app` or `site` and describe changes users will see and any migration steps. The framework, CLI and Studio jobs use the note as their GitHub Release body. The site job deploys the versioned build. For a local rehearsal run `bun run release:prepare --base <previous-commit-sha>`, followed by `node test/e2e/npm/candidate-registry.mjs <candidate-directory>`. This registry serves the five local tarballs and redirects third-party package requests to public npm.

| Release | Artifacts and order | Production trigger |
| --- | --- | --- |
| Intloom Release | Loom SDK, Compiler, Kernel. The three manifests share the framework version. | Framework version PR merged to main and Framework CI passed. |
| CLI Release | Publish `@intloom/cli` first, then the same-version `intloom` launcher. | CLI version PR merged and verified. A joint release waits for the framework release record at the same SHA. |
| Site Release | Rspress static files. An open PR gets a Worker preview alias and a commit status linking to it. | Site version PR merged and verified. The production deployment uses that commit's tested files. |
| App Release | macOS arm64 and Intel DMGs, Windows x64 ZIP and Linux x64 installer archive. Each target also ships an installer checksum, an Electrobun update manifest and a full update bundle. | Desktop version PR merged and verified. All four native jobs must succeed before the GitHub Release is published. |

The repository reserves GitHub's **Latest** release for the newest published stable Studio version. Framework, CLI and Studio prereleases use their own tags. Each `app-v<version>` release is prepared as a draft and published after its 16 files have been uploaded. Electrobun manifests (`stable-<platform>-<arch>-update.json`) and full bundles (`.tar.zst`) retain their build filenames. Stable Studio assets are available at `https://github.com/ole3021/intloom/releases/latest/download/<filename>`.

Installer verification adds `notes` from the matching Studio release notes and `archiveSha256` to the published update manifest. The digest covers the exact decompressed tar that Studio stages for installation. Both the sidebar and About Studio display this manifest's version and notes.

Use GitHub-hosted runners. Configure npm Trusted Publishing per package, with environment `npm`: the three framework packages use `release.yml`, and both command-line packages use `cli-release.yml`. Enable direct npm publish for those workflows. First publication of a new npm name requires the owner's bootstrap or an existing authorized publishing identity. Reuse the exact tested tarball. Registry verification compares SHA-512 integrity before treating an existing version as delivered.

Configure the `preview` and `production` GitHub environments with appropriately scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Enable Workers version URLs on the preview account. The default-branch workflow uploads only static files from the PR artifact to the preview Worker. Newly added completion-triggered workflows become available after installation on the repository's default branch.

Use a main-only `desktop-release` environment for macOS release signing. Supply `MAC_CERTIFICATE_P12_BASE64`, `MAC_CERTIFICATE_PASSWORD`, `ELECTROBUN_DEVELOPER_ID`, `ELECTROBUN_APPLEID`, `ELECTROBUN_APPLEIDPASS` and `ELECTROBUN_TEAMID`. PR builds use an unsigned installer and the separate `desktop-build` environment. Windows installers currently ship without Authenticode signing. The 0.4.0 desktop application uses the local demonstration service described in the [desktop README](../../apps/app/README.md).
