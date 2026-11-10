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
const measure = defineTool({
  id: "measure",
  description: "Measure the sample once before asking for a label.",
  inputSchema: z.strictObject({}),
  outputSchema: z.string(),
  async execute({ context }) {
    await writeFile(join(workDirectory(context.run), "measured"), "once", {
      flag: "wx",
    });
    return "blue-receipt";
  },
});

export default defineAgent({
  resultTool: "writeReport",
  id: "writer",
  inputSchema: input,
  outputSchema: ResultFileSchema,
  outputMode: "structured",
  model: { slot: "writer" },
  tools: [measure, writeReport],
  instructions:
    "Use the writeReport tool once. Copy the message exactly. Return only the tool's actual JSON file reference, without modification.",
  prompt: ({ inputData }) => JSON.stringify(inputData),
  generation: { maxSteps: 5 },
});
