import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { E2eError, entrySchema, type Options } from "./contracts.ts";

export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
export const help = `Usage: bun run e2e:cmd|e2e:mcp|e2e:codex --root DIRECTORY [options]

  --root DIRECTORY          Required execution root; existing runs are preserved.
  --suite DIRECTORY         Workflow E2E data (default: packages/intent/e2e).
  --case S01                Case ID (case-insensitive); omitted selects randomly.
  --seed VALUE              Reproduce case selection within the recorded catalog.
  --cli FILE                Candidate CLI bin.js (default: apps/cli/dist/bin.js).
  --workflow PACKAGE|FILE   Published package/version or local archive; default: suite's current source.
  --codex FILE              Codex executable (codex entry only; default: codex on PATH).
  --codex-model MODEL       Optional Codex model override (codex entry only).
  --help                    Print this help without preparing or running a test.

Each invocation creates e2e-ENTRY-CASE-TIMESTAMP-ID beneath --root.
Results and reports are English. No repair, restore, publication or automatic rerun.
Exit codes: 0 passed, 1 failed, 2 blocked, 130 interrupted.
`;
export async function parseOptions(argv: string[]): Promise<Options | null> {
  const entry = entrySchema.parse(argv[0]);
  const { values } = parseArgs({
    args: argv.slice(1),
    strict: true,
    options: {
      root: { type: "string" },
      suite: { type: "string" },
      case: { type: "string" },
      seed: { type: "string" },
      cli: { type: "string" },
      workflow: { type: "string" },
      codex: { type: "string" },
      "codex-model": { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) return null;
  if (
    (entry !== "codex" && (values.codex || values["codex-model"])) ||
    (entry === "codex" && values.workflow)
  )
    throw new E2eError(
      "OPTIONS_INVALID",
      "Codex options require the codex entry; its compatibility Workflow is supplied by the runner.",
      "environment",
      "blocked",
    );
  if (!values.root?.trim())
    throw new E2eError(
      "ROOT_REQUIRED",
      "Provide --root with the directory in which E2E may create projects.",
      "environment",
      "blocked",
    );
  const suite = resolve(
    values.suite ?? resolve(repositoryRoot, "packages/intent/e2e"),
  );
  return {
    entry,
    root: resolve(values.root),
    suite,
    casesRoot: resolve(suite, "cases"),
    ...(entry === "codex"
      ? { profile: resolve(repositoryRoot, "e2e/fixtures/codex/config.json") }
      : {}),
    cli: resolve(values.cli ?? resolve(repositoryRoot, "apps/cli/dist/bin.js")),
    workflow: values.workflow
      ? /^(?:\.|\/)/u.test(values.workflow)
        ? resolve(values.workflow)
        : values.workflow
      : "",
    ...(entry !== "codex" && !values.workflow
      ? { workspaceWorkflow: true }
      : {}),
    ...(values.case ? { caseId: values.case } : {}),
    seed: values.seed ?? randomUUID(),
    ...(entry === "codex"
      ? {
          codex: values.codex ? resolve(values.codex) : "codex",
          ...(values["codex-model"]
            ? { codexModel: values["codex-model"] }
            : {}),
        }
      : {}),
  };
}
