#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const args = process.argv.slice(2);
if (args.includes("--no-color")) {
  delete process.env.FORCE_COLOR;
  process.env.NO_COLOR = "1";
}
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
const positional = args.filter(
  (value, index) => !value.startsWith("-") && args[index - 1] !== "--project",
);
const wantsTui =
  !args.includes("--help") &&
  !args.includes("-h") &&
  !args.includes("--version") &&
  !args.includes("-v") &&
  (!positional.length || positional[0] === "tui");
function fail(code: string, message: string) {
  if (args.includes("--json"))
    process.stdout.write(
      `${JSON.stringify({ ok: false, error: { code, message, retryable: false }, outcome: "not_applied", meta: { requestId: randomUUID() } })}\n`,
    );
  else process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
if (major < 26 || (major === 26 && minor < 4))
  fail("CLI_NODE_UNSUPPORTED", "IntLoom CLI requires Node >=26.4.0.");
else if (wantsTui && !process.execArgv.includes("--experimental-ffi")) {
  const child = spawn(
    process.execPath,
    [
      ...process.execArgv,
      "--experimental-ffi",
      fileURLToPath(import.meta.url),
      ...args,
    ],
    { stdio: "inherit" },
  );
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
  const handlers = signals.map((signal) => {
    const forward = () => {
      child.kill(signal);
    };
    process.on(signal, forward);
    return { signal, forward };
  });
  try {
    process.exitCode = await new Promise<number>((resolveExit) => {
      child.once("error", () => resolveExit(1));
      child.once("exit", (code, signal) =>
        resolveExit(code ?? (signal === "SIGINT" ? 130 : 1)),
      );
    });
  } finally {
    for (const { signal, forward } of handlers) process.off(signal, forward);
  }
} else if (wantsTui) {
  let projectPath = process.cwd();
  let valid = true;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === undefined) continue;
    const projectArgument = args[index + 1];
    if (arg === "tui" || arg === "--no-color") continue;
    if (arg === "--project" && projectArgument?.trim()) {
      projectPath = resolve(projectArgument);
      index++;
    } else if (arg.startsWith("--project=") && arg.slice(10).trim())
      projectPath = resolve(arg.slice(10));
    else {
      valid = false;
      fail(
        "INVALID_REQUEST",
        `Unsupported TUI option: ${arg}. Run intloom tui --help.`,
      );
      break;
    }
  }
  if (valid) {
    const { runTui } = await import("./tui/index.ts");
    process.exitCode = await runTui(projectPath);
  }
} else {
  const { runCmd } = await import("./cmd/index.ts");
  process.exitCode = await runCmd(args);
}
