# Compose stages and child Looms

Use a Workflow when the sequence belongs to the task. Give each step a business responsibility and typed input/output. Connect the steps with `then` and finish with `commit()`. Map data between incompatible stage shapes. Put judgment in an Agent step and repeatable operations in Code or tools.

A child Loom has its own installed version, public command and Run. For a parent forwarding `{prompt: string}`, declare the dependency in its manifest:

```yaml
looms:
  "@intloom/meeting-notes": "*"
```

Point the parent command's `entry` to a module such as `flow.ts`:

```ts
import { ArtifactRefSchema, defineWorkflow, loomCommandStep } from "@intloom/loom-sdk";
import { z } from "zod";

export default defineWorkflow({
  id: "flow",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: ArtifactRefSchema,
}).then(loomCommandStep("report", "@intloom/meeting-notes", "summarize")).commit();
```

After the npm release, install the child using its package name. Install the parent in the recipient environment. The installer resolves required versions; the Kernel checks the installed tree before execution. The child validates its own input and has its own run ID. This parent can deliver the child's frozen file reference directly. Query the child to see which package version and command produced it. The [composition example and assertions](../../test/integration/npm-loom.test.ts) include both package declarations and the export check.
