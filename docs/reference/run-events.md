# Run events and activity

Kernel events are durable facts. The shared activity projection presents those
facts to the CLI, SDK and MCP. It never executes or resumes business work.

```text
Kernel / managed execution → database commit → RunEventsCommitted
                                   ↓                 ↓
                             Run events ← cursor queries
                                   ↓
                          RunActivityView → CLI / MCP
```

## Read and observe

```ts
const activity = await kernel.getRunActivity(runId);
const events = await kernel.listRunEvents({
  runId,
  after: activity.throughSeq,
  limit: 100,
  waitMs: 10_000,
});
if (events.items.length) {
  const next = await kernel.getRunActivity(runId);
  // Present next; continue observing after next.throughSeq.
}
```

`getRunActivity` reads the Run, related metadata and its events in one database
read transaction. It returns steps, top-level progress, active execution
instances, recent ended calls, interactions, artifact metadata, result metadata, model usage,
validation and a `throughSeq` cursor. Business output and artifact bytes are
read through `getRun`, `getRunResult` and Artifact APIs. The projection is
recomputed from saved records and the Run's immutable manifest; it has no
separate persistence or recovery authority.

`listRuns` returns `RunSummary` records, which contain the Run state and identity
without business output. Filtering, ordering and cursor pagination happen in the
database before summaries are returned. `getRun` and `getRunResult` retain full
business output. CLI overviews and MCP lists use the same summary contract.

Consumers that combine event history with activity snapshots must use a snapshot
whose `throughSeq` covers the events they have read before deciding to stop at a
waiting or terminal state. They wait from their last consumed event sequence;
advancing a history cursor to a newer snapshot would skip unread events.

`activeExecutions` retains all running, waiting and incomplete execution instances.
`recentExecutions` contains the last 20 ended Agent, Tool, Code and Model calls,
ordered by their finish events; `finishedExecutionCount` counts all ended calls
of those kinds. This bounded detail is not a complete call history. Use event
paging for the full history. Both arrays retain execution / parent IDs and
`origin.stepPath`; clients group calls by that path without parsing logs.
Model executions carry their own `usage` with the same receipt semantics as the
Run total. Parent Agent and Step durations and usage must not be added to the
Model total. Projection timestamps are saved facts; a UI may extend a currently
open active or waiting interval using its local clock for a live elapsed display.

`listRunEvents` accepts `waitMs` from 0 to 10,000, default 0. Existing events
return immediately. Otherwise the query waits for a commit or the deadline,
then reads the database again. An empty page means no new events. A caller
retains its cursor on an empty page. Timeline consumers follow `nextAfter` to
read every page; consumers of activity snapshots can advance to the snapshot's
cursor. Registering a wait does not block execution. Its optional second
`AbortSignal` argument closes only the observation. Host shutdown or caller
abort returns `OBSERVATION_CLOSED`; it does not cancel the Run.

In-process hosts may pass `onRunEvents(notice)` to `serve`. The callback receives
`{runId, throughSeq}` after the transaction commits. It should schedule work and
return promptly. Notifications are wake-up hints, not a durable delivery queue;
missed notifications are recovered by querying events. Listener exceptions do
not roll back committed work. The CLI uses the existing local IPC; MCP offers
`intloom_run_activity` and `intloom_run_events` with the same query semantics.
There is no MCP push subscription or Studio implementation.

## Identity and semantics

`RunEvent` is a discriminated union exported by `@intloom/loom-sdk`. Its envelope
contains `schemaVersion: 1`, `runId`, `seq`, `time` and typed payload. Events for
execution boundaries require `executionId` and `origin`; `parentExecutionId`
links calls within a Run. `operationId` links control events to persisted
start/resume/cancel operations. `(runId, seq)` identifies an event and defines
its order; timestamps are not ordering keys.

`origin.componentId`, `workflowId` and `stepPath` identify definitions. Each
loop iteration and concurrent call has its own execution ID. A stable waiting
Step retains that ID across restart and resume. A model invocation uses its
`invocationId` as its execution ID; model-driven Tools are children of that
invocation. A model step receipt is unique by `(invocationId, step)`.

| Facts | Events |
| --- | --- |
| Run lifecycle | `run.created`, `started`, `waiting`, `resumed`, `stopping`, `succeeded`, `failed`, `cancelled`, `interrupted`, `resume.requested`, `recovery.changed` |
| Workflow and Step | `workflow.*` / `step.*`: `started`, `waiting`, `resumed`, `finished` |
| Managed calls | `agent.*`, `tool.*`, `code.*`: `started`, `finished` |
| Model receipts | `model.invocation.started`, `model.step.finished`, `model.invocation.finished` |
| Child Run | `child.created` with child Run and call IDs; child has its own `run.created` |
| Interactions | `interaction.requested`, `responded`, `closed`; `wait.accepted` |
| Results | `artifact.created`, `acceptance.recorded`, `outcome.delivered`, `validation.started`, `validation.finished` |
| Author diagnostics | `log`; never parsed to infer lifecycle, usage or approval |

Workflow hierarchy supplies stage grouping. There is no separate Stage author
API. Plain Code and Agent roots do not acquire fictitious Workflow Steps.
Validation observes the existing final outcome check; it is not another
business Step or an extra evaluator. Unselected branches have no execution
instances. Child Runs retain separate events and usage totals.

## Persistence and limits

Run state, interactions, operations and corresponding events commit together.
Artifact and Acceptance metadata commit with their events; artifact bytes are
saved first. A parent-child link and the child's creation event commit together.
Managed execution awaits its start event before entering business code and
awaits its finish event before returning its result. A storage fault prevents
successful settlement and further dispatch. It cannot undo an external side
effect that already occurred, and it never triggers replay of that side effect.

Waiting events become visible only after the native checkpoint is verified and
saved by the Kernel. Native snapshots and Kernel records remain responsible for
recovery. Missing execution endings after interruption are projected as
`incomplete`; no successful finish or elapsed duration is invented. Cancelling
a stable wait closes its waiting interval without adding active work.

This is a new event storage contract. Older event tables are rejected with
`STORAGE_INCOMPATIBLE`; use a new data directory. Existing files are not deleted
or automatically migrated. Native suspend envelopes use version 2 and require
their saved execution identities. Old notification callbacks and broad
`ExecutionEvent` types are removed. No compatibility with older event stores or
checkpoint metadata is promised.

Events do not include model prompts, reasoning text, complete tool arguments or
results, file contents, credentials, or token-by-token streams. Author logs
remain author-provided diagnostics. Arbitrary background commands are not
automatically managed or observed.

## Accurate totals

Fixed workflows show completed top-level steps over the static top-level count.
Dynamic top-level branches and loops omit that denominator and report observed
completed/active instances. Nested steps and model rounds are not added to the
top-level denominator. Static steps carry a `conditional` flag when execution
is conditional. Active and waiting durations are separate; parallel child
durations must not be added to derive a parent duration.

Usage sums actual model step receipts once. Input and output tokens have
independent receipt counts. Missing values are unknown; reported zero remains
zero. `usage.complete` requires complete observed boundaries, successful ended
invocations, all declared step receipts and both token fields. It does not
assert that monetary costs were reported. Costs are grouped by reported currency;
receipts without a currency are counted separately. No price estimate or
implicit USD conversion is performed. Failed and cancelled calls retain any
receipts already saved, marked incomplete.

## Tool result summaries

A Tool can opt in to a short result description:

```ts
const search = defineTool({
  id: "search_files",
  description: "Search the selected files",
  inputSchema: z.string(),
  outputSchema: z.object({ matches: z.number() }),
  execute: async ({ inputData }) => searchFiles(inputData),
  summarize: ({ matches }) => `${matches} matches`,
});
```

`summarize` is synchronous and receives a copy of the successful Tool output,
with its type inferred from `outputSchema`. It returns text or `undefined`.
It should describe a result without including private content. Kernel removes
terminal controls, collapses whitespace to one line, redacts known credentials
and credential-labelled values, and limits the saved summary to 200 Unicode
code points, including the final ellipsis. Empty text is omitted. This processing
does not recognize arbitrary private information in author-supplied text.

The sanitized value is stored in `tool.finished.details.summary` and projected
as the Tool execution's `summary`. It follows the same commit notification,
paging and restart semantics as other execution facts. CLI displays it directly;
MCP and other consumers receive the same structured value. Full Tool output is
never copied into these events automatically.

Failed or cancelled Tools have no summary. If the summary callback throws or
returns a non-string value, Kernel omits the summary and records a generic
warning without the exception payload; the successful business result remains
unchanged. Summary generation does not add another input/output schema validation
layer or a separate execution status.

## Ask and Approval

Ask accepts the author's answer schema. Explicit Approval uses the exported
`ApprovalAnswerSchema` and a human response policy:

```ts
defineStep({
  id: "review",
  inputSchema: z.string(),
  outputSchema: z.boolean(),
  suspendSchema: z.string(),
  resumeSchema: ApprovalAnswerSchema,
  interaction: {
    kind: "approval",
    message: () => "Approve this report for the next local processing step?",
  },
  execute: async ({ inputData, resumeData, suspend }) =>
    resumeData === undefined ? suspend(inputData) : resumeData.approved,
});
```

Import `defineStep` and `ApprovalAnswerSchema` from `@intloom/loom-sdk`, and `z`
from `zod`. The approval schema is exactly `{approved: boolean}`. `false` is a
valid rejection answer passed to the original Step; the author decides its
business result. `decline` and `dismiss` leave the request pending. Other
sources (`agent`, `program`, `test`, `unknown`) cannot submit an Approval.
Automated tests must not label themselves human. A normal Ask containing a
boolean field does not become an Approval.

An answer, a continuation request and an actual resume are separate facts.
Closing a Run closes pending requests without manufacturing an answer. Approval
is an explicit Workflow interaction, not a global JavaScript permission system.
