import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { promisify } from "node:util";
import { headerCommand } from "./config.ts";

test("POSIX helper quoting preserves spaces, quotes and shell metacharacters", {
  skip: process.platform === "win32",
}, async () => {
  const args = [
    "path with spaces'quote",
    "$() `backticks` ; &",
    "\u4e2d\u6587\n\u6362\u884c",
  ];
  const command = headerCommand(
    [
      process.execPath,
      "-e",
      "process.stdout.write(JSON.stringify(process.argv.slice(1)))",
      ...args,
    ],
    "darwin",
  );
  const result = await promisify(execFile)("/bin/sh", ["-c", command]);
  assert.deepEqual(JSON.parse(result.stdout), args);
});
test("Windows helper encodes a literal PowerShell invocation", () => {
  const command = headerCommand(
    ["C:\\Program Files\\node.exe", "a'b; $(literal)"],
    "win32",
  );
  assert.match(
    command,
    /^powershell.exe -NoProfile -NonInteractive -EncodedCommand [\w+/=]+$/u,
  );
  assert.equal(
    Buffer.from(command.split(" ").at(-1) ?? "", "base64").toString("utf16le"),
    "& 'C:\\Program Files\\node.exe' 'a''b; $(literal)'; exit $LASTEXITCODE",
  );
});
