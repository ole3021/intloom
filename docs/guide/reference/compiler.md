---
title: Compiler reference
---

# Compiler reference

`@intloom/compiler` is a build-time library. Call it from your package's build script; it has no separate CLI and is not a runtime dependency.

```ts
import { compileWorkflow } from "@intloom/compiler";

await compileWorkflow({
  packageRoot: "/absolute/path/to/workflow-package",
  tsconfigFile: "tsconfig.build.json",
});
```

| Option | Contract |
| --- | --- |
| packageRoot | Required package root |
| tsconfigFile | Optional in-package config, defaults to tsconfig.build.json |
| logger | Optional caller-owned Utils logger |

The return type is `Promise<void>`. Output is written to package `dist`.

## Pipeline and output

Compiler reads metadata and YAML, follows resource references, validates topology/exports/dependencies, generates an entry, runs TypeScript, packages Skill assets and verifies generated artifacts. It inspects business module exports without executing business code.

Outputs include workflow.generated.js, its declarations/source map, referenced compiled modules and assets. Named exports are blueprint, codes and agentSpecs. Relative .ts imports become .js. Production output excludes tests.

Builds use temporary output. Validation failure preserves old dist. A cleanup-only failure can report that dist was already updated; read the diagnostic before retrying.

## Errors

| Code | Meaning |
| --- | --- |
| SOURCE_READ_FAILED | Unreadable source/resource |
| SOURCE_PARSE_FAILED | Invalid JSON, YAML or frontmatter |
| INVALID_WORKFLOW | Invalid definition/topology |
| INVALID_REFERENCE | Missing or disallowed reference |
| INVALID_BUILD_CONFIG | Invalid build settings |
| TYPESCRIPT_FAILED | TypeScript failure |
| INVALID_OUTPUT | Emitted dependency/export boundary failure |
| BUILD_FAILED | Build coordination/output publication failure |

Located diagnostics identify source where available. Compilation does not schedule a Run, call a model, publish to npm or bump versions. See [build and verify](../development/build.md).
