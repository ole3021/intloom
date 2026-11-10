import type { LoomManifest } from "@intloom/loom-sdk";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { inspectForCompilation } from "./inspect.ts";

const [modulePath, resultPath] = process.argv.slice(2);
if (!modulePath || !resultPath)
  throw new Error("Missing inspection arguments.");
try {
  const value: unknown = (await import(pathToFileURL(modulePath).href)).default;
  const result = inspectForCompilation(
    value,
    process.argv[4] as LoomManifest["build"]["target"],
  );
  await writeFile(resultPath, JSON.stringify({ ok: true, result }));
} catch (error) {
  const e = error as { code?: string; path?: string; message?: string };
  await writeFile(
    resultPath,
    JSON.stringify({
      ok: false,
      code: e.code ?? "DEFINITION_INVALID",
      path: e.path,
      message: e.message ?? String(error),
    }),
  );
}
