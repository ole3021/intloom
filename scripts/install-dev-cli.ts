import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const marker = "#!/bin/sh\n# Managed by IntLoom scripts/install-dev-cli.ts\n";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/** The launcher preserves the caller's directory, arguments, streams and signals. */
export async function installDevCli(options: {
  binDirectory: string;
  entryPath: string;
  nodePath: string;
}): Promise<string> {
  if (process.platform === "win32")
    throw new Error(
      "The local development launcher currently supports macOS and Linux.",
    );
  const entryPath = await realpath(options.entryPath);
  const nodePath = await realpath(options.nodePath);
  for (const file of [entryPath, nodePath])
    if (!(await lstat(file)).isFile())
      throw new Error(`Expected an ordinary file: ${file}`);

  const binDirectory = resolve(options.binDirectory);
  const launcher = join(binDirectory, "intloom-dev");
  const header = `${marker}# Entry: ${JSON.stringify(entryPath)}\n`;
  const existing = await lstat(launcher).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  });
  if (
    existing &&
    (!existing.isFile() ||
      !(await readFile(launcher, "utf8")).startsWith(header))
  )
    throw new Error(
      `Refusing to replace ${launcher}: it is not this checkout's managed launcher. Use --bin-dir with another directory, or explicitly remove the old launcher first.`,
    );

  await mkdir(binDirectory, { recursive: true });
  const temporary = join(binDirectory, `.intloom-dev-${randomUUID()}`);
  try {
    await writeFile(
      temporary,
      `${header}exec ${shellQuote(nodePath)} ${shellQuote(entryPath)} "$@"\n`,
      { mode: 0o755, flag: "wx" },
    );
    await rename(temporary, launcher);
  } finally {
    await rm(temporary, { force: true });
  }
  return launcher;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: node scripts/install-dev-cli.ts [--bin-dir DIRECTORY]");
    return;
  }
  if (
    args.length &&
    (args.length !== 2 || args[0] !== "--bin-dir" || !args[1]?.trim())
  )
    throw new Error(
      "Usage: node scripts/install-dev-cli.ts [--bin-dir DIRECTORY]",
    );
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  if (major < 26 || (major === 26 && minor < 4))
    throw new Error("Building the local CLI requires Node >=26.4.0.");

  const root = fileURLToPath(new URL("../", import.meta.url));
  // Check build output before consulting Bun's global directory.
  const entryPath = await realpath(resolve(root, "apps/cli/dist/bin.js"));
  let binDirectory = args[1];
  if (!binDirectory) {
    const { stdout } = await run("bun", ["pm", "bin", "-g"], { cwd: root });
    binDirectory = stdout.trim();
    if (!isAbsolute(binDirectory) || /[\r\n]/u.test(binDirectory))
      throw new Error("Bun did not return an absolute global bin directory.");
  }
  const launcher = await installDevCli({
    binDirectory,
    entryPath,
    nodePath: process.execPath,
  });
  console.log(`intloom-dev: ${launcher}`);
  console.log(`CLI: ${entryPath}`);
  console.log(`Node: ${await realpath(process.execPath)}`);
  const binPath = resolve(binDirectory);
  if (
    !(process.env.PATH ?? "")
      .split(delimiter)
      .some((entry) => entry && resolve(entry) === binPath)
  )
    console.log(
      `Add ${shellQuote(binPath)} to PATH to call intloom-dev from any directory.`,
    );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
