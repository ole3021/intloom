import * as z from "zod";
import { text, refs } from "../../../src/schema/common.ts";
export const implementationSubmissionSchema = z.strictObject({
  revision: z.number(),
  candidateRef: text,
  kind: z.enum(["ready", "needs_attention"]),
  items: z.array(
    z.strictObject({
      implementationRef: text,
      outcome: z.enum(["implemented", "reused", "incomplete"]),
      explanation: text,
      changeRefs: refs,
      sourceRefs: refs,
      remaining: z.string(),
    }),
  ),
  issues: z.array(text),
});
export const diagnosticInputSchema = z.strictObject({
  revision: z.number(),
  purpose: text,
  command: text,
  args: z.array(z.string()),
  cwd: text.optional(),
  timeoutMs: z.number().int().min(1).max(300000).optional(),
});
