import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { defineCode, DefinitionError, withDefault } from "@intloom/loom-sdk";
import { z } from "zod";

await writeFile(
  "author-source.ts",
  `
  import { defineCode, defineLoom, withDefault } from "@intloom/loom-sdk";
  import { z } from "zod";
  export let calls = 0;
  const constant = { labels: ["stable"] };
  const value = withDefault(z.strictObject({ labels: z.array(z.string()) }), constant);
  constant.labels.push("changed");
  export const schema = z.strictObject({ config: value.clone().describe("config"), count: withDefault(z.number(), 4) });
  export const native = z.string().default(() => { calls++; return "unsafe"; });
  export default defineLoom({ id: "bundled", version: "1.0.0", description: "Bundled", entry: defineCode({ id: "code", inputSchema: schema, outputSchema: z.number(), execute: () => { throw new Error("Do not execute at definition"); } }) });
`,
);
await build({
  entryPoints: ["author-source.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "author-bundle.mjs",
});
const bundled = await import(new URL("./author-bundle.mjs", import.meta.url));
assert.notEqual(bundled.schema.constructor, z.object({}).constructor);
defineCode({
  id: "consumer",
  inputSchema: bundled.schema,
  outputSchema: z.null(),
  execute: () => null,
});
const parsed = bundled.schema.parse({});
assert.deepEqual(parsed, { config: { labels: ["stable"] }, count: 4 });
parsed.config.labels.push("mutated");
assert.deepEqual(bundled.schema.parse({}), {
  config: { labels: ["stable"] },
  count: 4,
});
const projection = z.toJSONSchema(bundled.schema, { io: "input" });
assert.equal(projection.properties.count.default, 4);
assert.throws(
  () =>
    defineCode({
      id: "unsafe",
      inputSchema: bundled.native,
      outputSchema: z.null(),
      execute: () => null,
    }),
  (error) =>
    error instanceof DefinitionError && error.code === "SCHEMA_UNSUPPORTED",
);
assert.equal(bundled.calls, 0);
assert.equal(bundled.default.entry.kind, "code");
assert.equal(withDefault(z.number(), 1).parse(undefined), 1);
console.log(
  "author-bundle: independent Zod copy, constants and native-default rejection verified",
);
