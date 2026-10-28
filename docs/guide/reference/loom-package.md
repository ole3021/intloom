---
title: Loom Package 0.10
---

# Loom Package 0.10

A Loom delivers one callable capability. Code, applications and Agents invoke the same input/output contract. A Loom does not require an Agent. `loom.yaml` is the source entry; Compiler emits `definition`, `plan` and `bindings`, and Kernel adapts that plan to its existing execution engine.

## Smallest package

```text
normalize/
  loom.yaml
  code/run.ts
```

```yaml
schemaVersion: "1"
name: normalize
version: "1.0.0"
input:
  type: string
  minLength: 1
output:
  type: string
execute:
  code: ./code/run.ts#run
```

```ts
// code/run.ts
export function run(input: string): string {
  return input.trim();
}
```

`schemaVersion` defaults to `"1"`. Description is optional. Root input and output are required JSON Schemas; a value may be any JSON type, including null. `LoomCode<Input, Output>` and `defineCode` describe `(input, context) => output`. Context provides cancellation, Storage, optional Project access, and `interaction.request(id, context)`.

A source `package.json` and `tsconfig.build.json` are optional for a minimal package. Dependencies and npm identity belong in `package.json` when needed; its version must match `loom.yaml`, and its type must be `module`. Declare external runtime/declaration dependencies there. When a custom TypeScript configuration is supplied, install the SDK as a dependency. Compiler owns the generated distribution manifest and entry. New definitions cannot coexist with `package.json.loom` in the same source package.

## Agents, interactions and acceptance

```yaml
schemaVersion: "1"
name: edit-text
version: "1.0.0"
description: Edit text and confirm the checked result.
input:
  $ref: ./schemas/text.json
output:
  $ref: ./schemas/text.json
agents:
  editor:
    definition: ./agents/editor.md
    modelProfile: standard
    interactions: [clarify]
execute:
  agent: editor
interactions:
  clarify:
    kind: form
    title: Clarify the intended meaning
    context:
      type: object
      properties:
        question: {type: string}
      required: [question]
      additionalProperties: false
    response:
      type: object
      properties:
        answer: {type: string, minLength: 1}
      required: [answer]
      additionalProperties: false
  approve:
    kind: confirm
    title: Approve this result
    context:
      $ref: ./schemas/text.json
acceptance:
  checks:
    - id: preserveMeaning
      code: ./code/check.ts#check
  confirmation: approve
```

```markdown
---
name: editor
description: Edit text while preserving facts.
---

Use the supplied input. Ask clarify when the intended meaning is uncertain.
Return a result matching the declared output contract.
```

Agent Markdown uses YAML frontmatter (`name`, `description`) followed by instructions. Model selection, I/O, Tool references and interaction permissions stay in the root Agent declaration. This format does not imply support for every vendor's Agent header. A directly executed Agent inherits the Loom I/O unless overridden. Workflow Agents must explicitly declare their own `input` and `output`. Optional `tools` reference exported `AgentTool` implementations; optional `skills` reference Skill Markdown and its packaged assets. References are package-local and relative to the declaring document.

A host configures actual models in its own `intloom.yaml`:

```yaml
models:
  standard:
    provider: openai-compatible
    model: your-model-id
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
```

The supported profiles are `light`, `standard`, `deep`. Configure each profile used by service-executed Agents; missing profiles are errors, with no silent fallback. Credentials are resolved by the host and are never bundled into a Loom. Pure Code requires no model configuration. Legacy `llms` model purposes remain separate.

Interactions are optional named definitions. `form` and `select` define `context` and `response` Schemas; selections use response enums or arrays. `confirm` has the fixed response `{ "confirmed": true | false }`. Code calls a name with data. Agents receive only their declared interactions as Tools, with a `{context: ...}` argument. The host creates one pending action and validates the answer against that exact request. Applications and Agents must relay human decisions. E2E test simulation is separate and logs `actor: test_simulator` with knowledge references.

MCP can present flat primitive fields and enums directly. Complex responses use a JSON text form with the same Schema validation. The TUI provides a validated JSON response editor. The CLI/API can submit structured answers. A necessary decision is never bypassed by presentation fallback. Optional `apps` and per-interaction `app` select prebuilt HTML; `presentation.result.app` selects a terminal result view. App rendering is host-owned; frontend building remains author-owned. See [Loom Apps](./loom-apps.md).

An `AcceptanceCheck` receives detached `{input, output}` and context, returning `{passed, message?, details?}`. It does not edit the candidate. Delivery order is output validation → checks in order → optional final confirmation → successful delivery. Failure or rejection ends the Run without formal output; there is no implicit repair or retry. Passing checks means only that the declared checks passed.

## Workflow composition

`execute: {workflow: ./workflows/main.yaml}` selects a sequential plan:

```yaml
steps:
  - id: normalize
    execute: {code: ../code/normalize.ts#run}
  - id: review
    execute: {agent: reviewer}
    input: {from: normalize}
output: {from: review}
```

A step input defaults to `{from: input}`. `from` references the root input or an earlier execution step; optional `path` is a JSON Pointer. Optional `when: {value: {from: input, path: /enabled}, equals: true}` skips a step when values differ. Referencing the output of a skipped step fails explicitly. Code intermediates must be JSON; Agent boundaries and final delivery apply their declared Schemas. Parallel execution, sub-Loom resolution and implicit retries are not included.

## Development and invocation

```sh
intloom new normalize --template code
intloom check ./normalize
intloom inspect ./normalize --json
intloom build ./normalize
# Install the resulting dist package through the existing Loom installation flow.
intloom run normalize --input '"hello"'
intloom run normalize --input-file input.json
intloom attach RUN_ID --json
intloom answer RUN_ID --action ACTION_ID --answer '{"confirmed":true}'
```

`check` runs static compilation, type checks and artifact validation without replacing `dist`. `inspect` reads the new source definition, references and generated plan without importing business code; it does not replace `check`. `new` refuses an existing directory. `build` retains locking, staging, stable references, dependency checks, declarations, source maps and failure protection. Public Compiler APIs are `compileLoom`, `checkLoom`, `inspectLoom`, `scaffoldLoom`.

Applications retain the existing Operations admission contract: send `run` with `loomName`, JSON `input`, `serviceInstanceId` and a fresh `operationId`; observe the returned `runId`. A completed Run exposes `output`. Waiting exposes `pendingAction` or `pendingAgentCall`. Submit a human answer with the current action ID; do not start a replacement Run. Delegated Agent tasks include business `input` and `outputSchema`. Production callers never need to operate a UI to invoke Code or Agent execution.

`listLooms` exposes `contract.input/output` for new Looms. Logs include the source file/pointer for generated steps. `@intloom/loom-sdk/definition` exports author schemas, `/compiled` exports the compiled protocol, and `/loom.schema.json` provides the editor schema. CLI logs, Run queries and existing mirror/debug tooling remain framework responsibilities.

## Compatibility and recovery

Source schema `"1"`, compiled protocol `"2026-10-27.2"` (the previous `"2026-10-27.1"` and `"2026-10-27"` remain readable) and npm version are separate. The old source format and protocol `"2026-10-15"` remain supported, including existing Intent. Legacy SDK root exports remain available. Compiler and Kernel depend on SDK contracts; SDK core depends only on Zod; the optional browser entry has optional MCP peers.

New Run checkpoints use version 4; version 3 remains readable. Formal output is retained for terminal queries. Generated final confirmation resumes the saved candidate without rerunning the entry. A Code function waiting mid-execution needs an explicit `code.recover(saved, input, context)` continuation for restart. Agent sessions and arbitrary JavaScript stacks are not recreated across process restarts: uncertain execution becomes `RUN_INTERRUPTED`, preserving evidence instead of replaying effects. During a live delegated call, named interaction temporarily replaces the Agent wait; answering restores the same owned Agent call.

Supported JSON Schema is deliberately bounded: draft 2020-12, one explicit type, object properties/required/additionalProperties, array items/length, string length/pattern, numeric bounds/multipleOf, enum/const, oneOf/anyOf, annotations and package-local `$ref`/JSON Pointers. No remote or recursive references, other composition keywords, formats or implicit coercion. Unsupported constraints are errors. Required object keys must have declared properties. Checkpoint identity must match executable content, not just stable resource IDs.

## Branches, managed continuations and evidence

`from: [structuredPreparation, naturalPreparation]` merges mutually exclusive branches. Exactly one referenced step must have produced a value; zero or multiple values fail. References still point backwards, and `path` applies after selecting the one produced value. Conditional Agents prepare their model only when reached. Discovery readiness means admission can proceed; a conditional Agent can still require its profile when that branch executes. Legacy admission policy is unchanged.

An interaction can declare `validate: ./code/validation.ts#validateChoice`. This must export a synchronous `InteractionValidator`: `(answer, requestContext) => {passed, message?}`. Kernel first validates the response Schema and then this rule before consuming the pending action. Failed answers preserve the same request. The rule receives detached values and no execution access; it must not perform side effects. The same validation runs after restoring a wait.

Root `agents.worker.resume: ./code/continue.ts#resume` binds an `AgentContinuation`. It receives `(saved, originalInput, context)`, where saved contains the original named request and accepted answer. It returns the Agent's declared business output. This continuation runs only after recovering an explicit interaction wait. It does not restore the original model conversation or retry an interrupted Agent call. `Code.recover` retains the corresponding Code semantics.

`LoomContext.run` contains `id`, `startedAt`, and the host-supplied context. The host may configure:

```yaml
context:
  userId: local-user
  timeZone: Asia/Shanghai
  answerSource: human
  services:
    booking: http://127.0.0.1:4311
```

This context is captured with the Run and retained across waits. Service URLs must not contain secrets. Host provenance is not an authentication service: applications are responsible for routing actual human answers; automated tests use `test_simulator`.

Accepted answers create durable `InteractionReceipt` records with the action ID, Run ID, request/context, answer, acceptance time and host actor. Code reads a detached receipt through `context.interaction.receipt(id)` or `latest(interactionId)`; Run views expose `interactionReceipts`. An author can compare the receipt with the exact business payload before a write. A boolean or an Agent's claim is not a receipt.

Authors can throw `new LoomFailure("BUSINESS_REASON", "Safe explanation")`. Run errors retain `STEP_EXECUTION_FAILED` and display the declared reason. Ordinary exceptions keep internal details out of public errors. Do not put credentials or raw provider responses in a declared explanation.

Compiler links validators and continuations in the optional `bindings.validators` and `bindings.continuations` registries. Imported package-local JSON resources are typechecked, copied and verified with the emitted modules. The distribution still has exactly three named exports.

The [meeting-room Demo](https://github.com/ole3021/intloom/tree/main/examples/meeting-room-demo) exercises these contracts. Its service request/receipt ledger is distinct from delivery: a cancelled or failed Run can have a real external effect. Reconciliation uses the same saved business request ID and never silently creates a new request.
