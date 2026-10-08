# Intent business rules

These modules support the executable Steps in [codes/](../codes/) and Agent capabilities in [tools/](../tools/). [workflow.yaml](../workflow.yaml) and [stages/](../stages/) define routing; [schemas/](../schemas/README.md) defines serialized structure.

## Directory organization

| Path | Responsibility |
| --- | --- |
| `flow/shared.ts` | Frozen Artifact bases, Run-specific upstream output checks, digests, storage identities, Stage commit helpers, and reference traversal |
| `specification/state.ts`, `baseline.ts` | Parse initialized State, save drafts, load the current Artifact, and reject stale bases |
| `specification/proposal.ts`, `questions.ts` | Restricted proposals, immutable question history, actual response state, and feedback accounting |
| `specification/changes.ts`, `review.ts` | Apply cumulative patches and check identities, provenance, references, and skipped uncertainty |
| `specification/confirmation.ts`, `format-confirmation.ts` | Authoritative confirmation snapshot and readable presentation of the complete candidate |
| `specification/interaction.ts`, `errors.ts`, `constants.ts` | Interaction validation, business errors, and fixed Specification identities |
| `solution/state.ts`, `changes.ts` | Fixed Specification basis, architecture patches, containment, references, risks, and check plans |
| `implementation/state.ts`, `checks.ts` | Fixed upstream bases, actual change/origin checks, host commands, and checked file hashes |
| `validation/review.ts` | Target scope, evidence/location checks, report consistency, and computed statistics |

## Stage responsibilities

Each initializer supplies `{ id: runId, intent }`; its State Schema applies defaults, and entry Code reads business data. State belongs to the current Stage. Agents can update only the fields permitted by the Stage's proposal Schema. Code owns frozen bases, real answers/skips, feedback, confirmation, command results, and formal commits.

Specification uses cumulative JSON Patch changes against its baseline. It preserves `target_ref`, `origin_refs`, and `record_refs`; Code checks old patch values, mutation permissions, IDs, references, and acceptance ownership. Check can refresh a changed baseline and request another analysis before confirmation. Confirm presents the reviewed candidate and requires the State and baseline to remain current.

Solution reads this Run's committed Specification and the current Solution baseline. It defines structure, scenarios, concepts, decisions, risks, and D2 diagrams. Apps, Packages, and Modules retain their identities; obsolete Modules are retired. Review checks references and Module containment. The user confirms both the candidate architecture and its exact build/test command plan.

Implementation freezes this Run's Specification and Solution, records the initial project hashes, and obtains checks from the confirmed Solution Record. Every actual changed path must appear in the declared changes, and every declared path must have changed. Origin references must resolve to upstream objects. Host Code runs the checks, retains returned command results, and requires exit code zero without timeout or truncation. Finalize checks the current files against the checked snapshot and routes back to Check on drift.

Validation freezes the same upstream versions and the Implementation Record's code snapshot, then independently reruns its commands. Its Agent submits one check per scoped target with evidence, test claims, and findings. Check and Finalize both review the report and current source hashes. A valid report may contain failed, partial, or undone targets; saving it completes the Workflow without starting another repair cycle.

## Questions, feedback, and confirmation

Question IDs, text, options, and blocking policy remain immutable after submission. Only interaction Code writes actual answers or skips. An answer or explicit skip determines response state; there is no Agent-owned resolution flag. Follow-up questions use new IDs. Declining confirmation obtains real feedback and returns to the Agent; an affirmative answer containing revision feedback requires another unambiguous confirmation.

Specification requires each skipped question to have a corresponding active Deferred changed in this Run. Solution currently requires an active Risk when any question is skipped; its review does not associate each skipped question with a particular Risk. `processedFeedbackCount` records the Agent's claimed consumption of feedback, rather than proving its semantic treatment.

Specification and Solution accept at most 12 submitted proposals; Implementation accepts 8. Their Check Steps also bound accumulated feedback. These limits cover proposal/repair processing, not every model request or user interaction.

## Project capabilities and evidence

The host binds SDK `ProjectAccess` to its canonical project directory. Stage definitions grant Solution and Validation file listing/reading, and Implementation listing/reading/writing/removal/commands. An IDE can also edit the same project with its native tools; host checks still inspect the actual files.

The current host implementation excludes `.git`, `.intloom`, `intloom`, `node_modules`, `dist`, `coverage`, `.turbo`, `.env` and `.env.*`, `.dev.vars*`, and IntLoom configuration files from snapshots and file access. Symbolic links are rejected. Text operations allow 1 MiB; snapshots allow 10,000 files and 16 MiB per file. Commands default to 60 seconds, allow at most 300 seconds, and bound captured output. See [host project access](../../kernel/src/project/access.ts) for the implementation.

Checks must leave business file hashes unchanged. Projects with generated output in other directories need a compatible command plan or output layout. Project capabilities run with the host process's permissions; they do not provide an operating-system sandbox. Cancellation revokes bound operations and stops host commands, but cannot undo changes or stop independently running IDE actions.

Validation checks evidence ownership, existing files/lines, and `checkId` references to real host results. Executed fulfillment requires a successful, complete command. Test status is compared to the referenced command's result; the current contract does not establish which individual test cases that command executed. The Agent must assess relevance and coverage. Code inspection supports structural facts; browser interaction requires execution evidence. Missing coverage must remain `undone` or `partial`.

`targets` skips retired subtrees and selects supported Specification/Solution object IDs. Detailed checks cover that full scope. Summary counts currently cover requirements, acceptances, constraints, and relations for Specification, and scenarios, concepts, and decisions for Solution.

## Persistence and recovery

Later Stages verify this Run's upstream Record ownership and Artifact digest before freezing the basis. Current Artifacts are queried by `flowName=intent` and Stage name; replacements use expected revisions. Specification and Solution each commit their Artifact and Record atomically. Implementation saves a Record; Validation saves an Artifact. Project edits and Storage do not share a transaction, and failure preserves earlier effects.

| Stage | Artifact ID for initial creation | Storage Record ID |
| --- | --- | --- |
| Specification | `ART-intent-specification` | `<runId>` |
| Solution | `ART-intent-solution` | `REC-<runId>-solution` |
| Implementation | None | `REC-<runId>-implementation` |
| Validation | `ART-intent-validation` | None |

All saved data with a Run identity retain the original `RUN-...` ID. Repeat-call guards handle a successful commit followed by State cleanup failure; Runtime does not expose them as failed-Run retries.

The full Blueprint is `exclusive: true`. One host rejects competing work while Intent or another exclusive Workflow is active, including user/Agent waits. External editors and other hosts are not locked.

Specification Clarify and Confirm implement `ExecutableCode.recover`, including feedback collection and reconfirmation. Solution Clarify and Confirm currently rely on the original live call. Unknown effects and interrupted client Agent calls are not automatically replayed. See [restart recovery](../../../docs/guide/usage/recovery.md) and the [integration test boundaries](../test/README.md).
