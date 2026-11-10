# Compose a Workflow and child Looms

Use an explicit step for each required stage. A software change might need a reviewed specification, implementation and a separately executed check. Use `then` to order steps and `map` to adapt their data, then `commit()` the Workflow.

To reuse the [meeting-notes package](../start/run), declare `looms: {"@intloom/meeting-notes": "*"}` in the parent manifest. Expose a parent command taking `{prompt: string}` and point its entry to this module:

```ts
import { ArtifactRefSchema, defineWorkflow, loomCommandStep } from "@intloom/loom-sdk";
import { z } from "zod";

export default defineWorkflow({
  id: "flow",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: ArtifactRefSchema,
}).then(loomCommandStep("report", "@intloom/meeting-notes", "summarize")).commit();
```

Install the child from npm once it is published. During installation the parent resolves its declared child packages. At runtime the child validates its own input and records a child run. The parent can deliver the returned file reference directly.
