import type { StoredRecord } from "@intloom/kernel";
import * as z from "zod";

export const storedRecordSchema: z.ZodType<StoredRecord> = z.strictObject({
  id: z.string().min(1),
  flowName: z.string().min(1),
  stageName: z.string().min(1),
  data: z.json(),
  createdAt: z.iso.datetime(),
});
