---
title: Intent Loom
---

# Intent Loom

`@intloom/intent` develops and iterates features through **Specification → Solution → Implementation → Validation** under one Run ID.

## Value and purpose

It addresses four common problems:

- **Unclear intent:** goals, assumptions, constraints and unanswered questions are mixed together.
- **Inconsistent iterations:** requirements, design and code drift apart.
- **Changes without reasons:** it becomes difficult to trace code to a requirement or explain its impact.
- **Completion without evidence:** written code, successful commands, fulfilled requirements and code quality require separate judgments.

Intent both **advances the current development round and maintains project facts that later work can understand and use**.

## Scope

Intent adds, adjusts, removes and fixes features, including necessary changes to modules, interfaces, data and delivery tests. Independent code cleanup and restructuring belong to a separate Loom. Changing multiple modules for one feature does not authorize unrelated restructuring.

A repair may leave confirmed requirements unchanged. It still needs explicit work items and completion conditions. Preferences and development standards enter through `prompt`, not separate business configuration.

## Formal results

| Stage | Formal output |
| --- | --- |
| Specification | Full requirement Record and current requirement Artifact |
| Solution | Full design/plan Record and current design Artifact |
| Implementation | Actual files and a fixed-candidate Record; no Artifact |
| Validation | Per-round Record and cumulative validation Artifact |

Each stage commits once per Run. Downstream stages resolve immutable same-Run Records. Substantive changes after a stage's formal commit require a new Run. Validation assesses the delivered candidate without repairing it.

Requirements and design need actual user confirmation. Partial delivery needs a separate explicit choice and retains the complete acceptance scope. A completed report may conclude `passed`, `failed`, `partial` or `undone`.

Install the built package or a compatible archive before running:

```sh
intloom loom add @intloom/intent
intloom run intent --prompt "Build a task management application"
```

See [stages](./stages.md), [interaction](./interaction.md), [results](./results.md), [walkthrough](./walkthrough.md), and [Loom design principles](../development/design-principles.md). This refactor has not undergone real-model or two-round E2E validation.
