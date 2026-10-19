import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonCopy } from "./json.ts";

test("JSON snapshots preserve null, absent fields, empty objects and dense arrays; reject lossy values", () => {
  assert.deepEqual(jsonCopy({ empty: {}, nil: null, array: [null, {}] }), {
    empty: {},
    nil: null,
    array: [null, {}],
  });
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (const value of [
    { value: undefined },
    { value: NaN },
    { value: -0 },
    { value: () => {} },
    { value: new Date() },
    { value: new Uint8Array(2) },
    cycle,
    new Array(2),
  ])
    assert.throws(() => jsonCopy(value));
});
