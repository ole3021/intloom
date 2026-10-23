import type { LanguageModel } from "@mastra/core/llm";
import type { Logger, LogFields } from "@intloom/utils";
import { modelCompletion } from "./model-completion.ts";
import { observeConnection } from "./connection-observation.ts";
import { modelErrorDiagnostics } from "./errors.ts";

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
  const diagnostics = log.isLevelEnabled("debug");
  let started: number | undefined;
  let firstAttemptStarted: number | undefined;
  let attempt = 0;
  let streamOpened = false;
  let firstPartMs: number | undefined;
  let network: ReturnType<typeof observeConnection> | undefined;
  let ended: number | undefined;
  let stopped = false;
  let failed = false;
  let reported = false;
  let finishReason: string | undefined;
  let completion: ReturnType<typeof modelCompletion> | undefined;
  const end = () => {
    if (started === undefined || ended !== undefined) return;
    ended = performance.now();
    network?.close();
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
        firstAttemptStarted ??= started;
        attempt++;
        ended = undefined;
        stopped = false;
        failed = false;
        streamOpened = false;
        firstPartMs = undefined;
        finishReason = undefined;
        completion = diagnostics ? modelCompletion() : undefined;
        network = diagnostics
          ? observeConnection(log, { ...fields, attempt })
          : undefined;
        signal.addEventListener("abort", abort, { once: true });
        try {
          if (diagnostics)
            log.debug(
              attempt === 1 ? "model_step_started" : "model_retry_started",
              {
                ...fields,
                model: target.modelId,
                attempt,
              },
            );
          const options = args[0] as { headers?: Record<string, string> };
          const request = [
            {
              ...options,
              ...(diagnostics ? { includeRawChunks: true } : {}),
              ...(headers
                ? { headers: { ...options.headers, ...headers } }
                : {}),
            },
            ...args.slice(1),
          ];
          const invoke = () => Reflect.apply(value, target, request);
          const result = (await (network ? network.run(invoke) : invoke())) as {
            stream: ReadableStream<unknown>;
          };
          streamOpened = true;
          if (diagnostics)
            log.debug("model_stream_opened", {
              ...fields,
              attempt,
              elapsedMs: Math.round(performance.now() - started),
            });
          const reader = result.stream.getReader();
          return {
            ...result,
            stream: new ReadableStream<unknown>({
              async pull(controller) {
                try {
                  let part = await reader.read();
                  if (diagnostics && !part.done && firstPartMs === undefined) {
                    firstPartMs = Math.round(
                      performance.now() - (started ?? performance.now()),
                    );
                    log.debug("model_stream_first_part", {
                      ...fields,
                      attempt,
                      elapsedMs: firstPartMs,
                    });
                  }
                  // Consume SDK diagnostic chunks locally, before Agent processing.
                  while (
                    !part.done &&
                    part.value !== null &&
                    typeof part.value === "object" &&
                    Object.getOwnPropertyDescriptor(part.value, "type")
                      ?.value === "raw"
                  ) {
                    completion?.raw(
                      Object.getOwnPropertyDescriptor(part.value, "rawValue")
                        ?.value,
                    );
                    part = await reader.read();
                  }
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
                      completion?.finish(
                        Object.getOwnPropertyDescriptor(
                          part.value,
                          "finishReason",
                        )?.value,
                      );
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
          if (diagnostics)
            log.debug("model_attempt_failed", {
              ...fields,
              attempt,
              streamOpened,
              ...network?.summary(),
              ...modelErrorDiagnostics(error),
              durationMs: Math.round((ended ?? performance.now()) - started),
            });
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
      // The SDK can be cancelled during backoff, after an attempt's observer closed.
      if (signal.aborted && !stopped && !streamOpened) {
        stopped = true;
        ended = performance.now();
        network?.close();
        signal.removeEventListener("abort", abort);
      }
      if (ended === undefined) {
        failed = true;
        end();
      }
      reported = true;
      if (!diagnostics) return;
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
          attempts: attempt,
          streamOpened,
          ...(firstPartMs === undefined ? {} : { firstPartMs }),
          ...network?.summary(),
          model: model.modelId,
          providerFinishReason: safeFinishReason(finishReason),
          ...summary,
          completion: completion?.summary(safeFinishReason(finishReason)),
          durationMs: Math.round(
            (ended ?? performance.now()) - (firstAttemptStarted ?? started),
          ),
          ...(code === undefined ? {} : { errorCode: code }),
        },
      );
    },
  };
}
