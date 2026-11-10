import { cliArgs } from "../fixtures/cli.mjs";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { requestService } from "../../apps/cli/dist/service/client.js";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
test("explicit package acquisition, dev archives, live file references and recovery after removal", async (t) => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), "intloom-cli-a-")),
  );
  const dataDir = join(directory, "data");
  const pkg = { name: "@local/meeting", version: "1.0.0", type: "module" };
  const env = {
    ...process.env,
    npm_config_cache: join(directory, "cache"),
    npm_config_fetch_retries: "0",
  };
  const cli = (...args: string[]) =>
    exec(
      process.execPath,
      [...cliArgs(join(root, "apps/cli/dist/bin.js"), dataDir), ...args],
      {
        cwd: directory,
        env,
      },
    );
  t.after(async () => {
    for (const data of [dataDir]) {
      await requestService(data, "serviceShutdown").catch(() => {});
      for (let i = 0; i < 500; i++) {
        if (
          !(await readFile(join(data, "service.json")).catch(() => undefined))
        )
          break;
        await delay(10);
      }
    }
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(join(directory, "package.json"), JSON.stringify(pkg));
  const modules = join(directory, "node_modules");
  await mkdir(join(modules, "@intloom"), { recursive: true });
  await symlink(
    join(root, "packages/loom-sdk"),
    join(modules, "@intloom/loom-sdk"),
  );
  await symlink(
    join(root, "packages/loom-sdk/node_modules/zod"),
    join(modules, "zod"),
  );
  const source = `
    import {defineLoom,defineWorkflow,defineStep,InputFileRefSchema} from "@intloom/loom-sdk";
    import {z} from "zod";
    import {readFile} from "node:fs/promises";
    const input = z.object({prompt:z.string(),files:z.array(InputFileRefSchema),paths:z.array(z.string())});
    const review = defineStep({id:"read",inputSchema:input,outputSchema:z.string(),
      suspendSchema:input,resumeSchema:z.boolean(),interaction:{message:()=>"Continue?",responsePolicy:"any"},
      async execute({inputData,resumeData,suspend}) {
        if (resumeData===undefined) return suspend(inputData);
        return inputData.prompt + ":" + (await readFile(inputData.files[0]!.path,"utf8")) + ":" + inputData.paths.length;
      }});
    export default defineLoom({id:"@local/meeting", version:"1.0.0",description:"Review a file",
      entry:defineWorkflow({id:"flow",inputSchema:input,outputSchema:z.string()}).then(review).commit()});`;
  await writeFile(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        types: ["node"],
        typeRoots: [join(root, "node_modules/@types")],
      },
    }),
  );
  await symlink(
    join(root, "packages/compiler"),
    join(directory, "node_modules/@intloom/compiler"),
  );
  await writeFile(join(directory, "loom.ts"), source);
  const archive = join(directory, "dist/local-meeting-1.0.0.tgz");
  assert.match((await cli("dev", "build")).stdout, /Build complete/);
  const original = await readFile(archive);
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({ ...pkg, name: "wrong-name" }),
  );
  await assert.rejects(
    cli("dev", "build"),
    /must match package.json name "wrong-name"/,
  );
  assert.deepEqual(await readFile(archive), original);
  await writeFile(join(directory, "package.json"), JSON.stringify(pkg));
  await writeFile(
    join(directory, "loom.ts"),
    source.replace("Review a file", "Review another file"),
  );
  await cli("dev", "build");
  const bytes = await readFile(archive);
  assert.notDeepEqual(bytes, original);
  await mkdir(join(directory, "release"));
  await writeFile(join(directory, "release/local-meeting-1.0.0.tgz"), bytes);
  assert.equal(
    JSON.parse(
      (await cli("dev", "publish", "--path", "release", "--dry-run", "--plain"))
        .stdout,
    ).data.archive,
    join(directory, "release/local-meeting-1.0.0.tgz"),
  );
  await assert.rejects(cli("dev", "publish"), /CONFIRMATION_REQUIRED/);
  const status = async (id?: string) =>
    JSON.parse((await cli("status", ...(id ? [id] : []), "--plain")).stdout)
      .data;
  assert.equal((await status()).status, "offline");
  // Acquisition is explicit. A Run never downloads missing code.
  await assert.rejects(cli("run", pkg.name, "--input", "{}", "--plain"));
  await cli("install", archive, "--plain");
  const input = [
    "--prompt",
    "review",
    "--files",
    "note.txt;extra.pdf",
    "--paths",
    "folder;new-output",
    "--plain",
  ];
  await writeFile(join(directory, "note.txt"), "before");
  await writeFile(join(directory, "extra.pdf"), Buffer.from([0, 128, 255]));
  const wait = async (args: string[], supplied = input) => {
    try {
      await cli(...args, ...supplied);
    } catch (error) {
      const e = error as { code: number; stdout: string; stderr: string };
      assert.equal(e.code, 3, e.stderr);
      return JSON.parse(e.stdout).data;
    }
    assert.fail("Run should have reached the review step");
  };
  const first = await wait(["run", `${pkg.name}@1.0.0`]);
  const second = await wait(["run", pkg.name]);
  const third = await wait(
    ["dev", "test", "--path", "release"],
    [
      "--input",
      JSON.stringify({
        prompt: "review",
        files: [{ kind: "input-file", path: "note.txt" }],
        paths: [],
      }),
      "--plain",
    ],
  );
  const built = await wait(["dev", "test", "--build", "--path", "release"]);
  assert.equal(built.loom.id, pkg.name);
  assert.equal((await status()).runs.length, 4);
  // Interrupt each public observer while it is in its ten-second event wait.
  const interrupt = async (
    args: string[],
    targetData = dataDir,
    runId?: string,
  ) => {
    const childEnv: NodeJS.ProcessEnv = { ...env };
    const child = spawn(
      process.execPath,
      [...cliArgs(join(root, "apps/cli/dist/bin.js"), targetData), ...args],
      {
        cwd: directory,
        env: childEnv,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    t.after(() => child.kill("SIGKILL"));
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const exit = once(child, "exit");
    // Readiness includes a fresh Kernel startup; SIGINT latency is measured separately below.
    const readinessDeadline = Date.now() + 30_000;
    while (Date.now() < readinessDeadline) {
      runId ??= /Run (R[A-Z0-9]{5})/.exec(stderr)?.[1];
      if (
        runId &&
        stderr.includes("Log      ") &&
        (await requestService(targetData, "getRun", [runId])).status ===
          "waiting"
      )
        break;
      assert.equal(child.exitCode, null, stderr);
      await delay(10);
    }
    assert.ok(runId && stderr.includes("Log      "), stderr);
    await delay(200);
    const start = Date.now();
    child.kill("SIGINT");
    const [code] = await exit;
    const elapsed = Date.now() - start;
    assert.equal(code, 130, stderr);
    assert.ok(
      elapsed < 2000,
      `Observer took ${elapsed} ms to stop: ${args.join(" ")}`,
    );
    assert.equal(
      (await requestService(targetData, "getRun", [runId])).status,
      "waiting",
      "observer exit must not cancel business execution",
    );
    assert.equal(
      JSON.parse(stdout).data.run?.status ?? JSON.parse(stdout).data.status,
      "waiting",
    );
    assert.ok(!stdout.includes("\x1b") && !stderr.includes("\x1b"));
    t.diagnostic(
      `${args.slice(0, 2).join(" ")}: SIGINT exit in ${elapsed} ms; Run remains waiting`,
    );
  };
  await interrupt(
    ["status", first.id, "--watch", "--plain"],
    dataDir,
    first.id,
  );
  await interrupt(
    ["status", first.id, "--watch", "--plain"],
    dataDir,
    first.id,
  );
  await interrupt(["run", pkg.name, "--until", "terminal", ...input]);
  await interrupt([
    "dev",
    "test",
    "--path",
    "release",
    "--until",
    "terminal",
    ...input,
  ]);

  await interrupt(
    ["dev", "test", "--path", "release", "--until", "terminal", ...input],
    dataDir,
  );
  const cancelled = JSON.parse(
    (await cli("run", "stop", built.id, "--plain")).stdout,
  ).data;
  assert.equal(cancelled.operation, "cancel");
  const overview = (await cli("status")).stdout;
  assert.match(overview, /Needs attention/);
  assert.ok(overview.includes(first.id));
  assert.ok(overview.includes(third.id));
  assert.ok(!overview.includes("\x1b"));
  assert.equal((await status(third.id)).questions.length, 1);
  assert.equal(
    JSON.parse((await cli("loom", "describe", pkg.name, "--plain")).stdout).data
      .manifest.id,
    pkg.name,
  );
  await cli("loom", "remove", pkg.name);
  assert.equal(
    JSON.parse((await cli("loom", "list", "--plain")).stdout).data.items.length,
    0,
  );
  // A crash preserves the wait; an intentional shutdown cancels it.
  const descriptor = JSON.parse(
    await readFile(join(dataDir, "service.json"), "utf8"),
  );
  process.kill(descriptor.pid, "SIGKILL");
  await delay(100);
  await assert.rejects(cli("loom", "describe", pkg.name), /LOOM_NOT_FOUND/); // cold-start the same data directory
  await writeFile(join(directory, "note.txt"), "changed");
  await cli(
    "interaction",
    "respond",
    first.waits[0].requestId,
    "--value",
    "true",
  );
  await cli("status", first.id, "--watch", "--timeout", "10");
  assert.equal((await status(first.id)).result.output, "review:changed:2");
  const observed = await cli("status", first.id, "--watch");
  assert.match(observed.stdout, /Succeeded/);
  assert.match(observed.stdout, /review:changed:2/);
  assert.ok(
    !observed.stdout.includes("\x1b"),
    "redirected status contains plain text",
  );
  assert.equal(observed.stdout.match(/Run created/g)?.length, 1);
  await rename(join(directory, "note.txt"), join(directory, "moved.txt"));
  await cli(
    "interaction",
    "respond",
    second.waits[0].requestId,
    "--value",
    "true",
  );
  await cli("status", second.id, "--watch", "--timeout", "10");
  await cli(
    "interaction",
    "respond",
    third.waits[0].requestId,
    "--value",
    "true",
  );
  await cli("status", third.id, "--watch", "--timeout", "10");
  assert.equal((await status(third.id)).run.error.code, "INPUT_FILE_MISSING");
  const failed = await status(second.id);
  assert.equal(failed.run.status, "failed");
  assert.equal(failed.run.error.code, "INPUT_FILE_MISSING");
  assert.equal(failed.run.error.details.path, join(directory, "note.txt"));
  assert.equal(
    ((await requestService(dataDir, "serviceStatus")) as { status: string })
      .status,
    "ready",
  );
});
