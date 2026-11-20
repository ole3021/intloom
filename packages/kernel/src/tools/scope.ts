import {
  absolutePathSchema,
  ExecutionCancelledError,
  ExecutionRejectedError,
  rejectInputSchema,
  type CodeTools,
  type ProcessInput,
} from "@intloom/loom-sdk";
import { createFileTools, type CleanupFailure } from "./fs.ts";
import { Interactions, type Interaction } from "./interactions.ts";
import { Processes } from "./processes.ts";

export interface ToolScopeOptions {
  readonly tempDir: string;
  readonly signal?: AbortSignal;
  readonly onInteraction?: (interaction: Interaction) => void;
  readonly env?: Readonly<Record<string, string>>;
  readonly authorizePath?: (
    path: string,
    operation: "read" | "write",
    followFinal?: boolean,
  ) => Promise<string>;
  readonly authorizeCommand?: (input: ProcessInput) => Promise<ProcessInput>;
  readonly onProcess?: (pid: number, active: boolean) => void;
}

export interface ToolScope
  extends Pick<CodeTools, "signal" | "fs" | "process" | "user" | "reject"> {
  readonly tempDir: string;
  readonly interactions: Interactions;
  readonly cleanupFailures: readonly CleanupFailure[];
  cancel(reason?: string): void;
  close(): Promise<readonly CleanupFailure[]>;
}

export function createToolScope(options: ToolScopeOptions): ToolScope {
  const tempDir = absolutePathSchema.parse(options.tempDir);
  const controller = new AbortController();
  const { signal } = controller;
  const cancel = (reason = "Execution cancelled") =>
    controller.abort(new ExecutionCancelledError(reason));
  const abort = () =>
    cancel(
      options.signal?.reason instanceof Error
        ? options.signal.reason.message
        : String(options.signal?.reason ?? "Execution cancelled"),
    );
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const processes = new Processes(signal, {
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.authorizeCommand === undefined
      ? {}
      : { authorize: options.authorizeCommand }),
    ...(options.onProcess === undefined
      ? {}
      : { onProcess: options.onProcess }),
  });
  const interactions = new Interactions(signal, options.onInteraction);
  const files = createFileTools(signal, processes, options.authorizePath);
  let closing: Promise<readonly CleanupFailure[]> | undefined;
  return {
    signal,
    tempDir,
    fs: files.tools,
    process: processes.tools,
    user: interactions.user,
    interactions,
    cancel,
    get cleanupFailures(): readonly CleanupFailure[] {
      return [...files.cleanupFailures];
    },
    reject(input: { readonly reason: string }): never {
      signal.throwIfAborted();
      throw new ExecutionRejectedError(rejectInputSchema.parse(input).reason);
    },
    close(): Promise<readonly CleanupFailure[]> {
      closing ??= (async () => {
        cancel("Tool scope closed");
        options.signal?.removeEventListener("abort", abort);
        await processes.stop();
        await files.close();
        return [...files.cleanupFailures];
      })();
      return closing;
    },
  };
}
