---
title: Build, test, install, and distribute
---

# Build, test, install, and distribute

Compile from the Workflow source package, then package its generated output:

```sh
bun install
bun run build
npm pack --ignore-scripts
```

Compiler generates ESM, declarations, source maps and declared Skill assets. The authored manifest must export the generated entry and `./package.json` and include `dist` in `files`. SDK and other runtime imports belong in dependencies or peers; Compiler belongs in development dependencies.

## Verify the package

Test your Schemas, Code and Tools, then install the archive into a clean project. Confirm exported definitions and Skill assets load without access to authoring source. Execute intended routes, human interaction, persistence and recovery boundaries.

For [capture](./create.md), use the actual archive path:

```sh
intloom init capture-project --workflow /absolute/path/capture-workflow-0.1.0.tgz
cd capture-project
intloom start
intloom flows
```

Prepare CMD model configuration or an external MCP client first, then run `capture` with an intent. Its expected result is a completed Run and one Record whose ID is the Run ID. Read that Record after Service restart to check persistence.

## Distribute and upgrade

`npm pack` creates a local archive. Publishing is a separate explicit operation. Verify runtime dependencies are available to consumers and test the actual archive layout before publishing.

The current artifact protocol is `2026-10-08`, independently of npm package versions. Keep compatible resources available for unfinished Runs. Stop the Service before package replacement and restart to adopt rebuilt code.

Compilation/controlled tests do not prove real model quality or client acceptance. See [Compiler reference](../reference/compiler.md) and [compatibility](../reference/compatibility.md).
