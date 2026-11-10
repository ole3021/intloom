import {
  IntloomError,
  type RunEvent,
  type RunEventPage,
} from "@intloom/loom-sdk";
import type { Kernel } from "../api-contracts.ts";
import type { RunRepository } from "../lifecycle/run-contracts.ts";

export function createEventQuery(
  repository: Pick<RunRepository, "subscribe">,
  read: (
    runId: string,
    after: number,
    limit: number,
  ) => Promise<readonly RunEvent[]>,
  observationClosed: AbortSignal,
) {
  return async (
    options: Parameters<Kernel["listRunEvents"]>[0],
    signal?: AbortSignal,
  ): Promise<RunEventPage> => {
    const limit = options.limit ?? 20;
    const after = options.after ?? 0;
    let wake!: () => void;
    const changed = new Promise<void>((resolve) => {
      wake = resolve;
    });
    const unsubscribe = repository.subscribe((notice) => {
      if (notice.runId === options.runId && notice.throughSeq > after) wake();
    });
    const abort = signal
      ? AbortSignal.any([signal, observationClosed])
      : observationClosed;
    abort.addEventListener("abort", wake, { once: true });
    const timeout = setTimeout(wake, options.waitMs ?? 0);
    let remaining: readonly RunEvent[];
    try {
      remaining = await read(options.runId, after, limit + 1);
      if (!remaining.length && options.waitMs && !abort.aborted) {
        await changed;
        remaining = await read(options.runId, after, limit + 1);
      }
      if (abort.aborted)
        throw new IntloomError(
          "OBSERVATION_CLOSED",
          "The event observation has closed.",
        );
    } finally {
      clearTimeout(timeout);
      unsubscribe();
      abort.removeEventListener("abort", wake);
    }
    const items = remaining.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      ...(last && remaining.length > items.length
        ? { nextAfter: last.seq }
        : {}),
    };
  };
}
