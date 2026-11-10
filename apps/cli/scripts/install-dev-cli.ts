import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { "bin-dir": { type: "string" } } });
if (process.platform === "win32")
  throw new Error("The development CLI launcher requires macOS or Linux.");
const binDir = resolve(
  values["bin-dir"] ??
    execFileSync("bun", ["pm", "bin", "-g"], { encoding: "utf8" }).trim(),
);
const launcher = join(binDir, "intloom-dev");
const entry = realpathSync(
  fileURLToPath(new URL("../dist/bin.js", import.meta.url)),
);
// This marker also identifies launchers created before this installer moved.
const header = `#!/bin/sh\n# Managed by IntLoom scripts/install-dev-cli.ts\n# Entry: ${JSON.stringify(entry)}\n`;
const existing = lstatSync(launcher, { throwIfNoEntry: false });
if (
  existing &&
  !(existing.isFile() && readFileSync(launcher, "utf8").startsWith(header))
) {
  throw new Error(
    `Refusing to replace ${launcher}. Move the existing command aside or choose --bin-dir DIRECTORY.`,
  );
}

const node = realpathSync(process.execPath);
const command = [node, entry]
  .map((path) => `'${path.replaceAll("'", "'\\''")}'`)
  .join(" ");
mkdirSync(binDir, { recursive: true });
const temporary = join(binDir, `.intloom-dev-${randomUUID()}`);
try {
  writeFileSync(
    temporary,
    `${header}export INTLOOM_CLI_NAME=intloom-dev\nexec ${command} "$@"\n`,
    {
      flag: "wx",
      mode: 0o755,
    },
  );
  renameSync(temporary, launcher);
} finally {
  rmSync(temporary, { force: true });
}
console.log(`Installed ${launcher}\nCLI: ${entry}\nNode: ${node}`);
if (!process.env.PATH?.split(delimiter).includes(binDir))
  console.log(`Add ${binDir} to PATH to invoke intloom-dev by name.`);
