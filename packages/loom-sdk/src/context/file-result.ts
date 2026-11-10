import { z } from "zod";
import type { RunContext } from "./runtime-context.ts";

export const ResultFileSchema = z.strictObject({
  kind: z.literal("file"),
  path: z.string().min(1),
  mediaType: z.string().min(1),
});
export function workDirectory(run: RunContext) {
  return `${run.location.dataDir}/work/${run.runId}`;
}
export function resultFile(path: string, mediaType: string) {
  return { kind: "file" as const, path, mediaType };
}
