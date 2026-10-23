---
title: Read Intent results
---

# Read Intent results

## Four Records, three Artifacts

A **Record** preserves immutable facts from a stage in one Run. An **Artifact** is a current snapshot or accumulated view. Stage State is temporary and is not a formal handoff.

| Result | Interpretation |
| --- | --- |
| Specification Record | Full requirements, round work, coverage, round criteria, changes and actual confirmation |
| Specification Artifact | Latest formally confirmed requirements; not proof of implementation |
| Solution Record | Fixed requirement reference, full design, implementation and verification plans, target definitions and confirmation |
| Solution Artifact | Latest intended design; not a description of all existing code |
| Implementation Record | Actual changes, operation origins, candidate manifest, verification receipts and complete/partial handoff |
| Validation Record | Fixed source chain, candidate, full target assessments, findings, evidence and collection decisions |
| Validation Artifact | Ordered Record index, latest round, versioned target results and explicit historical finding updates |

There is no Implementation Artifact or versionless project-wide pass flag. File hashes identify a candidate; they are not a file backup or proof that a running service uses that candidate.

## Assessment outcomes

Each target is `passed`, `failed` or `unverified`. Code derives the round summary:

- `failed`: at least one target failed.
- `passed`: every target passed; an empty scope cannot pass.
- `partial`: some targets passed and the rest remain unverified.
- `undone`: no target has a conclusive pass/fail judgment.

Run completion means the report was saved. A command exit code is evidence to interpret, not an automatic business verdict. Partial delivery and stopping collection do not approve acceptance.

## Across Runs

Untouched targets retain their historical candidate and definition. A new unverified result does not fall back to an older pass. Changed definitions have separate index entries. Round-only criteria remain in Records.

Historical findings change only through explicit updates: `present`, `resolved`, `no_longer_applicable`, `unverified` or `invalidated`. Later uncertainty preserves the last definite assessment as history without claiming it verifies the new candidate. Omission does not close findings.
