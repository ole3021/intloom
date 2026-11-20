#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { runAuthoringCommand } from "@intloom/compiler";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };
const name = process.env.INTLOOM_CLI_NAME ?? "intloom";
const args = process.argv.slice(2);

if (args.length === 1 && args[0] === "--version") {
  console.log(version);
} else if (
  args.length === 0 ||
  (args.length === 1 && (args[0] === "--help" || args[0] === "-h"))
) {
  console.log(`${name} ${version} — Loom authoring

Usage: ${name} <check | build> [directory] [--details]

  check        Validate a Loom without changing dist/
  build        Check and build a distributable package in dist/
  --details    List discovered definitions, Skills and resources
  --help       Show this help
  --version    Show the package version

Build output can be installed as an npm package.`);
} else if (args[0] === "check" || args[0] === "build") {
  process.exitCode = await runAuthoringCommand(args);
} else {
  console.error(
    `Unsupported command. Run ${name} --help for available options.`,
  );
  process.exitCode = 2;
}
