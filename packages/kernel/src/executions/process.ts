import { execFile, spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Peer, type RequestHandler } from "./protocol.ts";

export async function launchExecution(options: {
  nodePath: string;
  installationDir: string;
  workDir: string;
  env: Readonly<Record<string, string>>;
  handle: RequestHandler;
  onProcess: (pid: number, active: boolean) => void;
}) {
  const kernelRoot = fileURLToPath(new URL("../../", import.meta.url));
  const sdkRoot = dirname(
    dirname(fileURLToPath(import.meta.resolve("@intloom/loom-sdk"))),
  );
  const zodRoot = dirname(fileURLToPath(import.meta.resolve("zod")));
  const semverRoot = dirname(
    createRequire(import.meta.resolve("@intloom/loom-sdk")).resolve(
      "semver/package.json",
    ),
  );
  const roots = await Promise.all(
    [kernelRoot, sdkRoot, zodRoot, semverRoot, options.installationDir].map(
      (path) => realpath(path),
    ),
  );
  const allowNet =
    options.nodePath === process.execPath && !process.versions.bun
      ? process.allowedNodeEnvironmentFlags.has("--allow-net")
      : (
          await promisify(execFile)(
            options.nodePath,
            ["-p", "process.allowedNodeEnvironmentFlags.has('--allow-net')"],
            { env: options.env },
          )
        ).stdout.trim() === "true";
  const child = spawn(
    options.nodePath,
    [
      "--permission",
      ...(allowNet ? ["--allow-net"] : []),
      ...roots.map((path) => `--allow-fs-read=${path}`),
      fileURLToPath(new URL("./runner.js", import.meta.url)),
    ],
    {
      cwd: options.workDir,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  let failure: Error | undefined;
  let stderr = "";
  let closed = false;
  const peer = new Peer(
    (message) =>
      new Promise<void>((resolve, reject) => {
        if (!child.connected) {
          reject(new Error("Execution process disconnected"));
          return;
        }
        child.send(message, (error) => (error ? reject(error) : resolve()));
      }),
    options.handle,
    (error) => {
      failure ??= error;
      child.kill("SIGKILL");
    },
  );
  child.on("message", (message) => peer.receive(message));
  child.stdout?.resume();
  child.stderr?.on("data", (bytes: Buffer) => {
    if (stderr.length < 16_384)
      stderr += bytes.toString("utf8").slice(0, 16_384 - stderr.length);
  });
  child.on("error", (error) => {
    failure ??= error;
  });
  if (child.pid) options.onProcess(child.pid, true);
  const done = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    error?: Error;
  }>((resolve) => {
    child.on("close", (code, signal) => {
      closed = true;
      peer.close();
      if (child.pid) options.onProcess(child.pid, false);
      const error =
        failure ??
        (code !== 0
          ? new Error(
              `Execution process exited (${signal ?? code}): ${stderr.trim()}`,
            )
          : undefined);
      resolve({ code, signal, ...(error ? { error } : {}) });
    });
  });
  return {
    peer,
    done,
    cancel(reason: string, graceMs: number) {
      if (closed) return;
      void peer.abort(reason).catch(() => {});
      const timer = setTimeout(() => {
        if (!closed) child.kill("SIGKILL");
      }, graceMs);
      void done.then(() => clearTimeout(timer));
    },
  };
}

export type ExecutionProcess = Awaited<ReturnType<typeof launchExecution>>;
