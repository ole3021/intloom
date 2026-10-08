---
title: Compiler reference
description: compileWorkflow options, generated artifacts, validation boundaries, and build errors.
---

# Compiler reference

`@intloom/compiler` is a build-time library. It has no standalone CLI and is not required by an installed Workflow at runtime.

## compileWorkflow

```ts
import { compileWorkflow } from "@intloom/compiler";

await compileWorkflow({
  packageRoot: "/absolute/path/to/workflow-package",
  tsconfigFile: "tsconfig.build.json",
});
```

| Option | Requirement |
| --- | --- |
| `packageRoot` | Required package directory |
| `tsconfigFile` | Optional configuration path inside the package; default `tsconfig.build.json` |
| `logger` | Optional Utils logger owned by the caller |

Return type is `Promise<void>`. Outputs are written to the package's `dist`; the function does not return a live runtime or an Agent registry. Without an explicit logger it uses the current logging context or stays silent.

## Inputs and output

Compilation reads package metadata and `workflow.yaml`, follows Stage/Code/Agent/Schema/Tool/Skill/initializer references, validates definitions and exports, allocates resource IDs, generates an entry, invokes TypeScript, packages referenced assets, and validates emitted artifacts.

Expected output includes:

```text
dist/
├── workflow.generated.js
├── workflow.generated.d.ts
├── workflow.generated.js.map
└── compiled referenced modules and Skill assets
```

Relative source `.ts` imports become `.js` output imports. Declarations and source maps accompany production modules. Tests and test directories are excluded. The source package must declare the generated JS and declaration entries and include `dist` in `files`.

## Build guarantees and limits

Business modules are inspected without executing them to obtain exports. Initializers are emitted as callable resources; compilation does not run them. Referenced runtime packages must be declared as dependencies or peers. Schema/Tool shape checks and source export inspection are not a substitute for actual installed-host execution.

Builds use temporary output and replace `dist` after validation. Failed validation preserves the previous output. A generated entry coordinates concurrent builds for the same package. Do not delete it while a build is active; inspect stale build resources after an interrupted process.

No npm publication, model request, Run scheduling, package-root manifest generation, or automatic version update is performed.

## Errors

| Code | Meaning |
| --- | --- |
| `SOURCE_READ_FAILED` | Source root or resource could not be read |
| `SOURCE_PARSE_FAILED` | Invalid JSON/YAML/frontmatter, including duplicate keys |
| `INVALID_WORKFLOW` | Invalid definition or topology |
| `INVALID_REFERENCE` | Invalid, missing, or disallowed resource reference |
| `INVALID_BUILD_CONFIG` | Invalid build configuration or output location |
| `TYPESCRIPT_FAILED` | TypeScript compilation failed |
| `INVALID_OUTPUT` | Emitted module, dependency, or export boundary failed verification |
| `BUILD_FAILED` | Build coordination or publication of local output failed |

Diagnostics include source locations when available. Inspect the reported failure, correct the source, and rebuild; do not treat an old surviving `dist` as the new build's success.

If building and cleanup both fail, the original Compiler error code, message, and location remain available. `error.cause.cause` is an `AggregateError` containing the original error first, followed by cleanup failures. Cleanup attempts both the temporary directory and generated entry; recovery backups are retained when output restoration fails.

A cleanup-only failure reports `BUILD_FAILED` and explicitly states that `dist` has already been updated. Check remaining build resources before retrying; this is not a validation failure that preserves the previous output.
