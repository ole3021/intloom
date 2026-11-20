import { z } from "zod";
import { absolutePathSchema } from "../loom/input.ts";

export const processInputSchema = z.strictObject({
  command: z.string().min(1),
  args: z.array(z.string()).readonly(),
  cwd: absolutePathSchema,
  timeoutMs: z.number().int().positive().optional(),
  maxOutputBytes: z.number().int().positive().optional(),
  env: z.record(z.string(), z.string()).optional(),
});
export type ProcessInput = z.infer<typeof processInputSchema>;

export interface ProcessReceipt {
  readonly status: "exited" | "launch-failed" | "timed-out" | "signaled";
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly truncated: boolean;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly error?: string;
}

export interface ProcessTools {
  run(input: ProcessInput): Promise<ProcessReceipt>;
}
