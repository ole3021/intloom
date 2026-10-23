import * as z from "zod";
import {
  text,
  recordRefSchema,
  candidateSchema,
  evidenceSchema,
  interactionSchema,
  approvalSchema,
} from "../../../src/schema/common.ts";
import { verificationEntrySchema } from "../../../src/schema/verification.ts";
import { changeSchema } from "./state.ts";
import { implementationSubmissionSchema } from "./submission.ts";
export const implementationRecordSchema = z.strictObject({
  runId: text,
  prompt: z.string().refine((value) => value.trim().length > 0),
  basis: z.strictObject({
    specification: recordRefSchema,
    solution: recordRefSchema,
  }),
  workspace: z.strictObject({
    baseline: candidateSchema,
    candidate: candidateSchema,
  }),
  submission: implementationSubmissionSchema,
  changes: z.array(changeSchema),
  verifications: z.array(verificationEntrySchema),
  evidence: z.array(evidenceSchema),
  interactions: z.array(interactionSchema),
  check: z.strictObject({ digest: text, issues: z.array(text) }),
  delivery: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("complete") }),
    z.strictObject({
      kind: z.literal("partial"),
      approval: approvalSchema,
      review: z.json(),
    }),
  ]),
  digest: text,
});
export type ImplementationRecord = z.infer<typeof implementationRecordSchema>;
export default implementationRecordSchema;
