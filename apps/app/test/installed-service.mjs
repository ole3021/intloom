import assert from "node:assert/strict";
import {
  readFile,
  mkdir,
  writeFile,
  mkdtemp,
  cp,
  symlink,
} from "node:fs/promises";
import { createServer } from "node:net";
import { execFileSync } from "node:child_process";
import { verifyInstallSources } from "./installed-packages.mjs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { buildPackage } from "../../../packages/compiler/dist/index.js";
import { kernelBackend } from "../src/main/kernel.ts";

const [runtime, work] = process.argv.slice(2);
const fixture = fileURLToPath(
  new URL("../../../test/integration/fixtures/file-report", import.meta.url),
);
process.env.npm_config_cache = join(work, "npm-cache");
const archive = await buildPackage(fixture, work);
const previous = join(work, "previous");
await cp(fixture, previous, { recursive: true });
await symlink(
  fileURLToPath(new URL("../../../node_modules", import.meta.url)),
  join(work, "node_modules"),
  "junction",
);
const previousMeta = JSON.parse(
  await readFile(join(previous, "package.json"), "utf8"),
);
await writeFile(
  join(previous, "package.json"),
  JSON.stringify({ ...previousMeta, version: "0.3.9" }),
);
const olderArchive = await buildPackage(previous, work);
const ordinary = join(work, "ordinary");
await mkdir(ordinary);
await writeFile(
  join(ordinary, "package.json"),
  JSON.stringify({ name: "ordinary", version: "1.0.0" }),
);
execFileSync(
  process.execPath,
  [
    join(runtime, "node_modules/npm/bin/npm-cli.js"),
    "pack",
    "--ignore-scripts",
    "--pack-destination",
    work,
  ],
  { cwd: ordinary, stdio: "pipe" },
);
const ordinaryArchive = join(work, "ordinary-1.0.0.tgz");
const dataDir = await mkdtemp(join(work, "kernel-"));
const studioDir = await mkdtemp(join(work, "prefs-"));
const listener = createServer().listen(0, "127.0.0.1");
await new Promise((resolve) => listener.once("listening", resolve));
const { port } = listener.address();
await new Promise((resolve) => listener.close(resolve));
await writeFile(
  join(dataDir, "intloom.yaml"),
  `version: 1\nservice:\n  port: ${port}\n`,
);
process.env.INTLOOM_DATA_DIR = dataDir;
process.env.INTLOOM_STUDIO_TEST_ACTOR = "1";
process.env.PATH =
  process.platform === "win32"
    ? join(process.env.SystemRoot, "System32")
    : "/usr/bin:/bin:/usr/sbin:/sbin";
process.env.npm_config_prefix = join(work, "global");
const host = await import(
  pathToFileURL(
    join(runtime, "node_modules/@intloom/cli/dist/local-service.js"),
  )
);
const client = host.createServiceClient(dataDir);
const app = await kernelBackend(studioDir, () => {}, runtime);
assert.equal((await app.snapshot()).service, "offline");
try {
  await app.act({ type: "service", online: true });
  assert.equal((await app.snapshot()).service, "online");
  const draft = {
    loom: "file-report",
    command: "write",
    projectDir: "",
    profileId: "",
    finalConfirmation: false,
    input: { message: "Standalone Studio installer" },
  };
  await verifyInstallSources(
    app,
    archive,
    olderArchive,
    ordinaryArchive,
    async (message) => {
      const { receipt } = await app.act({
        type: "launch",
        draft: { ...draft, input: { message } },
      });
      const run = await until(receipt.run.id, "succeeded");
      assert.equal(
        await readFile(await app.artifact(run.files[0].record.id), "utf8"),
        message + "\n",
      );
    },
  );
  const pkg = (await app.snapshot()).catalog.find(
    (p) => p.ref.id === "file-report",
  );
  assert.equal(pkg.defaultCommand, "write");
  const { receipt } = await app.act({ type: "launch", draft });
  async function until(id, expected) {
    for (let i = 0; i < 300; i++) {
      const run = await app.getRun(id);
      if (run?.summary.status === expected) return run;
      if (run?.summary.status === "failed") assert.fail(run.message);
      await delay(100);
    }
    throw Error(`Run ${id} did not reach ${expected}`);
  }
  const run = await until(receipt.run.id, "succeeded");
  assert.equal((await client("getRun", [receipt.run.id])).id, run.summary.id);
  const [{ record, delivered }] = run.files;
  assert.equal(delivered, true);
  assert.equal(record.name, "report.txt");
  assert.equal(
    await readFile(await app.artifact(record.id), "utf8"),
    draft.input.message + "\n",
  );
  const folder = join(work, "exports");
  await mkdir(folder);
  await app.artifact(record.id, folder);
  await assert.rejects(app.artifact(record.id, folder));
  const waiting = await app.act({
    type: "launch",
    draft: { ...draft, finalConfirmation: true },
  });
  const review = await until(waiting.receipt.run.id, "waiting");
  assert.equal(review.reviews[0].candidate.id, review.files[0].record.id);
  await assert.rejects(
    app.act({
      type: "answer",
      requestId: review.reviews[0].request.id,
      value: true,
    }),
    /human|source|person/i,
  );
  await app.act({ type: "cancel", id: review.summary.id });
  await until(review.summary.id, "cancelled");
  await app.act({ type: "catalog", id: pkg.ref.id, install: false });
  assert.equal((await app.snapshot()).catalog.length, 0);
  assert.equal(
    await readFile(await app.artifact(record.id), "utf8"),
    draft.input.message + "\n",
  );
  console.log(
    "Installed service, npm installation, execution, delivery, confirmation policy, cancellation and retained history passed.",
    run.summary.id,
    record.digest,
  );
} finally {
  await app.act({ type: "service", online: false }).catch(async (e) => {
    if ((await app.snapshot()).service !== "offline") throw e;
  });
}
// Shutdown acknowledges execution before the listening endpoint finishes closing.
for (let i = 0; i < 100 && (await app.snapshot()).service === "stopping"; i++)
  await delay(25);
assert.equal((await app.snapshot()).service, "offline");
// Attach to the same service in the reverse startup order.
process.env.INTLOOM_NPM_CLI = join(runtime, "node_modules/npm/bin/npm-cli.js");
await host.startLocalService(dataDir);
try {
  const descriptor = join(dataDir, "service.json");
  const { pid } = JSON.parse(await readFile(descriptor, "utf8"));
  await app.act({ type: "service", online: true });
  assert.equal(JSON.parse(await readFile(descriptor, "utf8")).pid, pid);
  const reopened = await app.snapshot();
  assert.ok(reopened.runs.some((r) => r.summary.status === "succeeded"));
  console.log("Reconnected to the existing service and retained Run history.");
} finally {
  await app.act({ type: "service", online: false });
}
