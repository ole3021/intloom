import assert from "node:assert/strict";
import { test } from "node:test";
import { runtime, specification, runId } from "../test/runtime.ts";
import {
  assertBaseline,
  inputRecord,
  loadRecord,
  recordId,
} from "./storage.ts";
import { json } from "./json.ts";

test("an absent baseline fails while a null first-publication baseline remains valid", async () => {
  const f = runtime("specification");
  await assert.rejects(assertBaseline(f.access, "specification", undefined), {
    code: "INVALID_INTENT_BASIS",
  });
  assert.equal(await assertBaseline(f.access, "specification", null), null);
  assert.equal(f.artifacts.size, 0);
  assert.equal(f.records.size, 0);
});

test("a missing handoff reference fails even when the expected Record exists", async () => {
  const f = runtime("solution");
  await f.seed("specification", specification());
  await assert.rejects(
    loadRecord(f.storage, undefined, "specification", runId),
    {
      code: "INVALID_INTENT_BASIS",
    },
  );
  assert.equal(f.records.size, 1);
});

test("handoff reads the immutable same-Run Record even when the latest Artifact differs", async () => {
  const f = runtime("solution"),
    spec = specification();
  await f.seed("specification", spec);
  await f.storage.commit([
    {
      type: "create_artifact",
      id: "newer-artifact",
      payload: {
        loomName: "intent",
        stageName: "specification",
        data: { unrelated: "another Run" },
      },
    },
  ]);
  assert.deepEqual(
    (await inputRecord(f.storage, runId, "specification")).data,
    json(spec),
  );
  await assert.rejects(
    loadRecord(
      f.storage,
      { recordRef: recordId(runId, "specification"), digest: "wrong" },
      "specification",
      runId,
    ),
    /digest mismatch/,
  );
  await assert.rejects(
    loadRecord(
      f.storage,
      { recordRef: recordId(runId, "specification"), digest: spec.digest },
      "specification",
      "RUN-other",
    ),
    /identity/,
  );
});
