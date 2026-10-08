import assert from "node:assert/strict";
import { test } from "node:test";
import * as z from "zod";
import { defineAgentTool } from "@intloom/workflow-sdk";
import { executionAccess } from "../../test/effector-fixture.ts";
import { executeAgentTool } from "./agent-tool.ts";

for (const asynchronous of [false, true])
  test(`host parses cross-type Tool output once (${asynchronous ? "async" : "sync"})`, async () => {
    let inputs = 0;
    let outputs = 0;
    const tool = defineAgentTool({
      id: "transform",
      description: "Return a raw string for the output parser.",
      inputSchema: z.string().transform((value) => {
        inputs++;
        return Number(value);
      }),
      outputSchema: z.string().transform((value) => {
        outputs++;
        return Number(value) + 1;
      }),
      execute: (input) =>
        asynchronous ? Promise.resolve(String(input)) : String(input),
    });
    assert.equal(
      await executeAgentTool(tool, "41", executionAccess().agent),
      42,
    );
    assert.deepEqual([inputs, outputs], [1, 1]);
  });

test("SDK tools receive host project capability and cannot swallow capability failures", async () => {
  const access = {
    ...executionAccess().agent,
    project: {
      snapshot: async () => ({ a: "hash" }),
      read: async (path: string) => {
        if (path === "missing") throw new Error("missing");
        return "source";
      },
      write: async () => {},
      remove: async () => {},
      run: async () => {
        throw new Error("unused");
      },
    },
  };
  const read = {
    id: "read",
    description: "read source",
    inputSchema: z.string(),
    outputSchema: z.string(),
    execute: (path: string, bound: typeof access) => bound.project.read(path),
  };
  assert.equal(await executeAgentTool(read, "a", access), "source");
  const swallowing = {
    ...read,
    execute: async (path: string, bound: typeof access) => {
      try {
        return await bound.project.read(path);
      } catch {
        return "pretend";
      }
    },
  };
  await assert.rejects(executeAgentTool(swallowing, "missing", access), {
    code: "TOOL_EXECUTION_FAILED",
  });
});
