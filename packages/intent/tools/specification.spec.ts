import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runtime, agentAccess } from "../test/runtime.ts";
import {
  editSpecification,
  readSpecification,
  submitSpecification,
} from "./specification.ts";
import init from "../codes/specification/init.ts";

import { draftRevision } from "../src/flow/draft.ts";
import { specificationStateSchema } from "../schemas/specification-state.ts";

describe("specification", () => {
  test("revision format is schema-owned and stale submission returns the current revision without changing State", async () => {
    const r = runtime();
    await init(null, r.access);
    const access = agentAccess(r.access);
    const revision = draftRevision(specificationStateSchema.parse(r.state));
    assert.equal(
      submitSpecification.inputSchema.safeParse({
        questions: [],
        draftRevision: `${revision}"}`,
      }).success,
      false,
    );
    assert.equal(
      editSpecification.inputSchema.safeParse({
        edits: [],
        draftRevision: `${revision}"}`,
      }).success,
      false,
    );
    const before = structuredClone(r.state);
    const result = await submitSpecification.execute(
      { questions: [], draftRevision: "0".repeat(64) },
      access,
    );
    assert.equal(result.saved, false);
    if (result.saved) assert.fail("Expected stale revision");
    assert.equal(result.draftRevision, revision);
    assert.deepEqual(submitSpecification.outputSchema.parse(result), result);
    assert.deepEqual(r.state, before);
  });
  test("Agent Tools read and submit using invocation-local access", async () => {
    const r = runtime();
    await init(null, r.access);
    const access = agentAccess(r.access);
    assert.ok(readSpecification.execute);
    assert.ok(submitSpecification.execute);
    const read = await readSpecification.execute({}, access);
    assert.equal((read as { intent: string }).intent, r.state?.intent);
    assert.ok((read as { draftRevision: string }).draftRevision);
    assert.equal("artifactSchema" in (r.state ?? {}), false);
    assert.deepEqual(
      await submitSpecification.execute(
        {
          questions: [],
          draftRevision: draftRevision(specificationStateSchema.parse(r.state)),
        },
        access,
      ),
      {
        saved: true,
      },
    );
    await r.access.state.clear();
    await assert.rejects(
      Promise.resolve().then(() => readSpecification.execute({}, access)),
    );
  });
});
