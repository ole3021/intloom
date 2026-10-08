import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runtime, agentAccess } from "../test/runtime.ts";
import { readSpecification, submitSpecification } from "./specification.ts";
import init from "../codes/specification/init.ts";

import { proposal } from "../test/specification-fixture.ts";

describe("specification", () => {
  test("Agent Tools read and submit using invocation-local access", async () => {
    const r = runtime();
    await init(null, r.access);
    const access = agentAccess(r.access);
    assert.ok(readSpecification.execute);
    assert.ok(submitSpecification.execute);
    const read = await readSpecification.execute({}, access);
    assert.equal((read as { intent: string }).intent, r.state?.intent);
    assert.deepEqual(await submitSpecification.execute(proposal, access), {
      saved: true,
    });
    await r.access.state.clear();
    await assert.rejects(
      Promise.resolve().then(() => readSpecification.execute({}, access)),
    );
  });
});
