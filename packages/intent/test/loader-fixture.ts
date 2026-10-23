import type { LoomConfig } from "@intloom/kernel/host";

export function modelConfig(version: string): LoomConfig {
  return {
    localStorage: "file",
    looms: [{ name: "@intloom/intent", version, sha256: "a".repeat(64) }],
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
