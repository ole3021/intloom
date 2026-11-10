import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
const [
  packageFile,
  directory,
  phase,
  artifact = "compiled",
  rawValue = "{}",
  targetId,
] = process.argv.slice(2);
const req = createRequire(packageFile);
const { serve } = await import(
  pathToFileURL(join(dirname(packageFile), "dist/index.js")).href
);
const { createClient } = await import(
  pathToFileURL(req.resolve("@libsql/client")).href
);
const dataDir = join(directory, "data");
const host = await serve({ dataDir });
if (phase === "start" || phase === "unpublished") {
  const ref = await host.installLoom({ source: join(directory, artifact) });
  const run = await host.createRun({ loom: ref, input: 1 });
  await writeFile(join(directory, "run.json"), JSON.stringify(run));
  if (phase === "unpublished") {
    const db = createClient({
      url: pathToFileURL(join(run.location.dataDir, "kernel.db")).href,
    });
    await db.execute(
      "CREATE TRIGGER fail_wait BEFORE UPDATE ON runs WHEN json_extract(NEW.record, '$.view.status') = 'waiting' BEGIN SELECT RAISE(ABORT, 'injected'); END",
    );
    db.close();
  }
  await host.startRun(run.id);
} else if (phase === "cancel_saved") {
  const run = JSON.parse(await readFile(join(directory, "run.json"), "utf8"));
  const db = createClient({
    url: pathToFileURL(join(run.location.dataDir, "kernel.db")).href,
  });
  await db.execute(
    "CREATE TRIGGER fail_cancel BEFORE UPDATE ON runs WHEN json_extract(NEW.record, '$.view.status') = 'cancelled' BEGIN SELECT RAISE(ABORT, 'injected'); END",
  );
  db.close();
  try {
    await host.cancelRun(run.id);
  } catch (error) {
    if (error.code === "STORAGE_UNAVAILABLE") process.exit(0);
    throw error;
  }
} else if (phase === "answer_saved") {
  const run = JSON.parse(await readFile(join(directory, "run.json"), "utf8"));
  const [request] = await host.listInteractions({ runId: run.id });
  const db = createClient({
    url: pathToFileURL(join(run.location.dataDir, "kernel.db")).href,
  });
  await db.execute(
    "CREATE TRIGGER fail_resume BEFORE INSERT ON run_operations WHEN NEW.operation = 'resume' BEGIN SELECT RAISE(ABORT, 'injected'); END",
  );
  db.close();
  const receipt = await host.respondInteraction(
    request.id,
    { action: "submit", value: {} },
    { source: { kind: "test", via: "api" } },
  );
  await writeFile(join(directory, "receipt.json"), JSON.stringify(receipt));
  process.exit(0);
} else if (
  phase === "answer" ||
  phase === "resume" ||
  phase === "completed_unpublished"
) {
  const run = JSON.parse(await readFile(join(directory, "run.json"), "utf8"));
  const requests = await host.listInteractions({ runId: run.id });
  const request = targetId
    ? requests.find((request) => request.id === targetId)
    : requests[0];
  if (phase === "completed_unpublished") {
    const db = createClient({
      url: pathToFileURL(join(run.location.dataDir, "kernel.db")).href,
    });
    await db.execute(
      "CREATE TRIGGER fail_complete BEFORE UPDATE ON runs WHEN json_extract(NEW.record, '$.view.status') = 'succeeded' BEGIN SELECT RAISE(ABORT, 'injected'); END",
    );
    db.close();
  }
  const receipt =
    phase !== "resume"
      ? await host.respondInteraction(
          request.id,
          { action: "submit", value: JSON.parse(rawValue) },
          { source: { kind: "test", via: "api" } },
        )
      : await host.resumeRun({ runId: run.id, requestId: request.id });
  await writeFile(join(directory, "receipt.json"), JSON.stringify(receipt));
}
const original = JSON.parse(
  await readFile(join(directory, "run.json"), "utf8"),
);
if (phase === "inspect") {
  await writeFile(
    join(directory, "view.json"),
    JSON.stringify({
      run: await host.getRun(original.id),
      interactions: await host.listInteractions({ runId: original.id }),
    }),
  );
} else {
  for (let i = 0; i < 500; i++) {
    let view;
    try {
      view = await host.getRun(original.id);
    } catch (error) {
      if (
        ["unpublished", "completed_unpublished"].includes(phase) &&
        error.code === "STORAGE_UNAVAILABLE"
      )
        process.exit(0);
      throw error;
    }
    if (
      ["waiting", "succeeded", "failed", "cancelled", "interrupted"].includes(
        view.status,
      )
    ) {
      await writeFile(
        join(directory, "view.json"),
        JSON.stringify({
          run: view,
          interactions: await host.listInteractions({ runId: original.id }),
        }),
      );
      break;
    }
    await delay(10);
  }
}
await host.close();
