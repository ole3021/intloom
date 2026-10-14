import { setTimeout as delay } from "node:timers/promises";
import type { resolveModelConfig } from "@mastra/core/llm";
import { E2eError } from "./contracts.ts";
import type { Evidence } from "./evidence.ts";

function connectionFailure(cause: unknown): string | undefined {
  const seen = new Set<unknown>();
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    const error = cause as {
      code?: unknown;
      statusCode?: unknown;
      cause?: unknown;
    };
    if (
      [
        "ECONNRESET",
        "ETIMEDOUT",
        "EAI_AGAIN",
        "ENOTFOUND",
        "ECONNREFUSED",
        "ENETUNREACH",
        "UND_ERR_CONNECT_TIMEOUT",
        "UND_ERR_SOCKET",
        "MODEL_CONNECTION_TIMEOUT",
      ].includes(String(error.code))
    )
      return String(error.code);
    if ([429, 502, 503, 504].includes(Number(error.statusCode)))
      return `HTTP_${error.statusCode}`;
    cause = error.cause;
  }
  return undefined;
}

export function modelTransport<
  Model extends Awaited<ReturnType<typeof resolveModelConfig>>,
>(
  model: Model,
  input: {
    actor: string;
    signal: AbortSignal;
    evidence: Evidence;
    timeoutMs: number;
    retries: number;
    idleTimeoutMs?: number | undefined;
    onFailure?: (cause: E2eError) => void;
  },
): Model {
  return new Proxy(model, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key !== "doStream")
        return typeof value === "function" ? value.bind(target) : value;
      if (typeof value !== "function")
        throw new TypeError("The configured model must support streaming.");
      return async (options: Record<string, unknown>) => {
        for (let attempt = 0; ; attempt++) {
          input.signal.throwIfAborted();
          const requestStarted = performance.now();
          const controller = new AbortController();
          const signal = AbortSignal.any([
            input.signal,
            ...(options.abortSignal instanceof AbortSignal
              ? [options.abortSignal]
              : []),
            controller.signal,
          ]);
          await input.evidence.event("model_connection_started", {
            actor: input.actor,
            attempt: attempt + 1,
            timeoutMs: input.timeoutMs,
          });
          const timer = setTimeout(
            () =>
              controller.abort(
                new E2eError(
                  "MODEL_CONNECTION_TIMEOUT",
                  `The model did not open a response stream within ${input.timeoutMs} ms.`,
                  "environment",
                ),
              ),
            input.timeoutMs,
          );
          timer.unref();
          let abort = () => {};
          try {
            // Only failure before a response stream exists can be retried; Tools have not run.
            signal.throwIfAborted();
            const canceled = new Promise<never>((_resolve, reject) => {
              abort = () => reject(signal.reason);
              signal.addEventListener("abort", abort, { once: true });
            });
            const request: Promise<{ stream: ReadableStream<unknown> }> =
              Promise.resolve(
                Reflect.apply(value, target, [
                  { ...options, abortSignal: signal },
                ]),
              );
            void request.then(
              (response) => {
                if (signal.aborted)
                  void response.stream.cancel().catch(() => {});
              },
              () => {},
            );
            const response = await Promise.race([request, canceled]);
            clearTimeout(timer);
            await input.evidence.event("model_stream_opened", {
              actor: input.actor,
              elapsedMs: Math.round(performance.now() - requestStarted),
            });
            let finished = false;
            let parts = 0;
            let firstPartMs: number | undefined, lastPartMs: number | undefined;
            let observation: Promise<void> | undefined;
            const observe = () =>
              (observation ??= input.evidence.event(
                "model_stream_observation",
                {
                  actor: input.actor,
                  finished,
                  parts,
                  firstPartMs,
                  lastPartMs,
                  elapsedMs: Math.round(performance.now() - requestStarted),
                },
              ));
            let idleTimer: ReturnType<typeof setTimeout> | undefined;
            let rejectIdle = (_error: E2eError) => {};
            const idle = new Promise<never>((_resolve, reject) => {
              rejectIdle = reject;
            });
            void idle.catch(() => {});
            const resetIdle = () => {
              clearTimeout(idleTimer);
              if (!input.idleTimeoutMs) return;
              idleTimer = setTimeout(() => {
                const failure = new E2eError(
                  "MODEL_STREAM_IDLE_TIMEOUT",
                  `The model response made no progress for ${input.idleTimeoutMs} ms. No continuation or retry was attempted.`,
                  "environment",
                );
                void input.evidence.event("model_stream_idle_timeout", {
                  actor: input.actor,
                  timeoutMs: input.idleTimeoutMs,
                });
                void observe();
                rejectIdle(failure);
                input.onFailure?.(failure);
                controller.abort(failure);
              }, input.idleTimeoutMs);
              idleTimer.unref();
            };
            resetIdle();
            const incomplete = () => {
              const failure = new E2eError(
                "MODEL_STREAM_INCOMPLETE",
                "The opened model stream ended without an explicit provider finish. No continuation or retry was attempted.",
                "environment",
              );
              input.onFailure?.(failure);
              return failure;
            };
            const guarded = response.stream.pipeThrough(
              new TransformStream<unknown, unknown>({
                transform(value, output) {
                  resetIdle();
                  const elapsed = Math.round(
                    performance.now() - requestStarted,
                  );
                  firstPartMs ??= elapsed;
                  lastPartMs = elapsed;
                  parts++;
                  const part = value as {
                    type?: string;
                    finishReason?: unknown;
                  } | null;
                  if (part?.type === "finish") {
                    const raw = part.finishReason;
                    const reason =
                      raw && typeof raw === "object" && "unified" in raw
                        ? raw.unified
                        : raw;
                    if (
                      ![
                        "stop",
                        "tool-calls",
                        "length",
                        "content-filter",
                        "error",
                      ].includes(String(reason))
                    )
                      throw incomplete();
                    finished = true;
                  }
                  output.enqueue(value);
                },
                flush() {
                  if (!finished) throw incomplete();
                },
              }),
            );
            const reader = guarded.getReader();
            return {
              ...response,
              stream: new ReadableStream<unknown>({
                async pull(output) {
                  try {
                    const part = await Promise.race([reader.read(), idle]);
                    if (part.done) {
                      clearTimeout(idleTimer);
                      await observe();
                      reader.releaseLock();
                      output.close();
                    } else output.enqueue(part.value);
                  } catch (cause) {
                    clearTimeout(idleTimer);
                    void reader.cancel(cause).catch(() => {});
                    reader.releaseLock();
                    if (signal.aborted || cause instanceof E2eError) {
                      await observe();
                      output.error(cause);
                      return;
                    }
                    const code = connectionFailure(cause);
                    const failure = new E2eError(
                      "MODEL_TRANSPORT_FAILED",
                      `The opened model response stream failed${code ? `: ${code}` : ""}. No continuation or retry was attempted. See stream evidence.`,
                      "environment",
                    );
                    const failed = input.evidence.event("model_stream_failed", {
                      actor: input.actor,
                      code: code ?? "STREAM_READ_FAILED",
                      diagnostic:
                        cause instanceof Error
                          ? cause.message
                          : "Stream read failed.",
                    });
                    const observed = observe();
                    input.onFailure?.(failure);
                    await Promise.all([failed, observed]);
                    output.error(failure);
                  }
                },
                cancel(reason) {
                  clearTimeout(idleTimer);
                  return reader
                    .cancel(reason)
                    .finally(() => reader.releaseLock());
                },
              }),
            };
          } catch (cause) {
            input.signal.throwIfAborted();
            if (options.abortSignal instanceof AbortSignal)
              options.abortSignal.throwIfAborted();
            const failure = controller.signal.aborted
              ? controller.signal.reason
              : cause;
            const code = connectionFailure(failure);
            if (!code) throw cause;
            const retry = attempt < input.retries;
            await input.evidence.event(
              retry ? "model_connection_retry" : "model_connection_failed",
              {
                actor: input.actor,
                code,
                attempt: attempt + 1,
                retries: input.retries,
                diagnostic:
                  failure instanceof Error
                    ? failure.message
                    : "Model connection failed.",
              },
            );
            if (!retry) {
              const failure = new E2eError(
                "MODEL_TRANSPORT_FAILED",
                `The test AI could not open a model response stream after ${attempt + 1} attempt(s): ${code}. See connection evidence.`,
                "environment",
              );
              input.onFailure?.(failure);
              throw failure;
            }
          } finally {
            clearTimeout(timer);
            signal.removeEventListener("abort", abort);
          }
          await delay(250 * (attempt + 1), undefined, { signal: input.signal });
        }
      };
    },
  });
}
