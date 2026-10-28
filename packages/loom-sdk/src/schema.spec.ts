import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSchemaValue, schemaFromJson, type JsonSchema } from "./schema.ts";

test("the supported JSON Schema dialect enforces structure and business constraints", () => {
  const schema: JsonSchema = {
    type: "object",
    properties: {
      text: { type: "string", minLength: 2, pattern: "^[a-z]+$" },
      count: { type: "integer", minimum: 1, maximum: 4 },
      items: {
        type: "array",
        items: { type: "string", enum: ["a", "b"] },
        minItems: 1,
      },
    },
    required: ["text", "count", "items"],
    additionalProperties: false,
  };
  const valid = { text: "ok", count: 2, items: ["a"] };
  assert.deepEqual(parseSchemaValue(schema, valid), valid);
  for (const invalid of [
    { ...valid, extra: true },
    { ...valid, text: "A" },
    { ...valid, count: 1.1 },
    { ...valid, count: 5 },
    { ...valid, items: [] },
    { ...valid, items: ["c"] },
  ])
    assert.throws(() => parseSchemaValue(schema, invalid));
});
test("unsupported or malformed constraints fail instead of silently weakening validation", () => {
  for (const schema of [
    { type: "string", format: "email" },
    { type: "number", minLength: 1 },
    { type: "object", required: ["missing"] },
    { type: "integer", minimum: "0" },
    { type: "object", properties: { x: { type: "string", minLength: -1 } } },
    { $ref: "./schema.json" },
  ])
    assert.throws(() => schemaFromJson(schema));
  assert.equal(parseSchemaValue({ type: "null" }, null), null);
  assert.throws(() => parseSchemaValue(false, {}));
  assert.deepEqual(
    parseSchemaValue(
      { type: "object", properties: { x: { type: "number" } } },
      { x: 1, y: 2 },
    ),
    { x: 1, y: 2 },
  );
});

test("the distributed editor schema matches the authoritative author schema", async () => {
  const { readFile } = await import("node:fs/promises");
  const z = await import("zod");
  const { loomDefinitionSchema } = await import("./capability.ts");
  assert.deepEqual(
    JSON.parse(
      await readFile(
        new URL("../schemas/loom.schema.json", import.meta.url),
        "utf8",
      ),
    ),
    z.toJSONSchema(loomDefinitionSchema, { io: "input" }),
  );
});

test("enum and const preserve sibling constraints and compare nested JSON values structurally", () => {
  const constrained: JsonSchema = {
    type: "string",
    enum: ["a", "long"],
    minLength: 2,
  };
  assert.throws(() => parseSchemaValue(constrained, "a"));
  assert.equal(parseSchemaValue(constrained, "long"), "long");
  assert.throws(() => parseSchemaValue({ type: "string", const: 1 }, 1));
  assert.throws(() => parseSchemaValue({ enum: [1, 2], const: 2 }, 1));
  assert.equal(parseSchemaValue({ enum: [1, 2], const: 2 }, 2), 2);
  const value = { a: [1, "x", { b: true }], c: null };
  assert.deepEqual(
    parseSchemaValue({ const: value }, { c: null, a: [1, "x", { b: true }] }),
    value,
  );
  assert.throws(() =>
    parseSchemaValue({ const: value }, { ...value, extra: true }),
  );
  assert.throws(() =>
    parseSchemaValue({ const: value }, { ...value, a: [1, "x"] }),
  );
  assert.deepEqual(parseSchemaValue({ enum: [[], value] }, []), []);
  const nested: JsonSchema = { type: "array", items: constrained };
  assert.throws(() => parseSchemaValue(nested, ["a"]));
  assert.deepEqual(parseSchemaValue(nested, ["long"]), ["long"]);
  assert.throws(() => parseSchemaValue({ type: "array", minItems: 1 }, []));
  assert.throws(() => parseSchemaValue({ type: "array", maxItems: 1 }, [1, 2]));
});

test("oneOf requires exactly one matching branch and anyOf keeps sibling constraints", () => {
  const exclusive: JsonSchema = {
    oneOf: [{ type: "number" }, { type: "integer" }],
  };
  assert.throws(() => parseSchemaValue(exclusive, 2));
  assert.equal(parseSchemaValue(exclusive, 2.5), 2.5);
  const inclusive: JsonSchema = {
    type: "string",
    minLength: 2,
    anyOf: [{ const: "a" }, { const: "long" }],
  };
  assert.throws(() => parseSchemaValue(inclusive, "a"));
  assert.equal(parseSchemaValue(inclusive, "long"), "long");
  for (const invalid of [
    { oneOf: [] },
    { anyOf: [{}], type: "string", format: "email" },
  ])
    assert.throws(() => schemaFromJson(invalid));
});
