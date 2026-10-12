import * as z from "zod";
import { basisSchema } from "../src/flow/shared.ts";
import {
  snapshotSchema,
  checkResultSchema,
  projectPathSchema,
} from "./engineering.ts";
const text = z.string().trim().min(1);
export const validationTargetSchema = z.strictObject({
  type: z.enum([
    "domain",
    "feature",
    "requirement",
    "acceptance",
    "constraint",
    "relation",
    "app",
    "package",
    "module",
    "resource",
    "scenario",
    "concept",
    "decision",
  ]),
  ref: text,
});
export const validationEvidenceSchema = z.strictObject({
  id: z.string().startsWith("VEVD-"),
  method: z.enum(["test", "runtime_observation", "static_analysis", "code"]),
  code_path: z
    .array(
      z.strictObject({
        path: projectPathSchema,
        lines: z.array(z.number().int().positive()).optional(),
      }),
    )
    .min(1),
  target_ref: text,
  result: z.enum(["fullfill", "partial", "violated"]),
  checkId: text.optional(),
  note: text.optional(),
});
export const validationCheckSchema = z.strictObject({
  target: validationTargetSchema,
  evidences: z.array(validationEvidenceSchema),
  result: z.strictObject({
    status: z.enum(["verified", "partial", "undone", "failed"]),
    reason: text,
  }),
});
export const validationTestSchema = z.strictObject({
  test_code_ref: z.strictObject({
    id: z.string().startsWith("VTCD-"),
    path: projectPathSchema,
    lineStart: z.number().int().positive(),
    lineEnd: z.number().int().positive(),
  }),
  ttarget_refs: z.array(text),
  status: z.enum(["passed", "failed", "not_run"]),
  checkId: text.optional(),
});
export const validationProposalSchema = z.strictObject({
  specification_checks: z.array(validationCheckSchema),
  solution_checks: z.array(validationCheckSchema),
  tests_checks: z.array(validationTestSchema),
  code_issues: z.array(
    z.strictObject({
      code_paths: z.array(
        z.strictObject({
          path: projectPathSchema,
          lines: z.array(z.number().int().positive()).optional(),
        }),
      ),
      reason: text,
      needRefactor: z.boolean(),
    }),
  ),
  findings: z.array(
    z.strictObject({
      id: z.string().startsWith("VFND-"),
      status: z.enum(["confirmed", "suspected"]),
      description: text,
      impact: text.optional(),
      locations: z.array(
        z.strictObject({
          path: projectPathSchema,
          lineStart: z.number().int().positive(),
          lineEnd: z.number().int().positive(),
        }),
      ),
      severity_level: z.enum(["high", "medium", "low"]),
    }),
  ),
});
export const validationReportRuleSchema = z.enum([
  "SCOPE_CHECK_COUNT",
  "CHECK_TARGET_MISMATCH",
  "EVIDENCE_IDENTITY_INVALID",
  "EVIDENCE_FILE_MISSING",
  "EVIDENCE_LINE_OUT_OF_RANGE",
  "HOST_CHECK_MISSING",
  "HOST_CHECK_FAILED",
  "VERIFIED_EVIDENCE_INCONSISTENT",
  "VIOLATION_STATUS_MISMATCH",
  "TEST_IDENTITY_OR_RANGE_INVALID",
  "TEST_TARGET_UNKNOWN",
  "TEST_STATUS_MISMATCH",
  "FINDING_ID_DUPLICATE",
  "FINDING_RANGE_INVALID",
]);
const diagnosticId = z
  .string()
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u);
const count = z.number().int().nonnegative();
export const validationFeedbackSchema = z.strictObject({
  rule: validationReportRuleSchema,
  message: z.string().max(200),
  scopeGroup: z.enum(["specification", "solution"]).optional(),
  targetRef: diagnosticId.optional(),
  evidenceId: diagnosticId.optional(),
  testId: diagnosticId.optional(),
  findingId: diagnosticId.optional(),
  codeIssueIndex: count.optional(),
  path: projectPathSchema.max(160).optional(),
  checkId: diagnosticId.optional(),
  requestedLine: count.optional(),
  lineStart: count.optional(),
  lineEnd: count.optional(),
  maxLine: count.optional(),
  expectedCount: count.optional(),
  actualCount: count.optional(),
});
export const validationSubmissionResultSchema = z.discriminatedUnion("saved", [
  z.strictObject({ saved: z.literal(true) }),
  z.strictObject({
    saved: z.literal(false),
    attemptsRemaining: z.literal(1),
    feedback: validationFeedbackSchema,
  }),
]);
export type ValidationReportRule = z.infer<typeof validationReportRuleSchema>;
export type ValidationFeedback = z.infer<typeof validationFeedbackSchema>;
export const validationStateSchema = z.strictObject({
  id: z.string().startsWith("RUN-"),
  intent: z.string(),
  specification: basisSchema.optional(),
  solution: basisSchema.optional(),
  baseline: basisSchema.nullable().optional(),
  implementationRecordId: z.string().optional(),
  fileSnapshot: snapshotSchema.optional(),
  commandResults: z.array(checkResultSchema).default([]),
  scope: z
    .strictObject({
      specification: z.array(validationTargetSchema),
      solution: z.array(validationTargetSchema),
    })
    .optional(),
  proposal: validationProposalSchema.optional(),
  submissionCount: z.number().int().min(0).max(2).default(0),
  submissionFeedback: validationFeedbackSchema.optional(),
});
export type ValidationState = z.infer<typeof validationStateSchema>;
export type ValidationProposal = z.infer<typeof validationProposalSchema>;
export default validationStateSchema.transform((value, context) => {
  const result = z.json().safeParse(value);
  if (!result.success) {
    context.addIssue({
      code: "custom",
      message: "State must contain JSON values only; omit undefined fields",
    });
    return z.NEVER;
  }
  return result.data;
});
