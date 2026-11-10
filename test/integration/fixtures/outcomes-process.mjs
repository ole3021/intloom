import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
const [packageFile, directory, phase] = process.argv.slice(2);
const req = createRequire(packageFile);
const { serve } = await import(
  pathToFileURL(join(dirname(packageFile), "dist/index.js")).href
);
const { createClient } = await import(
  pathToFileURL(req.resolve("@libsql/client")).href
);
const dataDir = join(directory, "data");
const host = await serve({ dataDir });
let run;
if (phase === "start") {
  const loom = await host.installLoom({ source: join(directory, "compiled") });
  run = await host.createRun({ loom, input: null });
  await writeFile(join(directory, "run.json"), JSON.stringify(run));
  await host.startRun(run.id);
} else run = JSON.parse(await readFile(join(directory, "run.json"), "utf8"));
if (phase === "complete_unpublished") {
  const db = createClient({
    url: pathToFileURL(join(run.location.dataDir, "kernel.db")).href,
  });
  await db.execute(
    "CREATE TRIGGER fail_complete BEFORE UPDATE ON runs WHEN json_extract(NEW.record, '$.view.status') = 'succeeded' BEGIN SELECT RAISE(ABORT, 'injected'); END",
  );
  db.close();
  const current = await host.getRun(run.id);
  await host.resumeRun({
    runId: run.id,
    waitId: current.waits[0].waitId,
    resumeData: true,
  });
}
if (phase === "inspect")
  await writeFile(
    join(directory, "result.json"),
    JSON.stringify(await host.getRunResult(run.id)),
  );
else {
  let ended = false;
  for (let i = 0; i < 500; i++) {
    try {
      const current = await host.getRun(run.id);
      if (current.status === "waiting" && phase === "start") {
        ended = true;
        break;
      }
    } catch (error) {
      if (
        phase === "complete_unpublished" &&
        error.code === "STORAGE_UNAVAILABLE"
      )
        process.exit(0);
      throw error;
    }
    await delay(10);
  }
  assert.ok(ended, "Expected phase boundary");
}
await host.close();
