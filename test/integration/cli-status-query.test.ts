import { cliArgs } from "../fixtures/cli.mjs";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type {
  RunView,
  RunActivityView,
} from "../../packages/loom-sdk/dist/index.js";
import { createServiceClient } from "../../apps/cli/dist/service/client.js";

const binary = fileURLToPath(
  new URL("../../apps/cli/dist/bin.js", import.meta.url),
);
const exec = promisify(execFile);

test("live status hydrates visible Runs, reuses terminal snapshots, and static/plain status keep only ten finished Runs", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "intloom-status-"));
  const endpoint = join(directory, "service.sock");
  let cycle = 0;
  let activeQueries = 0;
  let peakQueries = 0;
  const queries: { cycle: number; id: string }[] = [];
  const runs: RunView[] = Array.from({ length: 300 }, (_, i) => ({
    location: {
      storage: "global",
      dataDir: "/tmp/intloom-fixture/looms/test",
      directory: "/tmp/intloom-fixture",
    },
    id: `R${String(i).padStart(5, "0")}`,
    loom: { id: "review", version: "1.0.0", artifactDigest: "a".repeat(64) },
    status: i === 0 ? "running" : "succeeded",
    createdAt: "2026-11-05T00:00:00Z",
    updatedAt: "2026-11-05T00:00:00Z",
    ...(i ? { finishedAt: "2026-11-05T00:00:01Z" } : {}),
    waits: [],
    pendingInteractionIds: [],
  }));
  const firstRun = runs[0];
  const lastRun = runs.at(-1);
  assert.ok(firstRun && lastRun);
  const activity = (run: RunView): RunActivityView => ({
    run,
    throughSeq: 3,
    coverage: "complete",
    steps: [],
    activeExecutions: [],
    recentExecutions: [],
    finishedExecutionCount: 1,
    progress: { completed: 1, active: 0 },
    interactions: [],
    artifacts: [],
    result: { runId: run.id, runStatus: run.status, quality: "not_requested" },
    usage: {
      calls: 0,
      finishedCalls: 0,
      observedSteps: 0,
      inputTokens: { reported: 0, receipts: 0 },
      outputTokens: { reported: 0, receipts: 0 },
      costs: {},
      costsWithoutCurrency: 0,
      complete: true,
    },
  });
  let scopedProject: unknown;
  let waitClosed = false;
  let waiting: (() => void) | undefined;
  const server = createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) return;
      const req = JSON.parse(buffer);
      let data: unknown;
      if (req.method === "serviceStatus") {
        cycle++;
        data = {
          status: "ready",
          version: "0.3.0",
          projectDir: "/project",
          endpoint,
          runRevision: cycle,
          activeRunCount: 1,
          storageIssues: [],
          logPath: join(directory, "service.log"),
          mcpUrl: "http://127.0.0.1:4545/mcp",
          tokenPath: join(directory, "token"),
        };
      } else if (req.method === "listUnfinishedRuns") {
        data = { items: [firstRun] };
      } else if (req.method === "getRunOverview") {
        data = { totalRuns: runs.length, recent: runs.slice(-10).reverse() };
      } else if (req.method === "getRunActivity") {
        activeQueries++;
        peakQueries = Math.max(peakQueries, activeQueries);
        queries.push({ cycle, id: req.params[0] });
        const run = runs.find((run) => run.id === req.params[0]);
        assert.ok(run);
        data = activity(run);
      } else if (req.method === "getLoomCatalog") {
        scopedProject = req.params[0];
        data = [];
      } else if (req.method === "listRunEvents") {
        socket.once("close", () => {
          waitClosed = true;
        });
        waiting?.();
        return;
      } else throw new Error(req.method);
      const reply = `${JSON.stringify({ id: req.id, ok: true, data })}\n`;
      if (req.method === "getRunActivity")
        setTimeout(() => {
          activeQueries--;
          socket.end(reply);
        }, 10);
      else socket.end(reply);
    });
  });
  await new Promise<void>((done) => server.listen(endpoint, done));
  await writeFile(
    join(directory, "service.json"),
    JSON.stringify({
      formatVersion: 1,
      endpoint,
      token: "test",
      pid: process.pid,
      version: "0.3.0",
    }),
  );
  t.after(async () => {
    await new Promise<void>((done) => server.close(() => done()));
    await rm(directory, { recursive: true, force: true });
  });
  const host = createServiceClient(directory, "/scope");
  assert.deepEqual(await host("getLoomCatalog"), []);
  assert.equal(scopedProject, undefined);
  const controller = new AbortController();
  const pending = new Promise<void>((done) => {
    waiting = done;
  });
  const response = host(
    "listRunEvents",
    [{ runId: firstRun.id, waitMs: 10_000 }],
    controller.signal,
  );
  await pending;
  controller.abort();
  await assert.rejects(response, { code: "OBSERVATION_CLOSED" });
  for (let i = 0; !waitClosed && i < 100; i++) await delay(5);
  assert.equal(
    waitClosed,
    true,
    "aborting a scoped client must close its event request",
  );

  const env = { ...process.env, CI: "", TERM: "xterm-256color" };
  const tty = `Object.defineProperties(process.stdout,{isTTY:{value:true},columns:{value:100},rows:{value:36}});`;
  const child = spawn(
    process.execPath,
    [
      "--import",
      `data:text/javascript,${encodeURIComponent(tty)}`,
      ...cliArgs(binary, directory),
      "status",
      "--watch",
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => child.kill("SIGKILL"));
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (data) => {
    stdout += data;
  });
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  const exit = once(child, "exit");
  for (let i = 0; i < 500 && cycle < 3; i++) {
    assert.equal(child.exitCode, null, stderr);
    await delay(10);
  }
  assert.ok(cycle >= 3, stderr);
  await delay(100);
  child.kill("SIGINT");
  assert.equal((await exit)[0], 130, stderr);
  const first = queries.filter((q) => q.cycle === 1);
  assert.ok(first.length > 1 && first.length < 12, JSON.stringify(first));
  for (const current of [2, 3])
    assert.deepEqual(
      queries.filter((q) => q.cycle === current).map((q) => q.id),
      [firstRun.id],
    );
  assert.match(stdout, /more Runs/);
  t.diagnostic(
    `300 Runs: first live frame ${first.length} projections; each later revision 1 projection`,
  );
  queries.length = 0;
  const full = await exec(process.execPath, [
    ...cliArgs(binary, directory),
    "status",
  ]);
  assert.ok(
    full.stdout.includes(lastRun.id),
    JSON.stringify({
      stdout: full.stdout,
      stderr: full.stderr,
      queries: queries.length,
    }),
  );
  assert.equal(queries.length, 11);
  assert.ok(
    peakQueries <= 16,
    `Peak concurrent activity queries: ${peakQueries}`,
  );
  queries.length = 0;
  const plain = await exec(process.execPath, [
    ...cliArgs(binary, directory),
    "status",
    "--plain",
  ]);
  assert.equal(JSON.parse(plain.stdout).data.runs.length, 11);
  assert.equal(queries.length, 0);
});
