# Kernel API and execution reference

The Kernel executes npm Loom commands and also supports installed compiled artifacts. Installation, outcome slots and storage declarations below apply to that compiled-artifact API. Start with the [host integration guide](../../packages/kernel/README.md) for an npm command.

## npm commands

The host installs the npm package and selects a compiled command directory. The Kernel starts the selected entry, binds any Agent to the configured Harness, tracks parent/child Runs and persists file deliveries. A project installation can take precedence over a global package of the same name. Callers can request final review using `confirmDelivery: true` when creating a Run. Use `getRunResult` to inspect the frozen candidate and any rejection reason. See [delivery and revision](../author/delivery-and-revision.md) and [host configuration](configuration.md).

Hosts can call `inspectNpmLoomArchive(archivePath, globalRoot)` before installation to verify the compiled commands, read the package identity and compare the selected archive with an existing global installation. The inspection reads data without executing package scripts.

## Kernel operations

| Operation | Behavior |
| --- | --- |
| `installLoom({source, dependencySources?})` | Install a compiled directory or a complete `.tgz`; return the exact reference |
| `listLooms({id?, cursor?, limit?})` | Page through static capability summaries |
| `getLoom(selector)` | Read the exact reference and Manifest without loading author code |
| `removeLoom(id)` | Remove only the direct installation entry and retain bytes used by existing Runs |
| `createRun({loom, input, inputFiles?})` | Load and check the definition, normalize input once, persist a `created` Run |
| `startRun(runId)` | Accept execution of a created Run; return a control receipt, not a completion promise |
| `resumeRun({runId, requestId})` | Continue using the one saved answer; no replacement value is accepted |
| `resumeRun({runId, waitId, resumeData?})` | Accept external wait data once, or receive an owned child Run's saved result |
| `listInteractions({runId, status?})` / `getInteraction(requestId)` | Read requests and ordered response history without executing |
| `respondInteraction(requestId, response, {source})` | Record submit/decline/dismiss; a valid submit requests continuation |
| `cancelRun(runId, reason?)` | Persist cancellation intent and request cooperative cancellation |
| `getRun(runId)` / `getRunResult(runId)` | Read lifecycle state or formal output and quality |
| `listRuns({status?, loom?, parentRunId?, cursor?, limit?})` | Page through `RunSummary` records without business output; use `getRun` / `getRunResult` for output |
| `getRunActivity(runId)` | Read the shared Run activity projection |
| `listRunEvents({runId, after?, limit?, waitMs?})` | Read events after a Run-local sequence number |
| `listArtifacts({runId, cursor?, limit?})` / `getArtifact(artifactId)` | Read saved file records, including drafts and failed-run material |
| `readArtifact({artifactId, offset?, length?})` | Read verified bytes and explicit range information |
| `listAcceptances({runId, cursor?, limit?})` / `getAcceptance(acceptanceId)` | Read immutable reports and their candidate versions |
| `shutdown()` | Cancel all unfinished Runs and descendants, wait for execution to settle, then release storage |
| `close()` | Stop accepting new work, drain accepted work, then release storage ownership |

Selectors accept an exact `{id, version, artifactDigest}`, `{artifactDigest}`, or `{id, version?}`. Names select the active installation in the user-wide Intloom store. Exact digests can select retained snapshots. Run history filters match the ID, version and/or digest saved with each Run, independently of the active installation.
Pages default to 20 entries, allow at most 100, and bind cursors to their query
filters. Events return `nextAfter` when another page exists. Output is `JsonValue`;
there is no unchecked `getRunResult<T>()` assertion for unknown installed Looms.

## Execution and persistence

The internal `src/mastra/` adapter maps Agent, Tool, Skill and Workflow
definitions to pinned Mastra Core 1.81.0 and LibSQL 1.28.0. It owns the native
engine store, per-Run registrations, model binding checks and checkpoint reads.
Kernel supplies execution, prompt, resource, credential and managed-callback
services through narrow ports. Loom authors import `@intloom/loom-sdk`; the adapter
has no public package entry point. Native retries and automatic restarts are
disabled. Kernel waits for managed callbacks to settle before completing a stop.

The Loader verifies installed bytes and compares the loaded definition with the
static Manifest, including contracts, components, resources and dependency
requirements. Compiler and Loader use the same descriptor in `@intloom/loom-sdk/package-format`;
Kernel does not depend on Compiler. A Run stores its exact package and transitive
dependency identities, normalized input and execution binding. A later install
with the same name/version cannot change an existing Run's binding.

Code and inline Steps receive Run identity, an `AbortSignal`, declared immutable
resource reads, structured logging, and declared Agent/Tool calls. Input defaults apply at creation only, including when a
created Run is started after reopening. Code output is already typed business
data and is not parsed against its Schema a second time. The persistence boundary
requires finite JSON; an unencodable output fails with `STORAGE_FAILED`.

Starting persists intent before executing. Repeated starts return `no_change`
without replaying work. Successful execution becomes `succeeded` only after its
output and terminal event are saved. Business errors produce `failed` with a
safe error projection. For an unclassified exception from a known component or inline Step, the message identifies its declared ID. The original exception text and stack stay private. A failed final database transaction cannot report success;
The affected store reports `STORAGE_UNAVAILABLE` until Kernel is reopened after the storage issue is resolved; healthy stores remain available.

Cancelling a created Run immediately records `cancelled`. Active execution first
becomes `stopping`, receives the abort signal, and becomes `cancelled` only after
all managed callbacks settle, including parallel tools, maps and conditions. Cancellation cannot forcibly stop arbitrary JavaScript.
It does not overwrite a recorded failure or affect unrelated Runs. Owned child Runs receive cancellation and must settle before the parent finishes. `close()`
waits for accepted callbacks and never implicitly cancels them, so a callback
that never settles can prevent graceful shutdown.

Reopening inspects persisted engine facts without loading author modules, resolving
credentials or executing business code. It preserves stable waits and their IDs,
reconstructs questions already saved in engine snapshots, and keeps accepted
answers. Explicit continuation uses the original package, dependencies, engine
versions, Node major and non-sensitive bindings. Restart a waiting Run on its
original Node major to continue it. Missing conditions leave a waiting Run with
`recoveryIssue`; they do not trigger downloads, replacement bindings or replay.
Credentials are resolved from the original references before explicit dispatch and
may rotate without changing those references.

A resume atomically claims the native suspended execution before entering business
code. If its Kernel process disappears after that claim and before a new safe boundary, the
Run becomes `interrupted` and cannot resume. A complete saved boundary can repair
an unfinished Kernel write. Cancellation saved at a quiet wait can finish closing
its pending questions after reopening; an interrupted active stop remains
`interrupted`. `getRunResult` exposes output only for a successful Run; execution
status and delivery quality are separate, as described below.

## Waiting and interactions

Only explicit Workflow Step suspensions provide durable recovery. Author
`resumeData` and `suspendData` keep their original business shapes. Questions are
published after all managed work reaches a stable persisted boundary. Parallel,
nested and loop waits retain distinct IDs, including nested foreach iterations;
continuation targets one native resume label at a time.

A request accepts at most one valid `submit`. Kernel normalizes that value once,
saves it with its source, then requests continuation. `decline` and `dismiss`
record no answer and leave the request pending. `false` is a normal business
answer. `responsePolicy: "human"` requires a trusted human channel; caller context
is supplied by the embedding host, not taken from business JSON. This is a local
channel policy, not identity authentication against a malicious host.

```ts
const questions = await kernel.listInteractions({ runId });
const question = questions.find((item) => item.status === "pending");
if (question?.responsePolicy === "any") {
  await kernel.respondInteraction(question.id, { action: "submit", value: answer }, {
    source: { kind: "program", via: "api" },
  });
}
// An already saved answer survives a restart; explicit resume never overwrites it.
await kernel.resumeRun({ runId, requestId });
```

Receipts distinguish `requested`, `not_requested` and `needs_attention`; an
accepted answer is retained when continuation needs attention. Other pending
questions may be answered while the Run is advancing; Kernel serializes their
explicit continuation requests at stable boundaries. After restart, saved answers
remain but no old continuation queue is automatically dispatched.

Independent Loom Steps create owned child Runs with durable call identities.
Resuming reuses the original child and its formal result. In a live Kernel, child
completion can continue its waiting parent; after restart, a completed child's
parent needs explicit continuation. Parent waiting does not imply all children
are idle. `close()` drains the entire managed call chain without cancelling it.

## Artifacts, acceptance and delivery

Authors may call `context.artifacts.write({name, mediaType, data})` with a string
or `Uint8Array`. A fresh identity is returned only after the bytes and metadata
have been saved. The record includes owner `runId`, display name, declared MIME
type, actual size, SHA-256 digest, creation time and component origin. Names are
not filesystem paths; writing the same name creates another version. Package
resources remain separate and read-only. A file saved before a failed metadata
transaction is not discoverable; no background garbage collection is provided.

`readBytes(ref)` reads an owned reference's content; `readText(ref)` requires a
text MIME type and valid UTF-8. Known text types include `text/*`, JSON, XML and
structured `+json`/`+xml` types. MIME declarations do not certify file contents.
Reads verify size and digest and never execute file content. Host range reads
return `{data:Uint8Array, offset, length, totalSize, eof}`; `length` defaults to
1 MiB and must be 1–1 MiB. Offset at EOF returns empty bytes; beyond EOF is invalid.
Range responses retain only the requested bytes in memory while streaming the
file for integrity checking. Metadata remains queryable when bytes are missing.

`context.acceptance.record({subject, result})` requires declared acceptance
criteria. It saves a report, rather than invoking an evaluator. Typed checks
must cover each declared criterion exactly once, with no duplicate or unknown
IDs; all passed yields `passed`, any rejected yields `rejected`. The alternative
`{error:{code,message,details?}}` records a technical failure as `error`.
The method checks contract coverage, finite JSON and referenced artifacts without
parsing an already validated `AcceptanceReportSchema` a second time.

Each report records its candidate, SHA-256 of RFC 8785 canonical JSON, the fixed
criteria and its component origin. Key ordering does not change candidate identity;
invalid Unicode cannot be canonicalized. Reports and files are immutable, so an
explicit repair creates new versions and retains earlier rejected reports.
The Kernel does not schedule automatic evaluation, repair or approval.

At completion, static RFC 6901 pointers select the declared artifact slots and
one final report. Required slots must exist; required multiple slots cannot be
empty. Optional omitted slots are allowed, but selected references and allowed
media types must match persistent records and bytes. Artifact references in
ordinary output are also checked, without making every saved file a delivery.
A selected final report must belong to this Run and describe exactly the selected
candidate and criteria. Parent Runs can deliver child-owned or explicitly reused
files, retaining their owner IDs, but must create their own final report.

`RunResult.outcome` retains the static description/slot/acceptance contract and
adds `deliveries`, a slot-to-reference-array map, only on successful completion.
`RunResult.acceptance` summarizes the selected report's ID, owner, status and
subject digest. `quality` is `passed` or `rejected` for that successful delivery,
and `not_requested` when no final quality conclusion has been committed. For
non-successful Runs, consult `runStatus` and `error`; `not_requested` does not
claim that no evaluation was attempted. Saved reports remain available separately.

| Final evidence | Run status | Result |
| --- | --- | --- |
| Plain output or valid files without acceptance | `succeeded` | `quality: not_requested` |
| Matching passed report | `succeeded` | `quality: passed` |
| Matching rejected report | `succeeded` | `quality: rejected`, without retry |
| Missing file/report, invalid reference or changed candidate | `failed` | `OUTCOME_CONTRACT_UNSATISFIED`; no formal output |
| Selected technical-error report | `failed` | `ACCEPTANCE_EXECUTION_FAILED`; no formal output |
| Cancelled or interrupted execution | `cancelled` / `interrupted` | No formal output; saved materials remain readable |

Output, delivery relations, quality and the successful terminal state share one
Kernel transaction. Reopening can finish that transaction from complete native
execution evidence and saved records, even without author modules. It never
reruns evaluation to repair missing evidence. Read-only result queries return the
committed historical projection; they do not rerun delivery checks or alter a
past quality conclusion. Later file damage is reported by artifact reads.

## Installed packages and ownership

Installation checks format, target, complete file digests, resources and exact
dependency closure without importing runtime modules. Directory installations
can supply additional local `dependencySources`. A graph is registered in one
SQLite transaction only when all dependencies are available. Archives are read
without extraction before validation; traversal, links, duplicate entries and
unexpected files are rejected. Validated bytes are copied to
`packages/<artifactDigest>` independently of author files. Same-ID/version
artifacts coexist by digest. Reopening reads the saved static catalog even when
artifact files are unavailable, so waiting Runs remain inspectable. Loading or
resuming verifies the original artifact and dependency bytes before execution.

`packages.db` owns the global package catalog and `index.db` locates Runs and outcomes. Each selected storage directory has a `kernel.db` for Run, operation, event, Artifact and Acceptance records, `artifacts/<id>` for bytes, and `mastra.db` for engine snapshots. Per-Run Mastra instances borrow that storage, so finishing one Run does not close another Run’s engine. `owner.db` holds
a process-scoped SQLite write transaction for exclusive directory ownership;
another `serve` receives `SERVICE_BUSY`. Normal close or process death releases
ownership, without a time-based takeover. A CLI client connects to its existing
Intloom service instead of opening these databases itself.

`createPackageStore` and `getLoomCatalog` are internal composition/authoring
interfaces, not alternatives for clients to bypass Kernel ownership.
`@intloom/kernel/lifecycle` coordinates lifecycle through narrow repository/runtime
ports without importing local storage or an execution engine.

## Model and tool bindings

`serve({dataDir, projectDir?, bindings?})` loads model settings from `~/.intloom/intloom.yaml` and each Run’s detected project `intloom.yaml`. Project entries replace global entries by model alias, profile or (exact Loom ID/version, slot). Model aliases are replaced as complete descriptions. Agent execution requires an effective default profile. Exact slot bindings take precedence over the Agent profile, then the default; invalid bindings or unsupported capabilities fail instead of silently changing provider.

```yaml
version: 1
models:
  everyday:
    provider: openai
    model: gpt-4.1-mini
    credentialRef: env:OPENAI_API_KEY
profiles:
  default: everyday
  general: everyday
bindings:
  "loom-trip-plan@0.3.0":
    planner: everyday
```

Credential resolution reads the named process variable, then the project’s `.env`, then `~/.intloom/.env`. Only non-secret descriptions and references are persisted. SDK callers can inject Tools and a credential resolver. Changing a Tool implementation requires changing its revision.

A model description contains `provider`, `model`, `credentialRef` and optional
`options`. Current routes:

| Provider | Routing and capability boundary |
| --- | --- |
| `openai` | Known text-generation models in the pinned Mastra registry; `options.api` is `chat` (default) or `responses`; optional HTTP(S) `baseUrl`. Native structured output requires a positive registry capability. |
| `alibaba` | `qwen3.8-flash` with an explicit OpenAI-compatible `baseUrl`; `options.api` is `chat` (default) or `responses`. Native JSON Schema output requires the pinned Alibaba registry capability. The configured endpoint may be a gateway such as OpenCode Console; the model is not treated as an OpenAI model. |
| `minimax-cn` | `MiniMax-M3` / `MiniMax-M3.1-Flash` through the native Messages adapter at `https://api.minimax.cn/anthropic/v1`. An explicit `baseUrl` must equal that endpoint; omit `api`. Native JSON Schema output is unavailable and fails with `MODEL_CAPABILITY_UNSUPPORTED`. |

Registry compatibility is not a claim that every model has passed live-provider
acceptance. Text, structured output and tool loops are verified separately.
Endpoints cannot embed credentials, query parameters or fragments. `env:NAME`
resolves an explicitly named service environment variable. SDK callers can provide
`resolveCredential(reference)` for another store. Actual credentials and clients
are runtime-only, not saved in Run descriptions or passed to author contexts.

Host Tool slots contain `implementation`, `revision`, optional JSON `config` and
`credentialRef`, plus `execute({input, signal, config, credential?})`. The callback
returns unknown external data. Do not put secrets into `config`, which is saved.
The callback itself is not persisted; reopening must supply the same implementation
and revision to execute a previously created Run. JSON-only CLI config cannot
supply runtime callbacks.

## Agent and Workflow execution

Agents use their explicit prompt, instruction resources and ordered Skill text.
Each Run has isolated Mastra registrations. A Code entry remains direct Code;
it can call declared Agents/Tools without becoming a Workflow. Workflow maps
`then`, `map`, `parallel`, `branch`, `foreach`, `dowhile`, `dountil` and nested
Workflows to native Mastra constructs. Step result access stays synchronous and
scoped to the current definition; missing/unselected or foreign results are null.
An empty committed Workflow returns its normalized input.

Pure Code runs do not open a Mastra database. The runtime opens one only when the
Loom declares an Agent or Workflow. Persisted runtime identity uses the Kernel's
package version and its exact engine/storage dependency versions.

Root input is normalized once. Internal typed Step/component inputs and local
Code/Tool outputs are not reparsed. Model-produced tool arguments use native Tool
validation once; external bound Tool output is validated once, including model
calls. Text output is checked against the Agent schema; native structured output
uses the original schema once. Failed tools and incomplete model loops fail the
Run. Model/workflow retries, prompt-based structured fallback and automatic repair
are disabled. `maxSteps` defaults to five and limits the Agent tool loop.

## Current scope

Code, Agent and committed Workflow entries are executable. Tool resources work
inside Code/Steps and Agents; Skills contribute declared instruction resources.
Persistent waits, interaction records, explicit restart recovery and owned child
Runs, Artifact/Acceptance services and final delivery checks are implemented.
The CLI MCP entry connects these same records and services to clients; the Kernel
does not own protocol presentation. Kernel does not download dependencies,
run install hooks or isolate arbitrary author code.

## Model receipts in Run events

Use `listRunEvents({runId, after, limit})` and follow `nextAfter` to the last page. The CLI's `run events` and MCP's `intloom_run_events` read the same ordered events. Events use the typed `RunEvent` contract with `schemaVersion: 1`. Use `getRunActivity` for shared step, execution and usage summaries, including author-provided Tool result summaries. See [Run events and activity](run-events.md) for identity, notification, storage and completeness semantics.

| Event | Details |
| --- | --- |
| `model.invocation.started` | Unique `invocationId`, declared model `slot`, bound `provider` and `model`. Written before dispatching native generation. |
| `model.step.finished` | The same invocation ID, one-based observed native `step`, optional `inputTokens`, `outputTokens`, `reportedCost`, and optional reported `currency`. |
| `model.invocation.finished` | The invocation ID, observed `stepCount`, and `status` of `succeeded`, `failed` or `cancelled`. |

Each receipt includes its Run ID and execution origin. Group by `origin.workflowId` and `origin.stepPath`, joining events by invocation ID. Use step receipts exactly once per invocation and step. Missing metrics are unknown and a reported zero is retained. Cost is the upstream number, with a currency only if identified by the receipt. A reported cost without a currency can be shown separately. A native step can involve provider-specific operations; a step count measures observed native steps. A started invocation without an end receipt remains open or interrupted. Recording a receipt is awaited; a storage fault prevents successful settlement and does not replay generation. Receipts exclude prompts, tool arguments, raw responses, headers and credentials.

Kernel collects structured input-file references from the accepted, normalized input at root and child Run creation. CLI, MCP and in-process callers share this rule. Local CLI file arguments are live references. The Kernel persists their paths with the Run and checks their availability at execution and continuation. A missing file fails the original Run with `INPUT_FILE_MISSING`.


### Run identifiers and local diagnostics

New root and child Runs use `R` plus five uppercase alphanumeric characters, generated with Nano ID. Run creation is serialized within a data directory and retries an identifier already present in its repository. IDs are unique across the service’s registered storage locations. Operation, interaction and artifact identifiers keep their existing formats.

Execution errors retain available original error messages, stack traces and a direct cause in diagnostic details. Resolved credentials and credential-labelled values are redacted before persistence. The CLI renders these details separately from normal progress. Local foreground log observers receive committed author logs; async execution context attributes console diagnostics to their owning Run. These display observers do not control Run execution.

## Structured observation

`serve({dataDir, onRunEvents})` sends `{runId, throughSeq}` after committed events.
`getRunActivity(runId)` and `listRunEvents({runId, after, limit, waitMs})` share
the persisted event contract; waiting queries do not block Run execution.
The [event contract](run-events.md) also defines explicit Approval,
new storage requirements, restart behavior and the absence of automatic replay.

## One service and per-Run storage

The CLI and Studio share one local Intloom service per OS user. Either client can start the service. The service provides authenticated local IPC and MCP HTTP from the same process. The embedded `serve({dataDir})` API creates a Kernel for an application or isolated tests; `dataDir` is not a CLI option.

Pass each invocation directory as the second argument to `kernel.createRun(options, directory)`. The nearest ancestor `intloom.yaml` defines the project. Omitting the directory supplies no project context unless an embedded caller explicitly configured `ServeOptions.projectDir`. The Loom manifest owns storage selection: global by default, project only when declared. A project declaration without a detected project fails before creating the Run.

`dataDir/packages.db` and the immutable package cache are global. `dataDir/index.db` stores IDs, storage locations, parent links and durable stop requests. Run records/events/interactions and artifacts live at `dataDir/looms/<loom-id>/` or `<project>/.intloom/`; Mastra snapshots use the same location. Cross-storage parent/child creation commits their records and events in an attached SQLite transaction. Read-only global queries merge the stores without relocating business data.

`kernel.close()` drains active embedded work and retains durable waits for explicit recovery. `kernel.shutdown()` cancels every unfinished Run and owned descendant, waits for callbacks to settle, then closes storage. The CLI service always uses `shutdown()` for intentional termination, its `shutdown` command requires a preview and user confirmation. `startup` is a foreground observer of a detached service; Ctrl+C only exits observation. OS termination signals sent directly to the service request shutdown. Cancellation cannot undo external side effects and does not resume a stopped Run. Code callbacks must settle or cooperate with their abort signal before cancellation completes.

`getStorageIssues()` reports registered stores that are missing or unavailable. Opening those stores never creates replacement databases. They are excluded from merged listings and fail direct access with `STORAGE_UNAVAILABLE`; healthy stores remain usable. Restore the original path/data and restart to reopen them. Shutdown records stop intent in the global index even for inaccessible Runs. On recovery, quiet waits/created Runs become cancelled; active executions whose cleanup was not confirmed become interrupted. Neither resumes automatically.

If a child Run cannot persist its execution result, its readable parent fails
with `CHILD_RUN_FAILED`; durable stop requests cover the affected descendants.
Unrelated stores continue serving Runs.

Interaction IDs have a derived lookup index, including existing records on first
open. Startup reads only unfinished Runs. Artifact and Acceptance queries apply
their cursor and limit in each database before merging global pages.

Package preparation, credential resolution and execution initialization run
outside the lifecycle commit queue. Commands that prepare the same Run are
ordered; cancellation remains available during preparation. A prepared command
rechecks the current Run before committing, so cancelling it cannot start or
resume execution afterward. Reads return committed records without waiting for
unrelated preparation. Closing the Kernel drains already accepted preparation.

Run contexts expose the required `location` and actual optional `parentRunId`. Environment variables belong to the service process; a later invoking shell does not replace them. Credential lookup uses service process variables, then the Run project/global `.env` configuration.

When the same verified wait is reopened, Kernel preserves its event cursor and update time. A changed recovery issue is recorded separately. Outcome validation reads immutable files outside the lifecycle commit queue. The final state is committed after rechecking cancellation. If an output references an unavailable external store, the readable Run records a failed outcome validation with the source location. The local CLI exports a full Artifact by streaming and verifying it once into a temporary file before publishing the destination.
