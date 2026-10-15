import assert from "node:assert/strict";
import { test } from "node:test";
import { runtime, specification, solution } from "../../../test/runtime.ts";
import { prepare, verify, check, resolve, commit } from "./steps.ts";
import { readState, readContext, submit } from "./actions.ts";
import { readProject, writeProject } from "../../../src/tools/project.ts";
import { implementationRecordSchema } from "../schema/record.ts";
import { recordId } from "../../../src/storage.ts";
async function fixture() {
  const f = runtime("implementation");
  await f.seed("specification", specification());
  await f.seed("solution", solution());
  await prepare(f.access);
  return f;
}
test("actual source changes are host-owned; writes require a current read", async () => {
  const f = await fixture();
  await assert.rejects(
    async () =>
      writeProject.execute({ path: "greet.mjs", content: "fixed" }, f.access),
    /Read the current/,
  );
  await readProject.execute({ path: "greet.mjs" }, f.access);
  await writeProject.execute({ path: "greet.mjs", content: "fixed" }, f.access);
  await readContext({}, f.access);
  const s = readState(f.access);
  assert.equal(s.changes.length, 1);
  assert.equal(s.changes[0]!.operationRefs.length, 1);
  const result = await submit(
    {
      revision: s.revision,
      candidateRef: s.candidate!.id,
      kind: "ready",
      items: [
        {
          implementationRef: "IMPL-a",
          outcome: "implemented",
          explanation: "Actual implementation",
          changeRefs: [s.changes[0]!.id],
          sourceRefs: [],
          remaining: "",
        },
      ],
      issues: [],
    },
    f.access,
  );
  assert.equal(result.saved, true);
  await verify(f.access);
  assert.equal(f.flags.executions, 1);
  assert.equal((await check(f.access)).outcome, "ready");
  f.files["greet.mjs"] = "external drift";
  await assert.rejects(commit(f.access), /fixed candidate/);
  assert.equal(f.records.size, 2);
});
test("incomplete delivery requires a real choice and preserves all implementation items", async () => {
  const f = await fixture();
  const s = readState(f.access);
  await submit(
    {
      revision: s.revision,
      candidateRef: s.candidate!.id,
      kind: "needs_attention",
      items: [
        {
          implementationRef: "IMPL-a",
          outcome: "incomplete",
          explanation: "Not implemented",
          changeRefs: [],
          sourceRefs: [],
          remaining: "Implement the greeting",
        },
      ],
      issues: [],
    },
    f.access,
  );
  await verify(f.access);
  assert.equal((await check(f.access)).outcome, "needs_input");
  await assert.rejects(commit(f.access), /handoff check/);
  f.replies.push({ isConfirmed: true });
  await resolve(f.access);
  await check(f.access);
  await commit(f.access);
  const record = implementationRecordSchema.parse(
    f.records.get(recordId(s.id, "implementation"))!.data,
  );
  assert.equal(record.delivery.kind, "partial");
  assert.equal(record.submission.items[0]!.outcome, "incomplete");
});

test("an unsettled verification is never automatically replayed or handed off", async () => {
  const f = await fixture();
  await readProject.execute({ path: "greet.mjs" }, f.access);
  let s = readState(f.access);
  const source = s.evidence.find((e) => e.kind === "project_read")!;
  await submit(
    {
      revision: s.revision,
      candidateRef: s.candidate!.id,
      kind: "ready",
      items: [
        {
          implementationRef: "IMPL-a",
          outcome: "reused",
          explanation: "Inspect existing behavior",
          changeRefs: [],
          sourceRefs: [source.id],
          remaining: "",
        },
      ],
      issues: [],
    },
    f.access,
  );
  s = readState(f.access);
  s.verifications[0]!.disposition = "executing";
  await f.set(s);
  await assert.rejects(verify(f.access), /no settled receipt/);
  await assert.rejects(check(f.access), /no settled receipt/);
  assert.equal(f.flags.executions, 0);
});
