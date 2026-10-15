---
title: Define stages and routing
---

# Define stages and routing

Define Loom topology in `package.json.loom` and Stage topology in YAML. Each entry and route target must resolve within its own topology.

```json
{
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

Inside a Stage, route a Code result back to another Step or to the Stage end:

```yaml
check:
  type: code
  code: "./code/check.ts"
  on:
    repair_required:
      target: revise
    complete:
      end: true
```

The second block is a fragment of `stage.steps` and requires a declared `revise` Step. Code must return exactly a matching `outcome`. Ending a Step forwards its outcome to the Stage's Loom route; missing routes fail rather than selecting a default.

## State lifecycle

Every Stage declares `state.schema` and `state.initialize`. The initializer receives Run context and returns Schema input. State belongs to one Stage visit. A same-Stage Step loop retains it; reentering a Stage runs a fresh initializer.

Pass data between stages through deliberate formal outputs rather than implicit State copying.

## Agent Steps

Agent Steps declare instructions, model role, output Schema, Tools and Skills. The host parses final output and applies the returned outcome. Use `thinking`, `working` or `coding`.

See [YAML reference](../reference/workflow-yaml.md) and [execution resources](./execution.md).
