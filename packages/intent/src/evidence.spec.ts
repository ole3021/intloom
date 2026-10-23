import assert from "node:assert/strict";
import { test } from "node:test";
import {
  runtime,
  specification,
  solution,
  implementation,
  runId,
} from "../test/runtime.ts";
import { prepare as prepareSolution } from "../stages/solution/src/steps.ts";
import { readContext } from "../stages/solution/src/actions.ts";
import { prepare as prepareImplementation } from "../stages/implementation/src/steps.ts";
import { prepare as prepareValidation } from "../stages/validation/src/steps.ts";
import { recordId, seal } from "./storage.ts";
import { readEvidence, readHistory } from "./tools/project.ts";
import {
  rawState,
  evidence,
  inheritEvidence,
  linkedEvidence,
} from "./project.ts";

function receipt(stage: "specification" | "solution", candidateRef?: string) {
  return evidence(
    rawState(runtime(stage).access),
    "project_read",
    { path: "greet.mjs", content: "Original immutable source" },
    candidateRef,
  );
}
function withEvidence<T extends { digest: string }>(
  record: T,
  items: ReturnType<typeof receipt>[],
) {
  const { digest: _digest, ...body } = record;
  return seal({ ...body, evidence: items });
}

test("Solution exposes fixed Specification evidence, including IDs shown by read_history", async () => {
  const upstream = receipt("specification", "CAND-original");
  const local = receipt("solution");
  const fixed = withEvidence(specification(), [upstream]);
  const f = runtime("solution", { evidence: [local] });
  await f.seed("specification", fixed);
  await prepareSolution(f.access);
  await readHistory.execute(
    { recordRef: recordId(runId, "specification") },
    f.access,
  );
  const context = await readContext({}, f.access);
  assert.ok(context.evidence.some((item) => item.id === upstream.id));
  assert.deepEqual(
    await readEvidence.execute({ evidenceRef: upstream.id }, f.access),
    upstream,
  );
  assert.deepEqual(
    await readEvidence.execute({ evidenceRef: local.id }, f.access),
    local,
  );
  const before = rawState(f.access).evidence;
  await prepareSolution(f.access);
  assert.deepEqual(rawState(f.access).evidence, before);
  assert.deepEqual(
    (await f.storage.getRecordById(recordId(runId, "specification")))?.data,
    fixed,
  );
  assert.throws(
    () => linkedEvidence(rawState(f.access), [upstream.id], "CAND-other"),
    /another candidate/u,
  );
  await assert.rejects(
    async () => readEvidence.execute({ evidenceRef: "EVD-invented" }, f.access),
    /Unknown evidence/u,
  );
});

test("fixed evidence crosses Implementation and Validation without duplication or relabeling", async () => {
  const upstream = receipt("specification");
  const design = receipt("solution");
  const spec = withEvidence(specification(), [upstream]);
  const sol = withEvidence(solution(), [upstream, design]);
  sol.basis.specification.digest = spec.digest;
  const { digest: _digest, ...body } = sol;
  const fixed = seal(body);
  const f = runtime("implementation");
  await f.seed("specification", spec);
  await f.seed("solution", fixed);
  await prepareImplementation(f.access);
  assert.deepEqual(rawState(f.access).evidence, [upstream, design]);
  await prepareImplementation(f.access);
  assert.deepEqual(rawState(f.access).evidence, [upstream, design]);
  const impl = withEvidence(
    implementation(f.candidate()),
    rawState(f.access).evidence,
  );
  impl.basis.specification.digest = spec.digest;
  impl.basis.solution.digest = fixed.digest;
  const { digest: _implDigest, ...implBody } = impl;
  await f.seed("implementation", seal(implBody));
  const validation = runtime("validation", {}, f.storage);
  await prepareValidation(validation.access);
  for (const item of [upstream, design])
    assert.deepEqual(
      await readEvidence.execute({ evidenceRef: item.id }, validation.access),
      item,
    );
});

test("reading unrelated historical Records does not adopt their evidence", async () => {
  const f = runtime("solution");
  const historical = evidence(
    rawState(runtime("specification", { id: "RUN-old" }).access),
    "project_read",
    { path: "greet.mjs", content: "Historical source" },
  );
  await f.seed(
    "specification",
    withEvidence(specification("RUN-old"), [historical]),
  );
  const result = await readHistory.execute(
    { recordRef: recordId("RUN-old", "specification") },
    f.access,
  );
  assert.ok(result && typeof result === "object");
  assert.equal(rawState(f.access).evidence[0]?.kind, "historical_result");
  await assert.rejects(
    async () => readEvidence.execute({ evidenceRef: historical.id }, f.access),
    /Unknown evidence/u,
  );
});

test("inherited evidence conflicts fail without overwriting local receipts", () => {
  const original = receipt("specification");
  const state = rawState(runtime("solution", { evidence: [original] }).access);
  assert.throws(
    () => inheritEvidence(state, [{ ...original, data: "different source" }]),
    { code: "INVALID_INTENT_BASIS" },
  );
  assert.deepEqual(state.evidence, [original]);
});
