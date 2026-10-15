import assert from "node:assert/strict";
import { test } from "node:test";
import { runtime, specification, runId } from "../test/runtime.ts";
import { inputRecord, loadRecord, recordId } from "./storage.ts";
import { json } from "./json.ts";

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
