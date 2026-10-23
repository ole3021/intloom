import assert from "node:assert/strict";
import { test } from "node:test";
import * as z from "zod";
import {
  runtime,
  specification,
  solution,
  implementation,
} from "../test/runtime.ts";
import * as spec from "../stages/specification/src/steps.ts";
import * as sol from "../stages/solution/src/steps.ts";
import * as impl from "../stages/implementation/src/steps.ts";
import * as val from "../stages/validation/src/steps.ts";
import { readSpecificationContext } from "../stages/specification/tools/index.ts";
import { readSolutionContext } from "../stages/solution/tools/index.ts";
import { readImplementationContext } from "../stages/implementation/tools/index.ts";
import { readValidationContext } from "../stages/validation/tools/index.ts";

test("prepared Context contracts return valid JSON without undefined optional fields", async () => {
  const cases = [
    {
      stage: "specification",
      prepare: spec.prepare,
      tool: readSpecificationContext,
    },
    { stage: "solution", prepare: sol.prepare, tool: readSolutionContext },
    {
      stage: "implementation",
      prepare: impl.prepare,
      tool: readImplementationContext,
    },
    { stage: "validation", prepare: val.prepare, tool: readValidationContext },
  ] as const;
  for (const item of cases) {
    const f = runtime(item.stage);
    await f.seed("specification", specification());
    await f.seed("solution", solution());
    await f.seed("implementation", implementation(f.candidate()));
    // The source stage itself has not committed; upstream records are fixture inputs.
    f.records.delete(`REC-RUN-rule-test-${item.stage}`);
    await item.prepare(f.access);
    const value = await item.tool.execute({}, f.access),
      parsed = item.tool.outputSchema.parse(value);
    assert.equal(z.json().safeParse(parsed).success, true);
    assert.equal(parsed.runId, "RUN-rule-test");
    assert.doesNotThrow(() => z.toJSONSchema(item.tool.outputSchema));
  }
});
