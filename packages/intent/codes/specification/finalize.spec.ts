import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as z from "zod";
import { saveState } from "../../src/specification/state.ts";
import { emptyArtifact } from "../../src/specification/changes.ts";
import finalize from "./finalize.ts";

import { confirmed } from "../../test/specification-fixture.ts";

describe("finalize", () => {
  test("finalize rejects changed draft even if confirmed remains true", async () => {
    const r = await confirmed();
    const state = r.state;
    assert.ok(state);
    state.intent = "modified";
    await saveState(r.access, state);
    await assert.rejects(finalize(null, r.access), /confirmation/);
    assert.equal(r.calls.length, 0);
  });
  test("finalize rejects an external baseline change after confirmation", async () => {
    const r = await confirmed();
    r.setArtifact({
      id: "ART-new",
      revision: 1,
      flowName: "intent",
      stageName: "specification",
      data: z.json().parse(emptyArtifact()),
      createdAt: "t",
      updatedAt: "t",
    });
    await assert.rejects(finalize(null, r.access), /Artifact changed/);
    assert.equal(r.calls.length, 0);
  });
  for (const type of ["create_artifact", "replace_artifact"] as const) {
    test(`${type} commits Artifact and Record together, then clears State`, async () => {
      const r = await confirmed(
        type === "replace_artifact" ? emptyArtifact() : undefined,
      );
      assert.deepEqual(await finalize(null, r.access), { outcome: "complete" });
      assert.equal(r.calls.length, 1);
      assert.deepEqual(
        r.calls[0]?.map((operation) => operation.type),
        [type, "append_record"],
      );
      assert.equal(r.state, undefined);
      assert.equal(r.records.size, 1);
      if (type === "replace_artifact") {
        const operation = r.calls[0]?.[0];
        assert.ok(operation?.type === "replace_artifact");
        assert.equal(operation.expectedRevision, 1);
        assert.equal(operation.id, "ART-existing");
      }
    });
  }
  test("commit failure retains confirmed State and produces no success", async () => {
    const r = await confirmed();
    r.flags.failCommit = true;
    await assert.rejects(finalize(null, r.access), /commit failed/);
    assert.equal(r.state?.confirmation?.confirmed, true);
    assert.equal(r.records.size, 0);
  });
  test("retry after State clear failure does not commit a second time", async () => {
    const r = await confirmed();
    r.flags.failClear = true;
    await assert.rejects(finalize(null, r.access), /clear failed/);
    assert.equal(r.calls.length, 1);
    r.flags.failClear = false;
    await finalize(null, r.access);
    assert.equal(r.calls.length, 1);
    assert.equal(r.state, undefined);
  });
});
