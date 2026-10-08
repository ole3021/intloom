import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runtime } from "../../test/runtime.ts";
import init from "./init.ts";

describe("init", () => {
  test("bootstrap reads Runtime State, loads baseline and is idempotent", async () => {
    const r = runtime();
    await init({ intent: "must be ignored" }, r.access);
    assert.equal(r.state?.intent, "Save the user's explicit requirements");
    assert.equal(r.state?.baseline, null);
    const first = r.state;
    await init(null, r.access);
    assert.deepEqual(r.state, first);
  });
});
