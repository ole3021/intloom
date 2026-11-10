# Develop an npm Loom with a coding agent · IntLoom 0.4.0

Use this guide to implement a versioned capability for another user to install. Check `intloom --version` first. The commands below target CLI, SDK and Compiler 0.4.0. The host needs npm and a compatible Node (`^22.22.0 || ^24.0.0 || ^26.0.0`). Install `intloom@0.4.0` from a registry that serves it or use a prepared local candidate.

## Translate the task into a contract

Record the intended user, one concrete input, one command, the promised output, runtime prerequisites and an observable acceptance check. Identify missing facts that would change the deliverable. Ask for those before committing to a business rule. For file delivery, name the format and say what opening the exported file should show.

| Business requirement | Implementation choice |
| --- | --- |
| Deterministic calculation, transformation, validation or file generation | Default-export `defineCode`. A deterministic operation needed by an Agent can be a `defineTool`. |
| The next action depends on material or intermediate results | Default-export `defineAgent`. Give it a goal, tools, schemas, completion condition, model slot and step budget. It can use `askUser` with a `tool_use` slot for ordinary clarifications. |
| A required order, explicit stage review or specified child invocation | Default-export a committed `defineWorkflow`. Model the required steps, input/output mapping and waits. Steps can invoke Agents. |
| Another independently installed capability already does part of the job | Declare `looms: {file-report: "^0.4.0"}` in the parent manifest. In a Workflow, `loomCommandStep("report", "file-report", "write")` calls the child command and records a child Run. |

The host binds a model and chooses a Harness (Mastra or OpenCode). The package declares its model slots and strengths, capabilities, tools and optional resources. Use host configuration for credentials. The Kernel checks package-wide model requirements. Return a real tool receipt or file reference when the contract promises one. A standalone Code entry can return a scalar business value.

## Complete minimal package

Create these three files in a new `file-report` directory. They form a complete build input. Alternatively, `intloom dev init ./hello --id hello` generates a working greeting package to adapt. Use the generated npm build script for a package with `loom.yaml`. A project exporting `defineLoom` and using `intloom dev build` follows the compiled-artifact format.

**package.json** owns npm identity, runtime dependencies and build tooling.

```json
{
  "name": "file-report",
  "version": "0.4.0",
  "type": "module",
  "scripts": {
    "build": "intloom-build"
  },
  "devDependencies": {
    "@intloom/compiler": "0.4.0",
    "@intloom/loom-sdk": "0.4.0",
    "zod": "4.6.7"
  }
}
```

**loom.yaml** declares the public command and expected delivery. Multiple commands require an explicit `defaultCommand`. The input is a JSON Schema object; the output here is a description for callers.

```yaml
name: File report
description: Produce a text report containing the supplied message.
commands:
  write:
    description: Write the message to an immutable delivered report.
    entry: report.ts
    input:
      type: object
      properties:
        message: {type: string, minLength: 1}
      required: [message]
      additionalProperties: false
    output: UTF-8 report.txt
```

**report.ts** owns the component's actual input and output schemas. Write the bytes under the run's work directory before returning the file reference.

```ts
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defineCode,
  ResultFileSchema,
  resultFile,
  workDirectory,
} from "@intloom/loom-sdk";
import { z } from "zod";
export default defineCode({
  id: "write",
  inputSchema: z.strictObject({ message: z.string().min(1) }),
  outputSchema: ResultFileSchema,
  async execute({ inputData, context }) {
    await writeFile(
      join(workDirectory(context.run), "report.txt"),
      `${inputData.message}\n`,
    );
    return resultFile("report.txt", "text/plain");
  },
});
```

## Build and exercise the archive

When the pinned dependencies are available in the configured registry, run `npm install` in the author directory. With a local candidate, install the candidate's dependencies using its README and put its `node_modules/.bin` on PATH. Create the author folder directly inside that candidate so npm scripts and Node can resolve the matching tools from its parent directory.

From the author folder, run:

```sh
npm run build
mkdir ../report-recipient
cd ../report-recipient
npm init -y
intloom install ../file-report/dist/file-report-0.4.0.tgz --project .
intloom run file-report --plain
intloom run file-report write --input '{"message":"First delivery"}' --plain
```

The first invocation lists the commands. The second returns JSON. Read `data.id` for the Run and `data.output.id` for the artifact, substitute those actual values below, and compare the exported bytes:

```sh
intloom status RUN_ID --plain
intloom artifact export ARTIFACT_ID --out ./report.txt
node -e 'require("node:assert/strict").equal(require("node:fs").readFileSync("report.txt", "utf8"), "First delivery\n")'
```

Also submit `{"message":""}` and verify an input validation failure.

## Adapt the entry when the task changes

**Agent delivering a summary.** If the user needs the writer to decide what to keep from a long note, give a separate package its own npm name (for example `summary-note`). Keep the message input. Change the public description and output to promise a one-sentence UTF-8 summary. Add the following top-level manifest field and replace `report.ts` with this entry. Configure the host's `writer` binding or matching strength profile and a default profile before running.

```yaml
models:
  writer: {strength: standard, capabilities: [tool_use]}
```

```ts
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defineAgent,
  defineTool,
  ResultFileSchema,
  resultFile,
  workDirectory,
} from "@intloom/loom-sdk";
import { z } from "zod";

const input = z.strictObject({ message: z.string().min(1) });
const writeReport = defineTool({
  id: "writeReport",
  description:
    "Write the supplied message verbatim into the report and return the resulting file reference.",
  inputSchema: input,
  outputSchema: ResultFileSchema,
  async execute({ inputData, context }) {
    await writeFile(
      join(workDirectory(context.run), "report.txt"),
      `${inputData.message}\n`,
    );
    return resultFile("report.txt", "text/plain");
  },
});

export default defineAgent({
  resultTool: "writeReport",
  id: "writer",
  inputSchema: input,
  outputSchema: ResultFileSchema,
  outputMode: "structured",
  model: { slot: "writer" },
  tools: [writeReport],
  instructions:
    "Summarize the supplied note in one sentence. Preserve its dates and names. Call writeReport with that sentence and return the tool result.",
  prompt: ({ inputData }) => JSON.stringify(inputData),
  generation: { maxSteps: 5 },
});
```

Inspect the tool receipt and the actual exported text. Judge the summary against the names, dates and facts in the input. Test a missing model binding separately from a bad result. The `resultTool` supplies the structured file reference here. For an Agent that asks the model itself to return structured data, also require `structured_output`.

**Workflow forwarding a child delivery.** Give the parent its own npm name (for example `report-parent`) and a public `forward` command that takes the same message input, points at `flow.ts` and promises the child's report. Add `looms: {file-report: "^0.4.0"}` to the parent manifest. Install the Code child first if it is only available as a local archive. The parent entry is:

```ts
import { ArtifactRefSchema, defineWorkflow, loomCommandStep } from "@intloom/loom-sdk";
import { z } from "zod";

export default defineWorkflow({
  id: "flow",
  inputSchema: z.object({ message: z.string() }),
  outputSchema: ArtifactRefSchema,
}).then(loomCommandStep("report", "file-report", "write")).commit();
```

Build each package. In the recipient project run the parent's `forward` command, use the returned artifact reference to export the file, and query the child run ID on that reference to verify its parent and selected version.

## Review and handoff

For a caller-requested final review, start with `--confirm-delivery`. A human responds to formal approval through an interactive client. Rejection retains a frozen candidate and optional reason. If modification is part of the task, provide a revision command taking that candidate explicitly and creating a new Run and reference.

Return the **source project, built archive, sample command and verification results**. Include the rationale for the entry, tested versions and installation scope. Identify the exact exported result checked, invalid input or failure case exercised, and any model, platform or human review that still needs a real run.
