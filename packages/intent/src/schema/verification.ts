import * as z from "zod";
import { text, refs, candidateSchema, evidenceUseSchema } from "./common.ts";
export const commandSchema = z.strictObject({
  command: text,
  args: z.array(z.string()),
  cwd: text.optional(),
  timeoutMs: z.number().int().min(1).max(300000).optional(),
});
export const methodSchema = z.discriminatedUnion("kind", [
  commandSchema.extend({ kind: z.literal("command") }),
  z.strictObject({ kind: z.literal("procedure"), steps: z.array(text).min(1) }),
]);
export const verificationSchema = z.strictObject({
  id: text,
  purpose: text,
  method: methodSchema,
  preconditions: z.array(text),
  expectedEvidence: text,
  executionStage: z.enum(["implementation", "validation", "both"]),
});
export const targetKindSchema = z.enum([
  "acceptance",
  "round_criterion",
  "design_constraint",
  "engineering_constraint",
]);
export const targetRefSchema = z.strictObject({
  kind: targetKindSchema,
  id: text,
});
export const targetSchema = z.strictObject({
  id: text,
  kind: targetKindSchema,
  entityId: text,
  definitionDigest: text,
  sourceRef: z.strictObject({ recordRef: text, objectRef: text }),
  statement: text,
  context: z.json(),
  persistent: z.boolean(),
});
export const verificationEntrySchema = z.strictObject({
  definition: verificationSchema,
  origin: z.enum(["solution", "supplementary"]),
  targetRefs: refs,
  retryBasis: text.optional(),
  requestKey: text.optional(),
  replaces: text.optional(),
  disposition: z.enum([
    "pending",
    "executing",
    "awaiting_observation",
    "executed",
    "adopted",
    "unavailable",
    "stopped",
  ]),
  candidateRef: text.optional(),
  evidenceRefs: refs,
  reason: z.string(),
  attempts: z.number().int().nonnegative(),
});
export const supplementarySchema = z.strictObject({
  key: text,
  targetRefs: refs.min(1),
  purpose: text,
  evidenceGap: text,
  method: methodSchema,
  preconditions: z.array(text),
  expectedEvidence: text,
  replaces: z.strictObject({ verificationRef: text, reason: text }).optional(),
});
export const observationStepSchema = z.discriminatedUnion("status", [
  z.strictObject({
    stepIndex: z.number().int().nonnegative(),
    status: z.literal("observed"),
    observation: text,
    assessment: z.enum(["supports", "contradicts", "inconclusive"]),
    explanation: text,
    evidenceRefs: refs.min(1),
  }),
  z.strictObject({
    stepIndex: z.number().int().nonnegative(),
    status: z.literal("not_observed"),
    reason: text,
    evidenceRefs: refs,
  }),
]);
export const observationSubmissionSchema = z.strictObject({
  revision: z.number(),
  candidateRef: text,
  verificationRef: text,
  kind: z.enum(["recorded", "needs_attention"]),
  steps: z.array(observationStepSchema),
  limitations: z.array(text),
});
export const observationDataSchema = observationSubmissionSchema.extend({
  method: methodSchema,
  at: text,
});
export const assessmentSchema = z.strictObject({
  targetRef: text,
  verdict: z.enum(["passed", "failed", "unverified"]),
  explanation: text,
  evidence: z.array(evidenceUseSchema),
  limitations: z.array(text),
  missingEvidence: z.array(text),
});
export const executionDataSchema = z.strictObject({
  verificationRef: text.optional(),
  origin: z.enum(["verification", "diagnostic"]),
  startedAt: text,
  finishedAt: text,
  before: candidateSchema,
  after: candidateSchema,
  outcome: z.enum(["exited", "not_started", "interrupted", "unknown"]),
  result: z.strictObject({
    command: commandSchema,
    exitCode: z.number().nullable(),
    stdout: z.string(),
    stderr: z.string(),
    timedOut: z.boolean(),
    truncated: z.boolean(),
  }),
});
export type VerificationEntry = z.infer<typeof verificationEntrySchema>;
export type Target = z.infer<typeof targetSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
