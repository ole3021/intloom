# Compiler integration tests

These tests use built `@intloom/compiler` exports, real Workflow files, TypeScript compilation, and separate Node.js consumers. Source-level unit tests live beside their implementation in `src/`.

Run from the repository root:

```sh
bun run test:intg --filter=@intloom/compiler --concurrency=1
```

## Directory organization

| Path | Responsibility |
| --- | --- |
| `package.intg.ts` | Public ESM exports, declarations, and installed-archive compilation without repository links |
| `compile-workflow.intg.ts` | Generated resources, declarations, assets, configuration selection, output replacement, and cleanup-failure reporting |
| `compile-failures.intg.ts` | Failure diagnostics, previous-output preservation, cleanup, and author-owned entry protection |
| `helpers/workspace.ts` | Isolated workspaces, dependency links, file snapshots, and cleanup assertions |
| `helpers/consume-workflow.ts` | Consume and invoke compiled resources in a separate Node process |
| `fixtures/workflow/` | Two-Stage source package with Code, initializers, Agent, Schemas, Tool, Skill, and assets |
| `fixtures/consumer/` | Public Compiler API type assertions |

Local fixtures reuse installed dependencies; the archive test separately verifies package installation. Neither path proves live model behavior or Workflow execution through a host. See [package usage](../README.md).
