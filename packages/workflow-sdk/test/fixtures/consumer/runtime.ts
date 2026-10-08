import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  defineAgentTool,
  getAgentExecutionAccess,
  workflowMetadataSchema,
  workflowProtocolVersion,
} from "@intloom/workflow-sdk";
import * as z from "zod";

const entry = new URL(
  "./node_modules/@intloom/workflow-sdk/dist/index.js",
  import.meta.url,
);
assert.equal(import.meta.resolve("@intloom/workflow-sdk"), entry.href);
assert.equal(await realpath(entry), fileURLToPath(entry));
const kernelPackage: string = "@intloom/kernel";
await assert.rejects(import(kernelPackage), { code: "ERR_MODULE_NOT_FOUND" });
assert.deepEqual(
  workflowMetadataSchema.parse({
    type: "workflow",
    version: workflowProtocolVersion,
  }),
  {
    type: "workflow",
    version: workflowProtocolVersion,
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
const access = getAgentExecutionAccess({
  get: () => ({
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
  }),
});
assert.equal(tool.outputSchema.parse(await tool.execute(input, access)), 42);
