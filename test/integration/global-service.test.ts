import { createServer, type AddressInfo } from "node:net";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  rename,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify, stripVTControlCharacters } from "node:util";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { compileLoom } from "../../packages/compiler/dist/index.js";
import {
  serve,
  findProject,
  type Kernel,
} from "../../packages/kernel/dist/index.js";
import { openService } from "../../apps/cli/dist/service/server.js";
import { requestService } from "../../apps/cli/dist/service/client.js";
import { cliArgs } from "../fixtures/cli.mjs";
import { writeFixturePackage } from "./fixture-package.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const binary = join(root, "apps/cli/dist/bin.js");
const exec = promisify(execFile);
const prefix = `import {defineCode,defineLoom,defineWorkflow,defineStep} from '@intloom/loom-sdk'; import {z} from 'zod';`;
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-global-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dataDir = join(directory, "global");
  const a = join(directory, "project-a"),
    b = join(directory, "project-b"),
    nested = join(a, "src/sub");
  await mkdir(nested, { recursive: true });
  await mkdir(b);
  await writeFile(join(a, "intloom.yaml"), "version: 1\n");
  await writeFile(join(b, "intloom.yaml"), "version: 1\n");
  async function build(
    id: string,
    source: string,
    catalog?: Awaited<ReturnType<Kernel["getLoomCatalog"]>>,
  ) {
    const author = join(directory, id);
    await mkdir(author);
    await symlink(
      join(root, "packages/compiler/node_modules"),
      join(author, "node_modules"),
    );
    await writeFile(join(author, "loom.ts"), prefix + source);
    await writeFixturePackage(join(author, "loom.ts"));
    const result = await compileLoom({
      entryFile: join(author, "loom.ts"),
      outDir: join(author, "built"),
      ...(catalog ? { catalog } : {}),
    });
    assert.ok(result.ok, JSON.stringify(result));
    return result;
  }
  return { directory, dataDir, a, b, nested, build };
}
const code = (id: string, storage = "") =>
  `export default defineLoom({id:'${id}',version:'1.0.0',description:'storage',${storage ? `storage:'${storage}',` : ""}entry:defineCode({id:'main',inputSchema:z.number(),outputSchema:z.number(),execute:async({inputData,context})=>{await context.artifacts.write({name:'result.txt',mediaType:'text/plain',data:String(inputData)});return inputData;}})});`;
async function settled(kernel: Kernel, id: string) {
  for (let i = 0; i < 500; i++) {
    const run = await kernel.getRun(id);
    if (!["created", "running", "stopping"].includes(run.status)) return run;
    await delay(10);
  }
  assert.fail("Run did not settle");
}

test("storage is Loom-owned, finds the nearest YAML ancestor and preserves per-Run location across restart", async (t) => {
  const f = await fixture(t);
  assert.equal(await findProject(f.nested), f.a);
  await writeFile(join(f.nested, "intloom.json"), "{}");
  assert.equal(await findProject(f.nested), f.a);
  await writeFile(join(f.nested, "intloom.yaml"), "version: 1\n");
  assert.equal(await findProject(f.nested), f.nested);
  await rm(join(f.nested, "intloom.yaml"));
  await writeFile(join(f.directory, "intloom.json"), "{}");
  assert.equal(await findProject(f.directory), undefined);
  const global = await f.build("default-global", code("default-global"));
  const local = await f.build(
    "project-local",
    code("project-local", "project"),
  );
  assert.equal(global.manifest.storage, "global");
  let kernel = await serve({ dataDir: f.dataDir });
  t.after(() => kernel.close());
  const g = await kernel.installLoom({ source: global.artifactDir });
  const p = await kernel.installLoom({ source: local.artifactDir });
  await assert.rejects(kernel.createRun({ loom: p, input: 1 }, f.directory), {
    code: "PROJECT_REQUIRED",
  });
  await assert.rejects(kernel.createRun({ loom: p, input: 1 }), {
    code: "PROJECT_REQUIRED",
  });
  const runs = [
    await kernel.createRun({ loom: g, input: 10 }, f.nested),
    await kernel.createRun({ loom: p, input: 20 }, f.nested),
    await kernel.createRun({ loom: p, input: 30 }, f.b),
  ];
  assert.deepEqual(
    runs.map((r) => r.location),
    [
      {
        directory: f.nested,
        projectDir: f.a,
        storage: "global",
        dataDir: join(f.dataDir, "looms/default-global"),
      },
      {
        directory: f.nested,
        projectDir: f.a,
        storage: "project",
        dataDir: join(f.a, ".intloom"),
      },
      {
        directory: f.b,
        projectDir: f.b,
        storage: "project",
        dataDir: join(f.b, ".intloom"),
      },
    ],
  );
  for (const run of runs) {
    await kernel.startRun(run.id);
    assert.equal((await settled(kernel, run.id)).status, "succeeded");
    const artifact = (await kernel.listArtifacts({ runId: run.id })).items[0];
    assert.ok(artifact);
    assert.ok(run.location);
    assert.equal(
      await readFile(
        join(run.location.dataDir, "artifacts", artifact.id),
        "utf8",
      ),
      String((await kernel.getRunResult(run.id)).output),
    );
  }
  await assert.rejects(stat(join(f.dataDir, "kernel.db")), { code: "ENOENT" });
  await kernel.close();
  kernel = await serve({ dataDir: f.dataDir });
  let cursor: string | undefined;
  const listed: string[] = [];
  do {
    const page = await kernel.listRuns({
      limit: 1,
      ...(cursor ? { cursor } : {}),
    });
    listed.push(...page.items.map((run) => run.id));
    cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(new Set(listed), new Set(runs.map((run) => run.id)));
  for (const run of runs)
    assert.deepEqual((await kernel.getRun(run.id)).location, run.location);
});

test("child Loom chooses its own storage and shutdown cancels global, project and descendant waits permanently", async (t) => {
  const f = await fixture(t);
  const child = await f.build(
    "child-wait",
    `const wait=defineStep({id:'wait',inputSchema:z.number(),outputSchema:z.number(),suspendSchema:z.number(),resumeSchema:z.boolean(),interaction:{message:()=> 'Continue?',responsePolicy:'any'},execute:async({inputData,resumeData,suspend})=>resumeData===undefined?suspend(inputData):inputData}); export default defineLoom({id:'child-wait',version:'1.0.0',description:'wait',entry:defineWorkflow({id:'child',inputSchema:z.number(),outputSchema:z.number()}).then(wait).commit()});`,
  );
  let kernel = await serve({ dataDir: f.dataDir });
  t.after(() => kernel.close());
  await kernel.installLoom({ source: child.artifactDir });
  const parent = await f.build(
    "project-parent",
    `import {child} from './.intloom/dependencies.ts'; export default defineLoom({id:'project-parent',version:'1.0.0',description:'parent',storage:'project',dependencies:{child:{id:'child-wait',version:'1.0.0'}},entry:defineWorkflow({id:'parent',inputSchema:z.number(),outputSchema:z.number()}).then(defineStep(child,{id:'call'})).commit()});`,
    await kernel.getLoomCatalog(),
  );
  const loom = await kernel.installLoom({ source: parent.artifactDir });
  const run = await kernel.createRun({ loom, input: 1 }, f.nested);
  const inert = await kernel.createRun({ loom, input: 2 }, f.b);
  await kernel.startRun(run.id);
  assert.equal((await settled(kernel, run.id)).status, "waiting");
  const descendant = (await kernel.listRuns({ parentRunId: run.id })).items[0];
  assert.ok(descendant);
  assert.equal(descendant.location?.projectDir, f.a);
  assert.equal(descendant.location?.directory, f.nested);
  assert.equal(descendant.location?.storage, "global");
  assert.equal(
    descendant.location?.dataDir,
    join(f.dataDir, "looms/child-wait"),
  );
  assert.equal(
    (await kernel.listRunEvents({ runId: descendant.id })).items[0]?.type,
    "run.created",
  );
  const request = (await kernel.listInteractions({ runId: descendant.id }))[0];
  assert.ok(request);
  const slow = await f.build(
    "shutdown-active",
    `export default defineLoom({id:'shutdown-active',version:'1.0.0',description:'active cancellation',entry:defineCode({id:'slow',inputSchema:z.number(),outputSchema:z.number(),execute:async({inputData})=>{await new Promise(resolve=>setTimeout(resolve,200));return inputData;}})});`,
  );
  const activeLoom = await kernel.installLoom({ source: slow.artifactDir });
  const active = await kernel.createRun({ loom: activeLoom, input: 3 }, f.b);
  await kernel.startRun(active.id);
  assert.equal(kernel.activeRunCount, 1);
  await kernel.shutdown();
  kernel = await serve({ dataDir: f.dataDir });
  for (const id of [run.id, inert.id, descendant.id, active.id]) {
    assert.equal((await kernel.getRun(id)).status, "cancelled");
    assert.equal((await kernel.startRun(id)).disposition, "no_change");
  }
  assert.equal(
    (await kernel.getInteraction(request.id)).request.status,
    "closed",
  );
  await assert.rejects(
    kernel.resumeRun({ runId: descendant.id, requestId: request.id }),
  );
});

test("CLI and authenticated HTTP share one service; noninteractive shutdown refuses and run stop is terminal", async (t) => {
  const f = await fixture(t);
  const built = await f.build("project-http", code("project-http", "project"));
  const service = await openService({ dataDir: f.dataDir, mcpPort: 0 });
  t.after(() => service.close());
  const loom = await service.kernel.installLoom({ source: built.artifactDir });
  await assert.rejects(openService({ dataDir: f.dataDir, mcpPort: 0 }), {
    code: "SERVICE_BUSY",
  });
  const token = await readFile(join(f.dataDir, "token"), "utf8");
  assert.equal((await stat(join(f.dataDir, "token"))).mode & 0o777, 0o600);
  assert.equal((await fetch(service.mcpUrl)).status, 401);
  assert.equal(
    (
      await fetch(service.mcpUrl, {
        headers: {
          authorization: `Bearer ${token}`,
          origin: "https://untrusted.invalid",
        },
      })
    ).status,
    403,
  );
  const client = new Client(
    { name: "service-test", version: "1" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.mcpUrl), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  t.after(() => client.close());
  assert.equal((await client.listTools()).tools.length, 20);
  const created = await client.callTool({
    name: "intloom_run_create",
    arguments: { loom, input: 2, directory: f.nested },
  });
  const envelope = created.structuredContent as {
    ok: boolean;
    data: { id: string };
  };
  assert.equal(envelope.ok, true, JSON.stringify(created));
  const id = envelope.data.id;
  const cli = (...args: string[]) =>
    exec(process.execPath, cliArgs(binary, f.dataDir, ...args), { cwd: f.b });
  const status = JSON.parse((await cli("status", "--plain")).stdout).data;
  assert.equal(status.service.mcpUrl, service.mcpUrl);
  assert.equal(status.runs[0].location.projectDir, f.a);
  const details = JSON.parse((await cli("status", id, "--plain")).stdout).data;
  assert.equal(details.activity.run.id, id);
  await assert.rejects(cli("shutdown", "--plain"), (error: unknown) => {
    const e = error as { stdout: string; stderr: string };
    assert.equal(JSON.parse(e.stdout).error.code, "CONFIRMATION_REQUIRED");
    assert.ok(e.stderr.includes(id) && e.stderr.includes(f.a));
    return true;
  });
  assert.equal((await service.kernel.getRun(id)).status, "created");
  const stopped = JSON.parse(
    (await cli("run", "stop", id, "--plain")).stdout,
  ).data;
  assert.equal(stopped.run.status, "cancelled");
  await client.close();
  assert.equal(
    (await requestService(f.dataDir, "serviceStatus")).status,
    "ready",
  );
  await requestService(f.dataDir, "serviceShutdown");
  await service.done;
  await assert.rejects(fetch(service.mcpUrl));
  await assert.rejects(stat(join(f.dataDir, "service.json")), {
    code: "ENOENT",
  });
});

test("shutdown previews all projects, defaults to No and only closes after explicit terminal confirmation", {
  timeout: 15_000,
}, async (t) => {
  const f = await fixture(t);
  const built = await f.build("confirm-stop", code("confirm-stop", "project"));
  const service = await openService({ dataDir: f.dataDir, mcpPort: 0 });
  t.after(() => service.close());
  const loom = await service.kernel.installLoom({ source: built.artifactDir });
  const a = await service.kernel.createRun({ loom, input: 1 }, f.nested);
  const b = await service.kernel.createRun({ loom, input: 2 }, f.b);
  // This simulates terminal keystrokes only; it never submits a business Approval.
  const terminal = `Object.defineProperty(process.stdin,'isTTY',{value:true});process.stdin.setRawMode=()=>process.stdin;Object.defineProperties(process.stderr,{isTTY:{value:true},columns:{value:120}});`;
  async function answer(keys: string) {
    const child = spawn(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(terminal)}`,
        ...cliArgs(binary, f.dataDir, "shutdown"),
      ],
      {
        env: { ...process.env, CI: "", INTLOOM_CLI_TEST: "1" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    t.after(() => child.kill("SIGKILL"));
    let stderr = "",
      stdout = "",
      replied = false;
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (
        !replied &&
        stderr.includes("Cancel these Runs and shut down Intloom?")
      ) {
        replied = true;
        assert.ok(stderr.includes(a.id) && stderr.includes(b.id));
        assert.ok(stderr.includes(f.a) && stderr.includes(f.b));
        setTimeout(() => child.stdin.end(keys), 50);
      }
    });
    const [exit] = await once(child, "exit");
    assert.equal(exit, 0, stderr);
    assert.equal(replied, true, stderr);
    return stdout;
  }
  assert.equal(await answer("\r"), "");
  assert.equal(
    (await requestService(f.dataDir, "serviceStatus")).status,
    "ready",
  );
  assert.equal((await service.kernel.getRun(a.id)).status, "created");
  assert.equal(JSON.parse(await answer("y\r")).status, "stopped");
  await service.done;
  const reopened = await serve({ dataDir: f.dataDir });
  try {
    for (const run of [a, b])
      assert.equal((await reopened.getRun(run.id)).status, "cancelled");
  } finally {
    await reopened.close();
  }
});

test("missing and corrupt project stores stay isolated; shutdown persists stop intent through restoration", async (t) => {
  const f = await fixture(t);
  const local = await f.build("store-fault", code("store-fault", "project"));
  let kernel = await serve({ dataDir: f.dataDir });
  const loom = await kernel.installLoom({ source: local.artifactDir });
  const missing = await kernel.createRun({ loom, input: 1 }, f.a);
  const healthy = await kernel.createRun({ loom, input: 2 }, f.b);
  await kernel.close();
  const moved = join(f.directory, "moved-project");
  await rename(f.a, moved);
  kernel = await serve({ dataDir: f.dataDir });
  assert.equal((await kernel.getStorageIssues())[0]?.code, "STORAGE_MISSING");
  await assert.rejects(kernel.getRun(missing.id), {
    code: "STORAGE_UNAVAILABLE",
  });
  await assert.rejects(stat(f.a), { code: "ENOENT" });
  await kernel.startRun(healthy.id);
  assert.equal((await settled(kernel, healthy.id)).status, "succeeded");
  await kernel.shutdown();
  await rename(moved, f.a);
  kernel = await serve({ dataDir: f.dataDir });
  assert.equal((await kernel.getRun(missing.id)).status, "cancelled");
  assert.equal((await kernel.startRun(missing.id)).disposition, "no_change");
  const next = await kernel.createRun({ loom, input: 3 }, f.a);
  await kernel.close();
  const database = join(f.a, ".intloom/kernel.db");
  await rename(database, `${database}.original`);
  await writeFile(database, "invalid sqlite");
  kernel = await serve({ dataDir: f.dataDir });
  assert.equal(
    (await kernel.getStorageIssues())[0]?.code,
    "STORAGE_UNAVAILABLE",
  );
  const good = await kernel.createRun({ loom, input: 4 }, f.b);
  await kernel.startRun(good.id);
  assert.equal((await settled(kernel, good.id)).status, "succeeded");
  await assert.rejects(kernel.getRun(next.id), { code: "STORAGE_UNAVAILABLE" });
  await kernel.shutdown();
  await rm(database);
  await rename(`${database}.original`, database);
  kernel = await serve({ dataDir: f.dataDir });
  assert.equal((await kernel.getRun(next.id)).status, "cancelled");
  assert.deepEqual(await kernel.getStorageIssues(), []);
  await kernel.close();
});

test("startup observes a detached service; Ctrl+C leaves execution and persistent logs alive", {
  timeout: 20_000,
}, async (t) => {
  const f = await fixture(t);
  const built = await f.build(
    "observer-run",
    `export default defineLoom({id:'observer-run',version:'1.0.0',description:'observer',entry:defineCode({id:'slow',inputSchema:z.number(),outputSchema:z.string(),execute:async({inputData,context})=>{if(inputData===0)throw new Error('service-failure-diagnostic');console.info('before-observer-exit');await new Promise(resolve=>setTimeout(resolve,700));console.info('after-observer-exit');return JSON.stringify(context.run);}})});`,
  );
  t.after(() =>
    requestService(f.dataDir, "serviceShutdown").catch(() => undefined),
  );
  const launch = () => {
    const child = spawn(
      process.execPath,
      cliArgs(binary, f.dataDir, "startup", "--plain"),
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    t.after(() => child.kill("SIGKILL"));
    let errors = "";
    child.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    return { child, errors: () => errors };
  };
  const first = launch();
  const ready = JSON.parse(
    String((await once(first.child.stdout, "data"))[0]),
  ).data;
  assert.equal(ready.status, "ready", first.errors());
  const descriptor = JSON.parse(
    await readFile(join(f.dataDir, "service.json"), "utf8"),
  );
  assert.notEqual(descriptor.pid, first.child.pid);
  const loom = await requestService(f.dataDir, "installLoom", [
    { source: built.artifactDir },
  ]);
  const run = await requestService(f.dataDir, "createRun", [
    { loom, input: 1 },
    f.nested,
  ]);
  await requestService(f.dataDir, "startRun", [run.id]);
  const exited = once(first.child, "exit");
  first.child.kill("SIGINT");
  assert.equal((await exited)[0], 130, first.errors());
  assert.equal(
    (await requestService(f.dataDir, "serviceStatus")).endpoint,
    ready.endpoint,
  );
  let result = await requestService(f.dataDir, "getRun", [run.id]);
  for (let i = 0; result.status === "running" && i < 200; i++) {
    await delay(10);
    result = await requestService(f.dataDir, "getRun", [run.id]);
  }
  assert.equal(result.status, "succeeded");
  assert.deepEqual(JSON.parse(result.output as string).location, run.location);
  const failure = await requestService(f.dataDir, "createRun", [
    { loom, input: 0 },
    f.nested,
  ]);
  await requestService(f.dataDir, "startRun", [failure.id]);
  for (
    let i = 0;
    (await requestService(f.dataDir, "getRun", [failure.id])).status ===
      "running" && i < 200;
    i++
  )
    await delay(10);
  for (
    let i = 0;
    !(await readFile(ready.logPath, "utf8")).includes(
      "service-failure-diagnostic",
    ) && i < 200;
    i++
  )
    await delay(10);
  const logs = await readFile(ready.logPath, "utf8");
  assert.match(logs, /after-observer-exit/);
  assert.match(logs, /service-failure-diagnostic/);
  assert.ok(
    logs
      .split("\n")
      .filter(Boolean)
      .every((line) => JSON.parse(line).kind),
  );
  const second = launch();
  assert.equal(
    JSON.parse(String((await once(second.child.stdout, "data"))[0])).data
      .endpoint,
    ready.endpoint,
  );
  const closed = once(second.child, "exit");
  await requestService(f.dataDir, "serviceShutdown");
  assert.equal((await closed)[0], 0, second.errors());
  assert.match(second.errors(), /service-failure-diagnostic/);
});

test("startup reports occupied ports and invalid config with actionable repairs, and honors explicit port", {
  timeout: 20_000,
}, async (t) => {
  const f = await fixture(t);
  const occupied = createServer();
  await new Promise<void>((resolve) =>
    occupied.listen(0, "127.0.0.1", resolve),
  );
  const port = (occupied.address() as AddressInfo).port;
  const cli = (...args: string[]) =>
    exec(process.execPath, cliArgs(binary, f.dataDir, ...args));
  const failure = (code: string, hint: RegExp) => (error: unknown) => {
    const projected = JSON.parse((error as { stdout: string }).stdout).error;
    assert.equal(projected.code, code);
    assert.match(projected.message, hint);
    return true;
  };
  await assert.rejects(
    cli("startup", "--port", String(port), "--plain"),
    failure("PORT_IN_USE", /startup --port/),
  );
  await new Promise<void>((resolve) => occupied.close(() => resolve()));
  await writeFile(
    join(f.dataDir, "intloom.yaml"),
    "version: 1\nservice:\n  port: invalid\n",
  );
  await assert.rejects(
    cli("startup", "--port", String(port), "--plain"),
    failure("CONFIG_INVALID", /intloom.yaml/),
  );
  await writeFile(join(f.dataDir, "intloom.yaml"), "version: 1\n");
  const child = spawn(
    process.execPath,
    cliArgs(binary, f.dataDir, "startup", "--port", String(port), "--plain"),
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stderr.resume();
  t.after(() => child.kill("SIGKILL"));
  const ready = JSON.parse(String((await once(child.stdout, "data"))[0])).data;
  assert.equal(new URL(ready.mcpUrl).port, String(port));
  await assert.rejects(
    cli(
      "startup",
      "--port",
      String(port === 65535 ? 65534 : port + 1),
      "--plain",
    ),
    failure("SERVICE_PORT_MISMATCH", /shutdown/),
  );
  const exit = once(child, "exit");
  await requestService(f.dataDir, "serviceShutdown");
  assert.equal((await exit)[0], 0);
});

test("init adds only YAML to an existing directory and preserves user files", async (t) => {
  const f = await fixture(t);
  const directory = join(f.directory, "existing");
  await mkdir(directory);
  await writeFile(join(directory, "notes.txt"), "keep");
  await exec(
    process.execPath,
    cliArgs(binary, f.dataDir, "init", directory, "--plain"),
  );
  assert.equal(
    await readFile(join(directory, "intloom.yaml"), "utf8"),
    "version: 1\n",
  );
  assert.equal(await readFile(join(directory, "notes.txt"), "utf8"), "keep");
  await assert.rejects(
    exec(
      process.execPath,
      cliArgs(binary, f.dataDir, "init", directory, "--plain"),
    ),
    (error) => {
      assert.equal(
        JSON.parse((error as { stdout: string }).stdout).error.code,
        "FILE_EXISTS",
      );
      return true;
    },
  );
});

test("project menu keeps global status and shutdown independent of invocation options", {
  timeout: 10_000,
}, async (t) => {
  const f = await fixture(t);
  const terminal = `Object.defineProperty(process.stdin,'isTTY',{value:true});process.stdin.setRawMode=()=>process.stdin;Object.defineProperties(process.stderr,{isTTY:{value:true},columns:{value:120}});`;
  const child = spawn(
    process.execPath,
    [
      "--import",
      `data:text/javascript,${encodeURIComponent(terminal)}`,
      ...cliArgs(binary, f.dataDir, "--project", f.nested),
    ],
    {
      env: { ...process.env, CI: "", INTLOOM_CLI_TEST: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  t.after(() => child.kill("SIGKILL"));
  let transcript = "",
    stage = 0;
  const exit = once(child, "exit");
  child.stderr.on("data", (chunk) => {
    transcript += stripVTControlCharacters(String(chunk));
    if (stage === 0 && transcript.includes("What would you like to do?")) {
      stage++;
      setTimeout(() => child.stdin.write("\x1b[B\x1b[B\x1b[B\r"), 20);
    } else if (stage === 1 && transcript.includes("Shutdown")) {
      stage++;
      setTimeout(() => child.stdin.write("\x1b[B\x1b[B\r"), 20);
    }
  });
  child.stdout.on("data", (chunk) => {
    transcript += stripVTControlCharacters(String(chunk));
    if (stage === 2 && transcript.includes('"stopped"')) {
      stage++;
      child.kill("SIGINT");
    }
  });
  await exit;
  assert.equal(stage, 3, transcript);
  assert.match(transcript, /Intloom service offline/);
  assert.doesNotMatch(transcript, /INVALID_ARGUMENT|not supported by/);
});

test("child runtime context receives its own storage and actual parent identity", async (t) => {
  const f = await fixture(t);
  const child = await f.build(
    "context-child",
    `export default defineLoom({id:'context-child',version:'1.0.0',description:'context',entry:defineCode({id:'main',inputSchema:z.number(),outputSchema:z.string(),execute:({context})=>JSON.stringify(context.run)})});`,
  );
  const kernel = await serve({ dataDir: f.dataDir });
  t.after(() => kernel.close());
  await kernel.installLoom({ source: child.artifactDir });
  const parent = await f.build(
    "context-parent",
    `import {child} from './.intloom/dependencies.ts';export default defineLoom({id:'context-parent',version:'1.0.0',description:'parent',storage:'project',dependencies:{child:{id:'context-child',version:'1.0.0'}},entry:defineWorkflow({id:'parent',inputSchema:z.number(),outputSchema:z.string()}).then(defineStep(child,{id:'child'})).commit()});`,
    await kernel.getLoomCatalog(),
  );
  const loom = await kernel.installLoom({ source: parent.artifactDir });
  const run = await kernel.createRun({ loom, input: 1 }, f.nested);
  await kernel.startRun(run.id);
  const result = await settled(kernel, run.id);
  assert.equal(result.status, "succeeded");
  const context = JSON.parse(result.output as string);
  const saved = await kernel.getRun(context.runId);
  assert.equal(context.parentRunId, run.id);
  assert.deepEqual(context.location, saved.location);
  assert.equal(context.location.storage, "global");
  assert.equal(context.location.directory, f.nested);
  assert.equal(context.location.projectDir, f.a);
  await kernel.close();
});

test("a child store write failure stops its waiting parent without disabling unrelated Looms", async (t) => {
  const f = await fixture(t);
  const child = await f.build(
    "fault-child",
    `const wait=defineStep({id:'wait',inputSchema:z.number(),outputSchema:z.number(),suspendSchema:z.number(),resumeSchema:z.boolean(),interaction:{message:()=> 'Continue?',responsePolicy:'any'},execute:async({inputData,resumeData,suspend})=>resumeData===undefined?suspend(inputData):inputData}); export default defineLoom({id:'fault-child',version:'1.0.0',description:'wait',entry:defineWorkflow({id:'child',inputSchema:z.number(),outputSchema:z.number()}).then(wait).commit()});`,
  );
  let kernel = await serve({ dataDir: f.dataDir });
  t.after(() => kernel.close());
  await kernel.installLoom({ source: child.artifactDir });
  const parent = await f.build(
    "fault-parent",
    `import {child} from './.intloom/dependencies.ts';export default defineLoom({id:'fault-parent',version:'1.0.0',description:'parent',storage:'project',dependencies:{child:{id:'fault-child',version:'1.0.0'}},entry:defineWorkflow({id:'parent',inputSchema:z.number(),outputSchema:z.number()}).then(defineStep(child,{id:'call'})).commit()});`,
    await kernel.getLoomCatalog(),
  );
  const loom = await kernel.installLoom({ source: parent.artifactDir });
  const run = await kernel.createRun({ loom, input: 1 }, f.a);
  await kernel.startRun(run.id);
  assert.equal((await settled(kernel, run.id)).status, "waiting");
  const descendant = (await kernel.listRuns({ parentRunId: run.id })).items[0];
  assert.ok(descendant);
  const { createClient } = createRequire(
    join(root, "packages/kernel/package.json"),
  )(
    "@libsql/client",
  ) as typeof import("../../packages/kernel/node_modules/@libsql/client/lib-esm/node.js");
  const database = createClient({
    url: `file:${join(descendant.location.dataDir, "kernel.db")}`,
  });
  t.after(() => database.close());
  await database.execute(
    "CREATE TRIGGER reject_success BEFORE UPDATE ON runs WHEN json_extract(NEW.record, '$.view.status') = 'succeeded' BEGIN SELECT RAISE(ABORT, 'injected child write failure'); END",
  );
  const request = (await kernel.listInteractions({ runId: descendant.id }))[0];
  assert.ok(request);
  await kernel.respondInteraction(
    request.id,
    { action: "submit", value: true },
    { source: { kind: "test", via: "api" } },
  );
  for (
    let i = 0;
    i < 500 && (await kernel.getRun(run.id)).status !== "failed";
    i++
  )
    await delay(10);
  assert.equal((await kernel.getRun(run.id)).status, "failed");
  assert.equal((await kernel.getRun(run.id)).error?.code, "CHILD_RUN_FAILED");
  const good = await f.build("fault-independent", code("fault-independent"));
  const goodLoom = await kernel.installLoom({ source: good.artifactDir });
  const independent = await kernel.createRun({ loom: goodLoom, input: 2 });
  await kernel.startRun(independent.id);
  assert.equal((await settled(kernel, independent.id)).status, "succeeded");
  await kernel.close();
  await database.execute("DROP TRIGGER reject_success");
  kernel = await serve({ dataDir: f.dataDir });
  assert.equal((await kernel.getRun(descendant.id)).status, "interrupted");
  assert.equal((await kernel.startRun(descendant.id)).disposition, "no_change");
  assert.equal((await kernel.getRun(run.id)).status, "failed");
});

test("unavailable foreign Artifact storage records validation failure in the readable Run", async (t) => {
  const f = await fixture(t);
  const producer = await f.build("writer", code("writer"));
  const forward = await f.build(
    "forward",
    `import {ArtifactRefSchema} from '@intloom/loom-sdk'; export default defineLoom({id:'forward',version:'1.0.0',description:'forward an artifact',entry:defineCode({id:'main',inputSchema:ArtifactRefSchema,outputSchema:ArtifactRefSchema,execute:({inputData})=>inputData})});`,
  );
  let host = await serve({ dataDir: f.dataDir });
  t.after(() => host.close());
  const writer = await host.installLoom({ source: producer.artifactDir });
  const reader = await host.installLoom({ source: forward.artifactDir });
  const source = await host.createRun({ loom: writer, input: 3 });
  await host.startRun(source.id);
  assert.equal((await settled(host, source.id)).status, "succeeded");
  const [artifact] = (await host.listArtifacts({ runId: source.id })).items;
  assert.ok(artifact);
  const input = { kind: "artifact", runId: source.id, id: artifact.id };
  await host.close();
  await rename(
    source.location.dataDir,
    `${source.location.dataDir}.unavailable`,
  );
  host = await serve({ dataDir: f.dataDir });
  const run = await host.createRun({ loom: reader, input });
  await host.startRun(run.id);
  const failed = await settled(host, run.id);
  assert.equal(failed.status, "failed");
  assert.equal(failed.error?.code, "OUTCOME_CONTRACT_UNSATISFIED");
  assert.deepEqual(failed.error?.details, {
    directory: source.location.dataDir,
    artifactId: input.id,
  });
  const events = (await host.listRunEvents({ runId: run.id, limit: 100 }))
    .items;
  assert.deepEqual(
    events.slice(-2).map((e) => e.type),
    ["validation.finished", "run.failed"],
  );
});

test("a failed credential-file setup releases the service directory for an immediate retry", async (t) => {
  const f = await fixture(t);
  const token = join(f.dataDir, "token");
  await mkdir(token, { recursive: true });
  await assert.rejects(openService({ dataDir: f.dataDir, mcpPort: 0 }), {
    code: "EISDIR",
  });
  await rm(token, { recursive: true });
  const service = await openService({ dataDir: f.dataDir, mcpPort: 0 });
  await service.close();
});
