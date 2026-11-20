# IntLoom

This checkout implements the **0.5.0 Loom authoring pipeline and Code runtime**: SDK definitions → Compiler checks/builds → independently installable npm packages → real Kernel Code Runs. It includes persistent Stores, authorized tools, feedback, cancellation and output checks, Code/Agent/Workflow/Skills examples, and desktop and website shells.

## Develop

Use Node 26.13.0 and Bun 1.4.4.

```sh
bun install --frozen-lockfile
bun run --cwd packages/loom-sdk build
bun run --cwd packages/compiler build
bun install --frozen-lockfile
bun run verify
bun run build:dev
intloom-dev --help
```

`build:dev` builds the CLI and installs the `intloom-dev` launcher:

```sh
intloom-dev check examples/workflow-report
intloom-dev build examples/agent-research
```

See the [examples](examples/README.md), [SDK contracts](packages/loom-sdk/README.md), [Compiler output format](packages/compiler/README.md) and [Kernel runtime](packages/kernel/README.md#code-runs).

| Workspace | Current contents |
| --- | --- |
| `packages/loom-sdk` | Loom schemas, Agent/Workflow builders, contexts and tool contracts |
| `packages/compiler` | Shared checking/build pipeline and `intloom-build` CLI |
| `packages/kernel` | Code Run processes, authorization, durable Run/Exec history, SQLite Stores, feedback, cancellation and output checks |
| `apps/cli` | Node CLI and global development launcher tooling |
| `apps/app` | Electrobun, React, Vite and Tailwind shell |
| `apps/site` | Rspress website shell with English and Chinese pages |
| `examples/*` | Six buildable, independently consumable Loom packages |

See [development and verification](docs/maintainers/development.md) for commands and check coverage. Release and deployment workflows are paused.
