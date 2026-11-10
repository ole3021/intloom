import { z } from "zod";

/** A live local input. Read path with node:fs when the component needs its contents. */
export const InputFileRefSchema = z.strictObject({
  kind: z.literal("input-file"),
  path: z.string(),
});
export type InputFileRef = z.output<typeof InputFileRefSchema>;
