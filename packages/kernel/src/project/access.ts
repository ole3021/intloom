import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type {
  ProjectAccess,
  ProjectCommand,
  ProjectCommandResult,
} from "@intloom/workflow-sdk";

const excluded = new Set([
  ".git",
  ".intloom",
  "intloom",
  "node_modules",
  "dist",
  "coverage",
  ".turbo",
]);
const limit = 1024 * 1024;

/** Bound once to the canonical project directory; invocation wrappers enforce ownership. */
export function createProjectAccess(root: string): ProjectAccess {
  function candidate(path: string) {
    const parts = path.split(/[\\/]/);
    if (
      !path ||
      isAbsolute(path) ||
      parts.some((part) => part === ".." || excluded.has(part)) ||
      parts.some((part) => /^\.env(?:$|\.)|^\.dev.vars/.test(part)) ||
      parts.some((part) =>
        ["intloom.yaml", "intloom.config.yaml"].includes(part),
      )
    )
      throw new Error(
        "Project path must name a business file inside this project.",
      );
    const result = resolve(root, path);
    if (result !== root && !result.startsWith(`${root}${sep}`))
      throw new Error("Project path escapes its root.");
    return result;
  }
  async function checked(path: string) {
    const target = candidate(path);
    let current = target;
    while (current !== root) {
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink())
          throw new Error("Project operations do not follow symbolic links.");
      } catch (error) {
        if (
          !(
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          )
        )
          throw error;
      }
      current = dirname(current);
    }
    return target;
  }
  return {
    async snapshot() {
      const files: Record<string, string> = {};
      async function visit(directory: string) {
        for (const entry of (
          await readdir(directory, { withFileTypes: true })
        ).sort((a, b) => a.name.localeCompare(b.name))) {
          if (
            excluded.has(entry.name) ||
            /^\.env(?:$|\.)|^\.dev.vars/.test(entry.name) ||
            ["intloom.yaml", "intloom.config.yaml"].includes(entry.name)
          )
            continue;
          const file = join(directory, entry.name);
          if (entry.isSymbolicLink())
            throw new Error("Project snapshots do not follow symbolic links.");
          if (entry.isDirectory()) await visit(file);
          else if (entry.isFile()) {
            const info = await lstat(file);
            if (info.size > 16 * limit || Object.keys(files).length >= 10000)
              throw new Error(
                "Project snapshot exceeds its bounded file scope.",
              );
            files[relative(root, file).split(sep).join("/")] = createHash(
              "sha256",
            )
              .update(await readFile(file))
              .digest("hex");
          }
        }
      }
      await visit(root);
      return files;
    },
    async read(path) {
      const file = await checked(path);
      if ((await lstat(file)).size > limit)
        throw new Error("Project text file exceeds 1 MiB.");
      return readFile(file, "utf8");
    },
    async write(path, content) {
      if (Buffer.byteLength(content) > limit)
        throw new Error("Project text file exceeds 1 MiB.");
      const file = await checked(path);
      await mkdir(dirname(file), { recursive: true });
      await checked(path);
      await writeFile(file, content, { flag: "w" });
    },
    async remove(path) {
      await rm(await checked(path));
    },
    async run(command, signal) {
      return execute(root, command, checked, signal);
    },
  };
}

async function execute(
  root: string,
  command: ProjectCommand,
  checked: (path: string) => Promise<string>,
  signal?: AbortSignal,
): Promise<ProjectCommandResult> {
  signal?.throwIfAborted();
  const cwd =
    command.cwd && command.cwd !== "." ? await checked(command.cwd) : root;
  if ((await realpath(cwd)) !== cwd)
    throw new Error("Command directory must be canonical.");
  const timeoutMs = command.timeoutMs ?? 60000;
  if (
    !command.command.trim() ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 300000
  )
    throw new Error("Invalid project command or timeout.");
  return new Promise((resolveResult, reject) => {
    const child = spawn(command.command, [...command.args], {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    let stdout = "",
      stderr = "",
      timedOut = false,
      truncated = false;
    const append = (value: string, chunk: Buffer) => {
      const text = value + chunk.toString("utf8");
      if (Buffer.byteLength(text) > limit) truncated = true;
      return text.slice(0, limit);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    const kill = () => {
      if (child.pid && process.platform !== "win32") {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      } else child.kill("SIGKILL");
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutMs);
    signal?.addEventListener("abort", kill, { once: true });
    if (signal?.aborted) kill();
    child.once("error", (error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", kill);
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", kill);
      resolveResult({ command, exitCode, stdout, stderr, timedOut, truncated });
    });
  });
}

export function bindProjectAccess(
  project: ProjectAccess,
  check: () => void,
  signal?: AbortSignal,
): ProjectAccess {
  async function scoped<T>(action: () => Promise<T>) {
    check();
    const result = await action();
    check();
    return result;
  }
  return Object.freeze({
    snapshot: () => scoped(() => project.snapshot()),
    read: (path: string) => scoped(() => project.read(path)),
    write: (path: string, content: string) =>
      scoped(() => project.write(path, content)),
    remove: (path: string) => scoped(() => project.remove(path)),
    run: (command: ProjectCommand) =>
      scoped(() => project.run(command, signal)),
  });
}
