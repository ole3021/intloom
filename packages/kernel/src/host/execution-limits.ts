import { modelPriceSchema } from "../runtime/run-observation.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";
import { failure } from "../errors.ts";

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const executionLimitsSchema = z.strictObject({
  maxAgentSteps: positive.default(64),
  prices: z.array(modelPriceSchema).optional(),
  run: z
    .strictObject({
      maxModelCalls: positive.optional(),
      maxKnownInputTokens: positive.optional(),
      maxKnownOutputTokens: positive.optional(),
      maxDurationMs: positive.max(2_147_483_647).optional(),
    })
    .optional(),
});
export type ExecutionLimits = z.infer<typeof executionLimitsSchema>;
/** Host configuration is separate from frozen Core/Loom configuration. */
export async function readExecutionLimits(
  root: string,
): Promise<ExecutionLimits> {
  let content: string;
  try {
    content = await readFile(join(root, "intloom", "host.json"), "utf8");
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
      return executionLimitsSchema.parse({});
    throw failure(
      "CLI_EXECUTION_LIMITS_INVALID",
      "Could not read intloom/host.json.",
      cause,
    );
  }
  try {
    return executionLimitsSchema.parse(JSON.parse(content));
  } catch (cause) {
    throw failure(
      "CLI_EXECUTION_LIMITS_INVALID",
      "Invalid intloom/host.json. Use positive integer execution limits; unknown fields are rejected.",
      cause,
    );
  }
}
