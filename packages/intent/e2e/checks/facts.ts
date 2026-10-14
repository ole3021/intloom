import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import * as z from "zod";
import type { Check, Run } from "../../../../e2e/runner/contracts.ts";

const stages = ["specification", "solution", "implementation", "validation"];
const artifactStages = ["specification", "solution", "validation"];
const recordStages = ["specification", "solution", "implementation"];
const storedSchema = z
  .object({
    id: z.string(),
    flowName: z.string(),
    stageName: z.string(),
    revision: z.number().optional(),
    data: z.record(z.string(), z.json()),
  })
  .passthrough();
export type Stored = z.infer<typeof storedSchema>;
export const imageSchema = z
  .object({
    mirrorId: z.string(),
    traceId: z.string(),
    runId: z.string(),
    complete: z.boolean(),
    storageBackend: z.string(),
    boundary: z.object({
      kind: z.string(),
      stageName: z.string().optional(),
      stageVisitId: z.number(),
      stepName: z.string().optional(),
      stepVisitId: z.number(),
    }),
  })
  .passthrough();
export type Image = z.infer<typeof imageSchema>;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, part]) => [key, canonical(part)]),
    );
  return value;
}
function businessDigest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
export function verifyFacts(input: {
  run: Run;
  intent: string;
  executor: string;
  source: string;
  storage: string;
  artifacts: Stored[];
  records: Stored[];
  images: Image[];
  mirrorsValid: boolean;
  confirmations: { stageName: string; confirmed: boolean }[];
  originalIntents: string[];
}): Check[] {
  const checks: Check[] = [];
  const check = (id: string, valid: boolean, message: string) =>
    checks.push({ id, status: valid ? "passed" : "failed", message });
  check(
    "run_completed",
    input.run.status === "completed" && input.run.settled === true,
    "The original Run completed and all known work settled.",
  );
  check(
    "execution_policy",
    input.run.execution.agentExecutor === input.executor &&
      input.run.execution.source === input.source,
    "The Run used the selected entry and executor.",
  );
  check(
    "original_intent",
    input.originalIntents.length > 0 &&
      input.originalIntents.every((intent) => intent === input.intent),
    "Every inspected checkpoint preserves the complete original intent.",
  );
  check(
    "confirmations",
    ["specification", "solution"].every((stageName) =>
      input.confirmations.some(
        (confirmation) =>
          confirmation.stageName === stageName && confirmation.confirmed,
      ),
    ),
    "Specification and Solution were explicitly confirmed through the selected entry.",
  );
  check(
    "stage_sequence",
    isDeepStrictEqual(
      input.images
        .filter((image) => image.boundary.kind === "stage_start")
        .sort((a, b) => a.boundary.stageVisitId - b.boundary.stageVisitId)
        .map((image) => image.boundary.stageName),
      stages,
    ),
    "Mirror evidence includes the complete four-Stage sequence.",
  );
  check(
    "formal_results",
    input.artifacts.length === 3 &&
      input.records.length === 3 &&
      artifactStages.every((stage) =>
        input.artifacts.some(
          (value) => value.flowName === "intent" && value.stageName === stage,
        ),
      ) &&
      recordStages.every((stage) =>
        input.records.some(
          (value) =>
            value.flowName === "intent" &&
            value.stageName === stage &&
            value.data.id === input.run.runId,
        ),
      ),
    "The current Intent contract saved three Artifacts and three Records for this Run.",
  );
  const byArtifact = new Map(
    input.artifacts.map((value) => [value.stageName, value]),
  );
  const byRecord = new Map(
    input.records.map((value) => [value.stageName, value]),
  );
  const basisMatches = (basis: unknown, stage: string) => {
    const actual = byArtifact.get(stage);
    const parsed = z
      .object({ id: z.string(), revision: z.number(), data: z.json() })
      .safeParse(basis);
    return Boolean(
      actual &&
        parsed.success &&
        parsed.data.id === actual.id &&
        parsed.data.revision === actual.revision &&
        isDeepStrictEqual(parsed.data.data, actual.data),
    );
  };
  check(
    "result_relationships",
    ["specification", "solution"].every((stage) => {
      const artifact = byArtifact.get(stage),
        record = byRecord.get(stage);
      return (
        artifact &&
        record &&
        record.data.resultDigest === businessDigest(artifact.data)
      );
    }) &&
      basisMatches(
        byRecord.get("implementation")?.data.specification,
        "specification",
      ) &&
      basisMatches(byRecord.get("implementation")?.data.solution, "solution") &&
      basisMatches(
        byArtifact.get("validation")?.data.specification,
        "specification",
      ) &&
      basisMatches(byArtifact.get("validation")?.data.solution, "solution") &&
      byArtifact.get("validation")?.data.implementationRecordId ===
        byRecord.get("implementation")?.id,
    "Saved results retain the actual confirmed bases and Implementation Record reference.",
  );
  check(
    "commit_references",
    Boolean(input.run.results?.length) &&
      [...input.artifacts, ...input.records].every((stored) =>
        input.run.results?.some(
          (result) =>
            result.id === stored.id &&
            result.stageName === stored.stageName &&
            result.kind ===
              (input.artifacts.includes(stored) ? "artifact" : "record") &&
            (!stored.revision || result.revision === stored.revision),
        ),
      ),
    "The Run references actual formal commits and Artifact revisions.",
  );
  const key = (image: Image) =>
    `${image.boundary.stageVisitId}:${image.boundary.stepVisitId}:${image.boundary.stageName}:${image.boundary.stepName}`;
  const before = input.images.filter(
    (image) => image.boundary.kind === "step_before",
  );
  const after = new Set(
    input.images
      .filter((image) => image.boundary.kind === "step_after")
      .map(key),
  );
  check(
    "mirror_integrity",
    input.mirrorsValid &&
      input.images.length > 0 &&
      input.images.every(
        (image) =>
          image.complete &&
          image.runId === input.run.runId &&
          image.traceId === input.run.control?.traceId &&
          image.storageBackend === input.storage,
      ) &&
      !input.run.control?.captureDisabled &&
      !input.run.control?.pauseCause,
    "All inspected images are complete and belong to the original Run, trace and backend.",
  );
  check(
    "mirror_boundaries",
    before.length > 0 &&
      before.every((image) => after.has(key(image))) &&
      stages.every((stage) =>
        input.images.some(
          (image) =>
            image.boundary.kind === "stage_end" &&
            image.boundary.stageName === stage,
        ),
      ) &&
      ["workflow_start", "workflow_end"].every((kind) =>
        input.images.some((image) => image.boundary.kind === kind),
      ),
    "Every completed Step has matching before/after images, and Workflow/Stage boundaries are present.",
  );
  return checks;
}
