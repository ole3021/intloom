import type { RunView, RunErrorView } from "@intloom/kernel";
import {
  initializeProject,
  type InitializeProjectOptions,
  type ProjectExecution,
  type ProjectHost,
} from "@intloom/kernel/host";
import {
  createOperations,
  type Admission,
  type OperationReceipt,
  type OperationQuery,
} from "@intloom/kernel/operations";
import type {
  CodeExecutionAccess,
  AgentExecutionAccess,
  JsonValue,
  StorageAccess,
} from "@intloom/loom-sdk";
import { openFileStorage } from "@intloom/kernel/storage/file";
declare const host: ProjectHost;
const operations = createOperations(host.operations, "cli");
operations.getRun("RUN-1") satisfies Promise<RunView>;
// @ts-expect-error Operations mutations require an explicit operation receipt.
operations.run("fixture", { prompt: "request" });
// @ts-expect-error Direct answer mutation is not an Operations entry.
operations.answerAsk("RUN-1", "ASK-1", {});
// @ts-expect-error Direct stop mutation is not an Operations entry.
operations.cancelRun("RUN-1");
// @ts-expect-error Direct resume mutation is not an Operations entry.
operations.resumeRun("RUN-1", {});
// @ts-expect-error No standalone blocking start is exported.
import { run } from "@intloom/kernel/operations";
// @ts-expect-error No standalone blocking answer is exported.
import { answerAsk } from "@intloom/kernel/operations";
// @ts-expect-error No standalone stop is exported.
import { cancelRun } from "@intloom/kernel/operations";
void [run, answerAsk, cancelRun];
operations.admit("run", {
  serviceInstanceId: "instance",
  operationId: "operation",
  loomName: "fixture",
  input: { prompt: "request" },
}) satisfies Promise<Admission>;
operations.getOperation("instance", "operation") satisfies OperationQuery;
declare const options: InitializeProjectOptions;
initializeProject("/project", options) satisfies Promise<ProjectExecution>;
options.storage satisfies StorageAccess;
openFileStorage({ directory: "/storage" });
declare const code: CodeExecutionAccess<JsonValue>;
declare const tool: AgentExecutionAccess<JsonValue>;
code.storage.commit([]);
// @ts-expect-error Agent Tools cannot commit formal data.
tool.storage.commit([]);
// @ts-expect-error Agent Tools expose only declared named interactions.
tool.interaction?.askQuestions([]);
// @ts-expect-error SDK types have one owner.
import type { CodeExecutionAccess as RemovedAccess } from "@intloom/kernel";
declare const removed: RemovedAccess;
void removed;
// @ts-expect-error Runtime construction is private to Host.
import { createRuntime } from "@intloom/kernel";
// @ts-expect-error Private implementation paths are not package exports.
import { createRuntime as internal } from "@intloom/kernel/runtime/create-runtime";
// @ts-expect-error Arbitrary old Service paths are not exposed.
import { createServiceApi } from "@intloom/kernel/service/http-api";
void [createRuntime, internal, createServiceApi];
// @ts-expect-error Runtime only admits, it does not combine mutation with waiting.
host.execution.runtime.run(null, null);
declare const error: RunErrorView;
error.code satisfies string;
// @ts-expect-error Error projections do not contain in-process causes.
error.cause;
declare const receipt: OperationReceipt;
if (receipt.status === "indeterminate") receipt.error satisfies RunErrorView;
