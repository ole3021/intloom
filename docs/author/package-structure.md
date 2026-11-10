# Structure an npm Loom

Start with the three files from `intloom dev init`. Add modules when the command needs them.

| File | Owns |
| --- | --- |
| `package.json` | npm name and version, ESM module type, build script and npm dependencies. Author tooling belongs in `devDependencies`. Modules needed at runtime belong in `dependencies`. |
| `loom.yaml` | Public command names, input JSON Schema, human-readable delivery promise and entry paths. Also describes model requirements, child Looms and optional preflight checks. |
| Entry such as `loom.ts` | Default export of `defineCode`, `defineAgent` or a committed Workflow. Its SDK schemas describe what the component receives and returns. |
| Optional tools and resources | Operations, instructions, templates or other declared files used by a command. Register resources with the SDK so the Compiler can package their bytes. |

A public contract might promise “UTF-8 greeting.txt” in the manifest. The SDK entry returns a typed `ResultFileSchema` reference after writing the bytes in `workDirectory(context.run)`. Keep the public input and the entry input schema in agreement. The [manifest reference](../reference/loom-manifest.md) lists fields, and the [file-report project](../../test/integration/fixtures/file-report) shows all three files together.
