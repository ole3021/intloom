# Intent data contracts

Use direct Zod definitions and `z.infer`. Default Stage State exports enforce the JSON boundary; named Schemas retain precise business types for Code and Tools. Runtime creates each State with the actual Run ID and original intent, then applies Schema defaults.

## Directory organization

| File | Responsibility |
| --- | --- |
| [specification-state.ts](./specification-state.ts) | Specification State, baseline, question history, confirmation context, and restricted proposal |
| [specification-artifact.ts](./specification-artifact.ts) | Committed requirements objects and their IDs |
| [specification-record.ts](./specification-record.ts) | JSON Patch, changes, feedback, actual question answers, and Specification Record |
| [specification-analysis-result.ts](./specification-analysis-result.ts) | Specification Agent `clarification_required` / `ready` outcomes |
| [solution-artifact.ts](./solution-artifact.ts) | Architecture structure, scenarios, concepts, decisions, risks, and diagrams |
| [solution-state.ts](./solution-state.ts) | Fixed Specification basis, Solution baseline, proposals, questions, checks, confirmation, and Record |
| [solution-result.ts](./solution-result.ts) | Solution Agent `clarification_required` / `ready` outcomes |
| [engineering.ts](./engineering.ts) | Relative paths, command plans/results, file hashes, and implementation changes |
| [implementation-state.ts](./implementation-state.ts) | Fixed upstream bases, original/checked snapshots, proposals, feedback, host results, and Implementation Record |
| [implementation-result.ts](./implementation-result.ts) | Implementation Agent `ready` outcome |
| [validation-state.ts](./validation-state.ts) | Fixed bases/scope, command results, evidence, test claims, findings, and Validation proposal |
| [validation-result.ts](./validation-result.ts) | Validation Agent `ready` outcome |

## State and proposal boundaries

State defaults initialize draft collections and counters, without inventing business baselines or upstream outputs. Optional fields must be omitted rather than explicitly `undefined`. An absent baseline means initialization has not populated it; `null` means no prior Artifact exists. Later Stage bases store Artifact ID, revision, and the full business snapshot; [flow/shared.ts](../src/flow/shared.ts) owns that shared `basisSchema`.

| Proposal | Agent-owned fields |
| --- | --- |
| Specification | Cumulative changes, questions without answers/skips, `processedFeedbackCount` |
| Solution | Cumulative changes, questions without answers/skips, `processedFeedbackCount`, command plan |
| Implementation | Declared file changes and `processedFeedbackCount` |
| Validation | Per-target checks/evidence, test claims, code issues, and findings |

Tools preserve identity, history, fixed bases, and actual feedback. Agents cannot inject user answers, confirmation, host command results, or formal persistence. Code prepares confirmation and records the matching user response. Validation statistics are computed by Code; proposals cannot supply totals.

## Structure and business rules

Business objects reject extra fields. Preserve the serialized `target_ref`, `origin_refs`, and `record_refs` contracts. Question response state derives from `answer !== undefined || skipped === true`; no `isSolved` or `isHandled` flags are stored. Blocking policy remains unchanged after an answer, and existing question content is immutable.

Schemas check structure and JSON compatibility. Business modules check old patch values, mutation permissions, unique IDs, references, acceptance ownership, skipped uncertainty, upstream versions, confirmation matching, actual file changes, and evidence consistency. See [business rules](../src/README.md) for these Stage-specific requirements and their current limits.
