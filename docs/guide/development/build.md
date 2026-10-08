---
title: Build, test, and distribute
description: Compile package resources, validate installed artifacts, and distribute a Workflow archive.
---

# Build, test, and distribute

Use `@intloom/compiler` as a development dependency and `@intloom/workflow-sdk` as a runtime dependency. The host loads compiled resources; it does not run the Compiler when executing a Workflow.

## Build outputs

The build script in [Create a Workflow](./create.md) calls `compileWorkflow({ packageRoot })`. Compilation reads `workflow.yaml`, follows resource references, validates topology and declarations, emits JavaScript/declarations, includes Skill assets, and verifies package boundaries before replacing `dist`.

The generated entry exports exactly `blueprint`, `codes`, and `agentSpecs`. Keep generated identifiers internal; they may change on rebuild. The Compiler does not execute business modules to discover their exports or run initializers at build time. Installed modules are imported at runtime, so avoid top-level business effects.

Default build configuration is `tsconfig.build.json`. `tsconfigFile` can select another configuration inside the package root. Referenced runtime imports must be built-in modules or declared package dependencies. Compiler excludes source-adjacent `.spec.ts`, `.intg.ts`, and `test/` from production output.

## Validate two boundaries

| Validation | What to exercise |
| --- | --- |
| Source unit tests | Code behavior, schemas, Tool validation, routing decisions, and business errors |
| Built-package integration | Public exports, installed module resolution, packaged assets, real host execution, interaction, and persistence |

Use Node.js `node:test` for tests. Keep unit tests beside their target source and integration tests in `test/`. Include source, tests, and type contracts in type checking, while production builds exclude tests.

For an IntLoom repository workspace, run from the repository root:

```sh
bun run build --filter=<package-name> --concurrency=1
bun run check
bun run test --filter=<package-name>
bun run test:intg --filter=<package-name> --concurrency=1
```

Replace the package name and provide workspace scripts. A Compiler success proves artifact construction, not model quality or the workflow's real side effects. Use controlled model responses for repeatable engine tests, and separately validate the intended real model or MCP client.

## Produce an archive

For the root-layout package in the authoring guide, build first, then package from that package directory:

```sh
bun run build
npm pack --ignore-scripts
```

This creates a local archive without publishing it. Include the generated `dist`, package metadata, README, and license. The authored manifest must point `exports["."].types` and `default` to the generated files. Test files must not enter the archive.

The Compiler itself does not generate a publish-root manifest or publish to npm. If you choose a different distribution root, write and verify the manifest for that layout as a separate packaging step. Do not copy the built-in package's private build scripts without checking its layout assumptions.

## Install into a clean project

From another directory, use the actual archive path:

```sh
intloom init capture-project --workflow /absolute/path/to/capture-workflow-0.1.0.tgz
cd capture-project
intloom start
intloom flows
```

Ensure SDK and other runtime dependencies are resolvable. For the `capture` package, run `capture` through the [MCP path](../quickstart/mcp.md), or configure the [CLI service model path](../quickstart/cli.md) first. The expected outcome is a completed Run and a Record whose ID is that package's Run ID:

```sh
intloom record <runId>
```

Read the Record after a host restart as a persistence check. Check that compilation, installation, and execution work without access to the authoring source directory.

## Release and upgrade

Package version and Workflow protocol version are separate. The current protocol is `2026-10-08`. Publish compatible dependencies before a Workflow that needs them; local installation using repository links is not evidence of public registry availability.

Keep exact resources available for unfinished Runs. Rebuilding or upgrading a package while they await recovery can invalidate their checkpoints. See [Package management](../usage/packages.md).
