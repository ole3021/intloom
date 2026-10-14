import assert from "node:assert/strict";
import { test } from "node:test";
import { toolSchema } from "./schema.ts";

test("E2E schema validation retains host constraints without SDK format warnings in the console", async (t) => {
  const warn = t.mock.method(console, "warn");
  const schema = toolSchema({
    type: "object",
    properties: {
      id: { type: "string", format: "starts_with", pattern: "^ART-" },
    },
    required: ["id"],
    additionalProperties: false,
  });
  assert.deepEqual(await schema["~standard"].validate({ id: "ART-one" }), {
    value: { id: "ART-one" },
  });
  assert.ok(
    (await schema["~standard"].validate({ id: "wrong" })).issues?.length,
  );
  assert.ok((await schema["~standard"].validate({})).issues?.length);
  assert.equal(warn.mock.callCount(), 0);
});
