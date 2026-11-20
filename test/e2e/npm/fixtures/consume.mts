import type { reviewer } from "@intloom-example/agent-research";
import main from "@intloom-example/code-report";
import type report from "@intloom-example/workflow-report";
import type hello from "@intloom-example/hello-loom";
import meeting, { type minutes } from "@intloom-example/meeting-notes";
import type intent from "@intloom-example/intent-loom";
import type { specificationReview } from "@intloom-example/intent-loom";
import type { audit } from "@intloom-example/intent-loom/src/agents.js";
import {
  createToolScope,
  type ToolScope,
  type ToolScopeOptions,
  openStore,
  openKernelData,
  type KernelData,
  type StoreHandle,
  type ExecutionRecord,
  openKernel,
  type KernelRuntime,
} from "@intloom/kernel";
import type {
  ExecInput,
  ExecOutput,
  LoomEntry,
  LoomInput,
  ProcessReceipt,
  ExecutionResult,
  PackageIdentity,
  KeyValueStorage,
  RunResult,
} from "@intloom/loom-sdk";

const entry: LoomEntry = main;
const input: ExecInput<typeof report> = {
  prompt: "A report",
} satisfies LoomInput;
const review: ExecOutput<typeof reviewer> = { passed: true, issues: [] };
// @ts-expect-error The generated Agent declaration preserves structured results.
const invalid: ExecOutput<typeof reviewer> = "not a review";
// @ts-expect-error The generated Workflow declaration preserves LoomInput.
const wrongInput: ExecInput<typeof report> = "not LoomInput";
const output: Promise<ExecOutput<typeof report>> = Promise.resolve();

void [entry, input, review, invalid, wrongInput, output];

const meetingEntry: LoomEntry = meeting;
const helloInput: ExecInput<typeof hello> = { prompt: "zh-CN" };
const intentInput: ExecInput<typeof intent> = {
  prompt: "Change",
  files: ["/request.json"],
  folders: ["/project"],
};
const minutesResult: ExecOutput<typeof minutes> = {
  kind: "action",
  title: "Meeting",
  fullHeading: "Actions",
  sections: [],
};
declare const reviewed: ExecOutput<typeof specificationReview>;
const approved: boolean = reviewed.approved;
const intentOutput: Promise<ExecOutput<typeof intent>> = Promise.resolve();
const invalidAudit: ExecOutput<typeof audit> = {
  // @ts-expect-error The archived business schema preserves the verdict enum.
  verdict: "optimistic",
  reason: "No evidence",
};
void [
  meetingEntry,
  helloInput,
  intentInput,
  minutesResult,
  approved,
  intentOutput,
  invalidAudit,
];

const createScope: (options: ToolScopeOptions) => ToolScope = createToolScope;
const cancelled: ExecutionResult = {
  status: "cancelled",
  reason: "User stopped",
};
void [createScope, cancelled];

export async function consumeToolDeclarations(tools: ToolScope) {
  const feedback = await tools.user.ask({
    question: "Continue?",
    mode: "confirm",
    allowSkip: true,
  });
  if (feedback.status === "answered") {
    const value: boolean = feedback.value;
    void value;
  }
  // @ts-expect-error Skipped feedback has no value.
  feedback.value;
  // @ts-expect-error Only choice modes accept options.
  await tools.user.ask({ question: "Continue?", mode: "confirm", options: [] });
  const receipt: ProcessReceipt = await tools.process.run({
    command: "node",
    args: ["--version"],
    cwd: "/work",
  });
  const info = await tools.fs.stat({ path: "/work", followSymlinks: false });
  const directory = await tools.fs.mkdtemp({ directory: tools.tempDir });
  await tools.fs.remove({ path: directory, recursive: true });
  return { status: receipt.status, type: info?.type };
}

export async function consumeDataDeclarations(data: KernelData) {
  const identity: PackageIdentity = {
    name: "@intloom-example/code-report",
    version: "0.5.0",
  };
  const host: StoreHandle = await openStore(identity.name, {
    dataDir: "/data",
  });
  const borrowed: KeyValueStorage = await data.getStore(identity.name);
  // @ts-expect-error Kernel-owned business Store views cannot close the connection.
  borrowed.close();
  const record: ExecutionRecord = await data.createExecution({
    package: identity,
    kind: "code",
    mode: "chat",
    input: { prompt: "Typed consumer" },
  });
  await data.completeExecution(record.executionId, {
    result: { status: "succeeded" },
    value: null,
  });
  const events = await data.listEvents(record.executionId);
  for (const event of events.entries) {
    if (event.type === "completed") {
      const result: ExecutionResult = event.data.result;
      void result;
    }
  }
  await host.close();
  const other: KernelData = await openKernelData({ dataDir: "/other-data" });
  await other.close();
  return data.listExecutions({ status: "succeeded", limit: 10 });
}

export async function consumeRuntimeDeclarations(runtime: KernelRuntime) {
  const { runId } = await runtime.startRun({
    package: { name: "@intloom-example/code-report", version: "0.5.0" },
    input: { prompt: "Actual run" },
  });
  const record = await runtime.getRun(runId);
  if (record) {
    const phase:
      | "preparing"
      | "running"
      | "cancelling"
      | "finalizing"
      | "finished" = record.phase;
    void phase;
  }
  const result: RunResult = await runtime.waitRun(runId);
  const host: KernelRuntime = await openKernel({ dataDir: "/runtime-data" });
  await host.close();
  // @ts-expect-error Generic roots must specify their execution mode.
  await runtime.createExecution({
    package: { name: "example", version: "1.0.0" },
    kind: "code",
  });
  return result.outputs.current;
}
