# @intloom/kernel

Embed the Kernel in a Node.js application to create and control Loom runs, answer interactions and read delivered artifacts. The Kernel owns run state, execution and local persistence. A host such as the CLI prepares the npm installation and selects a command.

## Run an installed command

Install `@intloom/kernel` in an ESM project. Download the [file-report archive](../../docs/use/first-loom.md), copy its archive into your host project and run `npm install ./file-report-0.4.0.tgz` there. Run this module from that same directory.

```js
import { resolve } from "node:path";
import { serve } from "@intloom/kernel";

const kernel = await serve({ dataDir: "./local-data" });
try {
  const loom = await kernel.installLoom({
    source: resolve("node_modules/file-report/commands/write"),
    installedDirectory: true,
  });
  const run = await kernel.createRun({ loom, input: { message: "First delivery" } });
  await kernel.startRun(run.id);
  console.log(run.id);
} finally {
  await kernel.close(); // Drain active work and release the data directory.
}
```

Inspect a run with `getRun(id)`, read its result with `getRunResult(id)`, and use `listArtifacts({ runId: id })` and `readArtifact({ artifactId })` to retrieve saved files. For runs waiting on a person, list the interactions and submit the answer with its response source.

[Kernel API and execution reference](../../docs/reference/kernel.md) · [Run events and activity](../../docs/reference/run-events.md)
