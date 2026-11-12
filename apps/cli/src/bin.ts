#!/usr/bin/env node
import { version } from "./metadata.ts";
const args = process.argv.slice(2);

const versionArgs = args.filter((arg) => arg !== "--plain");
if (versionArgs.length === 1 && versionArgs[0] === "--version") {
  process.stdout.write(
    `${args.includes("--plain") ? JSON.stringify({ ok: true, data: { version } }) : version}\n`,
  );
} else {
  const { runCli } = await import("./commands.ts");
  await runCli(args);
}
