import assert from "node:assert/strict";
import { channel } from "node:diagnostics_channel";
import { test } from "node:test";
import type { LanguageModel } from "@mastra/core/llm";
import { silentLogger } from "@intloom/utils";
import { timeModelRequest } from "./model-timing.ts";

test("debug logging gates connection and raw-chunk diagnostics, never completion checks", async () => {
  const requests = channel("undici:request:create");
  const subscribed = requests.hasSubscribers;
  for (const enabled of [false, true]) {
    for (const reason of ["stop", "other"] as const) {
      const events: string[] = [];
      const model: Extract<LanguageModel, { specificationVersion: "v2" }> = {
        specificationVersion: "v2",
        provider: "fixture",
        modelId: "fixture",
        supportedUrls: {},
        async doGenerate() {
          throw new Error("Unexpected generate");
        },
        async doStream(options) {
          assert.equal(options.includeRawChunks, enabled ? true : undefined);
          assert.equal(requests.hasSubscribers, enabled || subscribed);
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({
                  type: "finish",
                  finishReason: reason,
                  usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                });
                controller.close();
              },
            }),
          };
        },
      };
      const controller = new AbortController();
      const timing = timeModelRequest(
        model,
        controller.signal,
        {
          ...silentLogger,
          isLevelEnabled: () => enabled,
          debug(event) {
            assert.ok(enabled);
            events.push(event);
          },
        },
        {},
      );
      const response = await timing.model.doStream({ prompt: [] });
      const reader = response.stream.getReader();
      while (!(await reader.read()).done) {
        /* Consume the provider finish without requiring diagnostics. */
      }
      reader.releaseLock();
      assert.equal(timing.providerFinishReason, reason);
      // The Agent aborts after rejecting the provider's completed, invalid finish.
      if (reason === "other") controller.abort(new Error("Invalid finish"));
      timing.report();
      assert.equal(requests.hasSubscribers, subscribed);
      if (enabled)
        assert.equal(
          events.at(-1),
          reason === "stop" ? "model_step_completed" : "model_step_failed",
        );
      else assert.deepEqual(events, []);
    }
  }
});
