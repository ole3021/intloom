import assert from "node:assert/strict";
import { test } from "node:test";
import * as z from "zod";
import { defineAgentTool } from "@intloom/loom-sdk";
import { silentLogger, withLogger } from "@intloom/utils";
import { executionAccess } from "../../test/access-fixture.ts";
import { executeAgentTool, isAgentToolInputError } from "./agent-tool.ts";

test("Tool diagnostics cannot replace the original failure and stay off without debug logging", async () => {
  const original = new Error("Tool failed");
  const tool = defineAgentTool({
    id: "fail",
    description: "Fail without effects.",
    inputSchema: z.object({}),
    outputSchema: z.boolean(),
    execute: () => {
      throw original;
    },
  });
  for (const enabled of [false, true]) {
    let writes = 0;
    await assert.rejects(
      withLogger(
        {
          ...silentLogger,
          isLevelEnabled: () => enabled,
          debug() {
            writes++;
            throw new Error("Log write failed");
          },
        },
        () => executeAgentTool(tool, {}, executionAccess().agent),
      ),
      { code: "TOOL_EXECUTION_FAILED", cause: original },
    );
    assert.equal(writes, enabled ? 1 : 0);
  }
});

test("input diagnostics omit dynamic dictionary keys, values and refinement messages", async () => {
  let executed = false;
  const tool = defineAgentTool({
    id: "labels",
    description: "Validate labels.",
    inputSchema: z.object({
      labels: z.record(
        z.string(),
        z.string().refine(() => false, "private-message"),
      ),
    }),
    outputSchema: z.boolean(),
    execute: () => {
      executed = true;
      return true;
    },
  });
  await assert.rejects(
    executeAgentTool(
      tool,
      { labels: { "private-key": "private-value" } },
      executionAccess().agent,
    ),
    (error: unknown) => {
      assert.ok(isAgentToolInputError(error));
      assert.ok(error instanceof Error);
      assert.match(error.message, /labels\.item \(custom\)/u);
      assert.doesNotMatch(error.message, /private-(?:key|value|message)/u);
      return true;
    },
  );
  assert.equal(executed, false);
});

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
  const access = executionAccess(undefined, {
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
  }).agent;
  const read = {
    id: "read",
    description: "read source",
    inputSchema: z.string(),
    outputSchema: z.string(),
    execute: (path: string, bound: typeof access) => {
      assert.ok(bound.project);
      return bound.project.read(path);
    },
  };
  assert.equal(await executeAgentTool(read, "a", access), "source");
  const swallowing = {
    ...read,
    execute: async (path: string, bound: typeof access) => {
      try {
        assert.ok(bound.project);
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
