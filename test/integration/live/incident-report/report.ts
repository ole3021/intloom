import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defineAgent,
  defineCode,
  ResultFileSchema,
  resultFile,
  workDirectory,
} from "@intloom/loom-sdk";
import { z } from "zod";

const writer = defineAgent({
  id: "writer",
  inputSchema: z.string(),
  outputSchema: z.string(),
  model: { slot: "writer" },
  outputMode: "text",
  instructions:
    "Write one handover sentence in English. Include the incident ID, site and total failed uploads across both batches. Express the total as digits followed by 'failed uploads'.",
  prompt: ({ inputData }) => inputData,
  generation: { maxSteps: 1, maxOutputTokens: 2048 },
});

export default defineCode({
  id: "summarize",
  inputSchema: z.strictObject({ notes: z.string() }),
  outputSchema: ResultFileSchema,
  uses: { agents: [writer] },
  async execute({ inputData, context }) {
    const summary = await context.agents.generate(writer, inputData.notes);
    await writeFile(join(workDirectory(context.run), "handover.txt"), summary);
    return resultFile("handover.txt", "text/plain");
  },
});
