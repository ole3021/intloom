import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { LoomError } from "@intloom/utils";
import type {
  CodeExecutionAccess,
  AgentExecutionAccess,
  JsonValue,
  StoredArtifact,
  StorageReadAccess,
} from "@intloom/workflow-sdk";
import * as z from "zod";
export type ReadAccess = Pick<
  AgentExecutionAccess<JsonValue>,
  "state" | "storage" | "signal" | "project"
>;
export type WriteAccess = CodeExecutionAccess<JsonValue>;
export const json = (value: unknown): JsonValue =>
  z.json().parse(JSON.parse(JSON.stringify(value)));
export function fail(message: string, code = "INVALID_INTENT_STAGE"): never {
  throw new LoomError(code, message, { retryable: false });
}
export function digest(value: unknown): string {
  function canonical(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, item]) => [k, canonical(item)]),
      );
    return v;
  }
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
// Specification keeps its established public Record ID; later Stages use separate storage identities.
export const recordId = (runId: string, stage: string) =>
  stage === "specification" ? runId : `REC-${runId}-${stage}`;
export const artifactId = (stage: string) => `ART-intent-${stage}`;
export function project(access: ReadAccess) {
  if (!access.project)
    fail(
      "This Stage requires host-bound project operations.",
      "MISSING_INTENT_CAPABILITY",
    );
  return access.project;
}
export const basisSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  data: z.json(),
});
export type Basis = z.infer<typeof basisSchema>;
export function basis(stored: StoredArtifact): Basis {
  return { id: stored.id, revision: stored.revision, data: json(stored.data) };
}
export async function current(storage: StorageReadAccess, stage: string) {
  const value = await storage.getArtifact("intent", stage);
  if (!value) fail(`Missing committed ${stage} Artifact.`);
  return value;
}
export async function sameBasis(
  access: ReadAccess,
  stage: string,
  expected: Basis,
) {
  const now = await current(access.storage, stage);
  if (!isDeepStrictEqual(basis(now), expected))
    fail(`The ${stage} basis changed during this Run.`, "STALE_INTENT_BASIS");
}
export async function outputOf(
  access: ReadAccess,
  stage: string,
  runId: string,
) {
  const stored = await current(access.storage, stage);
  const record = await access.storage.getRecordById(recordId(runId, stage));
  if (
    !record ||
    record.stageName !== stage ||
    record.flowName !== "intent" ||
    !record.data ||
    typeof record.data !== "object" ||
    Array.isArray(record.data) ||
    !("id" in record.data) ||
    record.data.id !== runId ||
    !("resultDigest" in record.data) ||
    record.data.resultDigest !== digest(stored.data)
  )
    fail(
      `The current ${stage} Artifact is not this Run's committed output.`,
      "STALE_INTENT_BASIS",
    );
  return { artifact: basis(stored), record };
}
export async function commitStage(
  access: WriteAccess,
  runId: string,
  stage: string,
  data: unknown,
  record: unknown | undefined,
  baseline: Basis | null,
) {
  const payload = { flowName: "intent", stageName: stage, data: json(data) };
  const id = recordId(runId, stage);
  if (record) {
    const previous = await access.storage.getRecordById(id);
    if (previous) {
      if (!isDeepStrictEqual(previous.data, json(record)))
        fail("Stage Record already exists with different contents.");
      await access.state.clear();
      return;
    }
  }
  if (!record) {
    const existing = await access.storage.getArtifact("intent", stage);
    if (existing && isDeepStrictEqual(existing.data, json(data))) {
      await access.state.clear();
      return;
    }
  }
  await access.storage.commit([
    baseline
      ? {
          type: "replace_artifact",
          id: baseline.id,
          expectedRevision: baseline.revision,
          payload,
        }
      : { type: "create_artifact", id: artifactId(stage), payload },
    ...(record
      ? [
          {
            type: "append_record" as const,
            id,
            payload: {
              flowName: "intent",
              stageName: stage,
              data: json(record),
            },
          },
        ]
      : []),
  ]);
  await access.state.clear();
}
export function objects(value: unknown): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  function visit(v: unknown) {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    const item = v as Record<string, unknown>;
    if (typeof item.id === "string") {
      if (result.has(item.id)) fail(`Duplicate object ID: ${item.id}`);
      result.set(item.id, item);
    }
    Object.values(item).forEach(visit);
  }
  visit(value);
  return result;
}
export function references(value: unknown): string[] {
  const result: string[] = [];
  function visit(v: unknown) {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    for (const [key, item] of Object.entries(v)) {
      if (key === "record_refs") continue;
      if ((key.endsWith("_ref") || key === "ref") && typeof item === "string")
        result.push(item);
      else if ((key.endsWith("_refs") || key === "refs") && Array.isArray(item))
        result.push(...item.filter((x): x is string => typeof x === "string"));
      else visit(item);
    }
  }
  visit(value);
  return result;
}
