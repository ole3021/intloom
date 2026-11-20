import { spawn } from "node:child_process";
import {
  processInputSchema,
  TextEncodingError,
  type ProcessTools,
  type ProcessReceipt,
  type ProcessInput,
} from "@intloom/loom-sdk";
import { isWithin } from "../paths.ts";

export class Processes {
  readonly #active = new Set<{
    cwd: string;
    stop: () => void;
    done: Promise<unknown>;
  }>();

  constructor(
    private readonly signal: AbortSignal,
    private readonly options: {
      env?: Readonly<Record<string, string>>;
      authorize?: (input: ProcessInput) => Promise<ProcessInput>;
      onProcess?: (pid: number, active: boolean) => void;
    } = {},
  ) {}

  readonly tools: ProcessTools = {
    run: async (input) => {
      const parsed = processInputSchema.parse(input);
      const request = this.options.authorize
        ? await this.options.authorize(parsed)
        : parsed;
      this.signal.throwIfAborted();
      const start = Date.now();
      const startedAt = new Date(start).toISOString();
      let stop = () => {};
      const done = new Promise<ProcessReceipt>((resolve, reject) => {
        const child = spawn(request.command, [...request.args], {
          cwd: request.cwd,
          env: { ...(this.options.env ?? process.env), ...request.env },
          shell: false,
          detached: process.platform !== "win32",
          stdio: ["ignore", "pipe", "pipe"],
        });
        if (child.pid) this.options.onProcess?.(child.pid, true);
        let timeout: ReturnType<typeof setTimeout> | undefined;
        let escalation: ReturnType<typeof setTimeout> | undefined;
        let timedOut = false;
        let stopped = false;
        let closed = false;
        let failure: unknown;
        let launchError: string | undefined;
        let remaining = request.maxOutputBytes ?? 1024 * 1024;
        let truncated = false;
        const output = { stdout: "", stderr: "" };
        const decoders = {
          stdout: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }),
          stderr: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }),
        };
        const kill = (signal: NodeJS.Signals) => {
          if (!child.pid) return;
          if (process.platform === "win32") {
            const killer = spawn(
              "taskkill",
              ["/pid", String(child.pid), "/t", "/f"],
              { stdio: "ignore" },
            );
            killer.on("error", () => child.kill(signal));
          } else {
            try {
              process.kill(-child.pid, signal);
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ESRCH")
                failure ??= error;
            }
          }
        };
        stop = () => {
          if (stopped) return;
          stopped = true;
          kill("SIGTERM");
          escalation = setTimeout(() => kill("SIGKILL"), 250);
        };
        const abort = () => {
          failure ??= this.signal.reason;
          stop();
        };
        this.signal.addEventListener("abort", abort, { once: true });
        const decode = (stream: "stdout" | "stderr", bytes?: Uint8Array) => {
          if (failure) return;
          try {
            const text = decoders[stream].decode(bytes, {
              stream: bytes !== undefined,
            });
            for (const character of text) {
              const size = Buffer.byteLength(character, "utf8");
              if (size > remaining || truncated) {
                truncated = true;
                continue;
              }
              output[stream] += character;
              remaining -= size;
            }
          } catch (cause) {
            failure = new TextEncodingError(
              `Process ${stream} is not valid UTF-8`,
              { cause },
            );
            if (!closed) stop();
          }
        };
        for (const stream of ["stdout", "stderr"] as const)
          child[stream].on("data", (bytes: Buffer) => decode(stream, bytes));
        child.on("error", (error) => {
          launchError = error.message;
        });
        child.on("exit", () => {
          if (process.platform !== "win32") kill("SIGKILL");
        });
        child.on("close", (exitCode, signal) => {
          closed = true;
          clearTimeout(timeout);
          clearTimeout(escalation);
          // A command's descendants belong to the same managed invocation.
          if (process.platform !== "win32") kill("SIGKILL");
          this.signal.removeEventListener("abort", abort);
          if (child.pid) this.options.onProcess?.(child.pid, false);
          decode("stdout");
          decode("stderr");
          if (failure) {
            reject(failure);
            return;
          }
          resolve({
            status: launchError
              ? "launch-failed"
              : timedOut
                ? "timed-out"
                : signal
                  ? "signaled"
                  : "exited",
            exitCode: launchError ? null : exitCode,
            signal,
            ...output,
            truncated,
            command: request.command,
            args: request.args,
            cwd: request.cwd,
            startedAt,
            durationMs: Date.now() - start,
            ...(launchError ? { error: launchError } : {}),
          });
        });
        if (request.timeoutMs)
          timeout = setTimeout(() => {
            timedOut = true;
            stop();
          }, request.timeoutMs);
      });
      const active = { cwd: request.cwd, stop: () => stop(), done };
      this.#active.add(active);
      try {
        return await done;
      } finally {
        this.#active.delete(active);
      }
    },
  };

  async stop(directory?: string): Promise<void> {
    const active = [...this.#active].filter(
      (process) => directory === undefined || isWithin(directory, process.cwd),
    );
    for (const process of active) process.stop();
    await Promise.allSettled(active.map((process) => process.done));
  }
}
