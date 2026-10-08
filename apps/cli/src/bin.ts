#!/usr/bin/env node
// Clack/picocolors read color settings at import time; apply explicit options before loading commands and UI.
if (process.argv.includes("--no-color")) process.env.NO_COLOR = "1";
const { runCli } = await import("./commands/program.ts");

process.exitCode = await runCli(process.argv.slice(2));
