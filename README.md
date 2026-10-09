# IntLoom

English | [简体中文](./README_ZH.md)

A loom of action for human intent.

IntLoom is a local workflow framework that brings Agents, code, and human decisions into one explicit process. It helps carry an intent through reasoning, execution, questions, and confirmation, while keeping the results that the Workflow commits.

## Why IntLoom

Work that combines AI reasoning with real actions needs a clear process. IntLoom is built around three goals:

- **Clear direction:** Workflows define the steps, checks, and decision points that guide the work.
- **Human participation:** Questions and confirmations make room for clarification, review, and changes.
- **Results that remain:** Committed outputs are saved separately from working drafts and can be inspected after execution.

Use IntLoom when a task needs both flexible reasoning and explicit control over how work proceeds.

## How it works

A Workflow defines a process; a Run is one execution of that process for an intent. Agents reason and use business Tools, code performs operations and checks, and people answer questions and review decisions. Execution continues within the same Run.

For software work, the [Intent Workflow](./packages/intent/README.md) organizes the process into Specification, Solution, Implementation, and Validation. Other Workflows can define their own stages and outputs.

You can work through the CLI or a connected Agent IDE using MCP. Both use the same local project service. The CLI uses a project-configured model; the default MCP path uses the connected client's Agent execution environment. Saved results can be queried through either entry.

## Getting started

Published packages support Node.js 22.22.0+; the latest Node.js 24 LTS is recommended. Working on this repository requires Node.js 24+, Bun 1.4.0+, and npm. These instructions use a source checkout; see [Installation](./docs/guide/quickstart/installation.md) for published-release prerequisites and complete setup.

From the repository root, build the CLI and inspect its help:

```sh
bun install
bun run build --filter=@intloom/cli --concurrency=1
node apps/cli/dist/bin.js --help
```

Obtain a compatible compiled Workflow archive with resolvable runtime dependencies. Replace the archive path below with your own. The project directory must be new or empty; the CLI does not bundle a business Workflow.

Still from the repository root:

```sh
node apps/cli/dist/bin.js init my-project --workflow /absolute/path/to/workflow.tgz
node apps/cli/dist/bin.js --project my-project start
```

Starting the service does not execute a Workflow. Choose an execution path next:

- [CLI](./docs/guide/quickstart/cli.md): configure the project's model and credentials, then use `flow` to begin a Run.
- [Agent IDE / MCP](./docs/guide/quickstart/mcp.md): connect Codex or another capable MCP client. The default client Agent mode needs no project model configuration.

Answer questions and confirmations to continue the same Run. Use `runs` to inspect execution, `attach` to continue from the terminal, and `artifacts` to inspect saved results. Process completion and the quality of its business results are separate things.

## Project status

IntLoom is in early development. Local Workflow execution, CLI/MCP access, file and SQLite storage, and bounded restart recovery are implemented. Studio remains planned.

Model behavior and client support need validation in the intended environment. See [Current capabilities](./docs/guide/status.md) for supported behavior and verification boundaries.

## Documentation

- [About IntLoom](./docs/guide/introduction.md)
- [Getting started](./docs/guide/getting-started.md)
- [CLI command reference](./docs/guide/reference/cli.md)
- [Create a Workflow](./docs/guide/development/create.md)
