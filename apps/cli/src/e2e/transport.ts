import type { resolveModelConfig } from "@mastra/core/llm";
import { E2eError } from "./contracts.ts";
import type { Evidence } from "./evidence.ts";

export function modelRequestDiagnostics(cause: unknown) {
  const seen = new Set<unknown>();
  let transportCode: string | undefined;
  let httpStatus: number | undefined;
  while (
    cause &&
    typeof cause === "object" &&
    !seen.has(cause) &&
    seen.size < 8
  ) {
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
        "EHOSTUNREACH",
        "EPIPE",
        "UND_ERR_CONNECT_TIMEOUT",
        "UND_ERR_HEADERS_TIMEOUT",
        "UND_ERR_SOCKET",
        "MODEL_CONNECTION_TIMEOUT",
      ].includes(String(error.code))
    )
      transportCode ??= String(error.code);
    if (
      typeof error.statusCode === "number" &&
      Number.isInteger(error.statusCode) &&
      error.statusCode >= 100 &&
      error.statusCode <= 599
    )
      httpStatus ??= error.statusCode;
    cause = error.cause;
  }
  return {
    ...(transportCode ? { transportCode } : {}),
    ...(httpStatus === undefined ? {} : { httpStatus }),
  };
}

function connectionFailure(cause: unknown): string | undefined {
  const { transportCode, httpStatus } = modelRequestDiagnostics(cause);
  return (
    transportCode ??
    (httpStatus === undefined ? undefined : `HTTP_${httpStatus}`)
  );
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
    idleTimeoutMs?: number | undefined;
    onFailure?: (cause: E2eError) => void;
  },
): Model {
  let attempt = 0;
  return new Proxy(model, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key !== "doStream")
        return typeof value === "function" ? value.bind(target) : value;
      if (typeof value !== "function")
        throw new TypeError("The configured model must support streaming.");
      return async (options: Record<string, unknown>) => {
        input.signal.throwIfAborted();
        attempt++;
        const requestStarted = performance.now();
        const controller = new AbortController();
        const signal = AbortSignal.any([
          input.signal,
          ...(options.abortSignal instanceof AbortSignal
            ? [options.abortSignal]
            : []),
          controller.signal,
        ]);
        if (attempt > 1)
          await input.evidence.event("model_connection_retry", {
            actor: input.actor,
            attempt,
            retryOwner: "sdk",
          });
        await input.evidence.event("model_connection_started", {
          actor: input.actor,
          attempt,
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
          // The SDK owns retries. Preserve its original exception before a stream opens.
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
              if (signal.aborted) void response.stream.cancel().catch(() => {});
            },
            () => {},
          );
          const response = await Promise.race([request, canceled]);
          clearTimeout(timer);
          await input.evidence.event("model_stream_opened", {
            actor: input.actor,
            attempt,
            elapsedMs: Math.round(performance.now() - requestStarted),
          });
          attempt = 0;
          let finished = false;
          let parts = 0;
          let firstPartMs: number | undefined, lastPartMs: number | undefined;
          let observation: Promise<void> | undefined;
          const observe = () =>
            (observation ??= input.evidence.event("model_stream_observation", {
              actor: input.actor,
              finished,
              parts,
              firstPartMs,
              lastPartMs,
              elapsedMs: Math.round(performance.now() - requestStarted),
            }));
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
          const reader = response.stream.getReader();
          let closed = false;
          const closeReader = (cancel: boolean, reason?: unknown) => {
            if (closed) return Promise.resolve();
            closed = true;
            clearTimeout(idleTimer);
            const canceled = cancel ? reader.cancel(reason) : Promise.resolve();
            reader.releaseLock();
            return canceled;
          };
          return {
            ...response,
            stream: new ReadableStream<unknown>({
              async pull(output) {
                try {
                  const part = await Promise.race([reader.read(), idle]);
                  if (closed) return;
                  if (part.done) {
                    if (!finished) throw incomplete();
                    await closeReader(false);
                    await observe();
                    output.close();
                    return;
                  }
                  resetIdle();
                  const elapsed = Math.round(
                    performance.now() - requestStarted,
                  );
                  firstPartMs ??= elapsed;
                  lastPartMs = elapsed;
                  parts++;
                  const value = part.value as {
                    type?: string;
                    finishReason?: unknown;
                  } | null;
                  if (value?.type === "finish") {
                    const raw = value.finishReason;
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
                  output.enqueue(part.value);
                } catch (cause) {
                  if (closed) {
                    output.error(cause);
                    return;
                  }
                  void closeReader(true, cause).catch(() => {});
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
                return closeReader(true, reason);
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
          await input.evidence.event("model_connection_failed", {
            actor: input.actor,
            ...modelRequestDiagnostics(failure),
            attempt,
            elapsedMs: Math.round(performance.now() - requestStarted),
            retryOwner: "sdk",
          });
          throw failure;
        } finally {
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
        }
      };
    },
  });
}
