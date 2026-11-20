# IntLoom CLI

The 0.5.0 CLI checks and builds Loom packages through `@intloom/compiler`.

```sh
intloom check ./my-loom
intloom check ./my-loom --details
intloom build ./my-loom
```

The directory defaults to `.`. A successful build writes a standalone npm package to `dist/`. Check/build failures exit 1; unsupported commands and invalid arguments exit 2. `--help` and `--version` are available. See the [Compiler contract](../../packages/compiler/README.md) for inspection behavior and output layout.

From the repository root:

```sh
bun run build:dev
intloom-dev --help
intloom-dev check examples/code-report
intloom-dev build examples/agent-research
```

The global development launcher preserves the caller's working directory and points to this checkout. The `intloom` npm launcher structure is retained for local archive-consumption checks. See [development](../../docs/maintainers/development.md).
