# Kernel

`@intloom/kernel` is IntLoom's private execution engine, bundled with the CLI. Loom authors use `@intloom/loom-sdk` and `intloom build`; a Loom never imports Kernel internals.

## Responsibilities and state ownership

| Directory | Responsibility | Owned state |
| --- | --- | --- |
| `host/` | Project configuration, frozen resource registries, execution preparation, storage/process lifetime, checkpoint files | One project environment and Service instance |
| `operations/` | Trusted entry policy, admissions, operation receipts, queries and presentation | Instance-scoped request identities and receipts |
| `runtime/` | Run/Stage lifecycle, routing, Call ownership, waits, pause/cancel and recovery | RunState, current Stage State, active Calls, execution facts |
| `execution/` | Execute Code/recovery and Agents, validate outputs, dispatch Tools and model requests | Delegated Agent sessions, claims and Tool/completion receipts |
| `access/` | Bind SDK State, Storage, Project and Interaction capabilities to a Call/Tool lifetime | Capability bindings only; no RunState copy |
| `loom/` | Discover, load, validate and register built Loom packages | Immutable executable resource tables |
| `storage/` | Atomic Artifact/Record persistence and queries | Formal project data |
| `mirror/` | Capture and restore explicit historical execution branches | Immutable images and restore bookkeeping |
| `transport/` | JSON/SSE, MCP and IDE interaction adapters | Connections and observer subscriptions |
| `errors.ts` | Classified errors and safe external projection | No execution state |

Host composes these modules. Host supplies `OperationsPorts` rather than its entire resource owner. Operations calls Runtime and Execution through their contracts; Runtime invokes Execution and supplies Access bindings. Execution and Access cannot import Runtime, Host or Operations implementations. Mirror receives an awaited checkpoint/capture port, never a `RunEntry`. There is no service locator, shared mutable Kernel singleton or second Run state in the transports.

## Admission and observation

A trusted CLI, Studio or Agent IDE entry determines execution policy. Host prepares that policy before Runtime admission; every Run retains a frozen policy. Runtime mutations return `applied`, `not_applied` or `indeterminate`. The distinction is made at the first possible mutation, not inferred from an error code.

`createOperations(host.operations, source).admit(...)` is the single Run mutation entry; there are no direct `run`, `answerAsk`, `cancelRun` or `resumeRun` aliases. New requests check Host availability before effects; known receipts remain queryable during shutdown. Host rechecks availability after asynchronous execution preparation, and suspended Runtime instances reject new mutations.

Operations deduplicates `run`, `answer`, `resume`, `pause` and `stop` by Service instance and operation UUID. The hash also binds source, target and canonical request parameters. A matching pending duplicate returns `pending`; a different request with the same UUID conflicts. Receipts are retained for the entire Service instance and never evicted to make room for another mutation.

`accepted` means admission succeeded, independently of the eventual Run result. `rejected` proves the mutation was not applied. `indeterminate` requires inspection before further work. Receipt queries distinguish `found`, `not_found` and `instance_changed`. After restart, find a Run by its persisted `startedBy` identity rather than replaying an old-instance request. Terminal checkpoints are read-only historical Run views.

Runtime admission never waits for business completion. `watchRun` immediately emits a current snapshot after subscribing; unsubscribing or closing a transport does not cancel the Run. `operations/wait-run.ts` is an observer convenience. Snapshot streams may coalesce updates and are not an audit log.

## Calls, waits and effects

A fresh Call owns each Code/Agent invocation. Access checks authority before starting an operation and again before delivering its result. Async State validation rechecks the binding before writing. Re-entering a Stage creates a new State binding; old capabilities cannot become current again.

Code receives State read/write, Storage read/commit, optional Project operations, and Interaction. Agent Tools receive State read/write, Storage read, and optional Project operations; their actual access object has no commit method. Legacy Agent Tools cannot interact. Protocol 2026-10-27 Agents may request only the named interactions declared for that Agent, through a request-only capability. Each Tool gets a shorter child lifetime. Model adaptation preserves the live capability binding; an unbound copy is rejected. Code/Tools must await their capability uses: returning with pending uses fails with `CALL_UNSETTLED` before routing. A human wait cannot begin while other capability uses are active. A delegated Agent temporarily transfers its single pending slot to a human action and resumes the same owned call after a valid answer.

Cancellation revokes authority immediately and does not roll back external effects. Actual successful commit references are recorded even if their caller was cancelled. `settled` tracks remaining accepted activity separately from logical Run status and optional model metrics. An exclusive Run retains its project reservation until tracked work settles, including after cancellation or failure; a paused Run also retains its reservation. Project subprocesses receive the Call's abort signal; arbitrary Loom code and external systems are still cooperatively cancellable.

Delegated Agent calls own claims, serial Tool execution and up to 256 Tool receipts. Each receipt caches the final result of the entire Tool operation, including post-execution checks and cleanup, so retries cannot turn a failure into success. Active receipts are never evicted. An end Tool prevents additional Tools, but the Agent must still submit its final result. Completion returns a submission receipt, not the next Run view. Closed Tool/completion receipts remain available for 30 minutes after the Call is closed **and its tracked activity has settled**. Restart does not restore claims or replay Tools.

## Recovery

Checkpoint formats 3 (legacy Looms) and 4 (protocol 2026-10-27) store one discriminated boundary: `stage_pending`, `step_ready`, `step_result`, `user_waiting`, `answer_ready`, `agent_waiting`, `executing` or `terminal`. Format 4 preserves structured business input and terminal output. Human waiting is saved before publication. An accepted answer, original action identity and accepting operation are saved before delivery; `executing` is saved before invoking its continuation. New capabilities publish output only after schema validation, acceptance checks and required final confirmation; candidates remain in Stage State until delivery.

On restart, supported human waits and accepted answers enter `ExecutableCode.recover` with a fresh Call and the original action ID. Saved Step results advance routing without executing the Step again. `executing` and delegated Agent waits become `RUN_INTERRUPTED`: external effects are uncertain and are never replayed automatically. Terminal snapshots remain queryable but cannot execute. Corrupt, incompatible and older checkpoint formats are preserved and rejected; this refactor does not migrate them.

Runtime exposes recovery validation independently of persistence and Execution construction. Host uses it both for restart and offline mirror preparation; validation never starts business Code or an Agent.

A checkpoint resumes the original project Run. A mirror creates an explicit historical execution branch with a new trace and cleared originating-operation identity; it remains paused until explicitly resumed. Existing mirror Run IDs are scoped to the restored project.

## Package entries and consumers

The private package exports only `.`, `./host`, `./operations`, `./loom`, `./errors`, `./transport/mcp`, `./transport/ide`, `./transport/interaction`, `./storage/file` and `./storage/sqlite`. There are no wildcard private paths. Root exports contain consumer data types; SDK types are imported directly from `@intloom/loom-sdk`.

Host imports are side-effect free. `host/entry.ts` is the executable child-process entry and is not re-exported by the Host API. CLI Core uses JSON/SSE; the MCP client uses the same Operations admission rules. User presentation and terminal lifecycle remain in CLI.

## Verification

Use Bun for development and the package's Node test scripts: `bun run build`, `bun run typecheck`, `bun run test`, `bun run test:intg`. Unit tests cover state/capability/receipt boundaries; integration tests cover generic built Loom fixtures, actual local services, process restart and both storage backends. CLI integration and package-consumer checks validate the shipped entries. Architecture tests enforce the dependency/export boundaries. These checks do not establish live provider quality or Intent S01/M01 acceptance.

## Optional Apps

`host/app-resources.ts` exposes installed, content-bound App resources. `operations/apps.ts` creates scoped, expiring view grants and projects current interactions/results; answers enter the same admission path as standard forms. Runtime retains business state and durable interaction receipts. No UI state machine is added to execution. `transport/mcp/apps.ts` and HTTP App routes share these operations. MCP metadata keeps view tokens outside model-visible content, and App tools cannot grant run/cancel/resume authority. Host adapters enforce actual user provenance, tool visibility and iframe sandbox policy. See [Loom Apps](../../docs/guide/reference/loom-apps.md).
