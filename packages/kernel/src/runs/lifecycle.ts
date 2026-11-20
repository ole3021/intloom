import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  askSubmissionSchema,
  executionResultSchema,
  ExecutionCancelledError,
  type AskSubmission,
  type ExecutionResult,
  type KeyValueStorage,
  type JsonValue,
  type RunResult,
} from "@intloom/loom-sdk";
import { z } from "zod";
import type { KernelData } from "../data.ts";
import {
  completeExecutionSchema,
  type CompleteExecution,
} from "../executions/contracts.ts";
import {
  launchExecution,
  type ExecutionProcess,
} from "../executions/process.ts";
import { errorMessage, type Operation } from "../executions/protocol.ts";
import type { Installation } from "../installations/contracts.ts";
import { Authorization } from "../tools/authorization.ts";
import { createToolScope, type ToolScope } from "../tools/scope.ts";
import type { CleanupFailure } from "../tools/fs.ts";
import type { SubmissionResult } from "../tools/interactions.ts";
import {
  authorizationAnswerSchema,
  interactionSchema,
  type AuthorizationAnswer,
  type AuthorizationRequest,
  type RunInteraction,
  type RunProcess,
  type RunRecord,
} from "./contracts.ts";
import type { RunRecords } from "./records.ts";
import { collectOutputs } from "./outputs.ts";

const callSchema = z.strictObject({
  executionId: z.uuid(),
  input: z.unknown(),
});
const submissionResultSchema = z.union([
  z.strictObject({ status: z.literal("accepted") }),
  z.strictObject({
    status: z.literal("pending"),
    interaction: interactionSchema,
  }),
]);

export async function finalizeRun(
  data: KernelData,
  records: RunRecords,
  runId: string,
  installation: Installation,
  conclusion: ExecutionResult,
  failures: readonly CleanupFailure[] = [],
): Promise<RunResult> {
  records.update(
    runId,
    { phase: "finalizing" },
    { type: "phase", data: { phase: "finalizing" } },
  );
  const cleanupFailures = [...failures];
  const run = records.require(runId);
  try {
    await rm(run.tempDir, { recursive: true, force: true });
  } catch (error) {
    cleanupFailures.push({ path: run.tempDir, message: errorMessage(error) });
  }
  const execution: ExecutionResult =
    conclusion.status === "succeeded" && cleanupFailures.length
      ? { status: "failed", reason: "Run finalization failed" }
      : conclusion;
  let cursor: string | undefined;
  do {
    const page = await data.listExecutions({
      runId,
      ...(cursor ? { cursor } : {}),
    });
    for (const record of page.entries) {
      if (!record.completion)
        await data.completeExecution(record.executionId, {
          result:
            execution.status === "succeeded"
              ? {
                  status: "failed",
                  reason:
                    "Execution process exited before recording completion",
                }
              : execution,
        });
    }
    cursor = page.nextCursor;
  } while (cursor);
  for (const interaction of records.require(runId).interactions) {
    if (interaction.status === "pending" || interaction.status === "deferred")
      records.interaction(runId, {
        ...interaction,
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      });
  }
  const result = await collectOutputs(run, installation.manifest, execution);
  records.update(
    runId,
    { phase: "finished", result, cleanupFailures, processes: [] },
    { type: "finished", data: result },
  );
  return result;
}

export class RunLifecycle {
  readonly done: Promise<RunResult>;
  readonly #controller = new AbortController();
  readonly #scopes = new Map<string, { scope: ToolScope; parentId?: string }>();
  readonly #pending = new Set<Promise<unknown>>();
  readonly #authorizations = new Map<
    string,
    { resolve: (answer: AuthorizationAnswer) => void }
  >();
  readonly #authorization: Authorization;
  #process: ExecutionProcess | undefined;
  #completion: CompleteExecution | undefined;
  #cancelReason: string | undefined;

  constructor(
    private readonly data: KernelData,
    private readonly records: RunRecords,
    private readonly initial: RunRecord,
    private readonly installation: Installation,
    private readonly options: {
      nodePath: string;
      env: Readonly<Record<string, string>>;
      cancellationGraceMs: number;
    },
  ) {
    this.#authorization = new Authorization({
      dataDir: data.dataDir,
      workDir: initial.workDir,
      tempDir: initial.tempDir,
      installationDir: installation.directory,
      input: initial.input,
      ask: (executionId, request, signal) =>
        this.authorize(executionId, request, signal),
    });
    this.done = this.execute();
    void this.done.catch(() => {});
  }

  private track<T>(promise: Promise<T>): Promise<T> {
    this.#pending.add(promise);
    void promise.then(
      () => this.#pending.delete(promise),
      () => this.#pending.delete(promise),
    );
    return promise;
  }

  private processFact(process: RunProcess, active: boolean) {
    const run = this.records.require(this.initial.runId);
    const others = run.processes.filter((item) => item.pid !== process.pid);
    this.records.update(
      run.runId,
      { processes: active ? [...others, process] : others },
      {
        type: "process",
        data: { process, active },
      },
    );
  }

  private scope(executionId: string, parentId?: string) {
    let entry = this.#scopes.get(executionId);
    if (!entry) {
      const scope = createToolScope({
        tempDir: this.initial.tempDir,
        signal: this.#controller.signal,
        env: this.options.env,
        authorizePath: (path, operation, followFinal) =>
          this.#authorization.path(
            executionId,
            path,
            operation,
            scope.signal,
            followFinal,
          ),
        authorizeCommand: (input) =>
          this.#authorization.command(executionId, input, scope.signal),
        onProcess: (pid, active) =>
          this.processFact({ pid, kind: "command" }, active),
      });
      entry = { scope, ...(parentId ? { parentId } : {}) };
      this.#scopes.set(executionId, entry);
    }
    return entry.scope;
  }

  private async authorize(
    executionId: string,
    request: AuthorizationRequest,
    signal: AbortSignal,
  ): Promise<AuthorizationAnswer> {
    signal.throwIfAborted();
    const id = randomUUID();
    const at = new Date().toISOString();
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.#authorizations.delete(id);
        reject(signal.reason);
      };
      this.#authorizations.set(id, {
        resolve: (answer) => {
          signal.removeEventListener("abort", abort);
          this.#authorizations.delete(id);
          resolve(answer);
        },
      });
      signal.addEventListener("abort", abort, { once: true });
      try {
        this.records.interaction(this.initial.runId, {
          id,
          executionId,
          createdAt: at,
          updatedAt: at,
          status: "pending",
          kind: "authorization",
          request,
        });
      } catch (error) {
        signal.removeEventListener("abort", abort);
        this.#authorizations.delete(id);
        reject(error);
      }
    });
  }

  submitAnswer(id: string, raw: unknown): Promise<SubmissionResult> {
    return this.track(
      (async () => {
        const run = this.records.require(this.initial.runId);
        const interaction = run.interactions.find((item) => item.id === id);
        if (
          !interaction ||
          !["pending", "deferred"].includes(interaction.status)
        )
          throw new Error(`No pending interaction '${id}'`);
        let answer: AskSubmission | AuthorizationAnswer;
        let result: SubmissionResult;
        if (interaction.kind === "authorization") {
          answer = authorizationAnswerSchema.parse(raw);
          const pending = this.#authorizations.get(id);
          if (!pending) throw new Error("Authorization is no longer pending");
          result = { status: "accepted" };
          this.records.interaction(run.runId, {
            ...interaction,
            status: "answered",
            updatedAt: new Date().toISOString(),
          });
          this.records.update(
            run.runId,
            {},
            { type: "answer", data: { id, answer, result } },
          );
          pending.resolve(answer);
        } else {
          answer = askSubmissionSchema.parse(raw);
          if (!this.#process)
            throw new Error("Execution process is not available");
          result = submissionResultSchema.parse(
            await this.#process.peer.request("answer", { id, answer }),
          ) as SubmissionResult;
          if (result.status === "accepted") {
            this.records.interaction(run.runId, {
              ...interaction,
              status: answer.status === "skipped" ? "skipped" : "answered",
              updatedAt: new Date().toISOString(),
            });
          }
          this.records.update(
            run.runId,
            {},
            { type: "answer", data: { id, answer, result } },
          );
        }
        return result;
      })(),
    );
  }

  cancel(reason = "Run cancelled"): void {
    const { phase } = this.records.require(this.initial.runId);
    if (this.#cancelReason || phase === "finalizing" || phase === "finished")
      return;
    this.records.update(
      this.initial.runId,
      { phase: "cancelling" },
      { type: "phase", data: { phase: "cancelling" } },
    );
    this.#cancelReason = reason;
    this.#controller.abort(new ExecutionCancelledError(reason));
    this.#process?.cancel(reason, this.options.cancellationGraceMs);
  }

  private async stopExecution(executionId: string, reason: string) {
    const ids = new Set([executionId]);
    for (const [id, entry] of this.#scopes) {
      if (entry.parentId && ids.has(entry.parentId)) ids.add(id);
    }
    await Promise.all(
      [...ids].map(async (id) => {
        const scope = this.#scopes.get(id)?.scope;
        scope?.cancel(reason);
        await scope?.close();
      }),
    );
  }

  private async handle(
    operation: Operation,
    raw: unknown,
    store: KeyValueStorage,
    entryId: string,
  ): Promise<unknown> {
    const { runId } = this.initial;
    if (operation === "ready") {
      const run = this.records.require(runId);
      return {
        runId,
        executionId: entryId,
        module: join(
          this.installation.directory,
          this.installation.packagePath,
          this.installation.manifest.entry.module,
        ),
        export: this.installation.manifest.entry.export,
        scope: run.scope,
        workDir: run.workDir,
        tempDir: run.tempDir,
        input: run.input,
      };
    }
    if (operation === "done") {
      this.#completion = completeExecutionSchema.parse(
        raw,
      ) as CompleteExecution;
      return;
    }
    if (operation === "exec.create") {
      const input = z
        .strictObject({ parentId: z.uuid(), input: z.unknown().optional() })
        .parse(raw);
      const parent = this.#scopes.get(input.parentId);
      if (!parent) throw new Error("Unknown parent execution");
      parent.scope.signal.throwIfAborted();
      const record = await this.data.createExecution({
        parentId: input.parentId,
        package: this.initial.package,
        kind: "code",
        ...(input.input === undefined ? {} : { input: input.input as never }),
      });
      this.scope(record.executionId, input.parentId);
      this.records.update(
        runId,
        {},
        {
          type: "execution",
          data: { executionId: record.executionId, action: "created" },
        },
      );
      return record;
    }
    if (operation === "exec.complete") {
      const { executionId, completion } = z
        .strictObject({
          executionId: z.uuid(),
          completion: completeExecutionSchema,
        })
        .parse(raw);
      if (!this.#scopes.has(executionId)) throw new Error("Unknown execution");
      await this.data.completeExecution(
        executionId,
        completion as CompleteExecution,
      );
      this.records.update(
        runId,
        {},
        { type: "execution", data: { executionId, action: "completed" } },
      );
      return;
    }
    if (operation === "exec.stop") {
      const { executionId, result } = z
        .strictObject({ executionId: z.uuid(), result: executionResultSchema })
        .parse(raw);
      if (result.status === "succeeded")
        throw new Error("Stopping requires an unsuccessful result");
      if (executionId === entryId) {
        this.#completion ??= { result };
        this.#process?.cancel(result.reason, this.options.cancellationGraceMs);
      }
      return this.stopExecution(executionId, result.reason);
    }
    if (operation === "interaction.update") {
      const { executionId, interaction } = z
        .strictObject({ executionId: z.uuid(), interaction: interactionSchema })
        .parse(raw);
      const scope = this.#scopes.get(executionId)?.scope;
      if (!scope) throw new Error("Unknown execution");
      scope.signal.throwIfAborted();
      const previous = this.records
        .require(runId)
        .interactions.find((item) => item.id === interaction.id);
      const at = new Date().toISOString();
      const record: RunInteraction = {
        ...interaction,
        kind: "question",
        executionId,
        createdAt: previous?.createdAt ?? at,
        updatedAt: at,
      };
      this.records.interaction(runId, record);
      return;
    }
    const { executionId, input } = callSchema.parse(raw);
    const scope = this.#scopes.get(executionId)?.scope;
    if (!scope) throw new Error("Unknown execution");
    scope.signal.throwIfAborted();
    if (operation.startsWith("fs.")) {
      const name = operation.slice(3) as keyof ToolScope["fs"];
      return scope.fs[name](input as never);
    }
    if (operation === "process.run") return scope.process.run(input as never);
    if (operation === "store.list") return store.list(input as never);
    const item = z
      .strictObject({ key: z.string(), value: z.unknown().optional() })
      .parse(input);
    if (operation === "store.get") return store.get(item.key);
    if (operation === "store.delete") return store.delete(item.key);
    if (operation === "store.set")
      return store.set(item.key, item.value as never);
    throw new Error(`Unexpected execution request: ${operation}`);
  }

  private async execute(): Promise<RunResult> {
    const { runId } = this.initial;
    let conclusion: ExecutionResult;
    try {
      await mkdir(this.initial.tempDir, { recursive: true });
      if (this.initial.scope === "intloom")
        await mkdir(this.initial.workDir, { recursive: true });
      const store = await this.data.getStore(this.initial.package.name);
      this.#controller.signal.throwIfAborted();
      const entry = await this.data.createExecution({
        package: this.initial.package,
        kind: "code",
        mode: "run",
        runId,
        input: this.initial.input as JsonValue,
      });
      this.scope(entry.executionId);
      this.records.update(
        runId,
        { entryExecutionId: entry.executionId },
        {
          type: "execution",
          data: { executionId: entry.executionId, action: "created" },
        },
      );
      this.#process = await launchExecution({
        nodePath: this.options.nodePath,
        installationDir: this.installation.directory,
        workDir: this.initial.workDir,
        env: this.options.env,
        handle: (operation, data) =>
          this.track(this.handle(operation, data, store, entry.executionId)),
        onProcess: (pid, active) =>
          this.processFact({ pid, kind: "execution" }, active),
      });
      if (this.#cancelReason)
        this.#process.cancel(
          this.#cancelReason,
          this.options.cancellationGraceMs,
        );
      else
        this.records.update(
          runId,
          { phase: "running" },
          { type: "phase", data: { phase: "running" } },
        );
      const exit = await this.#process.done;
      conclusion =
        this.#completion && this.#completion.result.status !== "succeeded"
          ? this.#completion.result
          : exit.error
            ? { status: "failed", reason: exit.error.message }
            : (this.#completion?.result ?? {
                status: "failed",
                reason: "Execution process exited without a result",
              });
    } catch (error) {
      conclusion = {
        status: "failed",
        reason: errorMessage(error) || "Run preparation failed",
      };
      if (this.#process) {
        this.#process.cancel("Run preparation failed", 0);
        await this.#process.done;
      }
    }
    if (this.#cancelReason)
      conclusion = { status: "cancelled", reason: this.#cancelReason };
    this.#controller.abort(
      new ExecutionCancelledError("Execution activities stopped"),
    );
    const failures = (
      await Promise.all(
        [...this.#scopes.values()].map(({ scope }) => scope.close()),
      )
    ).flat();
    while (this.#pending.size) await Promise.allSettled(this.#pending);
    return finalizeRun(
      this.data,
      this.records,
      runId,
      this.installation,
      conclusion,
      failures,
    );
  }
}
