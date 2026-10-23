import { randomUUID } from "node:crypto";
import type {
  CoreResult,
  CoreMeta,
  ServiceRunView,
  ProjectEvent,
} from "@intloom/kernel/operations";
import type {
  RunInput,
  WaitRunInput,
  WaitRunResult,
  ObserveOptions,
} from "./contracts.ts";
export async function waitForRun(
  watchRun: (
    input: RunInput,
    options?: ObserveOptions,
  ) => AsyncIterable<CoreResult<ProjectEvent>>,
  input: WaitRunInput,
  options: ObserveOptions = {},
): Promise<CoreResult<WaitRunResult>> {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 300000);
  let last: ServiceRunView | undefined;
  let meta: CoreMeta = { requestId: randomUUID(), runId: input.runId };
  try {
    for await (const event of watchRun(input, {
      signal: controller.signal,
    })) {
      meta = event.meta;
      if (!event.ok) {
        const { data: _data, ...result } = event;
        return { ...result, ...(last ? { data: { run: last } } : {}) };
      }
      if (event.data.type === "service_closing")
        return {
          ok: false,
          error: {
            code: "CLI_SERVICE_CLOSING",
            message: "The observed Service is closing.",
            retryable: false,
          },
          outcome: "not_applied",
          meta,
          ...(last ? { data: { run: last } } : {}),
        };
      if (event.data.type !== "run_snapshot") continue;
      last = event.data.run;
      const reason =
        last.status === "completed" || last.status === "failed"
          ? "terminal"
          : input.until !== "terminal" && last.status === "paused"
            ? "paused"
            : input.until !== "terminal" && last.pendingAction
              ? "human_action"
              : input.until !== "terminal" && last.pendingAgentCall
                ? "agent_action"
                : undefined;
      if (reason) return { ok: true, data: { run: last, reason }, meta };
    }
    return {
      ok: false,
      error: {
        code: options.signal?.aborted
          ? "OBSERVATION_CANCELLED"
          : "OBSERVATION_TIMEOUT",
        message: "Observation ended; the Run was not cancelled.",
        retryable: false,
      },
      outcome: "not_applied",
      meta,
      ...(last ? { data: { run: last } } : {}),
    };
  } finally {
    clearTimeout(timer);
    controller.abort();
    options.signal?.removeEventListener("abort", abort);
  }
}
