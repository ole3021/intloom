import { waitForRun } from "./wait.ts";
import type { CoreResult } from "@intloom/kernel/operations";
import { readLogs, watchLogs } from "./logs.ts";
import { buildLoom, checkLoom, inspectLoom, scaffoldLoom } from "./build.ts";
import { createProjectOperations } from "./project/operations.ts";
import { createServiceOperations } from "./service.ts";
import { createRunsOperations } from "./runs.ts";
import { createResourcesOperations } from "./resources.ts";
import { createLoomOperations } from "./loom-operations.ts";
import { createMirrorsOperations } from "./mirrors.ts";
import { createAgentsOperations } from "./agents.ts";
import type {
  WaitRunInput,
  WaitRunResult,
  ObserveOptions,
} from "./contracts.ts";
/** One facade for CMD/TUI; execution state remains in the project Service. */
export function createCliCore() {
  const core = {
    buildLoom,
    checkLoom,
    inspectLoom,
    scaffoldLoom,
    readLogs,
    watchLogs,
    ...createProjectOperations(),
    ...createServiceOperations(),
    ...createRunsOperations(),
    ...createResourcesOperations(),
    ...createLoomOperations(),
    ...createMirrorsOperations(),
    ...createAgentsOperations(),
    waitRun(
      input: WaitRunInput,
      options: ObserveOptions = {},
    ): Promise<CoreResult<WaitRunResult>> {
      return waitForRun(
        (run, observation) => core.watchRun(run, observation),
        input,
        options,
      );
    },
  };
  return core;
}
export type CliCore = ReturnType<typeof createCliCore>;
