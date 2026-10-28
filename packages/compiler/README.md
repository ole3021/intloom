# @intloom/compiler

Build Loom source packages into distributable ESM, TypeScript declarations, source maps and Skill assets. Compiler uses the contracts in `@intloom/loom-sdk`; it never executes business modules, creates Agents or depends on Kernel.

## Loom Package 0.10

New packages start from `loom.yaml` and emit exactly `definition`, `plan`, `bindings`. Minimal Code/Agent packages need no source package.json or tsconfig. Use `intloom new <directory> --template code|agent`, `intloom check [path]`, `intloom inspect [path]`, and `intloom build [path]`. Programmatic APIs also expose `scaffoldLoom`, `checkLoom` and `inspectLoom`. Check performs the same static build validation without replacing dist; inspection does not import business modules. See [the current contract](../../docs/guide/reference/loom-package.md).

The compiler retains the old frontend for Intent and shares its staging, TypeScript, artifact verification and publishing pipeline. Apps are prebuilt resources: Compiler validates self-contained HTML, resolves bindings, records the entry/hash and copies bytes unchanged. It never invokes a frontend build. See [Loom Apps](../../docs/guide/reference/loom-apps.md).

## Legacy build compatibility

With IntLoom installed, run `intloom build [path]`. Omit the path to build the current directory. The source package contains `package.json.loom`, `tsconfig.build.json`, and referenced Stage YAML, Code, Schema, Tool, Agent and Skill files. Keep each Stage's resources together; references are relative to the declaring file.

For programmatic builds:

```ts
import { compileLoom } from "@intloom/compiler";

const result = await compileLoom({ packageRoot: process.cwd() });
console.log(result.outputPath, result.diagnostics);
```

Requires Node.js 26.4.0+. Repository development uses Bun. Compiler is a development dependency; SDK and packages referenced by shipped JavaScript or declarations belong in dependencies or peers.

| Option | Purpose |
| --- | --- |
| `packageRoot` | Required source package directory |
| `tsconfigFile` | In-package configuration; defaults to `tsconfig.build.json` |
| `logger` | Optional caller-owned Utils logger |

`compileLoom` returns `Promise<CompileResult>` with source/output paths, package name/version, Loom name and warning diagnostics. Errors are `LoomError` values with located diagnostics in `cause.diagnostics`.

The generated `dist` is a complete package. Its manifest exports `loom.generated.js`, its declarations and `./package.json`; the source manifest's export map is not copied. Pack `dist`, not the authoring directory. The entry exports exactly `blueprint`, `codes` and `agentSpecs`.

Compilation follows the entry's module dependencies, ignoring inherited TypeScript `include` and project references. It enforces SDK contract checks, validates routing and local re-export chains, checks JavaScript/declaration dependencies and copies referenced Skill directories. Unreachable Stages/Steps produce warnings; cycles are legal. Code/Agent IDs are stable for logical resource bindings. Identical inputs with the same compiler, dependencies and configuration produce repeatable output; stable IDs do not authorize recovery across changed executable content.

A package lock serializes builds. Generated source stays in `.intloom-build-*`; validation completes before replacing `dist`. Failed validation preserves the old output. A cleanup failure may occur after replacement. An interrupted `.intloom-build.lock` records its owner: verify the process has exited and inspect temporary `previous-dist` backups before removing the lock. Locks are never automatically stolen.

See [Create a Loom](../../docs/guide/development/create.md), [Compiler reference](../../docs/guide/reference/compiler.md), [build and distribute](../../docs/guide/development/build.md), [source responsibilities](./src/README.md) and [tests](./test/README.md).

The capability format also links interaction validators and explicit Agent continuations. Package-local JSON imports are copied and checked as executable dependencies; `check` validates them without evaluating author modules. Protocol `2026-10-27.2` retains the three-export structure. The meeting-room Demo exercises these contracts and independent artifact consumption.
