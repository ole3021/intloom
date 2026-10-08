---
title: Workflow YAML reference
description: Source fields, resource references, routes, metadata, and compiled exports.
---

# Workflow YAML reference

The Compiler reads `workflow.yaml` from the package root. Workflow and Stage source objects are strict; unknown fields and duplicate YAML keys are rejected.

## Workflow document

| Field | Meaning |
| --- | --- |
| `workflow.name` | Registered execution name (`flowName`) |
| `workflow.exclusive` | Optional boolean; true excludes competing active Runs in the same host |
| `workflow.entry` | Entry Stage key |
| `workflow.stages.<key>.stage` | Stage resource reference |
| `workflow.stages.<key>.on.<outcome>` | `{ target: <stage-key> }` or `{ end: true }` |

## Stage document

| Field | Meaning |
| --- | --- |
| `stage.name` | Stage name matching its Workflow declaration |
| `stage.state.schema` | Zod Schema resource reference |
| `stage.state.initialize` | State initializer resource reference |
| `stage.entry` | Entry Step key |
| `stage.steps.<key>` | Code or Agent Step |

A Code Step contains `type: code`, `code: <reference>`, and `on` routes.

An Agent Step contains `type: agent`, `agent: <reference>`, `llm`, `outputSchema: <reference>`, and `on` routes. Optional `skills` and `tools` arrays default to empty. Runtime model roles are `reasoning`, `coding`, and `review`.

For either Step type, each `on.<outcome>` is `{ target: <step-key> }` or `{ end: true }`. A Stage end forwards that outcome to its Workflow-level route. Do not put both `target` and `end` in one route.

Names must be nonempty, have no surrounding whitespace, and avoid reserved object keys `__proto__`, `prototype`, and `constructor`. Entries and targets must resolve within their respective topology.

## Resource references

| Reference | Source |
| --- | --- |
| `@stages/review` | `stages/review.yaml` |
| `@agents/reviewer` | `agents/reviewer.md` |
| `@skills/review` | `skills/review/SKILL.md` |
| `@codes/check` | Default export from `codes/check.ts` |
| `@schemas/state` | Default export from `schemas/state.ts` |
| `@initializers/state` | Default export from `initializers/state.ts` |
| `@tools/review:readDraft` | Named export `readDraft` from `tools/review.ts` |

TypeScript resources accept a `:exportName` selector; without it they use the default export. Stage, Agent, and Skill references have no export selector. Nested resource directories are supported. References must stay within their resource directory and cannot use traversal, backslashes, or `.d.ts` source files.

These `@...` values are Compiler source references, not TypeScript import aliases. Relative TypeScript source imports use `.ts`; output imports are rewritten to `.js`.

## Markdown metadata

Agent and Skill Markdown starts with YAML frontmatter containing `name` and `description`; the body contains instructions. Step YAML binds the Agent to its model role, Tools, Skills, and final output Schema.

## Package metadata and exports

```json
{
  "type": "module",
  "intloom": {
    "type": "workflow",
    "version": "2026-10-08"
  },
  "exports": {
    ".": {
      "types": "./dist/workflow.generated.d.ts",
      "default": "./dist/workflow.generated.js"
    }
  },
  "files": ["dist"]
}
```

This fragment supplements a full package manifest, including name, version, and runtime dependencies. Compiler validates the source package's generated-entry layout. It emits named `blueprint`, `codes`, and `agentSpecs` exports; it does not publish an internal wrapper or instantiate Agents at build time.

See [Create a Workflow](../development/create.md) for a complete package and [Compiler](./compiler.md) for build behavior.
