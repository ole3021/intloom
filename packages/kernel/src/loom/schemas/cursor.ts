import * as z from "zod";
import type { Cursor } from "../../runtime/cursor.ts";

export const cursorSchema = z.strictObject({
  stageName: z.string().min(1),
  stepName: z.string().min(1),
}) satisfies z.ZodType<Cursor>;
