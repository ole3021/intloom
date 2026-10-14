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

Specification and Solution expose object editing separately from submission. `edit_specification` and `edit_solution` accept only editable object schemas and a current `draftRevision`. They generate conditional field patches against the actual draft, preserve accepted earlier changes and system provenance, and reject invalid edits without changing State. Mutually dependent objects are edited together. Read Tools expose authoring views, not internal State or a second copy of the Artifact schema. A changed Specification baseline retains `previousDraft` for reconciliation and resets edits against the new basis.

Submission accepts new questions and, for Solution, the check plan. Code derives feedback bookkeeping and checks the current draft before accepting a ready proposal. Necessary questions can be submitted before expansion. Only successful final submission closes the Agent's Tools; accepted edits do not. Formal Check, actual user confirmation and atomic commit remain authoritative.

New-object provenance is derived by Code. For the supported Specification/Solution root kinds with history, review initializes `record_refs` itself and attaches this Run; the editing schema excludes draft history. New nested objects without a history contract, such as Concept rules, have copied `record_refs` removed. Other unknown fields still fail. This avoids regenerating a complete proposal only to clear misplaced upstream history. Existing committed history remains protected against field or parent patches. Other Schema, identity, reference, coverage and confirmation rules still apply.

Implementation freezes this Run's Specification and Solution, records the initial project hashes, and obtains checks from the confirmed Solution Record. Every actual changed path must appear in the declared changes, and every declared path must have changed. Origin references must resolve to upstream objects. Host Code runs the checks, retains returned command results, and requires exit code zero without timeout or truncation. Finalize checks the current files against the checked snapshot and routes back to Check on drift.

`read_implementation` includes `submissionContext`: all net changed paths since initialization, valid upstream object IDs and the exact feedback count. `submit_implementation` validates the cumulative list before saving; missing/unchanged paths, unknown origins or an incorrect count return `saved:false` with all diagnostics for correction in the same Agent. No checks are run at submission. Failed Project/State/Storage operations and an exhausted eight-submission budget still terminate. Formal Check repeats the validations to detect subsequent drift. Solution check plans must terminate, be repeatable and restore temporary runtime data before exit; mutation diagnostics list every affected path. Behavioral CLI operations belong in isolated test fixtures, rather than separate commands writing the live store.

Validation freezes the same upstream versions and the Implementation Record's code snapshot, then independently reruns its commands. Its Agent submits one check per scoped target with evidence, test claims, and findings. Submission runs the same strict review before saving the proposal. The first known report mistake returns `saved: false` with one remaining submission, a fixed rule/message, and safe location fields; the host persists the counter and feedback in Stage State. A second invalid report throws the original non-retryable business error. A saved proposal cannot be resubmitted. Changed upstream bases or code, missing initialization, and real Project/State/Storage failures are never report feedback. Check and Finalize both review the report and current source hashes. A valid report may contain failed, partial, or undone targets; saving it completes the Workflow without starting another repair cycle.

## Questions, feedback, and confirmation

Question IDs, text, options, and blocking policy remain immutable after submission. Specification and Solution proposals supply new questions; omitted history is retained by Code, including actual answers and skips. Repeated unchanged question content remains harmless. Conflicting content, duplicate IDs and invalid option IDs return saved=false with correction feedback, while the accepted draft remains unchanged and the bounded proposal counter advances. draftRevision is a 64-character lowercase hexadecimal token validated by Schema. A stale revision returns the current token without modifying State or consuming the proposal counter. Only interaction Code writes actual answers or skips. An answer or explicit skip determines response state; there is no Agent-owned resolution flag. Follow-up questions use new IDs. Declining confirmation obtains real feedback and returns to the Agent; an affirmative answer containing revision feedback requires another unambiguous confirmation.

Specification requires each skipped question to have a corresponding active Deferred changed in this Run. Solution currently requires an active Risk when any question is skipped; its review does not associate each skipped question with a particular Risk. `processedFeedbackCount` is maintained by submission Code for Specification/Solution; it does not prove semantic treatment of feedback.

Specification and Solution accept at most 12 submitted proposals; Implementation accepts 8. Their Check Steps also bound accumulated feedback. Validation permits one schema-valid submission and, only after a known report rejection, one correction. These limits cover proposal/repair processing, not every model request or user interaction. Structurally invalid Tool inputs remain subject to Effector input validation and its Agent step limit; they do not count as submitted reports.

Specification/Solution/Implementation Check stops with `INTENT_REPAIR_STALLED` when a repair produces exactly the same diagnostic as the preceding Check failure. It saves both diagnostics and does not schedule another Agent. Different violations remain subject to the existing budgets; required checks are never waived to force completion. Command outputs may contain variable timing text, so exact diagnostic equality is a bounded safeguard rather than a universal semantic no-progress detector.

## Project capabilities and evidence

The host binds SDK `ProjectAccess` to its canonical project directory. Stage definitions grant Solution and Validation file listing/reading, and Implementation listing/reading/writing/removal/commands. An IDE can also edit the same project with its native tools; host checks still inspect the actual files.

The current host implementation excludes `.git`, `.intloom`, `intloom`, `node_modules`, `dist`, `coverage`, `.turbo`, `.env` and `.env.*`, `.dev.vars*`, and IntLoom configuration files from snapshots and file access. Symbolic links are rejected. Text operations allow 1 MiB; snapshots allow 10,000 files and 16 MiB per file. Commands default to 60 seconds, allow at most 300 seconds, and bound captured output. See [host project access](../../kernel/src/project/access.ts) for the implementation.

Checks must leave business file hashes unchanged. Projects with generated output in other directories need a compatible command plan or output layout. Project capabilities run with the host process's permissions; they do not provide an operating-system sandbox. Cancellation revokes bound operations and stops host commands, but cannot undo changes or stop independently running IDE actions.

Validation checks evidence ownership, concrete snapshot files and existing lines, and `checkId` references to real host results. Known review rejections emit one `intent_validation_rejected` warning with a fixed `rule` and only safe, bounded optional target/evidence/test/finding IDs, project-relative path, host check ID, line and count fields. Unknown values are omitted; the submitted report, State, raw error message, and project contents are never logged. The public Runtime error code, cause-code chain, and retryability do not change. Executed fulfillment requires a successful, complete command. Test status is compared to the referenced command's result; the current contract does not establish which individual test cases that command executed. The Agent must assess relevance and coverage. Code inspection supports structural facts; browser interaction requires execution evidence. Missing coverage must remain `undone` or `partial`.

The read-only `read_validation_file` Tool supplies numbered source and an exact `lineCount` using the same convention as review. It reads only the requested file and does not save metadata in State. Agents use these bounds for required test/finding ranges and can omit optional source line lists when an exact span is unknown; evidence rules and the single correction allowance remain unchanged. `read_project_file` retains its original raw-content contract.

`validation/scope.ts` derives mandatory current-Run coverage from Specification/Solution Record deltas (including nested changes and removals), Implementation file origins and direct related objects. Nested interface, rule, participant and scenario-step origins map to their nearest reportable owner; references to those children also select affected owners. Origins without a reportable owner conservatively require full coverage. Initial delivery, unassociated file changes or broad configuration changes use full active coverage. Explicitly changed retired/removed targets remain in scope; risks, diagrams and deferreds are supported. Unknown indirect impacts still require Agent assessment; `expand_validation_scope` adds targets with a reason before submission and never removes mandatory scope. This is scoped assessment, not proof of whole-project regression safety.

`read_validation` exposes scoped object content, scope reasons, changed paths and compact command receipts. `read_validation_details` retrieves additional current objects or full command output by ID. Historical baseline reports and hashes remain in State/Storage and are not repeatedly sent to the model. Final reports preserve scope, reasons, necessary removal context and the frozen sources. Unassessed historical targets are not counted as currently verified. Validation statistics describe only the recorded scope.

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

Container edits compare nested object content, so unchanged sibling Modules do not become mandatory solely because they share an App. Requirement changes retain their acceptance criteria in scope. The empty `read_validation_details` query lists a compact target catalog for additional regression selection.

Object edit batches coalesce overlapping parent/child values before compiling patches. An explicit child edit overrides its embedded copy in the same batch, independently of input order; the compiler preserves the reasons and generates one effective edit. This prevents duplicate creation and stale old-value tests generated by the Tool itself.
