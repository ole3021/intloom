import * as z from "zod";
import type { StepResult } from "../execution.ts";

export const stepResultSchema = z.strictObject({
  outcome: z.string().min(1),
}) satisfies z.ZodType<StepResult>;
