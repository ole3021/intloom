import type { StoredArtifact } from "@intloom/kernel";

export const artifact: StoredArtifact = {
  id: "ART-todo",
  flowName: "fixture",
  stageName: "first",
  revision: 1,
  data: {
    title: "Todo requirements",
    requirements: ["Add tasks", "Browser persistence"],
    note: "  original\ncontent  ",
  },
  createdAt: "2026-10-08T00:00:00.000Z",
  updatedAt: "2026-10-08T00:00:00.000Z",
};

/** Commits atomically through actual Code; the Record ID intentionally differs from the Run ID. */
export const artifactWorkflow = `import * as z from "zod";
export const blueprint = { flowName: "fixture", entryStageName: "first", stages: {
  first: { stageName: "first", initializeState: ({ runId, intent }) => ({ id: runId, intent }), stateSchema: z.strictObject({ id: z.string(), intent: z.string() }), entryStepName: "save",
    steps: { save: { stepName: "save", execution: { kind: "code", codeId: "CODE-123456789012345678901" }, on: { complete: { kind: "stage_end" } } } }, on: { complete: { kind: "workflow_end" } } }
} };
export const codes = { "CODE-123456789012345678901": async (_input, access) => {
  const { id, intent } = access.state.value;
  const old = await access.storage.getArtifact("fixture", "first");
  const payload = { flowName: "fixture", stageName: "first", data: { title: intent, requirements: ["Add tasks", "Browser persistence"], note: "  original\\ncontent  " } };
  await access.storage.commit([
    old ? { type: "replace_artifact", id: old.id, expectedRevision: old.revision, payload } : { type: "create_artifact", id: "ART-todo", payload },
    { type: "append_record", id: "REC-" + id, payload: { flowName: "fixture", stageName: "first", data: { intent } } }
  ]);
  return { outcome: "complete" };
} };
export const agentSpecs = {};
`;
