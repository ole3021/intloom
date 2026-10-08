# Intent distribution preparation

[build.ts](../build.ts) first calls `compileWorkflow` from `@intloom/compiler`, then `preparePackage` to turn `dist` into the publishable package root. Compiler builds resources; this module owns Intent's distribution metadata.

| File | Responsibility |
| --- | --- |
| `prepare-package.ts` | Derive the root-entry manifest, resolve workspace dependency versions, and copy the public README and supplied LICENSE |
| `prepare-package.spec.ts` | Verify manifest derivation, metadata filtering, dependency versions, and documentation/license copying |

The development manifest is private and points its entry to `dist/workflow.generated.js`. The distribution manifest removes `private`, scripts, and development dependencies, and relocates entry paths to `./workflow.generated.js` and its declarations. `workspace:*`, `workspace:^`, and `workspace:~` become installed package versions with the corresponding range policy. Unsupported workspace ranges and `file:`, `link:`, or `catalog:` runtime dependencies are rejected.

The generated package retains Workflow protocol metadata, currently `2026-10-08`, and exports `blueprint`, `codes`, and `agentSpecs`. Runtime dependencies are SDK, Utils, and Zod; Compiler and private Kernel are development dependencies. Source TypeScript, tests, build tooling, and source-only READMEs do not enter the distribution. The package README uses repository URLs for source navigation so its links do not depend on the installed layout.

From the repository root:

```sh
bun run build --filter=@intloom/workflow-intent --concurrency=1
bun run pack --filter=@intloom/workflow-intent --concurrency=1
```

The pack task builds prerequisites and packs `dist`, writing the archive to the repository's `.release/` directory. Packing the private development root produces a different layout and is not the publication path. Building or packing does not publish to a registry. See [repository release tooling](../../../scripts/README.md) for archive validation and publication.

[packed-package.intg.ts](../test/packed-package.intg.ts) installs archives with npm in an isolated consumer and checks resources, declarations, runtime dependencies, and file/SQLite access. These installation checks are separate from the manifest unit test.
