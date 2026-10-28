import { toRunView } from "../src/runtime/to-run-view.ts";
import { unwrapMutation } from "../src/runtime/mutation.ts";
import { resolveRunExecution } from "../src/runtime/execution-policy.ts";
import type {
  Blueprint,
  LoomInvocationInput as LoomInput,
} from "@intloom/loom-sdk";
import type { OperationRef } from "../src/runtime/contracts.ts";
import type {
  RunExecution,
  RunSource,
} from "../src/runtime/execution-policy.ts";
import type { RunEntry } from "../src/runtime/run-entry.ts";

export type TestRuntimeOptions = RuntimeOptions & {
  prepareExecution?: (
    blueprint: Blueprint,
    source: RunSource,
  ) => Promise<RunExecution>;
};
import { createRuntime as createEngine } from "../src/runtime/create-runtime.ts";
import type { RuntimeOptions } from "../src/runtime/contracts.ts";
import { waitForRun } from "../src/operations/wait-run.ts";

/** Scenario convenience only: engine retains the production mutation/receipt API.
 * run/answerAsk/completeAgentCall compose admission with observation and return a stable view.
 * Tests of admission or Agent receipts must call engine or options.executor.delegated directly.
 */
export function createRuntimeHarness(options: TestRuntimeOptions) {
  const runtime = createEngine(options);
  const startRun = async (
    blueprint: Blueprint,
    input: LoomInput,
    source: RunSource | RunExecution = "cli",
    startedBy?: OperationRef,
  ) =>
    unwrapMutation(
      await runtime.startRun(
        blueprint,
        input,
        typeof source === "string"
          ? ((await options.prepareExecution?.(blueprint, source)) ??
              resolveRunExecution(source, false))
          : source,
        startedBy,
      ),
    );
  const delegated = options.executor.delegated;
  return {
    ...runtime,
    engine: runtime,
    async resumeRun(...args: Parameters<typeof runtime.resumeRun>) {
      return unwrapMutation(await runtime.resumeRun(...args));
    },
    async cancelRun(runId: string) {
      unwrapMutation(await runtime.cancelRun(runId));
    },
    submitAnswer(...args: Parameters<typeof runtime.submitAnswer>) {
      return unwrapMutation(runtime.submitAnswer(...args));
    },
    ...delegated,
    startRun,
    async run(...args: Parameters<typeof startRun>) {
      const run = await startRun(...args);
      return waitForRun(runtime, run.runId);
    },
    async answerAsk(...args: Parameters<typeof runtime.submitAnswer>) {
      const run = unwrapMutation(runtime.submitAnswer(...args));
      return waitForRun(runtime, run.runId);
    },
    async completeAgentCall(
      request: Parameters<typeof delegated.completeAgentCall>[0],
    ) {
      await delegated.completeAgentCall(request);
      return waitForRun(runtime, request.runId);
    },
    async failAgentCall(
      request: Parameters<typeof delegated.failAgentCall>[0],
    ) {
      await delegated.failAgentCall(request);
      return waitForRun(runtime, request.runId);
    },
  };
}

/** Unit fixtures borrow the same Operations observer without adding a blocking Runtime mutation. */
export function waitForEntry(entry: RunEntry) {
  return waitForRun(
    {
      watchRun(_id, observe) {
        const listener = () => observe(toRunView(entry.state));
        entry.observers.add(listener);
        listener();
        return () => {
          entry.observers.delete(listener);
        };
      },
    },
    entry.state.id,
  );
}
