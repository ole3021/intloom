# Read the author project

Open the three files produced in [the first package](../start/build).

| File | What to change |
| --- | --- |
| `package.json` | npm name, version, ESM type, dependencies and build script. The scaffold uses `intloom-build`. |
| `loom.yaml` | What each command does, its input JSON Schema, expected output and relative entry path. Add `defaultCommand` for a multi-command package. |
| `loom.ts` | The default-exported component with its own input and output schemas. The greeting example writes to its run work directory and returns a file reference. |

Keep the public input and SDK schema in agreement. List runtime npm modules in `dependencies` and author tools in `devDependencies`. Add tools, templates and declared resources as the work requires. [Manifest fields](../reference/manifest) · [Delivery](./delivery)
