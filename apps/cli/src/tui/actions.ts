import { parseLoomDraft } from "./loom-input.ts";
import { randomUUID } from "node:crypto";
import { createSignal, type Accessor } from "solid-js";
import type { ReadonlyJsonValue } from "@intloom/loom-sdk";
import type { CliCore, CoreResult, ServiceRunView } from "../core/index.ts";
import type { createTuiSession, TuiSnapshot } from "./session.ts";
import type { ProjectInput } from "../core/index.ts";
import { runnable, unfinished } from "./selectors.ts";
import type { Dialog, TuiWindow } from "./navigation.ts";
type Admission = Extract<
  Awaited<ReturnType<CliCore["run"]>>,
  { ok: true }
>["data"];
export interface PendingWrite {
  kind: "run" | "answer" | "resume" | "cancel";
  instanceId: string;
  operationId?: string;
  runId?: string;
}
interface ActionContext {
  core: CliCore;
  session: ReturnType<typeof createTuiSession>;
  snapshot: Accessor<TuiSnapshot>;
  run: Accessor<ServiceRunView | undefined>;
  input: (instanceId?: string) => ProjectInput;
  connected: () => boolean;
  selectRun: (runId: string) => void;
  setView: (view: TuiWindow) => void;
  setDraft: (text: string) => void;
  setDialog: (dialog: Dialog | undefined) => void;
  loom: Accessor<string>;
  isDisposed: () => boolean;
  executeCommand: (text: string) => void;
}
export function createRunActions(context: ActionContext) {
  const {
    core,
    session,
    snapshot,
    run,
    input,
    connected,
    selectRun,
    setView,
    setDraft,
    setDialog,
    loom,
    isDisposed,
    executeCommand,
  } = context;
  const [busy, setBusy] = createSignal(false);
  const [pending, setPending] = createSignal<PendingWrite>();
  const [controlTarget, setControlTarget] = createSignal<ServiceRunView>();
  const canWrite = () => connected() && !busy() && !pending();
  async function inspectRun(runId: string, instanceId: string) {
    const result = await core.getRun({ ...input(instanceId), runId });
    if (!isDisposed() && result.ok) session.observeRun(result.data);
    else if (!isDisposed()) session.report(result);
  }
  function accepted(write: PendingWrite, admission: Admission) {
    const receipt = admission.receipt;
    if (receipt.status === "pending") {
      setPending(write);
      session.message(
        `Operation pending · ${write.operationId} · Inspect the original operation below`,
      );
    } else if (receipt.status === "indeterminate") {
      setPending(write);
      session.message(
        `${receipt.error.code}: ${receipt.error.message} · Outcome remains unknown; inspect the original operation.`,
      );
    } else if (receipt.status === "rejected") {
      setPending(undefined);
      session.message(`${receipt.error.code}: ${receipt.error.message}`);
    } else {
      setPending(undefined);
      if (admission.run) session.observeRun(admission.run);
      selectRun(receipt.runId);
      setView("workbench");
      if (write.kind === "run") setDraft("");
      session.message(`Operation accepted · Run ${receipt.runId}`);
      if (!admission.run) void inspectRun(receipt.runId, write.instanceId);
    }
  }
  async function admit(
    write: PendingWrite,
    execute: () => Promise<CoreResult<Admission>>,
  ) {
    if (!canWrite()) return;
    setBusy(true);
    setPending(write);
    try {
      const result = await execute();
      if (isDisposed()) return;
      if (result.ok) accepted(write, result.data);
      else {
        if (result.outcome === "not_applied") setPending(undefined);
        session.report(result);
      }
    } finally {
      if (!isDisposed()) setBusy(false);
    }
  }
  async function check() {
    const write = pending();
    if (!write || busy()) return;
    setBusy(true);
    try {
      if (write.operationId) {
        const result = await core.getOperation({
          ...input(write.instanceId),
          operationId: write.operationId,
        });
        if (isDisposed()) return;
        if (!result.ok) session.report(result);
        else if (result.data.status === "found")
          accepted(write, { receipt: result.data.receipt });
        else
          session.message(
            result.data.status === "instance_changed"
              ? `Service instance changed. Retain operation ${write.operationId} from ${write.instanceId}; inspect its Run history before further work.`
              : `No receipt for ${write.operationId}. Outcome remains unknown; no retry sent.`,
          );
      }
    } finally {
      if (!isDisposed()) setBusy(false);
    }
  }
  function submitDraft(text: string) {
    if (text.trim().startsWith("/") && !text.includes("\n")) {
      executeCommand(text.trim());
      setDraft("");
      return;
    }
    const instanceId = snapshot().instanceId;
    if (!instanceId || !canWrite() || !text.trim()) return;
    const selected = snapshot().looms.find(
      (item) => item.loomName === loom() && runnable(item),
    );
    if (!selected?.isAvailable) {
      session.message("Choose an available Loom before submitting.");
      setDialog("looms");
      return;
    }
    let loomInput: ReturnType<typeof parseLoomDraft>;
    try {
      loomInput = parseLoomDraft(selected.inputs, text);
    } catch (error) {
      session.message(
        error instanceof Error ? error.message : "Invalid Loom inputs.",
      );
      return;
    }
    const write: PendingWrite = {
      kind: "run",
      instanceId,
      operationId: randomUUID(),
    };
    void admit(write, () =>
      core.run({
        ...input(instanceId),
        serviceInstanceId: instanceId,
        operationId: write.operationId as string,
        loomName: loom(),
        input: loomInput,
      }),
    );
  }
  function answer(answer: ReadonlyJsonValue, actionId: string) {
    const current = run(),
      instanceId = snapshot().instanceId;
    if (!current || !instanceId || current.pendingAction?.id !== actionId) {
      session.message("Pending action changed. Inspect the current Run.");
      return;
    }
    const write: PendingWrite = {
      kind: "answer",
      instanceId,
      runId: current.runId,
      operationId: randomUUID(),
    };
    void admit(write, () =>
      core.answerAsk({
        ...input(instanceId),
        serviceInstanceId: instanceId,
        operationId: write.operationId as string,
        runId: current.runId,
        actionId,
        answer,
      }),
    );
  }
  function openControl(kind: "cancel" | "resume") {
    const current = run();
    if (
      !current ||
      !canWrite() ||
      (kind === "cancel" ? !unfinished(current) : current.status !== "paused")
    ) {
      session.message(
        kind === "cancel"
          ? "Select an unfinished Run to cancel."
          : "Select a paused Run to continue.",
      );
      return;
    }
    setControlTarget(current);
    setDialog(kind);
  }
  async function cancel() {
    const target = controlTarget();
    if (!target || !canWrite()) return;
    setDialog(undefined);
    setBusy(true);
    const operationId = randomUUID();
    const write: PendingWrite = {
      kind: "cancel",
      operationId,
      instanceId: target.serviceInstanceId,
      runId: target.runId,
    };
    setPending(write);
    try {
      const result = await core.cancelRun({
        operationId,
        ...input(write.instanceId),
        runId: target.runId,
      });
      if (isDisposed()) return;
      if (result.ok) {
        accepted(write, result.data);
      } else if (result.outcome === "not_applied") setPending(undefined);
      session.report(result);
    } finally {
      if (!isDisposed()) setBusy(false);
    }
  }
  function resume(choice: string) {
    const target = controlTarget();
    if (!target || !canWrite()) return;
    setDialog(undefined);
    const write: PendingWrite = {
      kind: "resume",
      instanceId: target.serviceInstanceId,
      runId: target.runId,
      operationId: randomUUID(),
    };
    const scope =
      choice === "abandon"
        ? "loom"
        : choice === "current"
          ? undefined
          : (choice as "step" | "stage" | "loom");
    void admit(write, () =>
      core.resumeRun({
        ...input(write.instanceId),
        serviceInstanceId: write.instanceId,
        runId: target.runId,
        operationId: write.operationId as string,
        expectedRevision: target.revision,
        ...(scope ? { scope } : {}),
        ...(choice === "abandon" ? { abandonMirror: true } : {}),
      }),
    );
  }
  return {
    busy,
    pending,
    controlTarget,
    canWrite,
    check,
    submitDraft,
    answer,
    openControl,
    cancel,
    resume,
  };
}
