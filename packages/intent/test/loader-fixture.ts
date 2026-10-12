import type { LoomConfig } from "@intloom/kernel";

export function modelConfig(version: string): LoomConfig {
  return {
    intent: { apps: [] },
    localStorage: "file",
    workflows: [
      { name: "@intloom/workflow-intent", version, sha256: "a".repeat(64) },
    ],
    useMcpAgent: true,
    llms: {
      default: {
        provider: "openai-compatible",
        model: "fixture-model",
        secret: "ENV.INTLOOM_PACKED_TEST_KEY",
        baseURL: "https://model.invalid/v1",
      },
    },
  };
}
