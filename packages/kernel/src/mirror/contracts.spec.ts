import assert from "node:assert/strict";
import { test } from "node:test";
import { validateScope } from "./coordinator.ts";
import type { MirrorManifest } from "./contracts.ts";

test("scope selects actual calls and visits without guessing next positions", () => {
  const manifest = (kind: MirrorManifest["boundary"]["kind"]) =>
    ({
      restorable: kind !== "loom_end",
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
  assert.throws(() => validateScope(manifest("loom_end"), "loom"));
  for (const kind of [
    "loom_start",
    "stage_before_init",
    "stage_start",
    "step_before",
    "step_after",
  ] as const)
    assert.doesNotThrow(() => validateScope(manifest(kind), "stage"));
});
