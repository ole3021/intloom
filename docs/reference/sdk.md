# TypeScript Loom definitions and SDK contracts

For an npm command, point its manifest entry at a module default-exporting `defineCode`, `defineAgent` or a committed `defineWorkflow`. Declare public commands in [loom.yaml](loom-manifest.md). Use `workDirectory(context.run)`, `resultFile` and `ResultFileSchema` to return a file. See [Agents and tools](../author/agents-and-tools.md) and [Workflow composition](../author/workflows-and-child-looms.md).

The `defineLoom` entry and artifact-level storage declarations apply to the compiled-artifact format. For command-based npm Looms, start with the [SDK guide](../../packages/loom-sdk/README.md).

## Minimal compiled-artifact definition

```ts
import { defineCode, defineLoom, withDefault } from "@intloom/loom-sdk";
import { z } from "zod";

const total = defineCode({
  id: "total",
  inputSchema: z.strictObject({
    prices: z.array(z.number().int().nonnegative()),
    quantity: withDefault(z.number().int().positive(), 1),
  }),
  outputSchema: z.number(),
  execute: ({ inputData }) =>
    inputData.prices.reduce((sum, price) => sum + price, 0) * inputData.quantity,
});

export default defineLoom({
  id: "order-total",
  version: "1.0.0",
  description: "Calculate an order total",
  entry: total,
});
```

`defineLoom` accepts Code, Agent, or a committed Workflow as its entry. The
entry owns its schemas; Loom does not duplicate them. The stable `id` uses an unscoped package ID or
`@scope/name` with lowercase letters, digits, dots, underscores and hyphens;
versions are exact semantic versions. The optional display `name` defaults to `id`. Component and Step IDs also permit
uppercase letters. Declare child Looms inline, for example
`dependencies: { analyze: { id: "@example/analyze", version: "^1.0.0" } }`.
Use static literal properties. The [Compiler](../../packages/compiler/README.md) reads
the declaration and generates the typed references before checking the entry.

## Components and context

| Constructor | Definition |
| --- | --- |
| `defineCode` | `id`, I/O schemas, `execute`, optional description and `uses` |
| `defineTool` | I/O schemas and required description; either `execute` with optional `uses`, or a runtime `binding` slot; optional synchronous `summarize(output)` for a short result description |
| `defineAgent` | I/O schemas, explicit text `prompt`, `instructions`, model slot, `outputMode`, optional tools, skills and generation settings |
| `defineSkill` | ID, description, instruction resource and optional auxiliary resources |
| `resource` | ID and a package-relative POSIX file path |

`uses` declares agents, tools and resources available through a callback's
typed `RuntimeContext`. Component calls require normalized input and infer the
referenced component's output. Prompt context exposes only Run identity and
declared resource reads; instruction and skill resources are already declared.
This package only declares context types. The [Kernel](../../packages/kernel/README.md)
implements Run identity, cancellation, declared resource reads, logs and Agent/Tool
calls for Code and inline Steps. Prompt context remains read-only and narrow.
The Kernel also implements Artifact reads/writes and explicit Acceptance records.

Agent text mode requires a string-valued output schema. Structured mode uses
the declared output schema. `generation.maxSteps` defaults to 5; it and
`maxOutputTokens` must be positive integers. Tools add `tool_use` to model
requirements; structured output adds `structured_output`. Explicit requirements
are retained. No model is called during definition.

### Markdown agents and Skill directories

Tool result summaries are persisted display data. See [Run events and activity](run-events.md#tool-result-summaries) for normalization, limits and failure semantics.

An author project has one entry, `loom.ts`. Organize schemas, Steps, Code, Agents and Tools as convenient and import them explicitly. Pure TypeScript definitions work on their own. The Compiler also supports static imports relative to the directory containing the Loom entry:

```ts
import planner from "intloom:agent/agents/enrich-trip.md";
import guidance from "intloom:skill/skills/grounded-trip-planning";

const agent = defineAgent({
  ...planner, skills: [guidance], model: { slot: "planner", profile: "general" },
  inputSchema: preparedSchema, outputSchema: draftSchema, outputMode: "structured",
  prompt: ({ inputData }) => JSON.stringify(inputData),
});
```

Agent Markdown has YAML front matter with `name` (component ID) and `description`, followed by static instructions. Keep typed schemas, tools and dynamic prompts in TypeScript. A Skill directory contains `SKILL.md` with the same required metadata; its lowercase hyphenated name matches the directory. Explicitly imported Skills preserve their relative files, including references, assets, scripts and optional vendor metadata. Attachment references are available as `guidance.resources` through declared resource reads. Shipping scripts grants no execution capability. Tests and examples stay in the author project unless explicitly referenced.

## Step and Workflow

Use `defineStep({id,inputSchema,outputSchema,execute,...})` for inline logic, or
`defineStep(component, {id})` to reuse Code, Agent, Tool, committed Workflow or
an independent `LoomRef`. Resource steps inherit I/O and do not accept overrides.

```ts
import { defineStep, defineWorkflow } from "@intloom/loom-sdk";
import { z } from "zod";

const increment = defineStep({
  id: "increment",
  inputSchema: z.number(),
  outputSchema: z.number(),
  execute: ({ inputData }) => inputData + 1,
});

const workflow = defineWorkflow({
  id: "count",
  inputSchema: z.number(),
  outputSchema: z.string(),
})
  .then(increment)
  .map(({ inputData }) => String(inputData))
  .commit();
```

Workflow type defaults to `mastra`; no other type is accepted. Its independent
Intloom definition stores the following constructs without scheduling them:

| Construct | Data contract |
| --- | --- |
| `then(step)` | Current data must satisfy the Step input; result replaces it |
| `map(fn)` | Explicit JSON result replaces current data |
| `parallel([a,b])` | Same input for each Step; result keys use literal Step IDs |
| `branch([[condition,step],...])` | All matching routes; result keys are optional |
| `foreach(step,{concurrency})` | Array item input and ordered array output; concurrency defaults to 1 |
| `dowhile(step,condition)` / `dountil(step,condition)` | Body runs at least once; its output must satisfy its next input |
| `commit()` | Current result must satisfy the declared final output |

Builders retain their earlier definition when extended. IDs must be unique
within each Workflow; a nested Workflow has its own scope. Package component
Steps connect **normalized** inputs. Independent Loom Steps connect their
**raw** input type because a child Run is a new acceptance boundary.

Inline Steps can declare `suspendSchema` and `resumeSchema`. Only a Step with a
suspend schema receives callable `suspend`; it returns an opaque `Suspended`
control value that should immediately be returned. `resumeData` and
`suspendData` are optional on the first execution. Optional `interaction`
requires both schemas, a message projection and an optional context projection;
its `responsePolicy` defaults to `any` and can be `human`. These are declarations;
persistent waiting, interaction records and explicit recovery are implemented by
the [Kernel](../../packages/kernel/README.md). The SDK exports their framework-independent public
types; it does not own execution or persistence.

`getStepResult(step)` is synchronous and typed as the Step output or `null`.
Reusable Steps see `getInitData()` as `unknown`; Workflow map/condition callbacks
infer the normalized root input. Map and conditions have data access only and
must not hide business side effects.

## Schema and defaults

Use Zod `~4.6.7` directly. `SchemaInput<S>` / `InputOf<D>` describe submitted
values; `SchemaOutput<S>` / `NormalizedInputOf<D>` describe accepted values;
`OutputOf<D>` describes the normal result. Internal connections do not apply
defaults or parse data again.

`withDefault(schema,value)` accepts a JSON constant matching the schema output.
It checks and snapshots that constant once, keeps independent immutable
declaration metadata, and supplies a fresh copy on each default application.
Metadata survives Zod composition, cloning and bundling with an independent
Zod copy. Mutating the original value or a previous parsed value cannot change
later defaults. A default must already be normalized, including nested defaults
and object-key stripping.

Supported contract schemas are finite JSON structures: strings, finite numbers,
booleans, null, objects, arrays, tuples, enums/literals, unions/discriminated
unions, records, nullable values, optional object properties, and representable
built-in constraints. Defaults are allowed only for input/resume. Root and array
`undefined`, arbitrary/unknown schemas, recursive schemas/property getters,
transforms, coercion, codecs, custom refinement/error callbacks, and native
`.default(...)` are rejected. Regex flags other than `u`, and URL normalization
or host/protocol restrictions, cannot be preserved and are rejected. Native
default getters are rejected before reading them. Ordinary business-local Zod
usage is unrestricted.

The constructors check schema definitions, not business input/output. JSON
types alone cannot prove finite numbers, lack of cycles or plain-object identity;
actual external data still requires the owning execution boundary's checks.
The compiler now projects these declarations to JSON Schema; runtime acceptance
remains a separate execution responsibility.

## Outcome and references

Optional `outcome` on Loom describes artifact slots using RFC 6901 JSON Pointers
and optional acceptance criteria. Artifact `multiple` defaults to false and
`required` to true. Criteria must be nonempty and uniquely identified; the subject
pointer cannot contain the final acceptance reference. Definition construction
checks these static rules; output-schema relationships and persisted reference
existence are not verified by this author package.

`ArtifactRefSchema` and `AcceptanceRefSchema` describe strict `{kind,id,runId}`
references. `AcceptanceReportSchema` describes nonempty `checks` with criterion
ID, `passed`/`rejected`, optional message and Artifact evidence. `AcceptanceResult`
accepts either those checks or a technical `error` with code, message and optional
JSON details. Technical failures are not quality rejections. RuntimeContext exposes
Artifact writes/reads and `acceptance.record({subject,result})`; persistence and
final delivery checks are implemented by the [Kernel](../../packages/kernel/README.md).
`ArtifactRecord`, `ArtifactRead`, `AcceptanceRecord`, `AcceptanceSummary` and
`OutcomeView` describe public saved metadata, ranged bytes and delivery relations.
A plain Loom needs only its ordinary output and no acceptance records.

Invalid definitions throw `DefinitionError` with `code`, `path` and `message`.
Type errors reject incompatible connections and incomplete definitions before
execution. Neither mechanism proves arbitrary callback correctness or prevents
side effects in author-written top-level JavaScript.

## Package boundary

This is Node ESM with a Zod peer. Public declarations do not import Mastra,
storage or Kernel types. Context signatures use standard `AbortSignal` and
`Uint8Array`; consumers need standard DOM or compatible Node ambient types.
Public static package contracts include `LoomManifest`, `LoomContracts`,
`ComponentManifest`, `ArtifactIntegrity` and `LoomCatalogEntry`.
Public Run contracts include `RunView`, `RunResult`, `RunControlReceipt`,
`RunEvent`, `RunEventPage`, `RunActivityView`, `RunEventsCommitted`, paginated queries and `IntloomError`. Unknown installed Run
outputs are `JsonValue`, without unchecked generic result assertions.
The framework uses `./package-format` for definition inspection, JSON Schema projection,
Manifest and bundle validation, content integrity and locked dependencies.
`./json` supplies copying, freezing and stable serialization of JSON values.
Run storage and execution interfaces belong to Kernel. Loom authors import the root entry.


## Reporting a business failure

A Code, inline Step or local Tool can call `context.fail("INTENT_EDIT_OUT_OF_SCOPE")` to stop its execution. Use a static public identifier of 1–64 characters starting with an uppercase ASCII letter and containing only uppercase ASCII letters, digits and underscores. Kernel returns `EXECUTION_FAILED` with an optional `businessCode`. Invalid codes are omitted. Ordinary exceptions are projected to a safe message.

`ExecutionError.origin`, when known, identifies the innermost declared `componentId`. Inside a Workflow it also contains the owning `workflowId` and its declared `stepPath` from the outermost Step. Parallel branches and nested Agent/Tool calls retain their own path. A child Loom has a separate Run. Existing errors and older saved Runs can omit these fields. A Loom authored with `context.fail` requires a Kernel that implements it.

## Local input files

Declare `files: z.array(InputFileRefSchema)` for CLI file input. Each reference contains `kind: "input-file"` and an absolute `path`. Use `await readFile(ref.path)` for bytes or `await readFile(ref.path, "utf8")` for text. A `paths: z.array(z.string())` field receives addresses directly.

## Run observation and explicit Approval

The SDK exports the [typed event and activity contracts](run-events.md).
Execution IDs identify calls, while component IDs and step paths identify
definitions. `ArtifactRecord` and `AcceptanceRecord` carry that execution scope.
Interaction requests explicitly distinguish `ask` and `approval`. An approval
Step must use `resumeSchema: ApprovalAnswerSchema` and `interaction: {kind:
"approval", message: ...}`. Its response policy defaults to `human` and cannot
be widened. An Ask may use any supported answer schema. A boolean Ask answer
is not permission to perform a separate action.

## Run storage

`defineLoom` accepts `storage?: "global" | "project"`; the compiler emits the resolved choice in `LoomManifest.storage`. Omission means global storage, including when invoked from a project. Declare `storage: "project"` when Run records, events, workflow snapshots and artifacts belong to the caller's project.

The CLI searches upward for the nearest `intloom.yaml`. A project-storage Loom fails with `PROJECT_REQUIRED` outside a project. It never silently switches storage. Child Looms inherit the invocation context and choose storage independently. `RunSummary.location` identifies the invocation directory, detected project, selected policy and data directory; that binding is retained through waiting and recovery.

`context.run.location` exposes that same required location to author code, and `context.run.parentRunId` identifies an actual parent Run when present. Use these paths explicitly; a shared service never changes its process working directory for a Run.
