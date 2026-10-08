# Runtime

## Recovery checkpoints

Memory remains authoritative. Hosts can configure a recovery store and call `restore()` once before accepting requests. CLI enables `.intloom/runtime/` through `initializeProject({runtimeDirectory})`. Atomic per-Run files contain the consistent Run/Stage/interaction boundary; they are synchronously saved before publishing waits, delivering accepted answers, or advancing to another Step. A saved Step result can advance routing without repeating Code. Stage recovery validates original Schema input against saved output instead of transforming that output again.

`ExecutableCode.recover(saved, access)` handles an accepted answer after process restart. The original Code function and its earlier effects are not repeated. Codes without this optional function cannot restore their waits automatically. In-flight effects and client Agent waits become `RUN_INTERRUPTED`, with their original evidence retained. Normal in-process answers continue the original Promise. `suspend()` revokes live capabilities while preserving recovery files; explicit cancellation remains terminal.

Manual removal abandons recovery for those files; no log-based reconstruction occurs. Damaged or incompatible files fail startup without deletion. Terminal files are retained but not loaded into the next Runtime. See the [complete recovery contract](../../../../design/architecture/runtime-recovery.md).

Runtime executes initialized Blueprints. Core resolves flowName; Runtime does not discover Workflows, load ESM, or invoke Compiler.

## N1 contracts and implementation boundaries

Each ProjectExecution owns createRuntime(options), with codes/agents/effector/required storage. N4 manages Runs in a closure Map and consumes initialized resources. N2 ships initializers with Blueprint; N7.1 executes Agents and N7.2 supplies persistent backends. The initial host-channel work is now implemented in apps/cli.

assertRunState/toRunView, N4 execution, and N6.1–N6.3 answers/stopping are implemented. Answers resume original Code; stopping revokes capabilities/actions and signals cancellation. Core integrates Registry/Runtime. Agents use business Tools; only Code calls interaction. N7.3 verifies complete Specification; actual Codex UI/live models require separate acceptance. Host Core functions also take execution first; see [Core](../core/README.md).

| API | Semantics |
| --- | --- |
| flow(blueprint,intent,source = "cli") | Reject blank intent, prepare the entry-specific executor before creating a Run, preserve original text, return at waiting/completed/failed |
| getRun(runId) | Current snapshot including running; missing Run throws NOT_FOUND |
| listRuns(flowName?) | Current snapshots with optional filter, preserving updatedAt |
| answerAsk(runId,actionId,answer) | Match pendingAction.id, validate/deliver to original call, return next stable snapshot; invalid/stale answers preserve action/time |
| cancelRun(runId) | Cancel one Run as failed/RUN_STOPPED, clear actions, preserve existing terminals |
| cancelAllRuns() | Cancel all active Runs using the same rules |

No separate resume exists. Human waiting retains the unfinished Code Promise/call/continuation; answerAsk continues it without replay. Continuation prepare reads authoritative requests, validates, and prepares pure delivery before consumption. No duplicate status/cursor/pendingAction is stored. Stopping never waits for or rolls back external effects.

## Client Agent calls

`agent-call-types.ts` defines the six request-object APIs: getAgentCall, claimAgentCall, callAgentTool, readAgentAsset, completeAgentCall and failAgentCall. Only `agent_ide/mcp_client` Runs can own these tasks. `agent-call.ts` retains the original invocation and publishes pendingAgentCall, mutually exclusive with human pendingAction.

A stable claimId recovers the same ownerToken. Tools execute serially with immutable request fingerprints and retained receipts: exact toolCallId/input retries return the original output without replay, changed inputs conflict, and concurrent distinct calls return BUSY. The limit is 256 receipts per Agent call, without eviction. Completion waits for Tools, validates the original output Schema once, and resumes the original Run. Completion retries retain the same snapshot until another Agent call starts. Cancellation and host suspension revoke ownership; late results cannot advance the Run.

Task payloads contain instructions, Skills, JSON Schemas and attachment IDs, not functions, model credentials or assetRoot. Only declared attachments up to 1 MiB are readable. Business commits and human confirmation remain Code capabilities. Client claim/receipt state is process-local; restart reports interrupted Agent calls instead of replaying them.

## State and transient resolution

RunState owns immutable execution {source,agentExecutor} and mutable status/cursor/pending action; Stage State owns business work. RunView is an on-demand snapshot, not another state store. Optional recovery checkpoints preserve this memory authority; see the recovery contract below.

| Status | pendingAction | lastError | Cursor |
| --- | --- | --- | --- |
| running | Absent | Absent | Current or upcoming Step |
| waiting | Exactly one of pendingAction or pendingAgentCall | Absent | Current waiting Step |
| completed | Absent | Absent | Last completed Step |
| failed | Absent | Required RuntimeError | Failure/cancellation position |

assertRunState checks combinations, Cursor shape, and timestamps. resolveCurrentExecution checks Blueprint references; interaction/answerAsk check requests/replies. Publish snapshots only after complete transitions.

Resolution is execute{stage,step} or halt, not persisted. RunState.status explains halt; invalid Cursors yield INVALID_CURSOR rather than normal halt. Terminal states retain their last Cursor without an artificial workflow_end Step.

## Projections and errors

toRunView validates state, copies execution/Cursor/action JSON, and serializes times to ISO. It does not update state/time or expose mutable references. lastError exposes code/message/retryable only; internal cause/stack stay in process.

| Condition | Behavior |
| --- | --- |
| Invalid intent or missing Workflow/Run | Kernel API error; Core resolves Workflow |
| Missing service configuration/credentials | API error before Run allocation or business effects |
| Initialization failure after creation | failed/RUN_INITIALIZATION_FAILED snapshot |
| Execution/result/routing failure | Classified failed snapshot without replay |
| Invalid answer | INVALID_REQUEST preserving waiting/time |
| Stale/duplicate answer or not waiting | CONFLICT preserving state/time |
| Inconsistent state | RUN_STATE_INVALID, no invalid projection |

N4 owns post-creation/background error conversion; N6 owns reply validation and stopping. Projection has no extra persistence or error store.

## N2: current Stage lifecycle

createStageState holds only the current Stage. enter releases old bindings, calls initialization, parses seed, and saves the value. Business code receives StateAccess without enter/leave. Frozen context contains actual runId/flowName/stageName/original intent; entry Code still loads baseline.

| Operation/event | Behavior |
| --- | --- |
| create | Requires absence; parse once and store JSON defaults/transforms |
| update | Replace existing value; failure preserves it |
| clear | Idempotent, no initialization or Storage rollback |
| value | Deep-copied readonly snapshot or undefined |
| Same-Stage Step loop | Retain binding/data without enter |
| Waiting/resumption | Same binding; human waiting blocks writes, claimed client Tools may update State within their scope |
| New Stage/same-name reentry | Fresh binding; old access expires, no exited-State cache |
| Failed/completed | Business access expires; internal diagnostics retain snapshot until release |

Copy inputs at call time and serialize writes. After asynchronous Schema parsing, check JSON/scope and publish once. Reject Date/undefined/nonfinite numbers and other non-JSON values. Failed initialization exposes no partial access; stale initialization/writes cannot affect new bindings. Failures do not poison queues or retry automatically. Schemas should accept their stored results, avoiding non-idempotent accumulating transforms.

N3 advances Cursor before N4 awaits enter_stage initialization. Step loops and undefined after clear never trigger enter. N2 does not update RunState/time. bind(assertScope) checks ownership at reads, queued writes, and publication; initializers also check it. Old Steps cannot write during later same-Stage calls. Standard Effector serializes Tools, which must await operations. Business code hands data across Stages via Artifact/Record rather than automatic State copying.

Protocol remains 2026-10-08 with required initializeState; rebuild old artifacts. Compiler/Loader/container tests establish delivery/lifecycle; actual flow integration is proven by N4.

## N3: synchronous resolution and advancement, option A

Routing functions are internal; Resolution/Transition types are exported:

```ts
resolveCurrentExecution(blueprint: Blueprint, run: Readonly<RunState>): Resolution;
applyStepResult(
  blueprint: Blueprint,
  run: RunState,
  executed: Extract<Resolution, { kind: "execute" }>,
  result: StepResult,
  now?: Date,
 ): Transition;
```

resolveCurrentExecution checks Cursor/Stage/Step references, definition names, state invariants, and Workflow ownership before execute/halt, even in waiting/terminal states. It calls no initializers/Code/Agents/Schemas. createRun uses explicit Blueprint/Stage entries rather than object order.

applyStepResult checks running status and executed definition identity, then strict one-field StepResult. step routes select same-Stage targets; stage_end reuses the outcome in Stage.on to enter another explicit entry or finish. Indices accept only own properties. Outcomes are neither defaulted, case-normalized, nor trimmed.

| Transition | Synchronous update | Loop action |
| --- | --- | --- |
| move_step | Target Cursor and updatedAt | Keep Stage binding and continue |
| enter_stage | Target Stage entry and updatedAt | Await initialization, including same-name reentry |
| complete | completed, last Cursor, updatedAt | Notify/end task, invalidate business access, retain diagnostics |

Transition is transient, not Code/Effector output. All targets/names/entries must validate before mutation. Copy valid Dates without requiring wall-clock monotonicity. Failure preserves status/cursor/time and does not itself write failed; N4 classifies owned failures.

STEP_RESULT_INVALID covers result shape; STEP_OUTCOME_NOT_HANDLED missing outcomes; INVALID_TRANSITION target/kind; INVALID_CURSOR positions; RUN_STATE_INVALID ownership/invariants. Stale definitions, moved cursors, or late waiting/terminal results yield EXECUTION_OWNERSHIP_LOST. All default nonretryable; lost ownership cannot overwrite waiting or RUN_STOPPED.

Same-definition/same-cursor checks cannot detect old results after returning through a loop. N4 checks independent call identity; N6 uses actionId; cancelRun revokes ownership. Initialization/errors are integrated, each Step yields the event loop, and no overall loop budget or third business state is added. Restart recovery is handled by the explicit checkpoint layer above.

## N4: execution tasks and notifications, option B

Project initialization supplies RuntimeOptions.prepareExecution, which resolves source/configuration, validates prerequisites, and prepares only the target Agents. Missing llms does not prevent host startup. The host signal is checked before and after asynchronous preparation so closing cannot admit a late Run. Low-level runtimes without this callback retain service execution by default. createRun validates nonblank intent/explicit entries before registration, freezes the policy, generates RUN ID/cursor/time, and retains text. Instance Map holds Blueprint, RunState, current Stage container, and execution control. Runs advance independently with one loop task each.

```text
flow → prepare executor → check host signal → create/register → subscribe to stable state → launch task
task: initialize Stage → resolve → execute → apply result → consume Transition
interaction: publish action/waiting → notify → flow returns while Code awaits
terminal: publish status/error → notify → request returns → task cleans control
```

waitUntilStable checks immediately after subscribing. Notifications wake observers, which project authoritative state and remove themselves on return. Each initializer/Step gets a fresh AbortController. Identity checks cover results/errors/State publication/Storage boundaries; equal cursors do not revive old calls. Controllers are transient control, not third state. Background exceptions are handled immediately; owned later failures still mark failed and clear actions.

executeStep looks up own Code/Agent properties and delegates to Effector with null input. It calls no Compiler/Loader or Agent assembly. Standard Effector makes requests, validates original outputSchema, and binds per-call Tool context; see [Effector](../effector/README.md).

Code gets State/writable Storage/interaction/signal; Agent gets State/read-only Storage/signal without commit/interaction. Human waiting blocks State/Storage writes. Client Agent waiting permits State changes only through a current Tool scope; Agent Storage remains read-only. Agents save questions and route to Code; answers continue Code and return to a new Agent call. Started Storage side effects cannot be undone; business code awaits them, and stale completion rejects results.

askQuestions/confirm validate shallow Schemas and unique question/option IDs, copy JSON, omit optional undefined, generate ASK ID/original Promise, then atomically publish action/waiting/time and notify. One unanswered action per call. Invalid/concurrent/unawaited interaction returning outcome yields STEP_INTERACTION_INVALID. Code may first publish waiting then violate the protocol, so flow may return waiting followed by a failed getRun. N6 supplies public answers/stopping.

## N6.1–N6.3: host orchestration, answers, stopping

Hosts choose clients and present waiting RunView through shared Kernel APIs. Runtime has no client driver, event bus, action history, or third state. [CLI](../../../../apps/cli/README.md) and Codex share one host; Studio is future work.

```text
host: flow → present pendingAction → answerAsk(runId,actionId,answer)
answer: match → synchronous validation/preparation → consume and set running
        → subscribe → deliver original Promise → return next waiting/terminal
cancelRun: revoke activeCall/reply → failed/RUN_STOPPED and clear action → notify → reject → abort
```

New interactions get new IDs; reconnection retains current ID. A single pending action cannot distinguish stale-page answers from a later question, so actionId is required. Consumption has no await and rechecks call/action/continuation; only the first valid concurrent submission succeeds. actionId is neither activeCall, authorization, nor historical-result caching.

Answers cover each requested question exactly once without unknown/duplicate/missing IDs. Skip only isSkippable questions. Preserve one nonblank text answer; options are suggestions and free text is allowed. Generic confirm accepts false/optional feedback. Intent owns required decline feedback; follow-ups call interaction again with fresh IDs.

Invalid submissions preserve state/time. After a lost accepted response, query getRun rather than submit to a new action or restart Code. Dismissal/disconnection preserves waiting. cancelRun preserves existing terminals; cancelAllRuns cancels all active Runs.

cancelRun revokes activeCall/reply before terminal publication, then rejects the answer and signals cancellation so callbacks cannot overwrite RUN_STOPPED. Effector passes signal to Agent; Code/Tools may pass it to APIs. cancelRun does not await the task or roll back effects. Ignored signals may leave tasks alive, but late results expire. Normal endCall revokes old signals too. Nothing resumes after process exit.

Terminals retain Cursor/Stage diagnostics while business access expires. Tasks/calls/replies/observers are cleaned when complete. The live Map retains terminal Runs without eviction. Host suspension releases active calls while preserving enabled recovery checkpoints.

## Files and validation

- contracts.ts, run-state.ts, run-view.ts, routing.ts: APIs/resources, authoritative state, snapshots, transient control.
- create-runtime.ts/create-run.ts: instance Map, entry/query/ID logic.
- run-entry.ts/call-scope.ts: replies, observers, failures, ownership.
- run-loop.ts/execute-step.ts: progression, initialization, dispatch, errors.
- execution-access.ts/interaction.ts: per-call bindings, requests, original Promises.
- answer-ask.ts/cancel-run.ts: synchronous answers, stopping, continuations.
- assert-run-state.ts/to-run-view.ts: invariants/projections.
- resolve-current-execution.ts/apply-step-result.ts: pure resolution/routing.
- stage-state.ts/stage-state-binding.ts: lifecycle, JSON validation, serialization, invalidation.
- ../errors/runtime.ts and schemas/: execution catalog and action validation; requests/replies belong to ../effector/schemas/user-ask.ts.

Projection tests cover errors/times/reference isolation/terminal positions/invalid states. Built exports check declarations and negative types without treating type success as execution proof. Routing units cover entries/loops/reentry/termination/invalid targets/own properties/no partial writes/time copies/stale results. State units cover access; create-runtime tests exercise loops/reentry/clear through actual flow instead of duplicate manual composition.

N4 behavior tests use actual Runtime.flow for Steps/Stages/running queries/unfinished Code/isolation/background errors/stale results/writes. N6 public tests cover repeated questions, no duplicate effects, invalid/stale/concurrent answers, complete matching, cancellation races, and late initializer/execution results; internal tests cover observers/task cleanup. N5 integration additionally spans configuration→Loader→Core→the same Runtime. These tests do not use live clients/models/persistence.

N7.1 adds standard Effector/actual engines with controlled models for shared-Agent isolation, Agent→Question Code→answer→new Agent loops, signals, and late model output. Built entries test assembled requests without proving remote model quality/formal Storage.

N7.3 in Intent uses actual projects/Effector/Tools/both backends for six Steps and feedback/repair/stop/conflicts. Models/answers remain controlled. Post-commit clear failure stays failed while hosts inspect the formal Record; no replay/retry API is added. See the [integration report](../../../../design/kernel/intent-integration-report.md).

## Execution logs

`RuntimeOptions.logger` accepts the host-owned Utils Logger. Each Run binds its generated timestamped runId; each Step invocation adds stageName, stepName and a Run-local executionId. Looping back creates a new executionId, while waiting and answering preserve the original one. `withLogger` propagates this context into initialization, Code, Agent, Tool, State and Storage calls.

Info records starts, completions, waits, resumption and stopping; debug records routing, ownership loss and safe execution summaries. Step duration excludes user waiting; resumption reports waitDurationMs. Errors contain classified codes and bounded sanitized stack locations, with only the code repeated at Run level. Logs never store business values or act as execution/recovery state. The host controls file ownership and failure policy; see [logging](../../../utils/src/logger/README.md).
