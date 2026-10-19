import assert from "node:assert/strict";
import { test } from "node:test";
import { runtime } from "../test/runtime.ts";
import { assertCandidate } from "./project.ts";

test("a missing candidate cannot silently adopt the current workspace", async () => {
  const f = runtime("implementation");
  const fixed = f.candidate();
  await assert.rejects(assertCandidate(f.access, undefined), {
    code: "INVALID_INTENT_BASIS",
  });
  assert.deepEqual(await assertCandidate(f.access, fixed), fixed);
  f.files["greet.mjs"] = "external edit";
  await assert.rejects(assertCandidate(f.access, fixed), {
    code: "INTENT_CANDIDATE_CHANGED",
  });
});
