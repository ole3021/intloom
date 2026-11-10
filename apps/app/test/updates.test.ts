import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { createStudioUpdater } from "../src/main/updates.ts";
import { blocksStudioRestart } from "../src/shared/updates.ts";
import { createSeed } from "../src/mock/service.ts";

function updater(t: TestContext, channel = "stable") {
  const dir = mkdtempSync(join(tmpdir(), "studio-update-test-"));
  t.after(() => rmSync(dir, { force: true, recursive: true }));
  mkdirSync(join(dir, "self-extraction"));
  const archive = join(dir, "self-extraction", "abc.tar");
  const info = {
    version: "0.10.0",
    platform: { darwin: "macos", win32: "win", linux: "linux" }[
      process.platform as "darwin"
    ],
    arch: process.arch,
    hash: "abc",
    archiveSha256: createHash("sha256").update("candidate").digest("hex"),
    notes: "Changes",
    updateReady: false,
    updateAvailable: true,
    error: "",
  };
  let blocked = false;
  let downloads = 0;
  let installs = 0;
  let checks = 0;
  type Native = Parameters<typeof createStudioUpdater>[0];
  let onStatus: Parameters<Native["onStatusChange"]>[0] = null;
  const native: Native = {
    updateInfo: () => info,
    appDataFolder: async () => dir,
    clearStatusHistory: () => {},
    onStatusChange: (fn) => {
      onStatus = fn;
    },
    checkForUpdate: async () => {
      checks++;
      onStatus?.({ status: "checking", timestamp: 0, message: "" });
      onStatus?.({ status: "update-available", timestamp: 0, message: "" });
      return info;
    },
    downloadUpdate: async () => {
      downloads++;
      await native.checkForUpdate();
      onStatus?.({
        status: "download-progress",
        details: { progress: 50 },
        timestamp: 0,
        message: "",
      });
      writeFileSync(archive, "candidate");
      info.updateReady = true;
    },
    applyUpdate: async () => {
      await native.checkForUpdate();
      onStatus?.({
        status: "extracting",
        details: { latestHash: info.hash },
        timestamp: 0,
        message: "",
      });
      installs++;
    },
  };
  const client = createStudioUpdater(
    native,
    { version: "0.4.0", channel },
    dir,
    () => {},
    () => (blocked ? "有运行中任务" : undefined),
  );
  return {
    client,
    info,
    archive,
    dir,
    native,
    block: () => {
      blocked = true;
    },
    counts: () => ({ checks, downloads, installs }),
  };
}

test("startup and manual checks share one operation; download and restart require separate actions", async (t) => {
  const f = updater(t),
    u = f.client;
  const checking = u.start({ action: "check" });
  assert.throws(() => u.start({ action: "download" }), /稍后重试/);
  await Promise.all([checking, u.start({ action: "check" })]);
  assert.equal(u.state.phase, "available");
  assert.equal(u.state.notes, "Changes");
  assert.deepEqual(f.counts(), { checks: 1, downloads: 0, installs: 0 });
  await Promise.all([
    u.start({ action: "download" }),
    u.start({ action: "download" }),
  ]);
  assert.equal(u.state.phase, "ready");
  assert.equal(f.counts().downloads, 1);
  await u.start({ action: "apply", route: "#/about" });
  assert.equal(f.counts().installs, 1);
  assert.equal(u.state.phase, "failed"); // SDK returned without restarting
  assert.equal(existsSync(join(f.dir, "studio-update.json")), false);
});

test("only newer stable builds for the same platform and architecture qualify", async (t) => {
  const f = updater(t);
  for (const version of ["0.4.0", "0.3.9", "0.4.0+abc"]) {
    f.info.version = version;
    await f.client.start({ action: "check" });
    assert.equal(f.client.state.phase, "current");
  }
  for (const patch of [
    { version: "0.5.0-alpha" },
    { version: "0.5.0", arch: "other" },
    { arch: process.arch, hash: "../bad" },
    { hash: "abc", archiveSha256: "missing" },
  ]) {
    Object.assign(f.info, patch);
    await f.client.start({ action: "check" });
    assert.equal(f.client.state.phase, "failed");
    await f.client.start({ action: "download" });
  }
  assert.equal(f.counts().downloads, 0);
  const dev = updater(t, "dev");
  await dev.client.start({ action: "check" });
  assert.equal(dev.counts().checks, 0);
});

test("corrupt downloads are discarded and can be retried; a moved release cannot replace the verified build", async (t) => {
  const f = updater(t);
  f.info.archiveSha256 = "0".repeat(64);
  await f.client.start({ action: "check" });
  await f.client.start({ action: "download" });
  assert.match(f.client.state.message ?? "", /校验失败/);
  assert.equal(existsSync(f.archive), false);
  f.info.archiveSha256 = createHash("sha256").update("candidate").digest("hex");
  await f.client.start({ action: "check" });
  await f.client.start({ action: "download" });
  assert.equal(f.client.state.phase, "ready");
  f.info.version = "0.11.0";
  await f.client.start({ action: "apply", route: "#/about" });
  assert.equal(f.counts().installs, 0);
  assert.equal(f.client.state.phase, "failed");
});

test("restart protection uses live run state and preserves the ready download", async (t) => {
  const f = updater(t);
  await f.client.start({ action: "check" });
  await f.client.start({ action: "download" });
  f.block();
  await f.client.start({ action: "apply", route: "#/" });
  assert.match(f.client.state.message ?? "", /运行中/);
  assert.equal(f.client.state.phase, "ready");
  assert.equal(f.counts().installs, 0);
  const runs = createSeed().runs;
  assert.ok(runs.some((r) => r.summary.parentRunId && blocksStudioRestart(r)));
  assert.ok(
    runs.some((r) => r.summary.status === "waiting" && !blocksStudioRestart(r)),
  );
});

test("reopening reports the actual installed version, consumes the receipt and restores the page", (t) => {
  const f = updater(t);
  for (const version of ["0.4.0", "0.10.0"]) {
    writeFileSync(
      join(f.dir, "studio-update.json"),
      JSON.stringify({ version: "0.10.0", route: "#/run/R-1050" }),
    );
    const u = createStudioUpdater(
      f.native,
      { version, channel: "stable" },
      f.dir,
      () => {},
      () => undefined,
    );
    assert.equal(u.returnRoute, "#/run/R-1050");
    assert.match(
      u.state.result ?? "",
      version === "0.10.0" ? /已更新至/ : /未完成/,
    );
    assert.equal(existsSync(join(f.dir, "studio-update.json")), false);
  }
});
