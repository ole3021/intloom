import { LoomError } from "@intloom/utils";
import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import * as z from "zod";
import { checkProject } from "../../core/check-project.ts";
import { initializeLooms } from "../../loom/initialize-looms.ts";
import { loomIdentity } from "../../runtime/recovery/loom-identity.ts";
import { restoreRuns } from "../../runtime/recovery/restore.ts";
import { createEffector } from "../../effector/create-effector.ts";
import { createExecutionPreparation } from "../../core/prepare-execution.ts";
import { acquireServiceLock, readServiceInfo } from "../discovery.ts";
import {
  exists,
  inside,
  protectedLoomPaths,
  safePath,
} from "../../mirror/files.ts";
import { scopeSchema, jsonCopy } from "../../mirror/contracts.ts";
import {
  listMirrors as readList,
  inspectMirror as readInspect,
  exportMirrors as readExport,
  findMirror,
  readMirrorDirectory,
  validateScope,
  commitRestore,
  restoreFailure,
} from "../../mirror/coordinator.ts";
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

/** Offline restore borrows current target resources for validation; it never starts a Runtime or installs Code. */
export async function restoreMirror(
  input: RestoreMirrorInput,
  faults: { failAt?: "import" | "files" | "checkpoint" } = {},
) {
  let release: (() => Promise<void>) | undefined;
  try {
    const parsed = restoreMirrorSchema.parse(input);
    const source = await realpath(resolve(parsed.sourceProject));
    const target = await realpath(resolve(parsed.targetProject));
    if (inside(source, target) || inside(target, source))
      throw new Error(
        "Restore target must be independent of the source project; nested and shared roots are rejected.",
      );
    await safePath(target, ".intloom");
    if (await readServiceInfo(target))
      throw new Error("Target service must be stopped before mirror restore.");
    if (await exists(await safePath(target, ".intloom/restore.lock")))
      throw new Error(
        "Incomplete restore exists; inspect .intloom/restore.lock before retrying.",
      );
    const image = await readMirrorDirectory(
      await findMirror(source, parsed.mirrorId),
    );
    validateScope(image.manifest, parsed.scope);
    const project = await checkProject(target);
    if ((project.config.localStorage ?? "file") !== image.storage.backend)
      throw new Error("File/SQLite restore requires the same backend type.");
    const initialized = await initializeLooms({
      projectRoot: target,
      config: project.config,
    });
    const blueprints = initialized.registries.blueprints;
    const blueprint = blueprints[image.checkpoint.run.loomName];
    if (!blueprint)
      throw new Error(
        `Current Loom cannot load: ${image.checkpoint.run.loomName}`,
      );
    const identities = Object.fromEntries(
      await Promise.all(
        Object.entries(initialized.registries.sources).map(
          async ([name, resource]) => [name, await loomIdentity(resource)],
        ),
      ),
    );
    const saved = jsonCopy(image.checkpoint);
    const traceId = randomUUID();
    const control = saved.control;
    if (!control) throw new Error("Mirror control data is missing.");
    control.traceId = traceId;
    control.sourceTraceId = image.manifest.traceId;
    control.sourceMirrorId = image.manifest.mirrorId;
    control.restoreCommitId = randomUUID();
    control.pauseReason = "restored";
    delete control.capturePending;
    delete control.captureDisabled;
    delete control.pauseCause;
    control.scope = {
      kind: parsed.scope,
      completed: false,
      ...(parsed.scope === "stage"
        ? {
            stageVisitId:
              image.manifest.boundary.kind === "loom_start"
                ? control.stageVisitId + 1
                : control.stageVisitId,
          }
        : {}),
    };
    saved.sourceLoomIdentity = saved.sourceLoomIdentity ?? saved.loomIdentity;
    saved.run.status = "paused";
    saved.run.updatedAt = new Date().toISOString();
    if (image.manifest.observation)
      saved.observationBaseline = image.manifest.observation;
    const preparation = createExecutionPreparation(
      project.config,
      initialized.registries.agents,
      project.projectRoot,
    );
    const readiness = preparation.readiness(
      blueprint,
      saved.run.execution.source,
    );
    if (
      readiness.status !== "available" ||
      readiness.agentExecutor !== saved.run.execution.agentExecutor
    )
      throw new Error(
        "Target execution policy or model configuration is incompatible with the saved Run.",
      );
    // Validate State and phase with the same path the host will use, with no writes or business execution.
    await restoreRuns({
      codes: initialized.registries.codes,
      agents: {},
      storage: {} as import("../../storage/contracts.ts").StorageAccess,
      effector: createEffector(),
      recovery: {
        store: { read: () => [saved], write: () => {} },
        blueprints,
        loomIdentities: identities,
      },
    });
    const protectedPaths = await protectedLoomPaths(
      target,
      initialized.registries.sources,
    );
    // A real service lock, not a new Runtime object, establishes target admission isolation.
    release = await acquireServiceLock(target, randomUUID());
    const result = await commitRestore(target, image, saved, protectedPaths, {
      ...(parsed.dryRun === undefined ? {} : { dryRun: parsed.dryRun }),
      ...faults,
    });
    return {
      runId: saved.run.id,
      traceId,
      targetProject: target,
      status: "paused" as const,
      sourceMirrorId: image.manifest.mirrorId,
      scope: control.scope,
      ...(parsed.scope === "stage"
        ? {
            scopeTarget: {
              stageName: saved.run.cursor.stageName,
              stageVisitId: control.scope.stageVisitId,
            },
          }
        : {}),
      warnings:
        identities[saved.run.loomName] !== saved.loomIdentity
          ? [
              "Loom identity changed; current Code will execute after explicit resume. Compatibility is not guaranteed.",
            ]
          : [],
      ...result,
    };
  } catch (cause) {
    throw restoreFailure(cause);
  } finally {
    await release?.();
  }
}
