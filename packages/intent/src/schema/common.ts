import * as z from "zod";
export const text = z.string().trim().min(1);
export const refs = z.array(text);
export const stageNameSchema = z.enum([
  "specification",
  "solution",
  "implementation",
  "validation",
]);
export type StageName = z.infer<typeof stageNameSchema>;
export const recordRefSchema = z.strictObject({
  recordRef: text,
  digest: text,
});
export const snapshotSchema = z.record(z.string(), z.string());
export const candidateSchema = z.strictObject({
  id: text,
  digest: text,
  files: snapshotSchema,
});
export const baselineSchema = z
  .strictObject({
    id: text,
    revision: z.number().int().positive(),
    data: z.json(),
  })
  .nullable();
export const questionSchema = z.strictObject({ key: text, question: text });
export const factSchema = z.strictObject({
  description: text,
  evidenceRefs: refs.min(1),
});
export const analysisSchema = z.strictObject({
  summary: text,
  scope: z.enum(["feature_development", "unsupported"]),
  rationale: text,
  facts: z.array(factSchema),
  assumptions: z.array(text),
  questions: z.array(questionSchema),
});
export const evidenceSchema = z.strictObject({
  id: text,
  kind: z.enum([
    "execution",
    "observation",
    "project_read",
    "project_write",
    "user_report",
    "historical_result",
  ]),
  runId: text,
  stageName: stageNameSchema,
  candidateRef: text.optional(),
  data: z.json(),
});
export const evidenceUseSchema = z.strictObject({
  evidenceRef: text,
  relation: z.enum(["supports", "contradicts", "context"]),
  explanation: text,
});
export const interactionSchema = z.strictObject({
  id: text,
  kind: z.enum(["questions", "confirmation"]),
  purpose: text,
  request: z.json(),
  answer: z.json(),
  at: text,
});
export const pendingInteractionSchema = z.strictObject({
  id: text,
  kind: z.enum(["questions", "confirmation"]),
  purpose: text,
  request: z.json(),
  revision: z.number(),
  reviewDigest: text,
});
export const baseStateSchema = z.strictObject({
  id: text,
  prompt: z.string().refine((value) => value.trim().length > 0),
  stageName: stageNameSchema,
  revision: z.number().int().nonnegative().default(0),
  task: text.default("prepare"),
  feedback: z.array(text).default([]),
  questions: z.array(questionSchema).default([]),
  interactions: z.array(interactionSchema).default([]),
  evidence: z.array(evidenceSchema).default([]),
  pendingInteraction: pendingInteractionSchema.optional(),
  resumeTask: text.optional(),
});
export const approvalSchema = z.strictObject({
  reviewDigest: text,
  interactionRef: text,
});
export const editAuditSchema = z.strictObject({
  kind: text,
  id: text,
  reason: text,
  before: z.json().nullable(),
  after: z.json(),
});
export const outcomeSchema = z.strictObject({
  outcome: z.enum(["ready", "needs_input", "needs_evidence"]),
});
export const resultSchema = z.strictObject({
  saved: z.boolean(),
  revision: z.number(),
  outcome: z.string().optional(),
  issues: z.array(z.string()).optional(),
  ids: z.record(z.string(), z.string()).optional(),
});
export type Candidate = z.infer<typeof candidateSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type BaseState = z.infer<typeof baseStateSchema>;
export type RecordRef = z.infer<typeof recordRefSchema>;
export type Baseline = z.infer<typeof baselineSchema>;

export const contextSchema = z.strictObject({
  runId: text,
  prompt: z.string(),
  revision: z.number().int().nonnegative(),
  task: text,
  feedback: z.array(text),
  interactions: z.array(interactionSchema),
  evidence: z.array(
    evidenceSchema.omit({ data: true }).extend({ summary: z.json() }),
  ),
  capabilities: z.strictObject({
    projectRead: z.boolean(),
    projectWrite: z.boolean(),
    browser: z.boolean(),
    userInteraction: z.literal("code"),
  }),
});
