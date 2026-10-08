# Compiler source

`index.ts` exports `compileWorkflow`. Other modules are internal to the package.

| Path | Responsibility |
| --- | --- |
| `compile-workflow.ts` | Coordinate load → analyze → build and log progress or failure |
| `types.ts` | Caller-supplied compile options |
| `errors.ts` | Compiler error codes and source-located failures |
| `source/types.ts` | Raw resources, parsed documents, and locations |
| `source/references.ts` | Resolve resource references and check path boundaries |
| `source/locations.ts` | Find the nearest document location for a diagnostic |
| `load/load-sources.ts` | Discover and read referenced files without executing modules |
| `load/parse-document.ts` | Parse YAML and retain document-node locations |
| `analyze/schemas.ts`, `validate-document.ts` | Validate source definitions and report located errors |
| `analyze/analyze-workflow.ts`, `model.ts` | Link resources, validate routing, and construct the internal model |
| `analyze/collect-skill-assets.ts` | Collect deliverable Skill files and reject private files or symlinks |
| `analyze/assign-resource-ids.ts` | Allocate Code and Agent IDs for a build |
| `build/build-export-files.ts` | Coordinate entry locking, compilation, assets, verification, and cleanup |
| `build/generate-entry.ts` | Generate imports and the three Workflow exports |
| `build/compile-typescript.ts` | Generate build configuration and invoke TypeScript |
| `build/cleanup-build.ts` | Attempt build cleanup and retain original and cleanup failures |
| `build/inspect-module.ts`, `verify-artifacts.ts` | Inspect emitted ESM and verify exports, imports, and package boundaries |
| `build/output-files.ts` | Inspect output files and relocate source maps |
| `build/publish-output.ts` | Replace `dist` and attempt restoration if replacement fails |

Adjacent `.spec.ts` files test their owning modules. See [package usage](../README.md) and the [Compiler reference](../../../docs/guide/reference/compiler.md) for the public build contract.
