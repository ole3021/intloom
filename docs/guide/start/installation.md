---
title: Install IntLoom
---

# Install IntLoom

## Requirements

Use Node.js **26.4.0 or later**. The TUI requires an interactive terminal. Repository and Workflow development use Bun; using an installed CLI does not require Bun.

```sh
node --version
npm install -g intloom
intloom --version
intloom --help
```

`intloom` and `@intloom/cli` provide the same command. Install one of them. The private Kernel is bundled with the CLI; business Workflow packages are installed separately.

## Check the installed command

If the reported version is unexpected, inspect your shell's executable resolution with `command -v intloom` on macOS/Linux or `where intloom` on Windows. Use `--help` before opening the TUI in a redirected terminal.

## Develop from source

From the repository root, install dependencies and build the development launcher:

```sh
bun install --frozen-lockfile
bun run build:dev
```

With Bun's global bin directory on PATH, `intloom-dev` uses this checkout's built output. Rebuild after source or Node changes. Stop a test project's existing Service before rebuilding Kernel or Service behavior, then start it again. Reopen TUI to load rebuilt UI code.

Proceed to [initialize a project](./project.md).
