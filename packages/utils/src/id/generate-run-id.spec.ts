import assert from "node:assert/strict";
import { test } from "node:test";
import { generateRunId } from "./generate-run-id.ts";

test("Run IDs retain exact UTC milliseconds and remain unique at the same timestamp", () => {
  const now = new Date("2026-10-08T06:30:15.123Z");
  const ids = Array.from({ length: 100 }, () => generateRunId(now));
  for (const id of ids)
    assert.match(id, /^RUN-20261008T063015123Z-[\w-]{21}$/u);
  assert.equal(new Set(ids).size, ids.length);
});
