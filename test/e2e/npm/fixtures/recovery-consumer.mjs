import { cliArgs, shutdown } from "./cli.mjs";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { mkdir, cp, rm, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { compileLoom } from "@intloom/compiler";
import { serve } from "@intloom/kernel";
await mkdir("recovery-author");
await writeFile(
  "recovery-author/package.json",
  JSON.stringify({ name: "consumer-wait", type: "module" }),
);
await cp("recovery-workflow.ts", "recovery-author/loom.ts");
const compiled = await compileLoom({
  entryFile: "recovery-author/loom.ts",
  outDir: "recovery-compiled",
  target: "node22",
});
assert.ok(compiled.ok, JSON.stringify(compiled));
await rm("recovery-author", { recursive: true });
let host = await serve({ dataDir: "recovery-sdk" });
const ref = await host.installLoom({ source: compiled.artifactDir });
const run = await host.createRun({ loom: ref, input: 1 });
await host.startRun(run.id);
await host.close();
host = await serve({ dataDir: "recovery-sdk" });
const [request] = await host.listInteractions({ runId: run.id });
assert.equal(request.status, "pending");
assert.deepEqual(request.context, { value: 2 });
assert.equal(
  (
    await host.respondInteraction(
      request.id,
      { action: "submit", value: {} },
      { source: { kind: "test", via: "api" } },
    )
  ).continuation.status,
  "requested",
);
await host.close();
host = await serve({ dataDir: "recovery-sdk" });
assert.equal((await host.getRun(run.id)).output, 5);
assert.deepEqual((await host.getInteraction(request.id)).responses[0].value, {
  add: 3,
});
assert.equal(
  (await host.listRunEvents({ runId: run.id, limit: 100 })).items.filter(
    (e) => e.details?.message === "before-once",
  ).length,
  1,
);
await host.close();
const cli = resolve("node_modules/.bin/intloom"),
  dataDir = resolve("recovery-cli"),
  exec = promisify(execFile);
let child;
async function command(...args) {
  try {
    return JSON.parse(
      (
        await exec(process.execPath, [
          ...cliArgs(cli, dataDir),
          ...args,
          "--plain",
        ])
      ).stdout,
    );
  } catch (error) {
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}
async function open() {
  child = spawn(
    process.execPath,
    [...cliArgs(cli, dataDir), "startup", "--plain"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let errors = "";
  child.stderr.on("data", (data) => {
    errors += data;
  });
  const ready = await Promise.race([
    once(child.stdout, "data"),
    once(child, "exit").then(() => {
      throw new Error(errors);
    }),
  ]);
  assert.equal(JSON.parse(String(ready[0])).data.status, "ready");
}
async function close(crash = false) {
  const ended = once(child, "exit");
  if (crash)
    process.kill(
      JSON.parse(await readFile(resolve(dataDir, "service.json"), "utf8")).pid,
      "SIGKILL",
    );
  else assert.equal((await shutdown(cli, dataDir)).status, "stopped");
  assert.deepEqual(await ended, [0, null]);
}
try {
  await open();
  const installed = (await command("install", compiled.artifactDir)).data;
  const waiting = (
    await command("run", installed.artifactDigest, "--input", "1")
  ).data;
  assert.equal(waiting.status, "waiting");
  const requests = (await command("interaction", "list", "--run", waiting.id))
    .data;
  assert.equal(requests.length, 1);
  await close(true);
  await open();
  const original = (await command("interaction", "get", requests[0].id)).data;
  assert.equal(original.request.status, "pending");
  assert.equal(
    (
      await command(
        "interaction",
        "respond",
        requests[0].id,
        "--action",
        "dismiss",
      )
    ).data.continuation.status,
    "not_requested",
  );
  await writeFile("recovery-answer.json", "{}");
  const receipt = (
    await command(
      "interaction",
      "respond",
      requests[0].id,
      "--value",
      "@recovery-answer.json",
    )
  ).data;
  assert.equal(receipt.continuation.status, "requested");
  let result;
  for (let i = 0; i < 100; i++) {
    result = (await command("status", waiting.id)).data.run;
    if (result.status === "succeeded") break;
    await delay(10);
  }
  assert.equal(result.output, 5);
  const interaction = (await command("interaction", "get", requests[0].id))
    .data;
  assert.deepEqual(interaction.responses.at(-1).source, {
    kind: "program",
    via: "cli",
  });
  assert.equal(
    (await command("run", "resume", waiting.id, "--request", requests[0].id))
      .data.disposition,
    "no_change",
  );
  assert.equal(
    (await command("interaction", "respond", requests[0].id, "--value", "{}"))
      .error.code,
    "INTERACTION_NOT_ANSWERABLE",
  );
  await close();
} finally {
  await shutdown(cli, dataDir).catch(() => undefined);
  if (child?.exitCode === null && child.signalCode === null) {
    const ended = once(child, "exit");
    child.kill("SIGKILL");
    await ended;
  }
}
console.log(
  "recovery-consumer: packaged SDK/CLI durable wait, new host process, saved normalized answer, explicit resume, one prior execution and source records verified",
);
