---
title: Workflow YAML reference
---

# Workflow YAML reference

Compiler reads `workflow.yaml` and referenced Stage files. Unknown fields and duplicate YAML keys are rejected.

## Workflow fields

`workflow.name` is the registered flowName. `exclusive` is optional. `entry` selects a Stage key. Each `stages.KEY` contains `stage` resource and `on` outcome routes.

## Stage and Step fields

`stage.name` matches its declaration. `state` requires Schema and initializer references. `entry` selects a Step key; `steps` contains:

| Step type | Required fields | Optional fields |
| --- | --- | --- |
| Code | `type: code`, `code`, `on` | None |
| Agent | `type: agent`, `agent`, `llm`, `outputSchema`, `on` | `skills` and `tools` arrays, default empty |

Routes are exactly `{ target: KEY }` or `{ end: true }`. Names are nonempty, have no surrounding whitespace, and cannot be reserved object keys. Entries/targets must exist; outcomes are matched exactly.

## Resource references

| Reference | Source |
| --- | --- |
| `@stages/review` | `stages/review.yaml` |
| `@agents/reviewer` | `agents/reviewer.md` |
| `@skills/review` | `skills/review/SKILL.md` |
| `@codes/check` | Default export in `codes/check.ts` |
| `@schemas/state` | Default export in `schemas/state.ts` |
| `@initializers/state` | Default export in `initializers/state.ts` |
| `@tools/draft:readDraft` | Named export in `tools/draft.ts` |

Nested directories are supported. TypeScript references allow `:exportName`; Stage/Agent/Skill references do not. References stay inside resource directories, without traversal/backslashes or declaration source files. These are Compiler references, not TypeScript import aliases.

Agent/Skill Markdown frontmatter requires name and description. Relative TypeScript source imports use .ts; compilation rewrites output imports to .js.

## Artifact metadata

```json
{
  "intloom": {"type": "workflow", "version": "2026-10-08"}
}
```

The full ESM manifest exports generated JS/declarations and `./package.json`. Named generated exports are `blueprint`, `codes` and `agentSpecs`. See [complete authoring example](../development/create.md).
