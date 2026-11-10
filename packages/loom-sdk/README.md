# @intloom/loom-sdk

Use the SDK to write the behavior of a Loom command in TypeScript. Choose `defineCode` for deterministic work, `defineAgent` for model-directed work with tools, or `defineWorkflow` for explicit stages. The package manifest (`loom.yaml`) describes what callers provide and receive. Each component declares its own input and output schemas.

## Write a file-producing command

Install the author dependencies in an npm project with `npm install -D @intloom/loom-sdk @intloom/compiler zod@~4.6.7`. Set the project's name, version and `"type": "module"`. Save the following as `report.ts`:

```ts
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineCode, ResultFileSchema, resultFile, workDirectory } from "@intloom/loom-sdk";
import { z } from "zod";

export default defineCode({
  id: "write",
  inputSchema: z.strictObject({ message: z.string().min(1) }),
  outputSchema: ResultFileSchema,
  async execute({ inputData, context }) {
    await writeFile(join(workDirectory(context.run), "report.txt"), inputData.message + "\n");
    return resultFile("report.txt", "text/plain");
  },
});
```

Point a command at that file in `loom.yaml`. The [complete file-report fixture](../../test/integration/fixtures/file-report) includes the manifest and build command. The Compiler packages the entry, and the Kernel fixes the returned file version for retrieval after execution.

[Build a Loom](../compiler/README.md) · [SDK contracts and compiled-artifact definitions](../../docs/reference/sdk.md)
