#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { runAuthoringCommand } from "./cli.ts";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };
const args = process.argv.slice(2);

if (args.length === 1 && args[0] === "--version") {
  console.log(version);
} else if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
  console.log(`intloom-build ${version} — Loom authoring

Usage: intloom-build <check | build> [directory]

  check        Validate a Loom without changing dist/
  build        Check and build a distributable package in dist/
  --help       Show this help
  --version    Show the package version

With no arguments, build the current directory.`);
} else {
  process.exitCode = await runAuthoringCommand(args.length ? args : ["build"]);
}
