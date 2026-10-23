export { artifact } from "../../../packages/kernel/test/artifact-fixture.ts";

/** Commits atomically through actual Code; the Record ID intentionally differs from the Run ID. */
export const artifactLoom = `import * as z from "zod";
export const blueprint = {inputs:["prompt"], loomName: "fixture", entryStageName: "first", stages: {
  first: { stageName: "first", initializeState: ({ runId, input }) => ({ id: runId, intent: input.prompt }), stateSchema: z.strictObject({ id: z.string(), intent: z.string() }), entryStepName: "save",
    steps: { save: { stepName: "save", execution: { kind: "code", codeId: "CODE-123456789012345678901" }, on: { complete: { kind: "stage_end" } } } }, on: { complete: { kind: "loom_end" } } }
} };
export const codes = { "CODE-123456789012345678901": async (access) => {
  const { id, intent } = access.state.value;
  const old = await access.storage.getArtifact("fixture", "first");
  const payload = { loomName: "fixture", stageName: "first", data: { title: intent, requirements: ["Add tasks", "Browser persistence"], note: "  original\\ncontent  " } };
  await access.storage.commit([
    old ? { type: "replace_artifact", id: old.id, expectedRevision: old.revision, payload } : { type: "create_artifact", id: "ART-todo", payload },
    { type: "append_record", id: "REC-" + id, payload: { loomName: "fixture", stageName: "first", data: { intent } } }
  ]);
  return { outcome: "complete" };
} };
export const agentSpecs = {};
`;
