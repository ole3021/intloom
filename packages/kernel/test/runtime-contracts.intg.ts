import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

test("published Runtime declarations constrain APIs, resolutions and error projections", async (t) => {
  const temporary = await mkdtemp(resolve(root, "test/.runtime-consumer-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await writeFile(
    resolve(temporary, "consumer.ts"),
    `import { createRuntime, createEffector, getAgentExecutionAccess, agentExecutionContextKey, initializeProject, flow, getRun, listRuns, answerAsk, cancelRun, cancelAllRuns, listWorkflows } from "@intloom/kernel";
import type {
  Blueprint, BlueprintStage, InitializeProjectOptions, ProjectExecution, Resolution, RunErrorView, Runtime, RuntimeOptions, RunView,
  StageStateInitializer, Transition, StorageAccess, StorageHandle, WorkflowView,
  Query, StorageQuery, SnapshotCategory, StorageCategory,
  Effector, AgentExecutionAccess, CodeExecutionAccess, JsonValue,
} from "@intloom/kernel";
import { RequestContext } from "@mastra/core/request-context";
import { openFileStorage } from "@intloom/kernel/storage/file";
import { openSqliteStorage } from "@intloom/kernel/storage/sqlite";
openFileStorage({ directory: "/storage" }) satisfies Promise<StorageHandle>;
openSqliteStorage({ filename: "/storage.sqlite", projectId: "project" }) satisfies Promise<StorageHandle>;
// @ts-expect-error SQL handles require a project identity.
openSqliteStorage({ filename: "/storage.sqlite" });
createEffector({ maxAgentSteps: 10 }) satisfies Effector;
declare const agentAccess: AgentExecutionAccess<JsonValue>;
declare const codeAccess: CodeExecutionAccess<JsonValue>;
agentAccess.signal satisfies AbortSignal;
codeAccess.signal satisfies AbortSignal;
getAgentExecutionAccess(new RequestContext()) satisfies AgentExecutionAccess<JsonValue>;
agentExecutionContextKey satisfies "intloom.execution";
// @ts-expect-error Only Code steps can ask users.
agentAccess.interaction;
// @ts-expect-error Agent Storage is read-only.
agentAccess.storage.commit([]);
// @ts-expect-error Code access requires its invocation cancellation signal.
const missingSignal: CodeExecutionAccess<JsonValue> = { state: codeAccess.state, storage: codeAccess.storage, interaction: codeAccess.interaction };
// @ts-expect-error Scheme B exposes coordination functions, not a Kernel object.
import type { Kernel } from "@intloom/kernel";
// @ts-expect-error The former factory type is removed.
import type { CreateKernel } from "@intloom/kernel";
declare const options: RuntimeOptions;
options.storage satisfies StorageAccess;
// @ts-expect-error Runtime must receive explicit Storage capabilities.
const missingStorage: RuntimeOptions = { codes: options.codes, agents: options.agents, effector: options.effector };
declare const blueprint: Blueprint;
declare const stage: BlueprintStage;
stage.initializeState satisfies StageStateInitializer;
// @ts-expect-error Initializers receive an owned context, not an intent string alone.
stage.initializeState("text");
declare const view: RunView;
const runtime: Runtime = createRuntime(options);
runtime.flow(blueprint, "  original text  ") satisfies Promise<RunView>;
runtime.getRun("RUN-1") satisfies Promise<RunView>;
runtime.listRuns("intent") satisfies Promise<RunView[]>;
runtime.answerAsk("RUN-1", "ASK-1", { isConfirmed: true }) satisfies Promise<RunView>;
// @ts-expect-error Replies must identify the specific waiting action.
runtime.answerAsk("RUN-1", { isConfirmed: true });
// @ts-expect-error Action IDs are strings.
runtime.answerAsk("RUN-1", 1, { isConfirmed: true });
declare const execution: ProjectExecution;
declare const projectOptions: InitializeProjectOptions;
initializeProject("/project", projectOptions) satisfies Promise<ProjectExecution>;
flow(execution, "intent", "text") satisfies Promise<RunView>;
getRun(execution, "RUN-1") satisfies Promise<RunView>;
listRuns(execution) satisfies Promise<RunView[]>;
answerAsk(execution, "RUN-1", "ASK-1", { isConfirmed: true }) satisfies Promise<RunView>;
cancelRun(execution, "RUN-1") satisfies Promise<void>;
cancelAllRuns(execution) satisfies Promise<void>;
// @ts-expect-error Cancelling one Run requires its identity.
cancelRun(execution);
listWorkflows(execution) satisfies Promise<WorkflowView[]>;
// @ts-expect-error Module calls require the retained project environment.
flow("intent", "text");
// @ts-expect-error Kernel replies also require the action identity.
answerAsk(execution, "RUN-1", { isConfirmed: true });
// @ts-expect-error Project initialization requires the host's Storage access.
initializeProject("/project", { effector: options.effector });
// @ts-expect-error The resource environment exposes no execution methods.
execution.flow("intent", "text");
declare const legacyQuery: Query;
declare const storageQuery: StorageQuery;
legacyQuery satisfies StorageQuery;
storageQuery satisfies Query;
declare const legacyCategory: SnapshotCategory;
declare const storageCategory: StorageCategory;
legacyCategory satisfies StorageCategory;
storageCategory satisfies SnapshotCategory;
declare const storageHandle: StorageHandle;
storageHandle.access satisfies StorageAccess;
storageHandle.dispose() satisfies Promise<void>;
// @ts-expect-error Business access cannot close the host-owned resource.
storageHandle.access.dispose();
runtime.cancelRun("RUN-1") satisfies Promise<void>;
runtime.cancelAllRuns() satisfies Promise<void>;
// @ts-expect-error Use cancelAllRuns to cancel every Run.
runtime.cancelRun();
// @ts-expect-error Runtime start is replaced by flow.
runtime.start(blueprint, "text");
// @ts-expect-error Runtime stop is replaced by explicit cancellation methods.
runtime.stop();
// @ts-expect-error RunView uses the same cursor field as RunState and pending actions.
view.currentCursor;
view.lastError satisfies RunErrorView | undefined;
// @ts-expect-error Workflow intent is text.
runtime.flow(blueprint, { intent: "text" });
// @ts-expect-error Runtime receives the loaded Blueprint, not its name.
runtime.flow("intent", "text");
// @ts-expect-error RunView exposes no Error cause.
view.lastError?.cause;
// @ts-expect-error RunView exposes no Error stack.
view.lastError?.stack;
// @ts-expect-error Snapshot cursors are readonly.
view.cursor.stepName = "other";
// @ts-expect-error Run state determines why execution halts.
const halt: Resolution = { kind: "halt", status: "waiting" };
// @ts-expect-error execute must identify both Stage and Step definitions.
const execute: Resolution = { kind: "execute" };
const enter: Transition = { kind: "enter_stage", stage };
const move: Transition = { kind: "move_step" };
const complete: Transition = { kind: "complete" };
// @ts-expect-error Stage entry must carry its definition even on same-name reentry.
const missingStage: Transition = { kind: "enter_stage" };
// @ts-expect-error Transitions do not duplicate the authoritative Run cursor.
const cursorTransition: Transition = { kind: "move_step", cursor: view.cursor };
// @ts-expect-error This model resumes the original call through answerAsk.
runtime.resume("RUN-1");
`,
  );
  await writeFile(
    resolve(temporary, "tsconfig.json"),
    JSON.stringify({
      extends: resolve(root, "../../tsconfig.base.json"),
      compilerOptions: { noEmit: true },
      files: ["consumer.ts"],
    }),
  );
  const require = createRequire(import.meta.url);
  const tsc = resolve(
    dirname(require.resolve("typescript/package.json")),
    "bin/tsc",
  );
  try {
    await run(process.execPath, [
      tsc,
      "-p",
      resolve(temporary, "tsconfig.json"),
      "--pretty",
      "false",
    ]);
  } catch (cause) {
    throw new Error(
      cause instanceof Error && "stdout" in cause
        ? String(cause.stdout)
        : String(cause),
      { cause },
    );
  }
});
