import { E2eError } from "./runner/contracts.ts";
import { parseOptions, help } from "./runner/options.ts";
import { execute } from "./runner/execute.ts";
import { Progress } from "./runner/progress.ts";

const controller = new AbortController();
const progress = new Progress((line) => process.stderr.write(line));
const interrupt = () => controller.abort();
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
try {
  const options = await parseOptions(process.argv.slice(2));
  if (!options) process.stdout.write(help);
  else {
    progress.start();
    const result = await execute(
      options,
      controller.signal,
      undefined,
      progress.handle,
      true,
    );
    process.stdout.write(
      `${JSON.stringify({ status: result.status, entry: result.entry, case: result.case ?? null, error: result.error, ...result.paths }, null, 2)}\n`,
    );
    process.exitCode = { passed: 0, failed: 1, blocked: 2, interrupted: 130 }[
      result.status
    ];
  }
} catch (cause) {
  process.stderr.write(
    `${JSON.stringify({ status: "blocked", error: { code: cause instanceof E2eError ? cause.code : "OPTIONS_INVALID", message: cause instanceof E2eError ? cause.message : "Invalid E2E options or execution root. Use --help." } })}\n`,
  );
  process.exitCode = 2;
} finally {
  progress.close();
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
}
