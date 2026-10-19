import * as z from "zod";
import { createHash } from "node:crypto";

export const scopeSchema = z.enum(["step", "stage", "loom"]);
export type MirrorScope = z.infer<typeof scopeSchema>;
export const boundarySchema = z.strictObject({
  kind: z.enum([
    "loom_start",
    "stage_before_init",
    "stage_start",
    "step_before",
    "step_after",
    "stage_end",
    "loom_end",
  ]),
  stageName: z.string().optional(),
  stageVisitId: z.number().int().nonnegative(),
  stepName: z.string().optional(),
  stepVisitId: z.number().int().nonnegative(),
});
export type MirrorBoundary = z.infer<typeof boundarySchema>;
export const controlSchema = z.strictObject({
  traceId: z.uuid(),
  stageVisitId: z.number().int().nonnegative(),
  stepVisitId: z.number().int().nonnegative(),
  stagePendingVisit: z.boolean().optional(),
  stepPendingVisit: z.boolean().optional(),
  boundary: boundarySchema.optional(),
  published: z
    .strictObject({
      mirrorId: z.uuid(),
      traceId: z.uuid(),
      boundary: boundarySchema,
    })
    .optional(),
  capturePending: z
    .strictObject({ mirrorId: z.uuid(), boundary: boundarySchema })
    .optional(),
  pauseReason: z
    .enum(["restored", "scope_completed", "mirror_capture_failed"])
    .optional(),
  pauseCause: z.string().optional(),
  captureDisabled: z.boolean().optional(),
  sourceMirrorId: z.uuid().optional(),
  sourceTraceId: z.uuid().optional(),
  scope: z.strictObject({
    kind: scopeSchema,
    completed: z.boolean(),
    stageVisitId: z.number().int().nonnegative().optional(),
  }),
  restoreCommitId: z.uuid().optional(),
});
export type MirrorControl = z.infer<typeof controlSchema>;
export const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  mirrorId: z.uuid(),
  traceId: z.uuid(),
  runId: z.string().min(1),
  capturedAt: z.iso.datetime(),
  boundary: boundarySchema,
  source: z.strictObject({
    mirrorId: z.uuid().nullable(),
    traceId: z.uuid().nullable(),
  }),
  loom: z.strictObject({ name: z.string(), identityAtCapture: z.string() }),
  storageBackend: z.enum(["file", "sqlite"]),
  complete: z.literal(true),
  restorable: z.boolean(),
  reason: z.string().optional(),
  consistency: z.literal("controlled_writes_settled"),
  digests: z.strictObject({
    checkpoint: z.string(),
    storage: z.string(),
    filesManifest: z.string(),
  }),
  capture: z.strictObject({
    durationMs: z.number().nonnegative(),
    files: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
  }),
  observation: z.json().optional(),
  observationBaseline: z.json().optional(),
});
export type MirrorManifest = z.infer<typeof manifestSchema>;
export function digest(bytes: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
