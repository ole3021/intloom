import type { LanguageModel } from "@mastra/core/llm";
import type { Logger, LogFields } from "@intloom/utils";

const originalModels = new WeakMap<LanguageModel, LanguageModel>();
const finishReasons = new Set([
  "stop",
  "length",
  "tool-calls",
  "content-filter",
  "error",
  "other",
  "unknown",
]);

export function safeFinishReason(reason: unknown): string {
  return typeof reason === "string" && finishReasons.has(reason)
    ? reason
    : "unknown";
}

/** Measures the provider stream, before SDK Tool dispatch, without inspecting its content. */
export function timeModelRequest(
  model: LanguageModel,
  signal: AbortSignal,
  log: Logger,
  fields: LogFields,
  headers?: Record<string, string>,
) {
  model = originalModels.get(model) ?? model;
  let started: number | undefined;
  let ended: number | undefined;
  let stopped = false;
  let failed = false;
  let reported = false;
  let finishReason: string | undefined;
  const end = () => {
    if (started === undefined || ended !== undefined) return;
    ended = performance.now();
    signal.removeEventListener("abort", abort);
  };
  const abort = () => {
    if (ended !== undefined) return;
    stopped = true;
    end();
  };
  const timed = new Proxy(model, {
    get(target, key) {
      // Model adapters can hold private fields; preserve their method receiver.
      const value = Reflect.get(target, key, target);
      if (key !== "doStream")
        return typeof value === "function" ? value.bind(target) : value;
      return async (...args: unknown[]) => {
        signal.throwIfAborted();
        started = performance.now();
        signal.addEventListener("abort", abort, { once: true });
        log.debug("model_step_started", { ...fields, model: target.modelId });
        try {
          const options = args[0] as { headers?: Record<string, string> };
          const request = headers
            ? [
                { ...options, headers: { ...options.headers, ...headers } },
                ...args.slice(1),
              ]
            : args;
          const result = (await Reflect.apply(value, target, request)) as {
            stream: ReadableStream<unknown>;
          };
          const reader = result.stream.getReader();
          return {
            ...result,
            stream: new ReadableStream<unknown>({
              async pull(controller) {
                try {
                  const part = await reader.read();
                  if (part.done) {
                    end();
                    reader.releaseLock();
                    controller.close();
                    return;
                  }
                  if (
                    part.value !== null &&
                    typeof part.value === "object" &&
                    "type" in part.value
                  ) {
                    if (part.value.type === "error") failed = true;
                    if (part.value.type === "finish") {
                      if ("finishReason" in part.value) {
                        const reason = part.value.finishReason;
                        finishReason = safeFinishReason(
                          reason &&
                            typeof reason === "object" &&
                            "unified" in reason
                            ? reason.unified
                            : reason,
                        );
                      }
                      end();
                    }
                  }
                  controller.enqueue(part.value);
                } catch (error) {
                  failed = true;
                  end();
                  reader.releaseLock();
                  controller.error(error);
                }
              },
              cancel(reason) {
                if (ended === undefined) {
                  stopped = signal.aborted;
                  failed = !stopped;
                }
                end();
                return reader
                  .cancel(reason)
                  .finally(() => reader.releaseLock());
              },
            }),
          };
        } catch (error) {
          failed = true;
          end();
          throw error;
        }
      };
    },
  });
  originalModels.set(timed, model);
  return {
    model: timed,
    get providerFinishReason() {
      return started === undefined ? undefined : safeFinishReason(finishReason);
    },
    report(summary: LogFields = {}, errorCode?: string) {
      if (started === undefined || reported) return;
      if (ended === undefined) {
        failed = true;
        end();
      }
      reported = true;
      if (!stopped && [undefined, "unknown", "other"].includes(finishReason))
        failed = true;
      const code = failed ? errorCode : undefined;
      log.debug(
        stopped
          ? "model_step_stopped"
          : failed
            ? "model_step_failed"
            : "model_step_completed",
        {
          ...fields,
          model: model.modelId,
          providerFinishReason: safeFinishReason(finishReason),
          ...summary,
          durationMs: Math.round((ended ?? performance.now()) - started),
          ...(code === undefined ? {} : { errorCode: code }),
        },
      );
    },
  };
}
