# @intloom/compiler

Check and build Intloom 0.5 Loom packages using the SDK's declaration contracts and TypeScript 7. The installed package includes the compiler backend; Bun is not required to consume it on supported Node.js releases (`^22.22.0 || ^24.0.0 || ^26.0.0`).

## Commands

```sh
intloom-build check ./my-loom
intloom-build check ./my-loom --details
intloom-build build ./my-loom
```

With no arguments, `intloom-build` builds the current directory. Both commands accept an optional directory (default `.`). `intloom check` and `intloom build` use the same command implementation. Exit codes are 0 for success, 1 for project/check/build failures, and 2 for command usage errors.

```ts
import { build, check } from "@intloom/compiler";

const result = await check({ projectDir: "./my-loom" });
if (!result.ok) console.error(result.diagnostics);

const built = await build({ projectDir: "./my-loom" });
if (built.ok) console.log(built.outputDir, built.manifest.entry);
```

Library calls return discriminated results. A successful result has `manifest`, `inspection` and empty `diagnostics`; failure has diagnostics with a stable code, message and available file/field/line location. `inspection.components` lists discovered kind/module/export-or-nested paths; `inspection.codeCalls: "dynamic"` marks Code calls as not statically enumerated. Both commands accept `--details` to print these locations, the entry kind, Skills and resources. Exported callable functions appear as Code locations; business behavior is checked by execution tests.

## Preparation and checks

`check` and `build` share one preparation pass:

1. Read `package.json` and `loom.yaml`; validate declaration schemas and package identity.
2. Resolve default or `#named` exports within the project.
3. Type-check and emit the entry/agent module graph plus generated entry-contract assertions.
4. Stage explicitly declared resources and check literal emitted imports against packaged files and runtime dependencies.
5. Import emitted modules in a fresh process, check exported/reachable Agent and Workflow definitions, tool declarations, reserved main-Agent names and control graphs, then validate and collect discovered Skills.
6. Prepare `loom.json` and package metadata. `build` then publishes the prepared directory to `dist/`.

**Module top-level code executes during checking and building.** Task functions, dynamic instructions, `loomInput`, Workflow mappings and models are not invoked. Keep business operations inside execution functions. Fresh inspection processes avoid stale transitive module caches between checks.

The optional project `tsconfig.json` is inherited. The Compiler enforces strict NodeNext/ES2022 ESM checking, checked JavaScript, declaration emission, relative TypeScript import rewriting and its own source/output directories. Only the referenced module graph is compiled; unrelated files selected by a project `include` are not entry modules. Install `@types/node` and configure `types: ["node"]` when using Node globals.

Structural inspection covers exported definitions and definitions reachable through Workflow steps and Agent tools. Export definitions used indirectly from Code so their Skills and structure can be inspected. Definitions created inside execution functions, computed imports and arbitrary business behavior are not evaluated by this check. Such resources must be explicitly included. Use relative imports for package-local modules and declared package dependencies for external imports.

`check` temporarily emits below `.intloom-prepare-*` in the project and removes it when finished. It does not update `dist/`. Failed preparation preserves the previous formal output. A successful build replaces a prior build of the same Loom, removing stale artifacts; it refuses an unrelated nonempty output directory.

## Output contract

`dist/` is a standalone npm package:

```text
dist/
├── package.json
├── loom.json
├── src/
│   ├── main.js
│   └── main.d.ts
├── skills/...
└── assets/...
```

- `package.json.loom` is `"./loom.json"`; `./loom.json` is also exported.
- `loom.json` has schema version `"0.5"`, normalized display/scope/input/output declarations, package name/version, discovered Skills and resources. Its `entry` is `{ module, export, kind }`, with `kind` equal to `code`, `agent` or `workflow`. Optional `agent` uses the same reference shape with `kind: "agent"`.
- Module and resource paths are relative to the built package root. Source directory layout is preserved, with `.ts → .js` and `.mts → .mjs`.
- The package's `.` export points to the entry module with its original exports; selecting a named entry does not manufacture a default export. `./*` exposes packaged files.
- Agent/Workflow callbacks, tools and Zod schemas remain in ESM code. The JSON manifest references definitions rather than serializing them.
- Declared runtime, optional and peer dependencies remain in `package.json`. Package managers install them; they are not bundled. Local `workspace:`, `file:` and `link:` dependency specs are rejected for distributable output. Build scripts and development dependencies are omitted.
- All discovered Skill contents and explicitly declared resources are copied, preserving locations and file permissions. Paths must stay inside the project and avoid generated metadata, emitted-code collisions, dependencies and build directories.

Pack the output directory, not the author source package:

```sh
cd my-loom/dist
npm pack
```

The output can be installed and imported independently. Kernel loading, execution and model binding are the subsequent runtime layer.
