# MCP interface

Start `intloom startup`, then connect to **`http://127.0.0.1:7341/mcp`** using Streamable HTTP and `Authorization: Bearer <token>`. Read the token from `~/.intloom/token`; `intloom status` shows the endpoint and token-file path. The service binds only to loopback and validates Host, Origin and authentication before dispatch. To choose another port, use `intloom startup --port N`, or set `service.port` in `~/.intloom/intloom.yaml` and restart the service.

The endpoint uses protocol **2026-07-28**, `@modelcontextprotocol/server` 2.4.0 and the official Node adapter. Configure clients for that revision. Legacy initialization is rejected. MCP Tasks, sampling, URL elicitation, subscriptions and custom MCP Apps are not provided.

CLI and MCP share the current user's single Intloom service. Client disconnects leave it running. `intloom shutdown` previews unfinished Runs, requires terminal confirmation, cancels them and closes both transports. Cancelled Runs cannot resume. A process crash is separate: interrupted execution is never silently replayed, while durable waits follow explicit recovery rules.

Each MCP Run supplies its own optional absolute `directory`; the service searches upward for `intloom.yaml`. Omission supplies no project context. Npm Looms keep run records and deliveries user-wide. For the compiled-artifact format, storage defaults to global; a Loom declaring `storage: "project"` requires a detected project. Package list/get query the service catalog, including npm Looms discovered in the global prefix. The service startup directory is never used as the MCP Run's project.

Install capabilities with the CLI. MCP provides no installation, arbitrary file-read/write or service-shutdown tools.

## Tools

All tools have object arguments. Exact JSON Schemas are returned by `tools/list`.
Optional fields below are marked `?`. `loom` selectors accept an exact
`artifactDigest`, `id` with an optional `version`, or their full installed reference.
Creating a Run requires the full reference with all three fields. Omitted
`input` is preserved so an author-declared root default can apply.

| Tool | Arguments | Result |
| --- | --- | --- |
| `intloom_looms_list` | `id?`, `cursor?`, `limit?` | Installed capability page |
| `intloom_loom_get` | `loom` | Reference and static Manifest |
| `intloom_run_create` | `loom`, `input?`, `directory?`, `confirmDelivery?` | Created Run, without execution |
| `intloom_run_start` | `runId` | Control receipt |
| `intloom_runs_list` | `status?`, `loom?`, `parentRunId?`, `cursor?`, `limit?` | History matched against each saved Run’s Loom identity, including removed installations. Run summary page without business output; read output with `intloom_run_get` / `intloom_run_result` |
| `intloom_run_get` | `runId` | State, waits and child activity |
| `intloom_run_result` | `runId` | Formal output, delivery, acceptance and quality |
| `intloom_run_activity` | `runId` | Shared structured activity snapshot, including its `throughSeq` cursor |
| `intloom_run_events` | `runId`, `after?`, `limit?`, `waitMs?` | Typed Run events with `nextAfter?`; wait up to 10 seconds for new events |
| `intloom_run_resume` | `runId`, either `requestId` or `waitId` with `resumeData?` | Explicit resume receipt |
| `intloom_run_stop` | `runId`, `reason?` | Explicit cancellation receipt |
| `intloom_interactions_list` | `runId`, `status?` | `{items}`; never opens forms |
| `intloom_interaction_get` | `requestId` | Request and response history |
| `intloom_interaction_respond` | `requestId`, `response` | Answer/action receipt, source `agent / mcp` |
| `intloom_interaction_prompt` | `requestId` | Native presentation round, existing facts, or fallback |
| `intloom_artifacts_list` | `runId`, `cursor?`, `limit?` | Artifact metadata page |
| `intloom_artifact_get` | `artifactId` | Metadata and `uri` |
| `intloom_artifact_read` | `artifactId`, `offset?`, `length?` | Base64 bytes and explicit range |
| `intloom_acceptances_list` | `runId`, `cursor?`, `limit?` | Acceptance page |
| `intloom_acceptance_get` | `acceptanceId` | Report, subject digest and result |

A response is `{action:"submit",value:<JSON>}`, `{action:"decline"}`, or
`{action:"dismiss"}`. No tool accepts a caller-supplied `source` or actor identity.
`requestId` resume cannot supply replacement data. External waits may accept
`resumeData`; owned child wait results come from the child Run.

Normal tool results contain `structuredContent: {ok:true,data}` and a short
consistent text summary. Known operation failures use `isError:true` with
`{ok:false,error:{code,message,details?}}`. Unknown tools and malformed protocol
arguments are protocol errors. A query of a failed Run or rejected quality is a
successful query. An accepted control receipt does not claim task completion.

Loom inputs and interaction answers are validated against the selected capability
by the Kernel; the fixed tool descriptions do not duplicate each installed Loom's
business schema. Inspect `intloom_loom_get` before submitting input. Inspector's
portability checks may warn about these intentionally unrestricted JSON fields.

List tools default to 20 entries and accept limits through 100. Query cursors are
bound to their filters. Artifact ranges default to at most 1 MiB and return
`encoding:"base64"`, `data`, `offset`, actual `length`, `totalSize`, and `eof`.
Protocol results are bounded to 8 MiB. An oversized result returns
`RESULT_TOO_LARGE` with relevant IDs and range/export guidance; store large
business output as an Artifact instead of embedding it in the Run output.

## Resources and interaction

`resources/list` discovers saved files in pages of 20, with `nextCursor` when
more remain. URIs have the form `intloom://artifacts/<artifactId>`; names and
URIs do not reveal storage paths. `resources/read` returns the whole artifact as
text for textual MIME types with valid UTF-8, or a base64 blob otherwise. It does
not execute HTML or JavaScript. Oversized full reads fail explicitly: use
`intloom_artifact_read` ranges or `intloom artifact export` to obtain all bytes.

Only an explicit `intloom_interaction_prompt` opens a form. The first version
supports flat object answers with string, numeric or boolean fields, string
enums, and supported form constraints. Nested objects, arrays and constraints
that cannot be preserved use a fallback with the original question/schema,
a CLI command and argument array, and `canRespondWithTool`. A human-only request
requires the native form or an actual interactive CLI answer; it cannot be
answered by an agent tool call.

Forms use `input_required`, opaque entry-owned `requestState`, and subsequent
`inputResponses`. The form displays the original message and context. Actual
native accept maps to submit, decline to decline, and cancel to dismiss. Only
this trusted native channel records `human / mcp`; deterministic test fixtures
use `test / mcp`. The entry associates the round with the original request and
never creates another Run. Repeated completed rounds return their existing
receipt. A lost/unknown handle fails; explicitly present the still-pending
request again. Saved answers remain authoritative across entry restarts.

Protocol cancellation or disconnect does not invent a decline/dismiss answer or
cancel the Run. Use the explicit business stop tool when cancellation is intended.

## Client setup

Configure the client's Streamable HTTP transport with the URL shown by `intloom status` and a Bearer token read from `~/.intloom/token`. For the official TypeScript client:

```ts
const client = new Client(
  { name: "intloom-caller", version: "1.0.0" },
  { versionNegotiation: { mode: { pin: "2026-07-28" } } },
);
await client.connect(new StreamableHTTPClientTransport(
  new URL("http://127.0.0.1:7341/mcp"),
  { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
));
```

Import `Client` and `StreamableHTTPClientTransport` from `@modelcontextprotocol/client`. A form-capable client advertises `elicitation: {form:{}}` and returns the actual user's action through MRTR. Automated form tests use `test / mcp`; they do not establish real human authorization. Other clients need separate verification of this protocol revision and native forms.

Protocol references: [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http), [MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr), and [elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation).

Run observation follows the [shared event contract](run-events.md). Waiting is
a bounded query, not a push subscription. Explicit Approval requests require
a human source and the fixed `{approved:boolean}` schema; automated callers
cannot satisfy this by choosing a human label.


## Caller-requested file approval

Pass `confirmDelivery: true` to `intloom_run_create` for a packaged npm command. `intloom_run_result` exposes the frozen candidate while the Run awaits review. Use the original request ID to prompt a human in a supported client, or open that request in the CLI. On rejection, the result retains the candidate. A later Run can explicitly receive it as revision input. A pure Agent clarification uses the same interaction tools with `kind: ask` and accepts ordinary external Agent answers.
