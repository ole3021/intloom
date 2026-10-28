# Compiler source

`compileLoom` owns build orchestration; `checkLoom` verifies without publishing, `inspectLoom` reads new definitions, and `scaffoldLoom` creates minimal source packages. It owns build locking, phase coordination, logging and the build receipt. Other modules are ordinary internal functions, not extensibility interfaces.

| Directory | Responsibility |
| --- | --- |
| `capability/` | New loom.yaml frontend: normalize contracts, resolve schemas/Markdown, generate definition/plan/bindings |
| `source/` | Source schemas, typed documents, reference resolution and source locations |
| `load/` | Read and validate documents before extracting their explicit references; collect Skill assets without executing modules |
| `analyze/` | Link the loaded snapshot, validate routing, warn about unreachable nodes and assign stable logical IDs; no filesystem access |
| `emit/` | Generate SDK contract assertions and exports, invoke TypeScript, map diagnostics to source declarations and relocate the staged entry |
| `package/` | Prepare the distribution manifest, resolve publishable dependency ranges, inspect emitted ESM, follow re-exports and verify declarations/assets |
| `build/` | Lock ownership, temporary output, output replacement/rollback and cleanup |
| `types.ts`, `diagnostics.ts`, `errors.ts` | Public build options/result and consistent located diagnostics |

Source references are resolved once while loading. Locations retain JSON/YAML fields and Stage/Step context. Analysis consumes validated documents and the reference index. Agent identity includes the role source, model purpose, output Schema, Skills and Tools; Code identity includes its relative source path and export. IDs retain the host’s 21-character suffix and include the package name and Loom name as a namespace. Neither logical identity includes absolute checkout paths or random build IDs.

New generated entries check `LoomCode`, `AcceptanceCheck`, `AgentTool`, `CompiledDefinition`, `ExecutionPlan` and `LoomBindings`. Legacy entries check `Blueprint`, `ExecutableCode`, `StageStateInitializer`, JSON-valued State Schemas, `StepResult` Agent output Schemas and `AgentSpec`. TypeScript emits only the entry dependency graph. Internal type inspection uses the scanner from the pinned TypeScript version; generated JavaScript is inspected with Acorn. Neither imports business resources.

Local export resolution supports named exports, aliases, star exports and cycles with an actual defining binding. It rejects missing or ambiguous bindings; `export *` never forwards a default export. Third-party packages remain dependency/type contracts, not code executed during verification.

Tests beside each module cover ownership rules and failure boundaries. `test/*.intg.ts` covers the public built package using independent minimal Looms, including SDK contract failures, declaration consumption, repeatable output, warnings, re-exports and preservation of old output. Archive consumers live in `test/package/`.
