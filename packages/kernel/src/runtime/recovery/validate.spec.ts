import assert from "node:assert/strict";
import { test } from "node:test";
import {
  runtimeFixture,
  fixtureStateSchema,
} from "../../../test/runtime-fixture.ts";
import { createRun } from "../create-run.ts";
import { createRunEntry } from "../run-entry.ts";
import { checkpointData } from "./checkpoint.ts";
import { validateRecovery } from "./validate.ts";

test("offline recovery validation needs no Storage, Execution or checkpoint store and never executes business entries", async () => {
  const f = runtimeFixture();
  let schemaParses = 0;
  Object.assign(f.first, {
    stateSchema: fixtureStateSchema.superRefine(() => {
      schemaParses++;
    }),
  });
  const entry = createRunEntry(
    f.blueprint,
    createRun(f.blueprint, { prompt: "saved" }),
  );
  await entry.stageState.enter(f.first);
  const saved = checkpointData(entry, "step_ready");
  const original = structuredClone(saved);
  f.events.length = 0;
  schemaParses = 0;
  const resources = {
    codes: f.codes,
    blueprints: { fixture: f.blueprint },
    loomIdentities: { fixture: "untracked" },
  };
  const validated = await validateRecovery(saved, resources);
  assert.equal(schemaParses, 1);
  assert.deepEqual(f.events, []);
  assert.deepEqual(saved, original);
  assert.equal(validated.interrupted, false);
  assert.equal(validated.entry.task, undefined);
  assert.equal(validated.entry.activeCall, undefined);
  assert.equal(validated.entry.recovery, undefined);
  assert.deepEqual(validated.entry.stageState.value, entry.stageState.value);
  const incompatible = structuredClone(saved);
  assert.ok(incompatible.stage);
  incompatible.stage.value = { value: 99, intent: "changed" };
  await assert.rejects(validateRecovery(incompatible, resources), {
    code: "STAGE_STATE_INVALID",
  });
  assert.deepEqual(f.events, []);
});
