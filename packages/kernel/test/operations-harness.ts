import { randomUUID } from "node:crypto";
import { LoomError } from "@intloom/utils";
import type { LoomInput, ReadonlyJsonValue } from "@intloom/loom-sdk";
import type { ProjectExecution } from "../src/host/project-contracts.ts";
import type { RunSource } from "../src/runtime/execution-policy.ts";
import { createOperationsPorts } from "../src/host/operations.ts";
import { createOperations } from "../src/operations/project.ts";
import { createOperationReceipts } from "../src/operations/receipts.ts";
import type { OperationsPorts } from "../src/operations/ports.ts";
import type { Admission } from "../src/operations/api-contracts.ts";
import { waitForRun } from "../src/operations/wait-run.ts";
import { runtimeFixture } from "./runtime-fixture.ts";

const environments = new WeakMap<
  ProjectExecution,
  { ports: OperationsPorts; instanceId: string }
>();
function environment(execution: ProjectExecution) {
  let value = environments.get(execution);
  if (!value) {
    const instanceId = randomUUID();
    value = {
      instanceId,
      ports: createOperationsPorts(execution, {
        receipts: createOperationReceipts(instanceId),
        storage: runtimeFixture().storage,
        assertOpen() {},
        presentRun: (run) => run,
        async status() {
          throw new Error("Unexpected status query");
        },
      }),
    };
    environments.set(execution, value);
  }
  return value;
}
function accepted(admission: Admission) {
  const receipt = admission.receipt;
  if (receipt.status === "accepted") return receipt.runId;
  if (receipt.status === "pending")
    throw new Error("Unexpected pending admission");
  throw new LoomError(receipt.error.code, receipt.error.message, {
    retryable: receipt.error.retryable,
  });
}
/** Integration fixtures use the production admission ledger, then explicitly observe the Run. */
export async function run(
  execution: ProjectExecution,
  loomName: string,
  input: LoomInput,
  source: RunSource = "cli",
) {
  const { ports, instanceId } = environment(execution);
  const admission = await createOperations(ports, source).admit("run", {
    serviceInstanceId: instanceId,
    operationId: randomUUID(),
    loomName,
    input,
  });
  return waitForRun(ports.runtime, accepted(admission));
}
export async function answerAsk(
  execution: ProjectExecution,
  runId: string,
  actionId: string,
  answer: ReadonlyJsonValue,
) {
  const { ports, instanceId } = environment(execution);
  accepted(
    await createOperations(ports, "cli").admit(
      "answer",
      {
        serviceInstanceId: instanceId,
        operationId: randomUUID(),
        actionId,
        answer,
      },
      runId,
    ),
  );
  return waitForRun(ports.runtime, runId);
}
export async function cancelRun(execution: ProjectExecution, runId: string) {
  const { ports, instanceId } = environment(execution);
  accepted(
    await createOperations(ports, "cli").admit(
      "stop",
      { serviceInstanceId: instanceId, operationId: randomUUID() },
      runId,
    ),
  );
}
export const getRun = (execution: ProjectExecution, id: string) =>
  execution.runtime.getRun(id);
export const listRuns = (execution: ProjectExecution, loom?: string) =>
  execution.runtime.listRuns(loom);
export const cancelAllRuns = (execution: ProjectExecution) =>
  execution.runtime.cancelAllRuns();
export { listLooms } from "../src/operations/looms.ts";
