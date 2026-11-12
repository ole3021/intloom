import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  IntloomError,
  type InstalledLoomRef,
  type RunControlReceipt,
  type RunResult,
  type RunView,
  type ResumeRunOptions,
  type InteractionResponse,
  type InteractionReceipt,
  type ResponseSource,
  type InteractionRequest,
} from "@intloom/loom-sdk";
import type {
  RunExecution,
  LoomRuntime,
  RunRecord,
  RunRepository,
  RunListQuery,
  WaitRecord,
  RunOperation,
} from "./run-contracts.ts";
import type { OutcomeServices } from "../outcomes/contracts.ts";
import { findInteraction, recordResponse } from "./interactions.ts";
import { terminal, diagnostic } from "./state.ts";
export { terminal } from "./state.ts";
import { createTransitions } from "./transitions.ts";
import { reconcileRuns } from "./recovery.ts";
/** Coordinates accepted operations and stable execution boundaries; the engine owns scheduling. */
export async function createKernel(dependencies: {
  recoverUpgrade?: boolean;
  repository: RunRepository;
  runtime: LoomRuntime;
  outcomes: OutcomeServices;
  id(): string;
  runId(): string;
  now(): string;
  markStopped(runId?: string): Promise<void>;
  wasStopped(runId: string): boolean;
}) {
  const {
    repository,
    runtime,
    outcomes,
    id,
    runId,
    now,
    markStopped,
    wasStopped,
  } = dependencies;
  let tail = Promise.resolve();
  let closing = false;
  let fault: IntloomError | undefined;
  const active = new Map<
    string,
    { execution: RunExecution; promise: Promise<void>; directory: string }
  >();
  const advancing = new Map<string, string>();
  const queued = new Map<string, Map<string, RunOperation>>();
  const healthy = () => {
    if (fault) throw fault;
  };
  const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
    const pending = tail.then(() => {
      healthy();
      return action();
    });
    tail = pending.then(
      () => undefined,
      (error: unknown) => {
        if (error instanceof IntloomError && error.code === "STORAGE_FAILED")
          fault = error;
        if (
          error instanceof IntloomError &&
          error.code === "STORAGE_UNAVAILABLE"
        ) {
          const directory = (error.details as { directory: string }).directory;
          for (const running of active.values())
            if (running.directory === directory)
              void running.execution
                .cancel()
                .catch((failure) =>
                  console.error(
                    "Cannot stop execution after storage failure",
                    failure,
                  ),
                );
        }
      },
    );
    return pending;
  };
  const commands = new Map<string, Promise<unknown>>();
  const preparations = new Set<Promise<unknown>>();
  const track = <T>(work: Promise<T>): Promise<T> => {
    preparations.add(work);
    void work.then(
      () => preparations.delete(work),
      () => preparations.delete(work),
    );
    return work;
  };
  const operate = <T>(runId: string, action: () => Promise<T>): Promise<T> => {
    const work = (commands.get(runId) ?? Promise.resolve()).then(() => {
      healthy();
      return action();
    });
    const settled = work.then(
      () => undefined,
      () => undefined,
    );
    commands.set(runId, settled);
    void settled.then(() => {
      if (commands.get(runId) === settled) commands.delete(runId);
    });
    return track(work);
  };
  const accepting = () => {
    healthy();
    if (closing)
      throw new IntloomError(
        "SERVICE_BUSY",
        "The Intloom service is closing and cannot accept new execution work.",
      );
  };
  const get = async (runId: string): Promise<RunRecord> => {
    const record = await repository.get(runId);
    if (!record)
      throw new IntloomError("RUN_NOT_FOUND", "Run was not found.", { runId });
    return record;
  };
  const { closedInteractions, end, boundary, startValidation, validate } =
    createTransitions(dependencies);
  await reconcileRuns({
    ...dependencies,
    transitions: { closedInteractions, end, boundary },
  });

  function prepareInput(
    prepared: Awaited<ReturnType<LoomRuntime["prepare"]>>,
    raw: unknown,
    explicitFiles: readonly string[] = [],
  ) {
    const input = prepared.normalize(raw);
    const files = new Set(explicitFiles);
    const collectFiles = (value: RunRecord["input"]) => {
      if (!value || typeof value !== "object") return;
      if (
        !Array.isArray(value) &&
        value.kind === "input-file" &&
        typeof value.path === "string"
      ) {
        value.path = resolve(
          prepared.binding.location.directory ?? ".",
          value.path,
        );
        files.add(value.path);
      } else {
        for (const child of Object.values(value)) collectFiles(child);
      }
    };
    collectFiles(input);
    return {
      binding: prepared.binding,
      input,
      ...(files.size ? { inputFiles: [...files] } : {}),
    };
  }

  async function create(
    loom: InstalledLoomRef,
    prepared: ReturnType<typeof prepareInput>,
    parentRunId?: string,
  ): Promise<RunRecord> {
    let nextId = runId();
    // Creation is serialized for this data directory, including child Runs.
    while (await repository.get(nextId)) nextId = runId();
    const time = now();
    return {
      ...prepared,
      view: {
        location: prepared.binding.location,
        id: nextId,
        loom: structuredClone(loom),
        status: "created",
        ...(typeof prepared.binding.config.command === "string"
          ? { command: prepared.binding.config.command }
          : {}),
        createdAt: time,
        updatedAt: time,
        waits: [],
        pendingInteractionIds: [],
        ...(parentRunId ? { parentRunId } : {}),
      },
    };
  }
  async function stopChildren(record: RunRecord) {
    for (const child of record.children ?? []) {
      try {
        await cancel(child.childRunId, "Parent Run stopped.");
      } catch (error) {
        if (
          !(error instanceof IntloomError) ||
          error.code !== "STORAGE_UNAVAILABLE"
        )
          throw error;
      }
    }
  }
  async function finishStopped(runId: string) {
    const record = await get(runId);
    if (record.view.status !== "stopping" || active.has(runId)) return;
    for (const { childRunId } of record.children ?? []) {
      try {
        if (!terminal((await get(childRunId)).view.status)) return;
      } catch (error) {
        if (
          !(error instanceof IntloomError) ||
          error.code !== "STORAGE_UNAVAILABLE" ||
          !wasStopped(childRunId)
        )
          throw error;
      }
    }
    queued.delete(runId);
    await boundary(
      record,
      record.view.stopReason?.kind === "error"
        ? { kind: "failed", error: record.view.stopReason.error }
        : { kind: "cancelled" },
    );
  }
  async function init(record: RunRecord): Promise<RunExecution> {
    if (record.checkpoint?.engineRef.kind === "delivery")
      return {
        async start() {
          throw new Error("A delivery decision requires a response.");
        },
        async resume({ data }) {
          const answer = data as { approved: boolean; reason?: string };
          return { kind: "delivery-decision", ...answer };
        },
        async cancel() {},
        async release() {},
      };

    return runtime.init(
      record,
      (event) => {
        enqueue(() => repository.log(record.view.id, event)).catch(
          () => undefined,
        );
      },
      (error) =>
        enqueue(async () => {
          const current = await get(record.view.id);
          if (current.view.stopReason || terminal(current.view.status)) return;
          await repository.save(
            {
              ...current,
              view: {
                ...current.view,
                status: "stopping",
                updatedAt: now(),
                stopReason: { kind: "error", error },
              },
            },
            [
              {
                type: "run.stopping",
                details: { reason: "error", code: error.code },
              },
            ],
          );
          await stopChildren(current);
        }),
      {
        id,
        now,
        bindEnvironment: (harness, bindings) =>
          enqueue(async () => {
            const current = await get(record.view.id);
            if (terminal(current.view.status)) return;
            await repository.save(
              {
                ...current,
                binding: {
                  ...current.binding,
                  bindings,
                  config: {
                    ...current.binding.config,
                    ...(harness ? { harness } : {}),
                  },
                },
                view: { ...current.view, ...(harness ? { harness } : {}) },
              },
              [],
            );
          }),
        recordEvent: (event) =>
          enqueue(() => repository.log(record.view.id, event)),
        outcomes: (scope) => outcomes.context(record, scope),
        child: async (callId, loom, input, scope) => {
          const owner = await get(record.view.id);
          const linked = owner.children?.find(
            (child) => child.callId === callId,
          );
          const ref = linked
            ? undefined
            : typeof loom === "function"
              ? await loom()
              : loom;
          const prepared = ref
            ? await runtime.prepare(ref, owner.binding.location.directory)
            : undefined;
          const normalized = prepared
            ? prepareInput(prepared, input)
            : undefined;
          const childId = await enqueue(async () => {
            const parent = await get(record.view.id);
            if (parent.view.status === "stopping")
              throw new IntloomError(
                "EXECUTION_CANCELLED",
                "Parent execution is stopping.",
              );
            const linked = parent.children?.find(
              (child) => child.callId === callId,
            );
            if (linked) return linked.childRunId;
            assert.ok(ref && normalized);
            const child = await create(ref, normalized, parent.view.id);
            await repository.save(
              {
                ...parent,
                view: { ...parent.view, updatedAt: child.view.createdAt },
                children: [
                  ...(parent.children ?? []),
                  { callId, childRunId: child.view.id },
                ],
              },
              [
                {
                  type: "child.created",
                  ...scope,
                  details: { childRunId: child.view.id, callId },
                },
              ],
              undefined,
              [child],
            );
            return child.view.id;
          });
          await operate(childId, () => start(childId));
          await active.get(childId)?.promise;
          return (await get(childId)).view;
        },
      },
    );
  }
  function dispatch(
    record: RunRecord,
    execution: RunExecution,
    wait?: WaitRecord,
  ) {
    const runId = record.view.id;
    if (wait) advancing.set(runId, wait.view.waitId);
    const promise = Promise.resolve()
      .then(() =>
        wait
          ? execution.resume({
              wait,
              checkpoint: record.checkpoint as NonNullable<
                RunRecord["checkpoint"]
              >,
              ...(wait.accepted?.data === undefined
                ? {}
                : { data: wait.accepted.data }),
            })
          : execution.start(record.input),
      )
      .then(async (result) => {
        const validationId =
          result.kind === "completed"
            ? await enqueue(async () =>
                (await get(runId)).view.stopReason
                  ? undefined
                  : startValidation(runId),
              )
            : undefined;
        const checked =
          result.kind === "completed" && validationId
            ? await validate(record, result.output, validationId)
            : undefined;
        return enqueue(async () => {
          const current = await get(runId);
          if (
            current.view.stopReason ||
            result.kind === "failed" ||
            result.kind === "cancelled"
          ) {
            if (checked) await repository.log(runId, checked.event);
            if (!current.view.stopReason && result.kind === "failed")
              await repository.save(
                {
                  ...current,
                  view: {
                    ...current.view,
                    status: "stopping",
                    updatedAt: now(),
                    stopReason: { kind: "error", error: result.error },
                  },
                },
                [
                  {
                    type: "run.stopping",
                    details: { reason: "error", code: result.error.code },
                  },
                ],
              );
            await stopChildren(await get(runId));
          } else {
            await boundary(current, result, checked);
            if (result.kind !== "waiting") queued.delete(runId);
          }
        });
      })
      .catch(async (error: unknown) => {
        if (
          error instanceof IntloomError &&
          error.code === "STORAGE_UNAVAILABLE"
        ) {
          // A root Run can recover an already persisted engine boundary after its store is restored.
          if (!record.view.parentRunId) return;
          try {
            await enqueue(async () => {
              await markStopped(runId);
              for (const [childId, running] of active)
                if (childId !== runId && wasStopped(childId))
                  await running.execution.cancel();
              let childId = runId;
              let parentId = record.view.parentRunId;
              while (parentId) {
                await markStopped(parentId);
                const parent = await get(parentId);
                if (!terminal(parent.view.status)) {
                  const failure = {
                    code: "CHILD_RUN_FAILED",
                    message: "The child Loom storage is unavailable.",
                    details: { childRunId: childId },
                  };
                  if (!parent.view.stopReason)
                    await repository.save(
                      {
                        ...parent,
                        view: {
                          ...parent.view,
                          status: "stopping",
                          updatedAt: now(),
                          stopReason: { kind: "error", error: failure },
                        },
                      },
                      [
                        {
                          type: "run.stopping",
                          details: { reason: "error", code: failure.code },
                        },
                      ],
                    );
                  await stopChildren(parent);
                  await active.get(parentId)?.execution.cancel();
                  await finishStopped(parentId);
                }
                childId = parentId;
                parentId = parent.view.parentRunId;
              }
            });
          } catch (failure) {
            if (
              !(failure instanceof IntloomError) ||
              failure.code !== "STORAGE_UNAVAILABLE"
            )
              fault =
                failure instanceof IntloomError
                  ? failure
                  : new IntloomError(
                      "STORAGE_FAILED",
                      "Cannot retain the affected Run stop requests.",
                    );
          }
          return;
        }
        fault =
          error instanceof IntloomError
            ? error
            : new IntloomError(
                "STORAGE_FAILED",
                "Execution settlement could not be persisted.",
              );
      })
      .finally(async () => {
        await execution.release();
        active.delete(runId);
        advancing.delete(runId);
        if (!fault) {
          try {
            const continuations = await enqueue(async () => {
              const next: {
                runId: string;
                waitId: string;
                operation?: RunOperation;
              }[] = [];
              await finishStopped(runId);
              const current = await get(runId);
              if (current.view.status === "waiting" && !closing) {
                const pending = queued.get(runId)?.entries().next().value;
                if (pending) {
                  queued.get(runId)?.delete(pending[0]);
                  next.push({
                    runId,
                    waitId: pending[0],
                    operation: pending[1],
                  });
                }
              }
              if (current.view.parentRunId) {
                await finishStopped(current.view.parentRunId);
                const parent = await get(current.view.parentRunId);
                if (
                  !closing &&
                  terminal(current.view.status) &&
                  parent.view.status === "waiting"
                ) {
                  const target = parent.waits?.find(
                    (wait) => !wait.consumed && wait.view.childRunId === runId,
                  );
                  if (target)
                    next.push({
                      runId: parent.view.id,
                      waitId: target.view.waitId,
                    });
                }
              }
              return next;
            });
            for (const next of continuations)
              await operate(next.runId, () =>
                advance(next.runId, next.waitId, next.operation),
              );
          } catch (error) {
            if (
              !(error instanceof IntloomError) ||
              error.code !== "STORAGE_UNAVAILABLE"
            )
              throw error;
          }
        }
      });
    active.set(runId, {
      execution,
      promise,
      directory: record.binding.location.dataDir,
    });
  }
  async function start(runId: string): Promise<RunControlReceipt> {
    const record = await get(runId);
    if (record.view.status !== "created")
      return { run: record.view, operation: "start", disposition: "no_change" };
    let execution: RunExecution;
    try {
      execution = await init(record);
    } catch (cause) {
      // Keep a compiled Run available when its pinned environment can be restored.
      if (
        !record.binding.config.command &&
        !(cause instanceof IntloomError && cause.code === "INPUT_FILE_MISSING")
      )
        throw cause;
      const error =
        cause instanceof IntloomError
          ? cause
          : new IntloomError(
              "EXECUTION_FAILED",
              "The command's startup check failed.",
            );
      return enqueue(async () => {
        const current = await get(runId);
        if (current.view.status !== "created")
          return {
            run: current.view,
            operation: "start",
            disposition: "no_change",
          };
        await boundary(current, { kind: "failed", error: error.toJSON() });
        throw error;
      });
    }
    let dispatched = false;
    try {
      return await enqueue(async () => {
        const current = await get(runId);
        if (current.view.status !== "created")
          return {
            run: current.view,
            operation: "start",
            disposition: "no_change",
          };
        const time = now();
        const running: RunRecord = {
          ...current,
          view: {
            ...current.view,
            status: "running",
            startedAt: time,
            updatedAt: time,
          },
        };
        await repository.save(running, [{ type: "run.started" }], {
          id: id(),
          runId,
          operation: "start",
          time,
        });
        dispatch(running, execution);
        dispatched = true;
        return {
          run: structuredClone(running.view),
          operation: "start",
          disposition: "accepted",
        };
      });
    } finally {
      if (!dispatched) await execution.release();
    }
  }
  async function advance(
    runId: string,
    waitId: string,
    operation?: RunOperation,
  ): Promise<RunControlReceipt> {
    const selection = await enqueue(async () => {
      let record = await get(runId);
      const wait = record.waits?.find(({ view }) => view.waitId === waitId);
      if (!wait)
        throw new IntloomError(
          "WAIT_TARGET_INVALID",
          "The Run has no matching wait.",
        );
      if (record.view.status === "interrupted")
        throw new IntloomError(
          "RUN_STATE_INVALID",
          "Interrupted executions cannot be replayed.",
        );
      if (wait.consumed)
        return {
          receipt: {
            run: record.view,
            operation: "resume" as const,
            disposition: "no_change" as const,
          },
        };
      if (terminal(record.view.status) || record.view.status === "stopping")
        throw new IntloomError(
          "RUN_STATE_INVALID",
          "The Run cannot be resumed.",
        );
      if (wait.view.kind === "child") {
        const child = await get(wait.view.childRunId as string);
        if (!terminal(child.view.status))
          throw new IntloomError(
            "WAIT_TARGET_INVALID",
            "The child Run has not completed.",
          );
        if (
          child.view.status !== "succeeded" ||
          child.view.deliveryStatus === "rejected"
        ) {
          const error = {
            code: "CHILD_RUN_FAILED",
            message: "The child Loom did not complete successfully.",
            details: { childRunId: child.view.id },
          };
          await repository.save(
            {
              ...record,
              view: {
                ...record.view,
                status: "stopping",
                updatedAt: now(),
                stopReason: { kind: "error", error },
              },
            },
            [
              {
                type: "run.stopping",
                details: { reason: "error", code: error.code },
              },
            ],
          );
          await stopChildren(record);
          await finishStopped(runId);
          return {
            receipt: {
              run: (await get(runId)).view,
              operation: "resume" as const,
              disposition: "accepted" as const,
            },
          };
        }
      }
      if (wait.view.kind !== "child" && !wait.accepted)
        throw new IntloomError(
          "WAIT_TARGET_INVALID",
          "The wait has no accepted response.",
        );
      const interaction = record.interactions?.find(
        ({ request }) => request.id === wait.view.requestId,
      );
      const source: ResponseSource = interaction?.responses.find(
        (response) => response.id === interaction.request.answerResponseId,
      )?.source ?? { kind: "program", via: "api" };
      if (active.has(runId)) {
        const pending = queued.get(runId) ?? new Map<string, RunOperation>();
        if (pending.has(waitId) || advancing.get(runId) === waitId)
          throw new IntloomError(
            "RUN_STATE_INVALID",
            "A continuation for this wait has already been accepted.",
          );
        const accepted: RunOperation = {
          id: id(),
          runId,
          operation: "resume",
          source,
          waitId,
          time: now(),
          ...(record.checkpoint ? { checkpointId: record.checkpoint.id } : {}),
        };
        record = {
          ...record,
          view: { ...record.view, updatedAt: accepted.time },
        };
        await repository.save(
          record,
          [{ type: "run.resume.requested", details: { waitId } }],
          accepted,
        );
        pending.set(waitId, accepted);
        queued.set(runId, pending);
        return {
          receipt: {
            run: record.view,
            operation: "resume" as const,
            disposition: "accepted" as const,
          },
        };
      }
      return { record, wait, source };
    });
    if (selection.receipt) return selection.receipt;
    const { record, wait, source } = selection;
    let execution: RunExecution;
    try {
      execution = await init(record);
    } catch (error) {
      await enqueue(async () => {
        const current = await get(runId);
        if (current.view.status === "waiting")
          await repository.save(
            {
              ...current,
              view: {
                ...current.view,
                updatedAt: now(),
                recoveryIssue: diagnostic(error),
              },
            },
            [{ type: "run.recovery.changed" }],
          );
      });
      throw error;
    }
    let dispatched = false;
    try {
      return await enqueue(async () => {
        const current = await get(runId);
        if (terminal(current.view.status) || current.view.status === "stopping")
          throw new IntloomError(
            "RUN_STATE_INVALID",
            "The Run cannot be resumed.",
          );
        const time = now();
        const { recoveryIssue: _, ...view } = current.view;
        assert.ok(current.checkpoint);
        const requestId = wait.request?.id;
        const responseId =
          requestId &&
          current.interactions?.find(({ request }) => request.id === requestId)
            ?.request.answerResponseId;
        const running: RunRecord = {
          ...current,
          view: { ...view, status: "running", updatedAt: time },
        };
        await repository.save(
          running,
          [
            {
              type: "run.resumed",
              ...(operation ? { operationId: operation.id } : {}),
              details: { waitId },
            },
          ],
          operation
            ? undefined
            : {
                id: id(),
                runId,
                operation: "resume",
                source,
                waitId,
                time,
                checkpointId: current.checkpoint.id,
                ...(responseId && { responseId }),
              },
        );
        dispatch(running, execution, wait);
        dispatched = true;
        return {
          run: structuredClone(running.view),
          operation: "resume",
          disposition: "accepted",
        };
      });
    } finally {
      if (!dispatched) await execution.release();
    }
  }
  async function cancel(
    runId: string,
    reason?: string,
  ): Promise<RunControlReceipt> {
    if (!wasStopped(runId)) await markStopped(runId);
    const record = await get(runId);
    if (terminal(record.view.status) || record.view.status === "stopping")
      return {
        run: record.view,
        operation: "cancel",
        disposition: "no_change",
      };
    const time = now();
    const view: RunView = {
      ...record.view,
      status: "stopping",
      updatedAt: time,
      stopReason: {
        kind: "cancel",
        ...(reason === undefined ? {} : { message: reason }),
      },
    };
    const stoppingWithActivity =
      active.has(runId) ||
      (
        await Promise.all(
          (record.children ?? []).map(async ({ childRunId }) => {
            try {
              return ["running", "stopping"].includes(
                (await get(childRunId)).view.status,
              );
            } catch (error) {
              if (
                error instanceof IntloomError &&
                error.code === "STORAGE_UNAVAILABLE"
              )
                return false;
              throw error;
            }
          }),
        )
      ).some(Boolean);
    await repository.save(
      { ...record, view, stoppingWithActivity },
      [{ type: "run.stopping", details: { reason: "cancel" } }],
      {
        id: id(),
        runId,
        operation: "cancel",
        time,
        ...(reason === undefined ? {} : { reason }),
      },
    );
    queued.delete(runId);
    await stopChildren(record);
    await active.get(runId)?.execution.cancel();
    await finishStopped(runId);
    return {
      run: (await get(runId)).view,
      operation: "cancel",
      disposition: "accepted",
    };
  }
  if (dependencies.recoverUpgrade) {
    for (const record of await repository.listUnfinished()) {
      if (record.view.status !== "waiting" || record.view.recoveryIssue)
        continue;
      for (const wait of record.waits ?? []) {
        if (wait.consumed) continue;
        try {
          const child = wait.view.childRunId;
          if (
            !wait.accepted &&
            !(child && terminal((await get(child)).view.status))
          )
            continue;
          await operate(record.view.id, () =>
            advance(record.view.id, wait.view.waitId),
          );
        } catch (error) {
          await enqueue(async () => {
            const current = await get(record.view.id);
            if (!terminal(current.view.status) && !current.view.recoveryIssue)
              await repository.save(
                {
                  ...current,
                  view: {
                    ...current.view,
                    updatedAt: now(),
                    recoveryIssue: diagnostic(error),
                  },
                },
                [{ type: "run.recovery.changed" }],
              );
          });
          break;
        }
      }
    }
  }
  return {
    createRun(options: {
      loom: InstalledLoomRef;
      input: unknown;
      projectDir?: string;
      inputFiles?: readonly string[];
      confirmDelivery?: boolean;
    }): Promise<RunView> {
      accepting();
      return track(
        (async () => {
          const prepared = await runtime.prepare(
            options.loom,
            options.projectDir,
          );
          const normalized = prepareInput(
            prepared,
            options.input,
            options.inputFiles,
          );
          if (options.confirmDelivery) {
            if (!prepared.binding.config.command)
              throw new IntloomError(
                "INPUT_INVALID",
                "Final file confirmation requires an npm Loom command.",
              );
            normalized.binding = {
              ...normalized.binding,
              config: { ...normalized.binding.config, confirmDelivery: true },
            };
          }
          return enqueue(async () => {
            const record = await create(options.loom, normalized);
            await repository.save(record, [{ type: "run.created" }]);
            return structuredClone(record.view);
          });
        })(),
      );
    },
    startRun(runId: string) {
      accepting();
      return operate(runId, () => start(runId));
    },
    cancelRun(runId: string, reason?: string) {
      healthy();
      return enqueue(() => cancel(runId, reason));
    },
    resumeRun(options: ResumeRunOptions) {
      accepting();
      return operate(options.runId, async () => {
        const record = await get(options.runId);
        const wait = record.waits?.find(({ view }) =>
          "requestId" in options
            ? view.requestId === options.requestId
            : view.waitId === options.waitId,
        );
        if (!wait)
          throw new IntloomError(
            "WAIT_TARGET_INVALID",
            "The specified wait was not found in this Run.",
          );
        if ("waitId" in options) {
          if (wait.view.kind === "interaction")
            throw new IntloomError(
              "INVALID_ARGUMENT",
              "Interaction waits must be resumed using their request ID.",
            );
          if (wait.view.kind === "child" && "resumeData" in options)
            throw new IntloomError(
              "INVALID_ARGUMENT",
              "Child results cannot be supplied externally.",
            );
          if (wait.view.kind === "external" && !wait.consumed) {
            if (wait.accepted && "resumeData" in options)
              throw new IntloomError(
                "WAIT_TARGET_INVALID",
                "Previously accepted resume data cannot be replaced.",
              );
            if (!wait.accepted) {
              if (!["waiting", "running"].includes(record.view.status))
                throw new IntloomError(
                  "RUN_STATE_INVALID",
                  "This Run cannot accept resume data.",
                );
              const data = await runtime.normalizeResume(
                record,
                wait,
                options.resumeData,
              );
              await enqueue(async () => {
                const current = await get(options.runId);
                if (!["waiting", "running"].includes(current.view.status))
                  throw new IntloomError(
                    "RUN_STATE_INVALID",
                    "This Run cannot accept resume data.",
                  );
                assert.ok(current.waits);
                await repository.save(
                  {
                    ...current,
                    view: { ...current.view, updatedAt: now() },
                    waits: current.waits.map((item) =>
                      item.view.waitId === wait.view.waitId
                        ? {
                            ...item,
                            accepted: data === undefined ? {} : { data },
                          }
                        : item,
                    ),
                  },
                  [
                    {
                      type: "wait.accepted",
                      details: {
                        waitId: wait.view.waitId,
                        source: { kind: "program", via: "api" },
                      },
                    },
                  ],
                );
              });
            }
          }
        }
        return advance(record.view.id, wait.view.waitId);
      });
    },
    async listInteractions(options: {
      runId: string;
      status?: InteractionRequest["status"];
    }) {
      healthy();
      const requests: InteractionRequest[] = [];
      const ids = [options.runId];
      for (let id = ids.pop(); id !== undefined; id = ids.pop()) {
        const record = await get(id);
        for (const item of record.interactions ?? []) {
          if (!options.status || item.request.status === options.status)
            requests.push(item.request);
        }
        if (options.status === "pending")
          for (const child of record.children ?? []) ids.push(child.childRunId);
      }
      return requests;
    },
    async getInteraction(requestId: string) {
      healthy();
      return (await findInteraction(repository, requestId)).interaction;
    },
    respondInteraction(
      requestId: string,
      response: InteractionResponse,
      caller: { source: ResponseSource },
    ): Promise<InteractionReceipt> {
      accepting();
      return track(
        (async () => {
          const { record } = await findInteraction(repository, requestId);
          return operate(record.view.id, async () => {
            const { receipt, resumeWaitId } = await recordResponse(
              dependencies,
              requestId,
              response,
              caller.source,
              enqueue,
            );
            if (resumeWaitId === undefined)
              return { ...receipt, continuation: { status: "not_requested" } };
            try {
              await advance(receipt.runId, resumeWaitId);
              return { ...receipt, continuation: { status: "requested" } };
            } catch (error) {
              return {
                ...receipt,
                continuation: {
                  status: "needs_attention",
                  message: diagnostic(error).message,
                },
              };
            }
          });
        })(),
      );
    },
    async getRun(runId: string) {
      healthy();
      return (await get(runId)).view;
    },
    async listRuns(options: RunListQuery) {
      healthy();
      return repository.listViews(options);
    },
    async getRunResult(runId: string): Promise<RunResult> {
      healthy();
      const { view, binding, result } = await get(runId);
      return {
        runId,
        runStatus: view.status,
        quality: "not_requested",
        ...(view.status === "succeeded" ? { output: view.output } : {}),
        ...(binding.outcome ? { outcome: binding.outcome } : {}),
        ...result,
        ...(view.error ? { error: view.error } : {}),
      };
    },
    async getActivitySnapshot(runId: string) {
      healthy();
      const snapshot = await repository.snapshot(runId);
      if (!snapshot)
        throw new IntloomError("RUN_NOT_FOUND", "Run was not found.", {
          runId,
        });
      return snapshot;
    },
    async listRunEvents(runId: string, after = 0, limit = -1) {
      healthy();
      await get(runId);
      return repository.events(runId, after, limit);
    },
    async close(cancelRuns = false) {
      closing = true;
      while (preparations.size) await Promise.allSettled([...preparations]);
      if (cancelRuns)
        await enqueue(async () => {
          await markStopped();
          for (const record of await repository.listUnfinished()) {
            if (terminal(record.view.status)) continue;
            try {
              await cancel(record.view.id, "Intloom service shutdown.");
            } catch (error) {
              if (
                !(error instanceof IntloomError) ||
                error.code !== "STORAGE_UNAVAILABLE"
              )
                throw error;
            }
          }
          for (const { execution } of active.values()) await execution.cancel();
        });
      await tail;
      while (active.size || preparations.size) {
        await Promise.allSettled([...preparations]);
        await Promise.all([...active.values()].map(({ promise }) => promise));
      }
      await tail;
      healthy();
    },
    get activeRunCount() {
      return active.size;
    },
  };
}
