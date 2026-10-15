import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type {
  CodeExecutionAccess,
  JsonValue,
  StorageAccess,
  StoredArtifact,
  StoredRecord,
  ProjectCommandResult,
} from "@intloom/loom-sdk";
import { json } from "../src/json.ts";
import { seal, recordId } from "../src/storage.ts";
import { candidate } from "../src/project.ts";
import { solutionTargets } from "../src/targets.ts";
import { specificationRecordSchema } from "../stages/specification/schema/record.ts";
import { solutionRecordSchema } from "../stages/solution/schema/record.ts";
import { implementationRecordSchema } from "../stages/implementation/schema/record.ts";
import { specificationStateSchema } from "../stages/specification/schema/state.ts";
import { solutionStateSchema } from "../stages/solution/schema/state.ts";
import { implementationStateSchema } from "../stages/implementation/schema/state.ts";
import { validationStateSchema } from "../stages/validation/schema/state.ts";
export const runId = "RUN-rule-test";
export const requirements = {
  domains: [],
  features: [
    {
      id: "FEATURE-a",
      name: "Greeting",
      description: "Greet a named user",
      status: "active" as const,
    },
  ],
  requirements: [
    {
      id: "REQ-a",
      featureRef: "FEATURE-a",
      description: "Greet Unicode names",
      status: "active" as const,
    },
  ],
  acceptances: [
    {
      id: "ACC-a",
      requirementRef: "REQ-a",
      description: "Returns Hello, name!",
      status: "active" as const,
    },
  ],
  constraints: [],
};
export const scope = {
  workItems: [
    {
      id: "WORK-a",
      action: "fix" as const,
      description: "Correct the greeting",
      requirementRefs: ["REQ-a"],
    },
  ],
  roundCriteria: [],
  coverage: [
    {
      workItemRef: "WORK-a",
      acceptanceRefs: ["ACC-a"],
      roundCriteriaRefs: [],
      constraintRefs: [],
    },
  ],
  excluded: [],
};
export const analysis = {
  summary: "Correct existing greeting behavior",
  scope: "feature_development" as const,
  rationale: "Feature behavior, no independent restructuring",
  facts: [],
  assumptions: [],
  questions: [],
};
export const design = {
  objects: [
    {
      id: "DESIGN-a",
      kind: "module" as const,
      name: "Greeting module",
      description: "An ESM greeting function",
      status: "active" as const,
      requirementRefs: ["REQ-a"],
      relatedRefs: [],
    },
  ],
  constraints: [],
};
export const plan = {
  implementationItems: [
    {
      id: "IMPL-a",
      description: "Implement greeting",
      designRefs: ["DESIGN-a"],
      dependsOn: [],
      explanation: "Satisfy existing requirement",
    },
  ],
  verifications: [
    {
      id: "VERIFY-a",
      purpose: "Check greeting",
      method: { kind: "command" as const, command: "node", args: ["--test"] },
      preconditions: [],
      expectedEvidence: "Actual greeting assertion",
      executionStage: "both" as const,
    },
  ],
  engineeringTargets: [],
  coverage: [
    {
      workItemRef: "WORK-a",
      target: { kind: "acceptance" as const, id: "ACC-a" },
      implementationRefs: ["IMPL-a"],
      verificationRefs: ["VERIFY-a"],
      explanation: "Exercise the greeting",
    },
  ],
};
export function specification(run = runId) {
  return specificationRecordSchema.parse(
    seal({
      runId: run,
      prompt: "  Fix greeting\n",
      baseline: null,
      snapshot: structuredClone(requirements),
      analysis,
      scope: structuredClone(scope),
      edits: [],
      interactions: [],
      evidence: [],
      approval: { reviewDigest: "fixture", interactionRef: "fixture" },
    }),
  );
}
export function solution(run = runId) {
  const spec = specification(run);
  return solutionRecordSchema.parse(
    seal({
      runId: run,
      prompt: spec.prompt,
      basis: {
        specification: {
          recordRef: recordId(run, "specification"),
          digest: spec.digest,
        },
      },
      baseline: null,
      snapshot: design,
      analysis,
      plan,
      targets: solutionTargets(spec, design, plan),
      edits: [],
      interactions: [],
      evidence: [],
      approval: { reviewDigest: "fixture", interactionRef: "fixture" },
    }),
  );
}
export const schemas = {
  specification: specificationStateSchema,
  solution: solutionStateSchema,
  implementation: implementationStateSchema,
  validation: validationStateSchema,
};
/** In-memory capability double, not an end-to-end or real-model execution. */
export function runtime(
  stage: keyof typeof schemas,
  overrides: object = {},
  storageOverride?: StorageAccess,
) {
  const artifacts = new Map<string, StoredArtifact>(),
    records = new Map<string, StoredRecord>();
  let value: JsonValue | undefined = json(
    schemas[stage].parse({
      id: runId,
      prompt: "  Fix greeting\n",
      stageName: stage,
      ...overrides,
    }),
  );
  const files: Record<string, string> = {
    "greet.mjs": "export const greet = name => name;\n",
  };
  const manifest = () =>
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        createHash("sha256").update(content).digest("hex"),
      ]),
    );
  const flags = { failClear: false, failCommit: false, executions: 0 };
  const replies: unknown[] = [];
  const requests: unknown[] = [];
  const receipts: Partial<ProjectCommandResult>[] = [];
  const storage: StorageAccess = storageOverride ?? {
    getArtifact: async (loomName, stageName) =>
      structuredClone(
        [...artifacts.values()].find(
          (x) => x.loomName === loomName && x.stageName === stageName,
        ),
      ),
    getArtifactById: async (id) => structuredClone(artifacts.get(id)),
    getRecordById: async (id) => structuredClone(records.get(id)),
    getLatestRecord: async (loomName, stageName) =>
      structuredClone(
        [...records.values()]
          .filter((x) => x.loomName === loomName && x.stageName === stageName)
          .at(-1),
      ),
    listArtifacts: async (query) => ({
      data: structuredClone(
        [...artifacts.values()].filter(
          (x) => !query.stageName || x.stageName === query.stageName,
        ),
      ),
    }),
    listRecords: async (query) => ({
      data: structuredClone(
        [...records.values()].filter(
          (x) => !query.stageName || x.stageName === query.stageName,
        ),
      ),
    }),
    commit: async (operations) => {
      if (flags.failCommit) throw Error("commit failed");
      const nextArtifacts = new Map(artifacts),
        nextRecords = new Map(records);
      const writtenArtifacts: StoredArtifact[] = [],
        appendedRecords: StoredRecord[] = [];
      for (const op of operations) {
        if (op.type === "append_record") {
          assert.equal(nextRecords.has(op.id), false);
          const r = { id: op.id, ...op.payload, createdAt: "fixture-time" };
          nextRecords.set(op.id, r);
          appendedRecords.push(r);
        } else if (op.type === "create_artifact") {
          assert.equal(nextArtifacts.has(op.id), false);
          const a = {
            id: op.id,
            ...op.payload,
            revision: 1,
            createdAt: "fixture-time",
            updatedAt: "fixture-time",
          };
          nextArtifacts.set(op.id, a);
          writtenArtifacts.push(a);
        } else if (op.type === "replace_artifact") {
          assert.equal(nextArtifacts.get(op.id)?.revision, op.expectedRevision);
          const a = {
            id: op.id,
            ...op.payload,
            revision: op.expectedRevision + 1,
            createdAt: "fixture-time",
            updatedAt: "fixture-time",
          };
          nextArtifacts.set(op.id, a);
          writtenArtifacts.push(a);
        } else throw Error("Unexpected test operation");
      }
      artifacts.clear();
      records.clear();
      nextArtifacts.forEach((v, k) => {
        artifacts.set(k, v);
      });
      nextRecords.forEach((v, k) => {
        records.set(k, v);
      });
      return {
        writtenArtifacts,
        appendedRecords,
        removedArtifactIds: [],
        removedRecordIds: [],
      };
    },
  };
  const access: CodeExecutionAccess<JsonValue> = {
    signal: new AbortController().signal,
    storage,
    state: {
      get value() {
        return structuredClone(value);
      },
      create: async (next) => {
        assert.equal(value, undefined);
        value = json(schemas[stage].parse(next));
      },
      update: async (next) => {
        value = json(schemas[stage].parse(next));
      },
      clear: async () => {
        if (flags.failClear) throw Error("clear failed");
        value = undefined;
      },
    },
    interaction: {
      confirm: async (request) => {
        requests.push(request);
        assert.ok(replies.length, "No fabricated user reply");
        return replies.shift() as { isConfirmed: boolean };
      },
      askQuestions: async (request) => {
        requests.push(request);
        assert.ok(replies.length, "No fabricated user reply");
        return replies.shift() as never;
      },
    },
    project: {
      snapshot: async () => manifest(),
      read: async (path) => {
        assert.ok(path in files);
        return files[path]!;
      },
      write: async (path, content) => {
        files[path] = content;
      },
      remove: async (path) => {
        delete files[path];
      },
      run: async (command) => {
        flags.executions++;
        return {
          command,
          exitCode: 0,
          stdout: "fixture assertion output",
          stderr: "",
          timedOut: false,
          truncated: false,
          ...receipts.shift(),
        };
      },
    },
  };
  const seed = async (stageName: string, data: { runId: string }) =>
    storage.commit([
      {
        type: "append_record",
        id: recordId(data.runId, stageName),
        payload: { loomName: "intent", stageName, data: json(data) },
      },
    ]);
  return {
    access,
    storage,
    artifacts,
    records,
    files,
    flags,
    replies,
    requests,
    receipts,
    seed,
    candidate: () => candidate(manifest()),
    set: async (next: object) => access.state.update(json(next)),
    value: () => structuredClone(value),
  };
}
export function implementation(
  current = candidate({ "greet.mjs": "fixed" }),
  run = runId,
) {
  const sol = solution(run);
  return implementationRecordSchema.parse(
    seal({
      runId: run,
      prompt: sol.prompt,
      basis: {
        ...sol.basis,
        solution: { recordRef: recordId(run, "solution"), digest: sol.digest },
      },
      workspace: { baseline: current, candidate: current },
      submission: {
        revision: 1,
        candidateRef: current.id,
        kind: "ready",
        items: [
          {
            implementationRef: "IMPL-a",
            outcome: "reused",
            explanation: "Existing implementation",
            changeRefs: [],
            sourceRefs: [],
            remaining: "",
          },
        ],
        issues: [],
      },
      changes: [],
      verifications: [],
      evidence: [],
      interactions: [],
      check: { digest: "fixture", issues: [] },
      delivery: { kind: "complete" },
    }),
  );
}
