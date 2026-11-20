# @intloom/loom-sdk

Authoring contracts for Intloom 0.5 Looms. The SDK provides Zod declaration schemas, typed Code contexts, `agent()` and `workflow()` definitions, and the compiled manifest contract. Import public APIs from `@intloom/loom-sdk`.

## Declare a Loom

`package.json` supplies the npm name, semantic version, `"type": "module"` and dependencies. Declare the SDK as a runtime dependency; Agent schemas can import Zod 4 from a direct `zod` dependency.

`packageIdentitySchema` validates the shared package-name/version identity used by the Compiler and Kernel. `loomIdSchema` validates the complete package name; `packageVersionSchema` requires a complete canonical semantic version.

```yaml
schemaVersion: "0.5"
name: Report writer
entry: ./src/main.ts
execution:
  scope: intloom
input:
  prompt:
    required: true
    description: What the report should cover
output:
  summary:
    type: markdown
    path: summary.md
```

`name`, `schemaVersion`, `entry` and `execution.scope` are required. `description`, `agent`, `input`, `output` and `resources` are optional. `execution.scope` is `intloom` or `workspace`. References select the default export; append `#exportName` for a named export. Local module extensions are `.ts`, `.mts`, `.js` and `.mjs`.

Inputs have optional `prompt`, `files` and `folders`. Each declaration accepts `required` (default `false`) and `description`. Required prompt text must contain non-whitespace characters; required lists must contain an item. `LoomInput` preserves omission versus `[]`; file and folder values are complete execution-environment paths. `createLoomInputSchema(declaration)` validates this boundary.

List declarations also accept `minItems / maxItems`; `files.extensions` lists allowed extensions such as `[".txt", ".md"]` (case-insensitive). These bounds apply to provided lists; use `required` to require presence. `input.exactlyOne: [prompt, files]` requires exactly one named field to contain nonblank text or a nonempty list. The fields must be declared, distinct, and have at most one required field.

Outputs are named `markdown`, `file`, `files` or `folder` declarations. The first, second and fourth use a concrete relative `path`; `files` uses a nonempty `paths` array. Paths are relative to the bound work directory and cannot escape it or contain globs. The optional reserved `summary` output must be `markdown` and is intended for default presentation. Public outputs describe artifacts; business schemas belong inside the Loom.

## Code

```ts
import type { LoomEntry } from "@intloom/loom-sdk";

const main: LoomEntry = async (input, context) => {
  await context.fs.write({
    path: `${context.workDir}/summary.md`,
    content: input.prompt ?? "No prompt supplied.",
  });
};
export default main;
```

`LoomEntry` is `(input: LoomInput, context: RunContext) => Promise<void>`. Internal Code functions can take JSON-compatible business input and return JSON-compatible data or `void`. `context.exec(target, input)` infers the target's input and result and returns a Promise; execution failures reject it.

`CodeContext` is discriminated by `mode`. Run has `runId / scope / workDir / tempDir`; PATCH also has `patchId`; chat has none of those fields. All branches have these typed capabilities:

| Capability | Contract |
| --- | --- |
| `fs.read({ path })` | Read strictly valid UTF-8 text |
| `fs.write({ path, content })` | Validate and write UTF-8 text |
| `fs.mkdir({ path })` | Create a directory and its parents |
| `fs.stat({ path, followSymlinks? })` | Return type/size, or `null` if missing; default does not follow links |
| `fs.list({ path })` | List one level of names and entry types |
| `fs.remove({ path, recursive? })` | Remove a path; recursion is explicit, missing paths succeed |
| `fs.mkdtemp({ directory, prefix? })` | Create and register a unique temporary directory |
| `process.run({ command, args, cwd, timeoutMs?, maxOutputBytes?, env? })` | Execute directly and return a command receipt |
| `user.ask({ question, mode, ... })` | Collect validated user feedback |
| `signal` | Current execution's cooperative cancellation signal |
| `reject({ reason })` | Immediately reject this Exec |
| `store.get(key)` | Read JSON data or `undefined` |
| `store.set(key, value)` | Create or replace JSON data |
| `store.delete(key)` | Delete a key; missing keys are accepted |
| `store.list({ prefix?, limit?, cursor? })` | Return `entries` and optional `nextCursor` |

File methods accept complete paths; the Kernel Run binding also resolves relative tool paths against workDir. Contexts describe Kernel-provided capabilities; this package constructs definitions and types. Ordinary child Execs share the current Loom Store, mode and bound directories. Code children in a Run share one Node execution process and retain closures. Agent children use their own definitions and explicitly supplied business input.

The [Kernel Store](../kernel/README.md#store) implements persistent JSON data, literal-prefix pagination and host connection ownership. Author-facing `KeyValueStorage` keeps the four methods above; its connection belongs to the host.

### Text, processes and cleanup

`decodeUtf8 / encodeUtf8` and file tools reject illegal UTF-8 or unpaired JavaScript surrogates with `TextEncodingError`. They preserve existing BOMs and newlines, add no BOM, and perform no encoding guessing or normalization. Process output follows the same strict UTF-8 rule.

Process receipts distinguish `exited / launch-failed / timed-out / signaled`, with `exitCode`, `signal`, stdout/stderr, `truncated`, command/arguments, working directory and timing. A nonzero exit is evidence data. Execution cancellation rejects the waiting call instead. `maxOutputBytes` bounds combined stdout/stderr capture; truncation is explicit and captured text remains valid Unicode.

```ts
import { withTempDir } from "@intloom/loom-sdk";

const receipt = await withTempDir(context, async (directory) => {
  await context.fs.write({ path: `${directory}/check.mjs`, content: "console.log('ok')" });
  return context.process.run({ command: "node", args: ["check.mjs"], cwd: directory });
});
```

The Kernel binding stops managed processes before temporary-directory removal and owns final cleanup. `withTempDir` cleans up on success, error and cancellation; a preceding business error remains primary if cleanup also fails, and the binding records cleanup failures. Retained handoff snapshots belong in `workDir`, outside this short-lived directory.

Use `context.signal` for external operations such as `fetch`. Managed tools bind cancellation automatically. `ExecutionCancelledError` and `ExecutionRejectedError` distinguish cancellation and business rejection from ordinary failure. `executionResultSchema` describes `succeeded / failed / rejected / cancelled`; each nonsuccess result requires a readable reason. Unhandled child rejection propagates through `context.exec`; a parent can catch and handle it. Rejection and output completeness are independent: a rejected execution can leave all declared evidence ready.

SDK cancellation, rejection and text-encoding errors retain `instanceof` identity when an installed Loom and its executor load separate SDK copies.

`RunResult` / `runResultSchema` describe the Kernel's final task facts: `runId`, `execution` and `outputs`. `OutputCheck` separates `none / ready / incomplete` from execution status; incomplete checks contain `OutputIssue` entries with output name, full path and reason. `outputs.result` and `outputs.current` map output names to `ArtifactRef` values with type, full path(s), optional description and source Run/PATCH identity. Business return values remain separate from task output facts. See [Kernel Code Runs](../kernel/README.md#code-runs) for runtime authorization, cancellation and retention.

### Feedback with `user.ask`

`question` is required plain text; optional `context` is a plain-text explanation. Clients choose presentation, including single-line/multiline controls. Modes are `text` (string), `confirm` (boolean), `single` (one selection) and `multiple` (a nonempty selection array).

```ts
const reply = await context.user.ask({
  question: "What should change?",
  context: "Describe the revisions needed before approval.",
  mode: "text",
  schema: z.string().trim().min(1),
  allowSkip: true,
  allowDefer: true,
});
if (reply.status === "answered") console.log(reply.value);
```

Choice modes require `options: [{ value, label }]` with unique values. `allowCustom: true` enables manual answers. Feedback preserves `{ kind: "option", value }` versus `{ kind: "custom", text }`; multiple selections cannot repeat. An optional Zod schema further validates the mode's answer value. Serializable tool calls use JSON Schema; `describeQuestion` exposes the client description while executable Zod validation stays in the Kernel binding.

Accepted answers return `{ status: "answered", value }`. Invalid submissions retain the same interaction, draft and validation issues for retry, without rerunning earlier work or consuming a Workflow repeat round. `allowSkip: true` adds `{ status: "skipped" }` to the result. `allowDefer: true` keeps the original call waiting. Both default to false. Confirmation feedback `false` is an answer. `ask` binds no business actions: the Loom or Kernel decides what follows.

## Agent

```ts
import { agent } from "@intloom/loom-sdk";
import { z } from "zod";

export const reviewer = agent({
  instructions: async ({ prompt, mode }) => `Review the supplied text (${mode}).`,
  returns: z.object({ passed: z.boolean(), issues: z.array(z.string()) }),
});
```

Agent input is always a required string. `instructions` is required text or a synchronous/asynchronous callback receiving readonly `AgentContext`; it is prepared once per execution. Optional fields are:

- `model`: a host-configured model reference; omission selects the Kernel default.
- `returns`: a Zod schema for the business result; omission means final text.
- `loomInput`: a synchronous `(input: LoomInput) => string` adapter for standard Loom input.
- `skills`: package-relative Skill directory paths.
- `tools`: named built-in references or Exec tool declarations.

The host-started main conversation returns text even when its Agent has `returns`. Ordinary child Agent calls, including chat children, retain the declared business result type.

```ts
const extract = async (input: { source: string }) => ({ text: input.source });
export const assistant = agent({
  instructions: "Read, extract and review supplied material.",
  tools: {
    read: "fs.read",
    review: { exec: reviewer, description: "Review a draft." },
    extract: {
      exec: extract,
      description: "Extract material.",
      input: z.object({ source: z.string() }),
    },
  },
});
```

Built-in references are the file methods above, `process.run`, `user.ask` and `execution.reject`. Code/Workflow tools require an `input` Zod schema whose parsed value matches the target. Agent tools omit `input` and use `{ prompt: string }`. Omitted tools expose no arbitrary business delegation. The main `loom.yaml.agent` reserves `startRun` and `startPatch` for the host.

## Workflow

```ts
import { workflow } from "@intloom/loom-sdk";

export const review = workflow<string>()
  .step("review", { exec: reviewer, input: ({ input }) => input })
  .returns(({ steps }) => steps.review)
  .build();
```

Mappings receive deeply readonly `input` and prior `steps`. They are synchronous; their result matches the target input. Finalize with `.build()` to obtain an executable `WorkflowDefinition<Input, Output>` and compact exported declarations. Omitting `.returns()` gives `void`; a builder itself is not executable. Workflow entry input must accept `LoomInput`.

- `when`: evaluated before a step's input mapping; false skips input, execution and next rules and advances in declaration order.
- `next`: a later local step name, `null` to finish, or ordered `{ when, to }` rules ending in an unconditional `{ to }` fallback. Conditions also receive the current `result`.
- `.repeat(name, { exec, input, until, nextInput, max })`: a loop position. `max` is a positive integer; `until` and `nextInput` receive readonly `result` and one-based `iteration`. The first iteration always runs. Success returns the final iteration's result; an unmet condition at `max` is an execution failure.

Optional steps produce optional results. After any `next`, subsequent results are conservatively optional, including the view passed to `.returns()`. The Compiler validates unique local names, forward targets, fallback placement and repeat bounds without calling mappings.

## Skills and resources

Each `skills` path names a directory containing `SKILL.md` with standard YAML frontmatter. `name` must match the directory, use lowercase alphanumeric/hyphen segments, and be at most 64 characters; `description` is required and at most 1024 characters. Standard optional metadata is supported. Each Agent's Skill names must be unique.

The Compiler includes each discovered Skill's complete directory tree. Other files/directories can be listed in `loom.yaml.resources`; use concrete package-relative paths. Resources keep their package-relative locations. `agents/openai.yaml` may travel as a file but has no interpreted behavior. Skill metadata does not grant tools or path permissions.

See the repository's [examples](../../examples/README.md) and [Compiler documentation](../compiler/README.md) for checking, building and archive consumption.
