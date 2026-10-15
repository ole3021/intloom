---
title: The four Intent stages
---

# The four Intent stages

## Specification

`prepare → analyze → check_scope → draft → check → confirm → commit`

The same Agent performs analysis and drafting in separate Steps. Analysis reads the prompt, existing requirements, actual code and historical reports, distinguishing facts from assumptions. Drafting organizes **feature → requirement → acceptance**, with optional Domain grouping. A batch-edit Tool receives editable objects; Code allocates formal IDs.

Code checks references, scope and coverage. `resolve` collects actual missing answers. Confirmation displays the full proposal, changes, round work and completion conditions. Commit saves a full requirement snapshot and round Record; `roundCriteria` stay in that Record.

## Solution

`prepare → analyze → check_analysis → design → check → confirm → commit`

Solution resolves this Run's Specification Record. Analysis establishes the real implementation context. Design describes affected objects and constraints, a dependency-ordered implementation plan, and verification responsibilities: `implementation`, `validation` or `both`.

Coverage connects work items, targets, implementation items and verification items. Invalid analysis returns to analysis; invalid design or coverage returns to design. Real confirmation precedes a full solution Record and design Artifact.

## Implementation

`prepare → implement → verify → observe (when needed) → check → resolve (when needed) → commit`

Implementation resolves the fixed solution and reads actual files before changing them. Code records host-owned operations, net changes and candidate hashes. Submissions account for every planned item as implemented, reused or incomplete.

Commands run in Code; procedures need actual observations and sources. Repairs remain within the confirmed scope. Same-candidate retries need new diagnostic evidence or user information; unsettled commands are not automatically replayed. A partial handoff requires a candidate-bound user choice. Commit saves one Implementation Record and no Artifact.

## Validation

`prepare → verify → observe (when needed) → assess → check → resolve (when needed) → commit`

Validation resolves the delivered candidate and all round targets. It adopts applicable implementation-only evidence and executes validation/both work independently. The Agent may request supplementary collection, submit observations, assess targets and explicitly update historical findings.

Code checks evidence applicability, complete coverage and real collection decisions. `resolve` offers continue, pause or stop for the displayed evidence gaps. A valid negative or incomplete report can be committed. Candidate drift or an unsettled original execution blocks publication. Commit appends the Record and updates the cumulative Artifact atomically.
