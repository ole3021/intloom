import * as z from "zod";
import type { Cursor } from "../blueprint.ts";

export const cursorSchema = z.strictObject({
  stageName: z.string().min(1),
  stepName: z.string().min(1),
}) satisfies z.ZodType<Cursor>;
