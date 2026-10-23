import type { StorageReadAccess, StorageOperation } from "@intloom/loom-sdk";
import type { StageAccess, StageCodeAccess } from "./access.ts";
import type { Baseline, RecordRef } from "./schema/common.ts";
import { json, digest } from "./json.ts";
import { fail } from "./errors.ts";
export const recordId = (runId: string, stage: string) =>
  `REC-${runId}-${stage}`;
export const artifactId = (stage: string) => `ART-intent-${stage}`;
export async function baseline(
  storage: StorageReadAccess,
  stage: string,
): Promise<Baseline> {
  const value = await storage.getArtifact("intent", stage);
  return value
    ? { id: value.id, revision: value.revision, data: json(value.data) }
    : null;
}
export async function assertBaseline(
  access: StageAccess,
  stage: string,
  expected: Baseline | undefined,
) {
  if (expected === undefined)
    fail(`Missing ${stage} baseline.`, "INVALID_INTENT_BASIS");
  if (digest(await baseline(access.storage, stage)) !== digest(expected))
    fail(
      `The ${stage} baseline changed; reassess before publishing.`,
      "STALE_INTENT_BASIS",
    );
  return expected;
}
export async function loadRecord(
  storage: StorageReadAccess,
  ref: RecordRef | undefined,
  stage: string,
  runId?: string,
) {
  if (!ref) fail(`Missing ${stage} Record reference.`, "INVALID_INTENT_BASIS");
  const stored = await storage.getRecordById(ref.recordRef);
  if (stored?.loomName !== "intent" || stored.stageName !== stage)
    fail(`Missing ${stage} Record.`, "INVALID_INTENT_BASIS");
  const data = json(stored.data);
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("Invalid Record.");
  const { digest: savedDigest, ...body } = data;
  if (
    savedDigest !== ref.digest ||
    digest(body) !== savedDigest ||
    (runId && data.runId !== runId)
  )
    fail("Record identity or digest mismatch.", "INVALID_INTENT_BASIS");
  return data;
}
export async function inputRecord(
  storage: StorageReadAccess,
  runId: string,
  stage: string,
) {
  const stored = await storage.getRecordById(recordId(runId, stage));
  const data = stored ? json(stored.data) : null;
  if (
    !stored ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.digest !== "string"
  )
    fail(`Missing this Run's ${stage} Record.`);
  const ref = { recordRef: stored.id, digest: data.digest };
  return { ref, data: await loadRecord(storage, ref, stage, runId) };
}
export function seal<T extends object>(body: T) {
  return { ...body, digest: digest(body) };
}
export async function resumeCommitted(
  access: StageCodeAccess,
  runId: string,
  stage: string,
) {
  const previous = await access.storage.getRecordById(recordId(runId, stage));
  if (!previous) return false;
  const data = json(previous.data);
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.digest !== "string"
  )
    fail("Invalid existing Record.");
  await loadRecord(
    access.storage,
    { recordRef: previous.id, digest: data.digest },
    stage,
    runId,
  );
  await access.state.clear();
  return true;
}
export async function publish(
  access: StageCodeAccess,
  runId: string,
  stage: string,
  record: unknown,
  projection?: { data: unknown; baseline: Baseline },
) {
  if (await resumeCommitted(access, runId, stage)) return;
  const operations: StorageOperation[] = [
    {
      type: "append_record",
      id: recordId(runId, stage),
      payload: { loomName: "intent", stageName: stage, data: json(record) },
    },
  ];
  if (projection) {
    const payload = {
      loomName: "intent",
      stageName: stage,
      data: json(projection.data),
    };
    operations.push(
      projection.baseline
        ? {
            type: "replace_artifact",
            id: projection.baseline.id,
            expectedRevision: projection.baseline.revision,
            payload,
          }
        : { type: "create_artifact", id: artifactId(stage), payload },
    );
  }
  await access.storage.commit(operations);
  await access.state.clear();
}
