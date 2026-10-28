---
title: Loom definition reference
---

# Loom definition reference

For new authoring and development commands, see [Loom Package 0.10](./loom-package.md). The Stage/Step, package.json.loom and fixed-input contracts below remain as the legacy Intent compatibility reference.


The top-level definition lives in `package.json.loom`; each Stage has its own YAML document. This legacy format does not use `loom.yaml`. Unknown definition fields, duplicate keys and reserved names are rejected.

```json
{
  "name": "review-loom",
  "version": "0.1.0",
  "type": "module",
  "loom": {
    "type": "loom",
    "version": "2026-10-15",
    "name": "review",
    "inputs": ["prompt"],
    "entry": "review",
    "stages": {
      "review": {
        "stage": "./stages/review/stage.yaml",
        "on": {"complete": {"end": true}}
      }
    }
  }
}
```

`loom.name` is the registered name. `inputs` selects fixed slots from `prompt`, `files`, `dirs`, `urls`; every declared slot is required. `exclusive` is optional; `entry` selects a Stage key. Package and protocol versions are independent.

```yaml
stage:
  name: review
  state:
    schema: "./schema/state.ts"
    initialize: "./code/initialize.ts"
  entry: check
  steps:
    check:
      type: code
      code: "./code/check.ts"
      on:
        complete:
          end: true
```

`stage.name` must match the top-level key. Code Steps require `type`, `code`, `on`; Agent Steps require `type`, `agent`, `llm`, `outputSchema`, `on`, with `skills` and `tools` defaulting to empty arrays. `llm` is `thinking`, `working` or `coding`.

Routes are exactly `{ target: KEY }` or `{ end: true }`. A Step exit outcome is matched against its Stage’s `on` in `loom.stages`. Entries, targets and exit mappings must exist. Cycles are legal; unreachable nodes produce warnings.

## Resource references

| Reference | Resource |
| --- | --- |
| `./stages/review/stage.yaml` | Stage YAML |
| `./agent/reviewer.md` | Agent Markdown |
| `./skill/review/SKILL.md` | Skill Markdown and directory assets |
| `./code/check.ts` | TypeScript default export |
| `./schema/state.ts#stateSchema` | Named Schema export |
| `./tool/draft.ts#readDraft` | Named Tool export |

Paths resolve relative to the declaring file; fields determine resource kinds, not folder names. Package-internal `../` references can share `src`; escaping paths, backslashes and `.d.ts` resources are rejected. TypeScript selectors use `#exportName`; YAML/Markdown have no export selector. Local module re-exports are supported.

Agent/Skill frontmatter contains only `name`, `description`; the body describes the role or capability. Stage definitions bind model purpose, Schema, Tools and Skills. Packaged Skill asset paths are relative to the entry. Private environment files and asset symlinks are rejected.

Building generates an independent distribution manifest and three named exports. See [Compiler](./compiler.md) and the [complete example](../development/create.md).
