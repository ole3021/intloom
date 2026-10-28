import assert from "node:assert/strict";
import { realpath, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  defineAgentTool,
  LoomFailure,
  loomMetadataSchema,
  loomProtocolVersion,
} from "@intloom/loom-sdk";
import * as z from "zod";
import { loomDefinitionSchema } from "@intloom/loom-sdk/definition";
import { appMethods, choiceAnswer } from "@intloom/loom-sdk/app-contracts";
import {
  capabilityProtocolVersions,
  compiledLoomProtocolVersion,
} from "@intloom/loom-sdk/compiled";

const entry = new URL(
  "./node_modules/@intloom/loom-sdk/dist/index.js",
  import.meta.url,
);
assert.equal(import.meta.resolve("@intloom/loom-sdk"), entry.href);
assert.equal(await realpath(entry), fileURLToPath(entry));
const kernelPackage: string = "@intloom/kernel";
await assert.rejects(import(kernelPackage), { code: "ERR_MODULE_NOT_FOUND" });
assert.deepEqual(
  loomMetadataSchema.parse({
    type: "loom",
    version: loomProtocolVersion,
  }),
  {
    type: "loom",
    version: loomProtocolVersion,
  },
);
const tool = defineAgentTool({
  id: "installed_transform",
  description: "Execute the installed Tool contract.",
  inputSchema: z.string().transform(Number),
  outputSchema: z.string().transform(Number),
  execute: (input) => String(input + 1),
});
const input = tool.inputSchema.parse("41");
const unused = () => {
  throw new Error("This Tool does not use host capabilities.");
};
const access = {
  state: { value: null, create: unused, update: unused, clear: unused },
  storage: {
    getArtifact: unused,
    getArtifactById: unused,
    getLatestRecord: unused,
    getRecordById: unused,
    listArtifacts: unused,
    listRecords: unused,
  },
  signal: new AbortController().signal,
} satisfies import("@intloom/loom-sdk").AgentExecutionAccess<
  import("@intloom/loom-sdk").JsonValue
>;
assert.equal(tool.outputSchema.parse(await tool.execute(input, access)), 42);

const utilsPackage: string = "@intloom/utils";
await assert.rejects(import(utilsPackage), { code: "ERR_MODULE_NOT_FOUND" });
const authorSchema = JSON.parse(
  await readFile(
    new URL(import.meta.resolve("@intloom/loom-sdk/loom.schema.json")),
    "utf8",
  ),
);
assert.ok(authorSchema.properties.agents);
assert.ok(authorSchema.properties.apps);
assert.equal(appMethods.answer, "intloom_app_answer");
assert.deepEqual(choiceAnswer("/roomId", "room_b"), { roomId: "room_b" });
assert.equal(compiledLoomProtocolVersion, "2026-10-27.2");
assert.ok(capabilityProtocolVersions.includes("2026-10-27"));
const safeFailure = new LoomFailure(
  "BOOKING_OUTCOME_UNKNOWN",
  "Inspect request",
);
assert.ok(LoomFailure.is(safeFailure));
assert.equal(LoomFailure.is(new Error("private details")), false);
assert.equal(
  loomDefinitionSchema.parse({
    name: "installed-capability",
    version: "1.0.0",
    input: { type: "string" },
    output: { type: "string" },
    execute: { code: "./code/run.ts#run" },
  }).schemaVersion,
  "1",
);
