# @intloom/compiler

Build IntLoom Workflow source packages into ESM, TypeScript declarations, and Skill assets. Compiler validates sources and generated artifacts without executing business modules. It is a build-time library, not a standalone CLI or a Workflow runtime dependency.

## Usage

Requires Node.js 24+. Add Compiler as a development dependency of the Workflow package; repository workspaces use `workspace:*`. Declare packages needed by the compiled Workflow in `dependencies` or `peerDependencies`.

Call Compiler from a build script in the Workflow package:

```ts
import { compileWorkflow } from "@intloom/compiler";

await compileWorkflow({
  packageRoot: process.cwd(),
});
```

For a script saved as `scripts/build.ts`, run from the Workflow package root:

```sh
node scripts/build.ts
```

`compileWorkflow` returns `Promise<void>` and writes to `dist`.

| Option | Purpose |
| --- | --- |
| `packageRoot` | Required path to the Workflow source package |
| `tsconfigFile` | Configuration path inside the package; defaults to `tsconfig.build.json` |
| `logger` | Optional caller-owned [Utils logger](../utils/src/logger/README.md); otherwise uses the current logging context or stays silent |

The package needs `workflow.yaml`, referenced resources, a build configuration, and an ESM `package.json` with Workflow protocol metadata. Its manifest must declare the generated entry:

```json
{
  "exports": {
    ".": {
      "types": "./dist/workflow.generated.d.ts",
      "default": "./dist/workflow.generated.js"
    }
  },
  "files": ["dist"]
}
```

The entry exports `blueprint`, `codes`, and `agentSpecs`. Validation failures preserve the previous `dist`; correct the reported source or configuration and rebuild. Compilation does not run a Workflow or publish its package.

See [Create a Workflow](../../docs/guide/development/create.md) for source setup, [Compiler reference](../../docs/guide/reference/compiler.md) for options and errors, and [Build and distribute](../../docs/guide/development/build.md) for package usage.

## Directory organization

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | Public `compileWorkflow` export |
| `src/compile-workflow.ts` | Coordinate loading, analysis, building, and logging |
| `src/types.ts`, `src/errors.ts` | Compile options and located errors |
| `src/source/` | Resource types, references, and diagnostic locations |
| `src/load/` | Read referenced sources and parse YAML/Markdown |
| `src/analyze/` | Validate definitions, link resources, collect assets, and assign IDs |
| `src/build/` | Generate and compile the entry, verify artifacts, and replace output |
| `src/**/*.spec.ts` | Source-level unit tests beside their implementation |
| `test/` | Built-package integration tests, helpers, and fixtures |

See the [source directory](./src/README.md) and [test directory](./test/README.md) for file responsibilities.
