import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonCopy } from "./contracts.ts";
import { validateScope } from "./coordinator.ts";
import type { MirrorManifest } from "./contracts.ts";

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
test("scope selects actual calls and visits without guessing next positions", () => {
  const manifest = (kind: MirrorManifest["boundary"]["kind"]) =>
    ({
      restorable: kind !== "workflow_end",
      boundary: { kind },
    }) as MirrorManifest;
  assert.doesNotThrow(() => validateScope(manifest("step_before"), "step"));
  assert.throws(
    () => validateScope(manifest("step_after"), "step"),
    /step_before/u,
  );
  assert.throws(
    () => validateScope(manifest("stage_end"), "stage"),
    /visit has ended/u,
  );
  assert.throws(() => validateScope(manifest("workflow_end"), "workflow"));
  for (const kind of [
    "workflow_start",
    "stage_before_init",
    "stage_start",
    "step_before",
    "step_after",
  ] as const)
    assert.doesNotThrow(() => validateScope(manifest(kind), "stage"));
});
