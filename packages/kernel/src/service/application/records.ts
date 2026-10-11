import type { StoredRecord } from "../../index.ts";
import * as z from "zod";

export const storedRecordSchema: z.ZodType<StoredRecord> = z.strictObject({
  id: z.string().min(1),
  flowName: z.string().min(1),
  stageName: z.string().min(1),
  data: z.json(),
  createdAt: z.iso.datetime(),
});

export const recordPageSchema = z
  .strictObject({
    data: z.array(storedRecordSchema),
    nextCursor: z.string().optional(),
  })
  .transform(({ data, nextCursor }) => ({
    data,
    ...(nextCursor === undefined ? {} : { nextCursor }),
  }));
