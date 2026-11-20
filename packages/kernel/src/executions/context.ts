import { resolve } from "node:path";
import {
  ExecutionCancelledError,
  ExecutionRejectedError,
  getExecKind,
  rejectInputSchema,
  type CodeContext,
  type CodeTools,
  type ExecutionResult,
  type JsonValue,
} from "@intloom/loom-sdk";
import { z } from "zod";
import { jsonText } from "../persistence/json.ts";
import { Interactions } from "../tools/interactions.ts";
import {
  errorMessage,
  type Peer,
  type ProcessBinding,
  type Operation,
} from "./protocol.ts";
import type { ExecutionRecord, CompleteExecution } from "./contracts.ts";

export function executionContext(peer: Peer, binding: ProcessBinding) {
  const runController = new AbortController();
  const questions = new Map<string, Interactions>();
  let unhandled: unknown;
  function fail(error: unknown) {
    unhandled ??= error;
    runController.abort(error);
    void peer
      .request("exec.stop", {
        executionId: binding.executionId,
        result: {
          status:
            error instanceof ExecutionRejectedError ? "rejected" : "failed",
          reason: errorMessage(error) || "Unhandled execution failure",
        },
      })
      .catch(() => {});
  }

  async function invoke(
    target: unknown,
    input: unknown,
    parentSignal: AbortSignal,
    parentId?: string,
    entryId?: string,
  ): Promise<unknown> {
    parentSignal.throwIfAborted();
    const kind = getExecKind(target);
    if (kind !== "code")
      throw new Error("This runtime executes Code targets only");
    const valueInput =
      input === undefined
        ? {}
        : { input: JSON.parse(jsonText(input)) as JsonValue };
    const executionId =
      entryId ??
      (
        await peer.request<ExecutionRecord>("exec.create", {
          parentId,
          ...valueInput,
        })
      ).executionId;
    const controller = new AbortController();
    const abort = () => controller.abort(parentSignal.reason);
    parentSignal.addEventListener("abort", abort, { once: true });
    if (parentSignal.aborted) abort();
    const pending = new Set<Promise<unknown>>();
    function track<T>(promise: Promise<T>): Promise<T> {
      pending.add(promise);
      // The outward Promise keeps Node's unhandled-rejection semantics for ignored calls.
      return new Promise<T>((resolve, reject) => {
        void promise.then(
          (value) => {
            pending.delete(promise);
            resolve(value);
          },
          (error: unknown) => {
            pending.delete(promise);
            reject(error);
          },
        );
      });
    }
    async function drain() {
      do {
        await Promise.allSettled(pending);
        await new Promise<void>((resolve) => setImmediate(resolve));
      } while (pending.size);
    }
    const interactions = new Interactions(controller.signal, (interaction) => {
      questions.set(interaction.id, interactions);
      void track(
        peer.request("interaction.update", { executionId, interaction }),
      ).catch(fail);
    });
    const call = <T>(operation: Operation, data: unknown) => {
      controller.signal.throwIfAborted();
      return track(peer.request<T>(operation, { executionId, input: data }));
    };
    const pathInput = <T extends { readonly path: string }>(input: T): T => ({
      ...input,
      path: resolve(binding.workDir, input.path),
    });
    const context: CodeContext = {
      mode: "run",
      runId: binding.runId,
      scope: binding.scope,
      workDir: binding.workDir,
      tempDir: binding.tempDir,
      signal: controller.signal,
      reject(input): never {
        controller.signal.throwIfAborted();
        throw new ExecutionRejectedError(rejectInputSchema.parse(input).reason);
      },
      fs: {
        read: (input) => call("fs.read", pathInput(input)),
        write: (input) => call("fs.write", pathInput(input)),
        mkdir: (input) => call("fs.mkdir", pathInput(input)),
        stat: (input) => call("fs.stat", pathInput(input)),
        list: (input) => call("fs.list", pathInput(input)),
        remove: (input) => call("fs.remove", pathInput(input)),
        mkdtemp: (input) =>
          call("fs.mkdtemp", {
            ...input,
            directory: resolve(binding.workDir, input.directory),
          }),
      },
      process: {
        run: (input) =>
          call("process.run", {
            ...input,
            cwd: resolve(binding.workDir, input.cwd),
          }),
      },
      store: {
        get: (key) => call("store.get", { key }),
        set: (key, value) => call("store.set", { key, value }),
        delete: (key) => call("store.delete", { key }),
        list: (options = {}) => call("store.list", options),
      },
      user: {
        ask: ((input) =>
          track(interactions.user.ask(input))) as CodeTools["user"]["ask"],
      },
      exec: ((target, input) =>
        track(
          invoke(target, input, controller.signal, executionId),
        )) as CodeTools["exec"],
    };
    let value: unknown;
    let error: unknown;
    let conclusion: ExecutionResult = { status: "succeeded" };
    try {
      value = await (
        target as (input: unknown, context: CodeContext) => Promise<unknown>
      )(input, context);
      if (value !== undefined) jsonText(value);
      await drain();
      if (unhandled !== undefined) throw unhandled;
      controller.signal.throwIfAborted();
    } catch (cause) {
      error = cause;
      conclusion = {
        status:
          cause instanceof ExecutionRejectedError
            ? "rejected"
            : cause instanceof ExecutionCancelledError
              ? "cancelled"
              : "failed",
        reason: errorMessage(cause) || "Execution failed",
      };
      controller.abort(cause);
      await peer.request("exec.stop", {
        executionId,
        result: conclusion,
      });
      await drain();
    } finally {
      parentSignal.removeEventListener("abort", abort);
    }
    const completion: CompleteExecution = {
      result: conclusion,
      ...(conclusion.status === "succeeded" && value !== undefined
        ? { value: value as JsonValue }
        : {}),
    };
    await peer.request("exec.complete", { executionId, completion });
    if (conclusion.status !== "succeeded") throw error;
    return value;
  }
  return {
    fail,
    cancel(reason: string) {
      runController.abort(new ExecutionCancelledError(reason));
    },
    answer(raw: unknown) {
      const { id, answer } = z
        .strictObject({ id: z.uuid(), answer: z.unknown() })
        .parse(raw);
      const interaction = questions.get(id);
      if (!interaction) throw new Error(`No pending interaction '${id}'`);
      const result = interaction.submit(id, answer);
      if (result.status === "accepted") questions.delete(id);
      return result;
    },
    async run(target: unknown): Promise<CompleteExecution> {
      try {
        const value = await invoke(
          target,
          binding.input,
          runController.signal,
          undefined,
          binding.executionId,
        );
        return {
          result: { status: "succeeded" },
          ...(value === undefined ? {} : { value: value as JsonValue }),
        };
      } catch (error) {
        return {
          result: {
            status:
              error instanceof ExecutionRejectedError
                ? "rejected"
                : error instanceof ExecutionCancelledError
                  ? "cancelled"
                  : "failed",
            reason: errorMessage(error) || "Execution failed",
          },
        };
      }
    },
  };
}
