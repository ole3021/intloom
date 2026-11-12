import { setTimeout as delay } from "node:timers/promises";
import { ModelRouterLanguageModel } from "@mastra/core/llm";
import { IntloomError, type ModelRequestProgress } from "@intloom/loom-sdk";

type RequestOptions = Parameters<ModelRouterLanguageModel["doGenerate"]>[0];

function timedOut(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (
    "statusCode" in error &&
    (error.statusCode === 408 || error.statusCode === 504)
  )
    return true;
  if (
    "code" in error &&
    [
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_BODY_TIMEOUT",
      "UND_ERR_CONNECT_TIMEOUT",
      "ETIMEDOUT",
    ].includes(String(error.code))
  )
    return true;
  return (
    ("name" in error && error.name === "TimeoutError") ||
    ("cause" in error && timedOut(error.cause))
  );
}

function authStatus(error: unknown): 401 | 403 | undefined {
  if (!error || typeof error !== "object") return;
  if (
    "statusCode" in error &&
    (error.statusCode === 401 || error.statusCode === 403)
  )
    return error.statusCode;
  return "cause" in error ? authStatus(error.cause) : undefined;
}

/** Retry a single provider request before returning anything to the agent or its tools. */
export class RequestModel extends ModelRouterLanguageModel {
  readonly deadline: number;
  requestError?: IntloomError;
  constructor(
    config: ConstructorParameters<typeof ModelRouterLanguageModel>[0],
    private readonly signal: AbortSignal,
    private readonly report: (progress: ModelRequestProgress) => Promise<void>,
    private readonly requestTimeoutMs: number,
    totalTimeoutMs: number,
  ) {
    super(config);
    this.deadline = performance.now() + totalTimeoutMs;
  }

  override doGenerate(
    options: RequestOptions,
  ): ReturnType<ModelRouterLanguageModel["doGenerate"]> {
    return this.request(options, (input) => super.doGenerate(input));
  }
  override doStream(
    options: RequestOptions,
  ): ReturnType<ModelRouterLanguageModel["doStream"]> {
    return this.request(options, (input) => super.doStream(input));
  }

  private async request<T extends object>(
    options: RequestOptions,
    send: (input: RequestOptions) => Promise<T>,
  ): Promise<T> {
    const caller = options.abortSignal
      ? AbortSignal.any([this.signal, options.abortSignal])
      : this.signal;
    let attempt = 1;
    while (true) {
      caller.throwIfAborted();
      const remaining = Math.ceil(this.deadline - performance.now());
      if (remaining > 0) {
        await this.report({ status: "started", attempt });
        const timer = AbortSignal.timeout(
          Math.min(remaining, this.requestTimeoutMs),
        );
        // Persisting progress occurs outside the transport error handler.
        // A failed receipt must never resend a successful request.
        let result: T | undefined;
        try {
          result = await send({
            ...options,
            abortSignal: AbortSignal.any([caller, timer]),
          });
        } catch (error) {
          caller.throwIfAborted();
          const status = authStatus(error);
          if (status) {
            this.requestError = new IntloomError(
              "MODEL_AUTH_FAILED",
              status === 401
                ? "The model provider rejected the credential (HTTP 401). Check the configured API key."
                : "The model provider denied access (HTTP 403). Check the credential and its permission to use this model.",
              { status },
            );
            throw this.requestError;
          }
          if (!timer.aborted && !timedOut(error)) throw error;
        }
        if (result) {
          await this.report({ status: "received", attempt });
          return result;
        }
      }
      if (attempt === 2 || this.deadline - performance.now() <= 3000) {
        await this.report({ status: "timed_out", attempt });
        this.requestError = new IntloomError(
          "MODEL_REQUEST_TIMEOUT",
          `Model request timed out (attempt ${attempt}).`,
        );
        throw this.requestError;
      }
      await this.report({ status: "retrying", attempt });
      await delay(3000, undefined, { signal: caller });
      attempt++;
    }
  }
}
