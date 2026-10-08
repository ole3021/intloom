import assert from "node:assert/strict";
import { test } from "node:test";
import * as z from "zod";
import { defineAgentTool } from "@intloom/workflow-sdk";
import {
  scriptedAgent,
  executionAccess,
  latestToolResult,
} from "../../../test/effector-fixture.ts";
import { createEffector } from "../create-effector.ts";
import { serviceTool } from "./agent-tools.ts";

test("service models execute the same SDK Tool with original schema transforms exactly once", async () => {
  let inputs = 0;
  let outputs = 0;
  let calls = 0;
  const tool = defineAgentTool({
    id: "calculate",
    description: "Calculate",
    inputSchema: z.object({ n: z.number() }).transform(({ n }) => {
      inputs++;
      return { n: n + 1 };
    }),
    outputSchema: z.string().transform((n) => {
      outputs++;
      return { n: Number(n) + 1 };
    }),
    execute: async (input, access) => {
      calls++;
      assert.equal("commit" in access.storage, false);
      return String(input.n);
    },
  });
  const agent = scriptedAgent(
    (request) => {
      const result = latestToolResult(request);
      if (!result) return { calls: [{ name: tool.id, input: { n: 1 } }] };
      assert.deepEqual(result.output, { type: "json", value: { n: 3 } });
      return { text: '{"outcome":"complete"}' };
    },
    { calculate: serviceTool(tool) },
  );
  assert.deepEqual(
    await createEffector().executeAgent(agent, null, executionAccess().agent),
    { outcome: "complete" },
  );
  assert.deepEqual([inputs, outputs, calls], [1, 1, 1]);
});
