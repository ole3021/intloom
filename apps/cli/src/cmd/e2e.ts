import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import type { CliIo } from "./index.ts";
import { entrySchema, E2eError } from "../e2e/contracts.ts";
import { catalog, loadCase } from "../e2e/cases.ts";
import { execute } from "../e2e/runner.ts";

export async function runE2e(
  input: {
    path?: string;
    root?: string;
    caseId?: string;
    entry?: string;
    seed?: string;
    profile?: string;
    list: boolean;
  },
  io: CliIo,
) {
  const packagePath = resolve(io.cwd, input.path ?? ".");
  const entry = entrySchema.parse(input.entry ?? "cmd");
  if (input.list) {
    const root = join(packagePath, "e2e/cases");
    const cases = await Promise.all(
      (await catalog(root)).map(async (id) => {
        const { manifest } = await loadCase(join(root, id));
        return {
          id,
          name: manifest.name,
          rounds: manifest.rounds.length,
          description: manifest.description,
        };
      }),
    );
    io.output.write(`${JSON.stringify({ packagePath, cases }, null, 2)}\n`);
    return 0;
  }
  if (!input.root)
    throw new E2eError(
      "ROOT_REQUIRED",
      "Provide --root for new isolated E2E projects.",
      "environment",
      "blocked",
    );
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  let progress = "preparing";
  const heartbeat = setInterval(
    () => io.error.write(`[e2e] ${progress}\n`),
    30000,
  );
  heartbeat.unref();
  try {
    const result = await execute(
      {
        packagePath,
        root: resolve(io.cwd, input.root),
        entry,
        seed: input.seed ?? randomUUID(),
        cli: fileURLToPath(new URL("../bin.js", import.meta.url)),
        ...(input.caseId ? { caseId: input.caseId } : {}),
        ...(input.profile ? { profile: resolve(io.cwd, input.profile) } : {}),
      },
      controller.signal,
      process.env,
      (event) => {
        if (
          [
            "execution_started",
            "iteration_started",
            "iteration_finished",
            "failure",
            "checks_finished",
          ].includes(event.kind)
        ) {
          progress = `${event.kind}: ${JSON.stringify(event.data)}`;
          io.error.write(`[e2e] ${progress}\n`);
        }
      },
      true,
    );
    io.output.write(`${JSON.stringify(result, null, 2)}\n`);
    return { passed: 0, failed: 1, blocked: 2, interrupted: 130 }[
      result.status
    ];
  } finally {
    clearInterval(heartbeat);
    process.off("SIGINT", abort);
    process.off("SIGTERM", abort);
  }
}
