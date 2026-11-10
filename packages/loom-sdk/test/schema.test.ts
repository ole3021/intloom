import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  defineCode,
  defineStep,
  DefinitionError,
  withDefault,
} from "../src/index.ts";

function accepts(schema: z.ZodType) {
  return defineCode({
    id: "schema",
    inputSchema: schema,
    outputSchema: z.null(),
    execute: () => null,
  });
}
const unsupported = (value: unknown) =>
  value instanceof DefinitionError && value.code === "SCHEMA_UNSUPPORTED";

test("withDefault preserves raw and normalized projection and constant values across composition", () => {
  const supplied = { nested: { values: [1, 2] } };
  const base = z.strictObject({
    nested: z.strictObject({ values: z.array(z.number()) }),
  });
  const fallback = withDefault(base, supplied);
  supplied.nested.values.push(3);
  const first = fallback.parse(undefined);
  first.nested.values.push(9);
  assert.deepEqual(fallback.parse(undefined), { nested: { values: [1, 2] } });
  assert.deepEqual(fallback.clone().parse(undefined), {
    nested: { values: [1, 2] },
  });
  const schema = z
    .strictObject({ fallback: fallback.clone().describe("Constant") })
    .extend({ count: withDefault(z.number(), 3) });
  accepts(schema);
  const raw = z.toJSONSchema(schema, { io: "input", target: "draft-2020-12" });
  const normalized = z.toJSONSchema(schema, {
    io: "output",
    target: "draft-2020-12",
  });
  assert.deepEqual(raw.required ?? [], []);
  assert.deepEqual(normalized.required, ["fallback", "count"]);
  assert.deepEqual(
    (raw.properties?.fallback as z.core.JSONSchema.BaseSchema)?.default,
    { nested: { values: [1, 2] } },
  );
  assert.deepEqual(
    (raw.properties?.count as z.core.JSONSchema.BaseSchema)?.default,
    3,
  );
  assert.deepEqual(withDefault(z.boolean(), false).parse(undefined), false);
  assert.deepEqual(withDefault(z.string(), "").parse(undefined), "");
  const optionalDefault = withDefault(z.string().optional(), "present");
  accepts(optionalDefault);
  assert.equal(optionalDefault.parse(undefined), "present");
  const step = defineStep({
    id: "resume",
    inputSchema: z.null(),
    outputSchema: z.boolean(),
    suspendSchema: z.null(),
    resumeSchema: withDefault(z.boolean(), false),
    execute: async ({ resumeData, suspend }) => resumeData ?? suspend(null),
  });
  assert.equal(step.resumeSchema?.parse(undefined), false);
});

test("native default getters and forbidden validation callbacks are never executed", () => {
  let calls = 0;
  const schema = z.strictObject({
    value: z.string().default(() => {
      calls++;
      return "default";
    }),
  });
  assert.throws(() => accepts(schema), unsupported);
  assert.equal(calls, 0);
  assert.throws(
    () =>
      withDefault(
        z.number({
          error: () => {
            calls++;
            return "custom";
          },
        }),
        "wrong" as never,
      ),
    unsupported,
  );
  assert.throws(
    () =>
      withDefault(
        z.number().min(1, {
          error: () => {
            calls++;
            return "custom";
          },
        }),
        0,
      ),
    unsupported,
  );
  assert.equal(calls, 0);
  assert.throws(() => accepts(z.string().default("constant")), /withDefault/);
  const custom = z.string().refine(() => {
    calls++;
    return true;
  });
  assert.throws(() => accepts(custom), unsupported);
  assert.throws(() => withDefault(custom, "value"), unsupported);
  assert.throws(
    () =>
      accepts(
        z.stringFormat("my-format", () => {
          calls++;
          return true;
        }),
      ),
    unsupported,
  );
  assert.throws(
    () =>
      accepts(
        z.lazy(() => {
          calls++;
          return z.string();
        }),
      ),
    unsupported,
  );
  assert.equal(calls, 0);
});

test("invalid constants fail at declaration, including functions, instances, cycles and schema mismatch", () => {
  const invalid: unknown[] = [
    undefined,
    () => 1,
    new Date(),
    new Map(),
    new Set(),
    1n,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    [undefined],
    new (class Value {
      x = 1;
    })(),
  ];
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  invalid.push(cyclic);
  const hole = new Array(1);
  invalid.push(hole);
  let called = false;
  invalid.push({
    get value() {
      called = true;
      return 1;
    },
  });
  for (const value of invalid)
    assert.throws(
      () => withDefault(z.number(), value as never),
      (cause) =>
        cause instanceof DefinitionError && cause.code === "DEFAULT_INVALID",
    );
  assert.equal(called, false);
  assert.throws(
    () => withDefault(z.number().positive(), -1),
    (cause) =>
      cause instanceof DefinitionError && cause.code === "DEFAULT_INVALID",
  );
  assert.throws(
    () => withDefault(z.object({ x: z.number() }), { x: 1, extra: 2 } as never),
    /normalized output/,
  );
  assert.throws(
    () =>
      withDefault(
        z.strictObject({ x: withDefault(z.number(), 1) }),
        {} as never,
      ),
    /normalized output/,
  );
});

test("supported finite JSON structure and built-in restrictions survive JSON Schema conversion", () => {
  const schema = z.strictObject({
    text: z
      .string()
      .min(1)
      .max(30)
      .regex(/^[a-z]+$/),
    count: z.number().int().min(0).max(100).multipleOf(2),
    email: z.email(),
    hex: z.hex(),
    date: z.iso.date(),
    nullable: z.string().nullable(),
    optional: z.boolean().optional(),
    values: z.array(z.enum(["a", "b"])).min(1),
    pair: z.tuple([z.number(), z.literal(null)]),
    mapping: z.record(z.string(), z.number()),
    choice: z.discriminatedUnion("type", [
      z.strictObject({ type: z.literal("a"), a: z.number() }),
      z.strictObject({ type: z.literal("b"), b: z.boolean() }),
    ]),
    mixed: z.union([z.literal(true), z.number(), z.string()]),
  });
  accepts(schema);
  const projected = z.toJSONSchema(schema, { target: "draft-2020-12" });
  assert.equal(projected.additionalProperties, false);
  assert.equal(
    (projected.properties?.count as z.core.JSONSchema.BaseSchema)?.multipleOf,
    2,
  );
  assert.equal(
    (projected.properties?.text as z.core.JSONSchema.BaseSchema)?.pattern,
    "^[a-z]+$",
  );
  assert.equal(
    (projected.properties?.email as z.core.JSONSchema.BaseSchema)?.format,
    "email",
  );
  for (const schema of [
    z.object({ value: z.string() }),
    z.looseObject({ value: z.string() }),
    z.object({ value: z.string() }).catchall(z.number()),
  ]) {
    accepts(schema);
    const input = z.toJSONSchema(schema, { io: "input" });
    const output = z.toJSONSchema(schema, { io: "output" });
    if (schema._zod.def.catchall === undefined) {
      assert.equal(input.additionalProperties, undefined);
      assert.equal(output.additionalProperties, false);
    }
  }
});

test("unsupported or non-JSON contracts fail with component and schema location", () => {
  const unsupportedSchemas = [
    z.any(),
    z.unknown(),
    z.date(),
    z.bigint(),
    z.map(z.string(), z.string()),
    z.set(z.string()),
    z.nan(),
    z.undefined(),
    z.string().optional(),
    z.array(z.string().optional()),
    z.coerce.number(),
    z.string().transform((value) => value.length),
    z.preprocess(String, z.string()),
    z.string().superRefine(() => {}),
    z.string().refine(async () => true),
    z.string().trim(),
    z.string().regex(/hello/i),
    z.string().catch("fallback"),
    z.string().prefault("fallback"),
    z.literal(undefined),
    z.enum({ infinite: Number.POSITIVE_INFINITY }),
    z.number().min(Number.POSITIVE_INFINITY),
  ];
  for (const schema of unsupportedSchemas)
    assert.throws(
      () => accepts(schema),
      (cause) =>
        unsupported(cause) &&
        cause instanceof DefinitionError &&
        cause.path.startsWith("schema.inputSchema"),
    );
  const recursive = z.object({
    get child(): z.ZodType {
      return recursive;
    },
  });
  assert.throws(() => accepts(recursive), unsupported);
  assert.throws(
    () =>
      defineCode({
        id: "out",
        inputSchema: z.null(),
        outputSchema: z.strictObject({ value: withDefault(z.string(), "no") }),
        execute: () => ({ value: "yes" }),
      }),
    /only allowed in input and resume/,
  );
  assert.throws(
    () =>
      defineStep({
        id: "wait",
        inputSchema: z.null(),
        outputSchema: z.null(),
        suspendSchema: withDefault(z.string(), "no"),
        execute: () => null,
      }),
    /only allowed in input and resume/,
  );
});
