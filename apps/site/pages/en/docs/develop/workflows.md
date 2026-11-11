# Compose a Workflow and child Looms

Use an explicit step for each required stage. A software change might need a reviewed specification, implementation and a separately executed check. Use `then` to order steps and `map` to adapt their data, then `commit()` the Workflow.

To reuse the [meeting-notes package](../start/run), declare `looms: {"@intloom/meeting-notes": "1.0.1"}` in the parent manifest. Expose a parent command taking `{prompt: string}` and point its entry to this module:

```ts
import { ArtifactRefSchema, defineWorkflow, loomCommandStep } from "@intloom/loom-sdk";
import { z } from "zod";

export default defineWorkflow({
  id: "flow",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: ArtifactRefSchema,
}).then(loomCommandStep("report", "@intloom/meeting-notes", "summarize")).commit();
```

Installing the parent resolves the declared version of `@intloom/meeting-notes` from npm when needed. At runtime the child validates its own input and records a child run. The parent can deliver the returned file reference directly.
