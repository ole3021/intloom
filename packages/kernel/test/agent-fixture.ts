import type { TestContext } from "node:test";
import * as z from "zod";
import type { LoomConfig } from "../src/core/schemas/loom-config.ts";
import type { AgentSpec } from "../src/workflow/module.ts";

export function agentSpec(): AgentSpec {
  return {
    name: "reviewer",
    description: "Reviews changes",
    instructions: "Review the supplied changes.",
    llm: "reasoning",
    outputSchema: z.strictObject({ outcome: z.string() }),
    skills: [],
    tools: [],
  };
}

export function testConfig(): LoomConfig & {
  llms: NonNullable<LoomConfig["llms"]>;
} {
  return {
    intent: { apps: [] },
    localStorage: "file",
    workflows: [],
    useMcpAgent: true,
    llms: {
      default: {
        provider: "openai-compatible",
        model: "test-model",
        secret: "ENV.INTLOOM_WORKFLOW_TEST_KEY",
        baseURL: "https://model.invalid/v1",
      },
    },
  };
}

export function credential(t: TestContext): void {
  const previous = process.env.INTLOOM_WORKFLOW_TEST_KEY;
  process.env.INTLOOM_WORKFLOW_TEST_KEY = "fixture-credential";
  t.after(() => {
    if (previous === undefined) delete process.env.INTLOOM_WORKFLOW_TEST_KEY;
    else process.env.INTLOOM_WORKFLOW_TEST_KEY = previous;
  });
}
