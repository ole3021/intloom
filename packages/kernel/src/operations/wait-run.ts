import type { Runtime } from "../runtime/contracts.ts";
import type { RunView } from "../runtime/run-view.ts";

/** Waiting is an observer convenience. Cancelling an observer never stops the Run. */
export function waitForRun(
  runtime: Pick<Runtime, "watchRun">,
  runId: string,
  signal?: AbortSignal,
): Promise<RunView> {
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    let finished = false;
    const cleanup = () => {
      finished = true;
      unsubscribe?.();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    try {
      unsubscribe = runtime.watchRun(runId, (view) => {
        if (view.status !== "running") {
          cleanup();
          resolve(view);
        }
      });
      if (finished) unsubscribe();
    } catch (cause) {
      cleanup();
      reject(cause);
    }
  });
}
