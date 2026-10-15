import * as z from "zod";
import { defineAgentTool } from "@intloom/loom-sdk";
import { project } from "../access.ts";
import { text } from "../schema/common.ts";
import {
  rawState,
  snapshot,
  evidence,
  getEvidence,
  assertCandidate,
} from "../project.ts";
import { json } from "../json.ts";
import { save } from "../state.ts";
import { fail } from "../errors.ts";
export const listProject = defineAgentTool({
  id: "list_project_files",
  description:
    "Read the current product file manifest. IntLoom data and generated evidence are excluded by the host.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: async (_, access) => json(await snapshot(access)),
});
export const readProject = defineAgentTool({
  id: "read_project_file",
  description:
    "Read actual project text and register an immutable source receipt. Returns evidenceRef; read source before changing an existing file.",
  inputSchema: z.strictObject({ path: text }),
  outputSchema: z.json(),
  execute: async ({ path }, access) => {
    const state = rawState(access),
      before = await snapshot(access);
    if (state.stageName === "validation") {
      const expected = state.candidate;
      if (
        expected &&
        typeof expected === "object" &&
        "id" in expected &&
        expected.id !== before.id
      )
        fail("Candidate changed.", "INTENT_CANDIDATE_CHANGED");
    }
    const content = await project(access).read(path);
    await assertCandidate(access, before);
    const item = evidence(
      state,
      "project_read",
      { path, content, contentDigest: before.files[path] },
      before.id,
    );
    await save(access, state, false);
    return json({ content, evidenceRef: item.id, candidateRef: before.id });
  },
});
export const readEvidence = defineAgentTool({
  id: "read_evidence",
  description:
    "Read the original immutable content of a listed evidence reference, including command output and limitations.",
  inputSchema: z.strictObject({ evidenceRef: text }),
  outputSchema: z.json(),
  execute: async ({ evidenceRef }, access) =>
    json(getEvidence(rawState(access), evidenceRef)),
});
export const readHistory = defineAgentTool({
  id: "read_history",
  description:
    "List historical Intent Records, or read a specific Record and register its actual source. Historical results are not current-candidate verification.",
  inputSchema: z.strictObject({
    recordRef: text.optional(),
    stageName: z
      .enum(["specification", "solution", "implementation", "validation"])
      .optional(),
    cursor: text.optional(),
  }),
  outputSchema: z.json(),
  execute: async (input, access) => {
    if (!input.recordRef)
      return json(
        await access.storage.listRecords({
          loomName: "intent",
          ...(input.stageName ? { stageName: input.stageName } : {}),
          ...(input.cursor ? { cursor: input.cursor } : {}),
          limit: 20,
        }),
      );
    const stored = await access.storage.getRecordById(input.recordRef);
    if (!stored || stored.loomName !== "intent") fail("Unknown Intent Record.");
    const state = rawState(access);
    const item = evidence(state, "historical_result", {
      recordRef: stored.id,
      data: stored.data,
    });
    await save(access, state, false);
    return json({ evidenceRef: item.id, record: stored });
  },
});
export const writeProject = defineAgentTool({
  id: "write_project_file",
  description:
    "Write an implementation file. Existing content must have been read at its current hash; writes receive host-owned operation evidence. Preserve unrelated work.",
  inputSchema: z.strictObject({ path: text, content: z.string() }),
  outputSchema: z.json(),
  execute: async ({ path, content }, access) => {
    const state = rawState(access);
    if (state.stageName !== "implementation" || state.task !== "implement")
      fail("Product writes are restricted to implementation.");
    const before = await snapshot(access);
    if (
      before.files[path] &&
      !state.evidence.some(
        (item) =>
          item.kind === "project_read" &&
          item.data &&
          typeof item.data === "object" &&
          !Array.isArray(item.data) &&
          item.data.path === path &&
          item.data.contentDigest === before.files[path],
      )
    )
      fail("Read the current file before replacing it.");
    await project(access).write(path, content);
    const after = await snapshot(access);
    const item = evidence(
      state,
      "project_write",
      {
        path,
        beforeDigest: before.files[path] ?? null,
        afterDigest: after.files[path] ?? null,
        before,
        after,
        at: new Date().toISOString(),
      },
      after.id,
    );
    delete state.checkedDigest;
    delete state.partialApproval;
    delete state.externalApproval;
    await save(access, state);
    return json({
      saved: true,
      operationRef: item.id,
      candidateRef: after.id,
      revision: state.revision,
    });
  },
});
export const removeProject = defineAgentTool({
  id: "remove_project_file",
  description:
    "Remove a previously read file required by the confirmed feature change; register the actual deletion.",
  inputSchema: z.strictObject({ path: text }),
  outputSchema: z.json(),
  execute: async ({ path }, access) => {
    const state = rawState(access);
    if (state.stageName !== "implementation" || state.task !== "implement")
      fail("Removal is restricted to implementation.");
    const before = await snapshot(access);
    if (
      !before.files[path] ||
      !state.evidence.some(
        (item) =>
          item.kind === "project_read" &&
          item.data &&
          typeof item.data === "object" &&
          !Array.isArray(item.data) &&
          item.data.path === path &&
          item.data.contentDigest === before.files[path],
      )
    )
      fail("Read the current file before removing it.");
    await project(access).remove(path);
    const after = await snapshot(access);
    const item = evidence(
      state,
      "project_write",
      {
        path,
        beforeDigest: before.files[path],
        afterDigest: null,
        before,
        after,
        at: new Date().toISOString(),
      },
      after.id,
    );
    delete state.checkedDigest;
    delete state.partialApproval;
    delete state.externalApproval;
    await save(access, state);
    return json({
      saved: true,
      operationRef: item.id,
      candidateRef: after.id,
      revision: state.revision,
    });
  },
});
