import type { ProjectExecution } from "./project-contracts.ts";
import type { OperationsPorts } from "../operations/ports.ts";
import { listLooms } from "../operations/looms.ts";
import { prepareRun } from "./prepare-run.ts";
import { restoreMirror } from "./restore-mirror.ts";

/** Host composes borrowed capabilities; Operations never receives the Host or its resource handles. */
export function createOperationsPorts(
  execution: ProjectExecution,
  environment: Pick<
    OperationsPorts,
    "receipts" | "storage" | "assertOpen" | "presentRun" | "status"
  >,
): OperationsPorts {
  return Object.freeze({
    ...environment,
    projectRoot: execution.projectRoot,
    runtime: execution.runtime,
    delegated: execution.executor.delegated,
    startRun: (loom, input, source, operation) =>
      prepareRun(
        execution,
        loom,
        input,
        source,
        operation,
        environment.assertOpen,
      ),
    listLooms: (source) => listLooms(execution, source),
    restoreMirror,
  } satisfies OperationsPorts);
}
