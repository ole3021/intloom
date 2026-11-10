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
