import { cliArgs } from "../fixtures/cli.mjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { compileLoom } from "../../packages/compiler/dist/index.js";
import { openService } from "../../apps/cli/dist/service/server.js";
import { requestService } from "../../apps/cli/dist/service/client.js";
import { writeFixturePackage } from "./fixture-package.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const exec = promisify(execFile);

test("Run summaries keep large outputs out of overview IPC and terminal observers print the same complete output", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "intloom-run-results-"));
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(directory, "node_modules"),
  );
  await writeFile(
    join(directory, "loom.ts"),
    `
    import {defineLoom,defineCode} from "@intloom/loom-sdk"; import {z} from "zod";
    export default defineLoom({id:"query-output",version:"1.0.0",description:"Query output",
      entry:defineCode({id:"echo",inputSchema:z.string(),outputSchema:z.string(),execute:({inputData})=>inputData})});`,
  );
  await writeFixturePackage(join(directory, "loom.ts"));
  const compiled = await compileLoom({
    entryFile: join(directory, "loom.ts"),
    outDir: join(directory, "compiled"),
  });
  assert.ok(compiled.ok, JSON.stringify(compiled));
  const dataDir = join(directory, "data");
  const host = await openService({
    dataDir,
    projectDir: directory,
    mcpPort: 0,
  });
  t.after(async () => {
    await host.close();
    await rm(directory, { recursive: true, force: true });
  });
  const loom = await host.kernel.installLoom({ source: compiled.artifactDir });
  const payload = `BUSINESS_OUTPUT_VISIBLE:${"x".repeat(450_000)}`;
  const ids: string[] = [];
  for (let i = 0; i < 20; i++) {
    const run = await host.kernel.createRun({ loom, input: payload });
    ids.push(run.id);
    await host.kernel.startRun(run.id);
    for (let n = 0; n < 500; n++) {
      if ((await host.kernel.getRun(run.id)).status === "succeeded") break;
      await delay(10);
    }
    assert.equal((await host.kernel.getRun(run.id)).status, "succeeded");
  }
  const firstId = ids[0];
  assert.ok(firstId);
  const created = await host.kernel.createRun({ loom, input: "not started" });
  const page = await requestService(dataDir, "listRuns", [{ limit: 100 }]);
  assert.equal(page.items.length, 21);
  assert.ok(page.items.every((run) => !("output" in run)));
  assert.ok(Buffer.byteLength(JSON.stringify(page)) < 32_000);
  const key = (run: { createdAt: string; id: string }) =>
    `${run.createdAt}/${run.id}`;
  assert.deepEqual(page.items.map(key), page.items.map(key).sort());
  const pending = await requestService(dataDir, "listRuns", [
    { status: "created" },
  ]);
  assert.deepEqual(
    pending.items.map((run) => run.id),
    [created.id],
  );
  const first = await requestService(dataDir, "listRuns", [
    { status: "succeeded", loom: { id: "query-output" }, limit: 7 },
  ]);
  assert.ok(first.nextCursor);
  const second = await requestService(dataDir, "listRuns", [
    {
      status: "succeeded",
      loom: { id: "query-output" },
      limit: 100,
      cursor: first.nextCursor,
    },
  ]);
  assert.equal(second.nextCursor, undefined);
  assert.deepEqual(
    [...first.items, ...second.items].map((run) => run.id),
    page.items.filter((run) => run.status === "succeeded").map((run) => run.id),
  );
  await assert.rejects(
    requestService(dataDir, "listRuns", [
      { cursor: first.nextCursor, status: "created" },
    ]),
    { code: "INVALID_ARGUMENT" },
  );
  assert.equal(
    (await requestService(dataDir, "listRuns", [{ parentRunId: firstId }]))
      .items.length,
    0,
  );
  assert.equal(
    (await requestService(dataDir, "getRun", [firstId])).output,
    payload,
  );
  assert.equal(
    (await requestService(dataDir, "getRunResult", [firstId])).output,
    payload,
  );

  const cli = (...args: string[]) =>
    exec(
      process.execPath,
      [...cliArgs(join(root, "apps/cli/dist/bin.js"), dataDir), ...args],
      { maxBuffer: 4 * 1024 * 1024 },
    );
  const overview = await cli("status", "--plain");
  assert.equal(JSON.parse(overview.stdout).data.runs.length, 11);
  assert.ok(!overview.stdout.includes("BUSINESS_OUTPUT_VISIBLE"));
  assert.match((await cli("status")).stdout, /Total 21/);
  const tty =
    "Object.defineProperties(process.stdout,{isTTY:{value:true},columns:{value:100},rows:{value:36}});";
  const terminal = (...args: string[]) =>
    exec(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(tty)}`,
        ...cliArgs(join(root, "apps/cli/dist/bin.js"), dataDir),
        ...args,
      ],
      { env: { ...process.env, TERM: "dumb" }, maxBuffer: 4 * 1024 * 1024 },
    );
  for (const args of [
    ["status", firstId, "--watch"],
    ["status", firstId],
  ]) {
    const result = await terminal(...args);
    assert.ok(
      result.stdout.includes(`Output  ${JSON.stringify(payload)}`),
      args.join(" "),
    );
  }
  const plain = JSON.parse(
    (await cli("status", firstId, "--watch", "--plain")).stdout,
  ).data;
  assert.equal(plain.run.id, ids[0]);
  assert.equal(plain.run.output, payload);
});

test("run and watch render only delivered Markdown in the terminal", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "intloom-markdown-"));
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(directory, "node_modules"),
  );
  const entry = join(directory, "loom.ts");
  await writeFile(
    entry,
    `
    import { ArtifactRefSchema, defineCode, defineLoom } from "@intloom/loom-sdk";
    import { z } from "zod";
    export default defineLoom({
      id: "markdown-result", version: "1.0.0", description: "Deliver Markdown",
      outcome: { artifacts: { files: { at: "/files", multiple: true } } },
      entry: defineCode({
        id: "write", inputSchema: z.object({}), outputSchema: z.object({ files: z.array(ArtifactRefSchema), draft: ArtifactRefSchema }),
        async execute({ context }) {
          const write = (name: string, mediaType: string, data: string) => context.artifacts.write({name, mediaType, data});
          const draft = await write("draft.md", "text/markdown", "DRAFT-BODY");
          const report = await write("report", "text/markdown; charset=utf-8", "# Final report\\n\\n**Rendered finding**\\n\\n> Source\\n\\n[Guide](https://example.org)");
          const long = await write("notes.MD", "text/plain", "x\\n".repeat(32767) + "你TAIL-OF-FILE");
          const binary = await write("image.png", "image/png", "BINARY-BODY");
          return { files: [report, report, binary, long], draft };
        }
      })
    });`,
  );
  await writeFixturePackage(entry);
  const compiled = await compileLoom({
    entryFile: entry,
    outDir: join(directory, "compiled"),
  });
  assert.ok(compiled.ok, JSON.stringify(compiled));
  const dataDir = join(directory, "data");
  const host = await openService({ dataDir, mcpPort: 0 });
  t.after(async () => {
    await host.close();
    await rm(directory, { recursive: true, force: true });
  });
  await host.kernel.installLoom({ source: compiled.artifactDir });
  const tty =
    "Object.defineProperties(process.stdout,{isTTY:{value:true},columns:{value:80}})";
  const cli = (terminal: boolean, ...args: string[]) =>
    exec(
      process.execPath,
      [
        ...(terminal
          ? ["--import", "data:text/javascript," + encodeURIComponent(tty)]
          : []),
        ...cliArgs(join(root, "apps/cli/dist/bin.js"), dataDir, ...args),
      ],
      {
        env: {
          ...process.env,
          TERM: "dumb",
          npm_config_prefix: join(directory, "prefix"),
        },
        maxBuffer: 2 * 1024 * 1024,
      },
    );
  const args = ["run", "markdown-result", "--input", "{}"];
  const run = await cli(true, ...args);
  const id = run.stderr.match(/Run (R[A-Z0-9]+)/)?.[1];
  assert.ok(id);
  const watch = await cli(true, "status", id, "--watch");
  for (const { stdout } of [run, watch]) {
    assert.equal(stdout.match(/Rendered finding/g)?.length, 1);
    assert.match(stdout, /Final report/);
    assert.match(stdout, /https:\/\/example\.org/);
    assert.match(stdout, /Preview truncated/);
    assert.doesNotMatch(
      stdout,
      /# Final report|\*\*Rendered finding\*\*|DRAFT-BODY|BINARY-BODY|TAIL-OF-FILE|\uFFFD/,
    );
  }
  for (const result of [
    await cli(false, ...args),
    await cli(true, ...args, "--plain"),
  ]) {
    assert.doesNotMatch(result.stdout, /Rendered finding|Preview truncated/);
    assert.doesNotThrow(() => JSON.parse(result.stdout));
  }
});
