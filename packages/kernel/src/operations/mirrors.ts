import { LoomError } from "@intloom/utils";
import * as z from "zod";
import { scopeSchema } from "../mirror/contracts.ts";
import {
  listMirrors as readList,
  inspectMirror as readInspect,
  exportMirrors as readExport,
} from "../mirror/coordinator.ts";
function offlineFailure(code: string, cause: unknown) {
  return new LoomError(
    code,
    cause instanceof Error ? cause.message : String(cause),
    { cause, retryable: false },
  );
}
export async function listMirrors(project: string) {
  try {
    return await readList(project);
  } catch (cause) {
    throw offlineFailure("MIRROR_READ_FAILED", cause);
  }
}
export async function inspectMirror(project: string, id: string) {
  try {
    return await readInspect(project, id);
  } catch (cause) {
    throw offlineFailure("MIRROR_READ_FAILED", cause);
  }
}
export async function exportMirrors(
  project: string,
  traceId: string,
  target: string,
) {
  try {
    return await readExport(project, traceId, target);
  } catch (cause) {
    throw offlineFailure("MIRROR_EXPORT_FAILED", cause);
  }
}
export const restoreMirrorSchema = z.strictObject({
  sourceProject: z.string().min(1),
  mirrorId: z.uuid(),
  targetProject: z.string().min(1),
  scope: scopeSchema,
  dryRun: z.boolean().optional(),
});
export type RestoreMirrorInput = z.infer<typeof restoreMirrorSchema>;
export const resumeRunSchema = z.strictObject({
  operationId: z.uuid(),
  abandonMirror: z.boolean().optional(),
  scope: scopeSchema.optional(),
  expectedRevision: z.number().int().positive(),
  serviceInstanceId: z.uuid(),
});
