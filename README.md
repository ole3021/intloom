# IntLoom

[简体中文](README_ZH.md)

IntLoom is a framework for executing Looms. This repository contains the
execution kernel, SDK, compiler tools, and supporting applications. Business
Looms are maintained independently.

## Repository

- `apps/`: command-line and website applications.
- `packages/`: SDK, compiler, kernel, and shared utilities.
- `docs/`: user and developer documentation.

## Development

Use the Bun version specified in `package.json`.

```sh
bun install --frozen-lockfile
bun run check
bun run build
```

`check` runs Biome and workspace type checks. `build` runs workspace build
scripts. `verify` runs both in sequence. `format` formats supported source and
configuration files.
