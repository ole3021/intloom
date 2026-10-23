import type { Runtime } from "../src/runtime/contracts.ts";
import type { RunView } from "../src/runtime/run-view.ts";

/** Terminal and paused snapshots are complete only after accepted activity settles. */
export function waitForSettledRun(
  runtime: Pick<Runtime, "watchRun">,
  runId: string,
  signal: AbortSignal = AbortSignal.timeout(20_000),
): Promise<RunView> {
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    let finished = false;
    const cleanup = () => {
      finished = true;
      unsubscribe?.();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) return abort();
    try {
      unsubscribe = runtime.watchRun(runId, (view) => {
        if (view.status !== "running" && view.settled) {
          cleanup();
          resolve(view);
        }
      });
      if (finished) unsubscribe();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
