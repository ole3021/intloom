# Compiler API

## Build an npm Loom

Use `intloom-build [project-directory] [output-directory]` (defaults to the current project and its `dist/`). The programmatic API is `await buildPackage(projectDirectory, outputDirectory)`. It returns the path of the npm archive. The project must have its author dependencies installed. See [the npm author tutorial](../author/first-package.md).

## Compiled-artifact projects

Use these APIs for TypeScript `defineLoom` projects and their locked artifact dependencies. The [Compiler guide](../../packages/compiler/README.md) covers the npm package format.

## Compile

```ts
import { compileLoom, packLoom } from "@intloom/compiler";

const result = await compileLoom({
  entryFile: "./loom.ts",
  outDir: "./dist/loom",
  target: "node22",
});
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));

const archive = await packLoom({
  artifactDir: result.artifactDir,
  outFile: "./example.tgz",
});
```

The default target is `node22`. The CLI uses it for new Looms. The compiler
writes its Node range to `loom.json` and the generated npm `package.json`.
Explicit `target: "node26"` retains the original `>=26.13.0 <27` requirement.
Kernel checks each Loom in the installed dependency graph against its own manifest.

The default export of `loom.ts` must be a `defineLoom` definition. The directory
containing it is the build/resource root. An adjacent `tsconfig.json` is extended
for strict, no-emit typechecking of the entry and its imports. Ambient type packages
resolve from the author directory and its ancestors; explicit inherited `typeRoots`
remain authoritative even though the generated check config lives in a temporary
directory. The compiler then
bundles ordinary JS/TS dependencies, loads the candidate in a disposable Node
process, inspects declarations, and copies only declared resources. This
inspection has a 30-second process timeout. It never invokes execute, prompt,
map, condition or interaction callbacks. Author module initialization does run:
definitions must be stable and free of business side effects. Compilation is
not a sandbox or a proof that arbitrary TypeScript is pure.

The output contains:

```text
package.json
loom.json
runtime.mjs
resources/<resource-id>/<filename>  # when declared
integrity.json
```

Manifest format 1 contains identity, entry, component/Step relationships,
resource paths, exact Loom dependencies, runtime requirements and optional Outcome.
Workflow relationships are descriptive; executable callbacks stay in the module.
Code, Agent and committed Workflow entries are supported without constructing
Mastra objects. Definite Outcome path/reference mismatches are rejected; actual
Artifact/Acceptance delivery checks belong to execution.

`contracts.input`, `normalizedInput` and `output` use JSON Schema 2020-12.
They are projected from the same supported Zod declarations. `withDefault`
remains optional in the raw input and required after normalization. Schema
metadata cannot replace structural constraints. Unsupported schemas fail;
they are not weakened to empty contracts.

Static JS/TS imports and Node built-ins are supported, including bundled CommonJS
modules that use built-ins. Host packages (`@mastra/*`, Intloom Kernel/Compiler/
adapter and SDK framework subpaths), native `.node` modules and unresolved dynamic
module loading are rejected. Direct runtime module loaders are unsupported.
Install-script-generated files and arbitrary runtime filesystem dependencies
are not automatically collected. Explicit resources must be regular files under
the build root, with relative POSIX paths and no links.

The compiler returns a discriminated `CompileResult`. Failures contain stage,
machine code and message, with a source path when available. Typechecking errors
retain the TypeScript diagnostic. Known artifact output directories may be
rebuilt; unrelated existing directories and directories containing the source
entry are not overwritten.

## Dependencies and sharing

Declare child Looms directly on the default Loom in `loom.ts`. Import the generated
references normally, even on the first build:

```ts
import { defineLoom, defineWorkflow, defineStep } from "@intloom/loom-sdk";
import { analyze } from "./.intloom/dependencies.ts";
import { z } from "zod";

export default defineLoom({
  id: "report", version: "1.0.0", description: "Analyze a text",
  dependencies: { analyze: { id: "@example/analyze", version: "^1.0.0" } },
  entry: defineWorkflow({ id: "report", inputSchema: z.string(), outputSchema: z.string() })
    .then(defineStep(analyze, { id: "analyze" }))
    .commit(),
});
```

The declaration's `version` is a semver range (an exact version also works).
Use an object literal with explicit aliases, each containing literal strings
`id` and `version`. Variables, calls, shorthand, computed keys and spreads
cannot supply dependencies. The rest of a Loom may use normal TypeScript.
For a dependent Loom, pass the literal to the SDK's `defineLoom` in the entry
file. When spreading other Loom options, place the explicit dependencies literal after the spread (use `{}` for none). Dependency-free factory-based entries remain supported.

`intloom dev build` reads the entry syntax without executing or resolving its imports,
selects installed child Looms, writes `loom.lock.json` and the typed references
in `.intloom/dependencies.ts`, then typechecks and compiles the whole project.
The lock records exact versions and content digests. An independent build needs
no installed Loom catalog and creates no dependency files in a fresh project.
For the SDK use `compileLoom({ entryFile, outDir, target: "node22", catalog })`.
The catalog can be an array or an async loader, called only for declared dependencies.
Use `resolveLoomDependencies({ projectDir, catalog })` to prepare references separately.
Generated `LoomRef` types preserve raw input, normalized input and output.

To migrate, move the literal from `loom.dependencies.ts` to `defineLoom({ dependencies: ... })`
and remove the old file and `defineLoomDependencies` import. Keep existing locks
when their declarations match. The old file is rejected without loading it.

The CLI resolves new dependencies from active global Loom installations and their bundled dependency graphs. A frozen lock resolves the exact retained snapshots, even after an active installation changes. Without a lock, the highest matching local version is selected. Several digests
for that version produce `DEPENDENCY_AMBIGUOUS`; use `selections: { analyze:
"<digest>" }` to choose. Existing locks are preserved; use `update: true` to change
them. Missing exact artifacts, changed declarations without update, cycles and
stale reference contracts fail explicitly. No operation downloads Looms.

Pass the resolver’s `catalog` as `dependencySources` to pack a dependent Loom. The packer opens and verifies only the locked graph. Directory strings remain supported; for arbitrary directory names, their integrity indexes identify candidates. The archive is a standard npm tarball. Its root artifact lives under `package/`; exact transitive Loom dependencies live under `package/dependencies/<digest>/`. Offline installers validate the whole graph before registration. The author project must have a package.json whose name exactly matches the Loom ID, including any scope. The compiler reports a mismatch before replacing an existing artifact. The npm archive uses the same identity. The generated npm manifest takes its version and description from the Loom. An adjacent author `package.json` may supply npm `license` and `repository` metadata. To ship documentation, list exact root filenames in its standard `files` array, for example `["README.md", "LICENSE"]`. Supported documents are README.md, LICENSE, LICENSE.md and LICENSE.txt; an explicitly selected document must exist as a regular file. Other npm fields, lifecycle scripts and arbitrary file patterns are not copied. A short input and expected result in the README let a recipient try the package. Publish the tested tarball with `npm publish ./package.tgz`.

File identity is SHA-256 over the compact JSON of `[path, fileDigest]` pairs,
ordered by UTF-8 path bytes. All regular files are covered except `integrity.json`
itself. Machine paths, archive compression and timestamps do not enter the index.
Identical build inputs/configuration produce identical artifact identities;
different content with the same name/version remains distinguishable. Digests
establish content integrity, not publisher authentication.

The compiler resolves `defineLoom.storage` to `global` by default or preserves the explicit `project` declaration in `LoomManifest.storage`. Runtime project discovery belongs to the caller and Kernel; compilation does not choose a Run's data directory.

The compiler always typechecks author code before bundling. An inherited TypeScript `noCheck` setting cannot skip this step.
