import assert from "node:assert/strict";
import { mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { test } from "node:test";
import { interaction, runtimeFixture } from "./fixtures/runtime.mjs";

test("path authorization uses actual targets, per-Run grants, input reads and protected writes", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start, root, workspace, dataDir } = await runtimeFixture(t, {
    scope: "workspace",
    source: `export default async function main(input, context) {
      const paths = JSON.parse(input.prompt);
      const type = await context.fs.stat({ path: "link" });
      if (type.type !== "symlink") throw new Error("lost symlink");
      for (let i = 0; i < 2; i++) {
        const text = await context.fs.read({ path: "link" });
        if (text !== "outside") throw new Error("wrong read");
      }
      await context.fs.remove({ path: "link" });
      if (await context.fs.read({ path: input.files[0] }) !== "input") throw new Error("input");
      try { await context.fs.write({ path: input.files[0], content: "denied" }); }
      catch (error) { if (error.name !== "AuthorizationDeniedError") throw error; }
      await context.fs.write({ path: input.files[1], content: "workspace input remains writable" });
      for (const path of [paths.internal, new URL("./main.js", import.meta.url).pathname]) {
        try { await context.fs.write({ path, content: "unsafe" }); throw new Error("write escaped"); }
        catch (error) { if (error.name !== "AuthorizationDeniedError") throw error; }
      }
    }`,
  });
  const outside = join(root, "outside.txt");
  const input = join(root, "input.txt");
  const writable = join(workspace, "input.txt");
  await writeFile(outside, "outside");
  await writeFile(input, "input");
  await writeFile(writable, "workspace");
  await symlink(outside, join(workspace, "link"));
  const { runId } = await start({
    prompt: JSON.stringify({ internal: join(dataDir, "system.sqlite") }),
    files: [input, writable],
  });
  const first = await interaction(kernel, runId);
  assert.deepEqual(first.data.request, {
    kind: "path",
    path: outside,
    operation: "read",
  });
  await kernel.submitAnswer(first.data.id, "run");
  const second = await interaction(kernel, runId, first.cursor);
  assert.deepEqual(second.data.request, {
    kind: "path",
    path: input,
    operation: "write",
  });
  await kernel.submitAnswer(second.data.id, "deny");
  assert.equal((await kernel.waitRun(runId)).execution.status, "succeeded");
  assert.equal((await kernel.getRun(runId)).interactions.length, 2);
  assert.equal(await readFile(outside, "utf8"), "outside");
  assert.equal(await readFile(input, "utf8"), "input");
  assert.equal(
    await readFile(writable, "utf8"),
    "workspace input remains writable",
  );
  await assert.rejects(stat(join(workspace, "link")), { code: "ENOENT" });
});

test("single-use grants prompt again and denied tools can be caught", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start, root } = await runtimeFixture(t, {
    source: `export default async function main(input, context) {
      await context.fs.read({ path: input.prompt });
      try { await context.fs.read({ path: input.prompt }); throw new Error("missing denial"); }
      catch (error) { if (error.name !== "AuthorizationDeniedError") throw error; }
    }`,
  });
  const outside = join(root, "external");
  await writeFile(outside, "read once");
  const { runId } = await start({ prompt: outside });
  const first = await interaction(kernel, runId);
  await kernel.submitAnswer(first.data.id, "once");
  const second = await interaction(kernel, runId, first.cursor);
  assert.deepEqual(second.data.request, first.data.request);
  await kernel.submitAnswer(second.data.id, "deny");
  assert.equal((await kernel.waitRun(runId)).execution.status, "succeeded");
});

test("Node permissions restrict direct I/O and spawn; approved commands have explicit environments and network remains available", {
  timeout: 20_000,
}, async (t) => {
  const server = createServer((_request, response) =>
    response.end("network allowed"),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { kernel, start, root } = await runtimeFixture(t, {
    runtime: {
      env: {
        PROVIDED: "host value",
        URL: `http://127.0.0.1:${server.address().port}`,
      },
    },
    source: `import { readFile, writeFile } from "node:fs/promises";
      import { spawn } from "node:child_process";
      export default async function main(input, context) {
        for (const attempt of [
          () => readFile(input.prompt),
          () => writeFile(context.workDir + "/direct.txt", "blocked"),
          () => spawn(process.execPath, ["-e", ""]),
        ]) {
          try { await attempt(); throw new Error("direct permission escaped"); }
          catch (error) { if (error.code !== "ERR_ACCESS_DENIED") throw error; }
        }
        if (process.env.PROVIDED !== "host value" || process.env.INTLOOM_TEST_SECRET !== undefined) throw new Error("env leak");
        if (await (await fetch(process.env.URL)).text() !== "network allowed") throw new Error("network");
        const script = "require('node:fs').writeFileSync(process.argv[1], 'command outside write');console.log(JSON.stringify({provided:process.env.PROVIDED,explicit:process.env.EXPLICIT,secret:process.env.INTLOOM_TEST_SECRET}))";
        const command = { command: process.execPath, args: ["-e", script, input.prompt], cwd: context.workDir, env: { EXPLICIT: "one" } };
        const receipt = await context.process.run(command);
        const env = JSON.parse(receipt.stdout);
        if (env.provided !== "host value" || env.explicit !== "one" || env.secret !== undefined) throw new Error("command env");
        await context.process.run(command);
        await context.process.run({ ...command, env: { EXPLICIT: "two" } });
        await context.process.run({ ...command, cwd: context.tempDir });
        await context.process.run({ ...command, args: ["-e", "console.log('changed args')"] });
      }`,
  });
  const previous = process.env.INTLOOM_TEST_SECRET;
  process.env.INTLOOM_TEST_SECRET = "fixture-not-a-real-secret";
  t.after(() => {
    if (previous === undefined) delete process.env.INTLOOM_TEST_SECRET;
    else process.env.INTLOOM_TEST_SECRET = previous;
  });
  const outside = join(root, "command-output");
  await writeFile(outside, "outside");
  const { runId } = await start({ prompt: outside });
  const requests = [];
  for await (const event of kernel.observeRun(runId)) {
    if (event.type !== "interaction" || event.data.status !== "pending")
      continue;
    assert.equal(event.data.kind, "authorization");
    assert.equal(event.data.request.kind, "command");
    requests.push(event.data.request);
    await kernel.submitAnswer(event.data.id, "run");
  }
  const result = await kernel.waitRun(runId);
  assert.equal(result.execution.status, "succeeded", JSON.stringify(result));
  assert.equal(requests.length, 4);
  assert.equal(await readFile(outside, "utf8"), "command outside write");
  await assert.rejects(
    stat(join((await kernel.getRun(runId)).workDir, "direct.txt")),
    { code: "ENOENT" },
  );
});

test("authorization of external temporary directories is cleaned after managed activities", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start, root } = await runtimeFixture(t, {
    source: `export default async function main(input, context) {
      const directory = await context.fs.mkdtemp({ directory: input.prompt });
      await context.store.set("temporary", directory);
    }`,
  });
  const external = join(root, "external");
  await mkdir(external);
  const { runId } = await start({ prompt: external });
  const question = await interaction(kernel, runId);
  assert.equal(question.data.request.path, external);
  await kernel.submitAnswer(question.data.id, "once");
  assert.equal((await kernel.waitRun(runId)).execution.status, "succeeded");
  const run = await kernel.getRun(runId);
  const path = await (await kernel.getStore(run.package.name)).get("temporary");
  await assert.rejects(stat(path), { code: "ENOENT" });
});
