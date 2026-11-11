import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { zstdDecompressSync } from "node:zlib";

const [source, destination] = process.argv.slice(2).map((p) => resolve(p));
const work = mkdtempSync(join(tmpdir(), "studio-install-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));
const files = readdirSync(source);
const platform = { darwin: "macos", win32: "win", linux: "linux" }[
  process.platform
];
// Git Bash's tar treats Windows drive letters as remote hosts.
const tarExecutable =
  platform === "win"
    ? join(process.env.SystemRoot, "System32", "tar.exe")
    : "tar";
const prefix = `stable-${platform}-${process.arch}-`;
const version = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
const manifest = `${prefix}update.json`;
const info = JSON.parse(readFileSync(join(source, manifest), "utf8"));
assert.equal(info.version, version);
assert.equal(info.platform, platform);
assert.equal(info.arch, process.arch);
assert.match(info.hash, /^[a-z0-9]+$/);
const ext = { macos: ".dmg", win: ".zip", linux: ".tar.gz" }[platform];
const installers = files.filter((f) => f.startsWith(prefix) && f.endsWith(ext));
assert.equal(installers.length, 1, "Expected a native installer");
const installer = join(source, installers[0]);
const payloads = files.filter(
  (f) => f.startsWith(prefix) && f.endsWith(".tar.zst"),
);
assert.equal(payloads.length, 1);
const payload = readFileSync(join(source, payloads[0]));
const wrapped = join(work, "installer");
mkdirSync(wrapped);
if (platform === "macos") {
  execFileSync("hdiutil", [
    "attach",
    installer,
    "-readonly",
    "-nobrowse",
    "-mountpoint",
    wrapped,
  ]);
  try {
    const { bavail, bsize } = statfsSync(wrapped);
    const freeMiB = Math.floor((bavail * bsize) / 1024 ** 2);
    assert.ok(freeMiB >= 32, `Installer volume has only ${freeMiB} MiB free`);
    console.log(`Mounted installer volume has ${freeMiB} MiB free`);
    assert.equal(readlinkSync(join(wrapped, "Applications")), "/Applications");
    const app = readdirSync(wrapped).find((f) => f.endsWith(".app"));
    assert.ok(app);
    if (process.env.INTLOOM_SIGN_MAC === "1") {
      execFileSync("codesign", [
        "--verify",
        "--deep",
        "--strict",
        join(wrapped, app),
      ]);
      execFileSync("xcrun", ["stapler", "validate", installer]);
    }
    assert.ok(
      readFileSync(
        join(wrapped, app, "Contents/Resources", `${info.hash}.tar.zst`),
      ).equals(payload),
    );
  } finally {
    execFileSync("hdiutil", ["detach", wrapped]);
  }
} else {
  execFileSync(tarExecutable, ["-xf", installer, "-C", wrapped]);
  if (platform === "linux") {
    const extractor = readFileSync(join(wrapped, "installer"));
    assert.ok(extractor.subarray(-payload.length).equals(payload));
  } else {
    assert.ok(readdirSync(wrapped).some((f) => f.endsWith(".exe")));
    const entries = readdirSync(wrapped, { recursive: true });
    const archive = entries.find((f) => f.endsWith(".tar.zst"));
    assert.ok(archive && readFileSync(join(wrapped, archive)).equals(payload));
  }
}
// Start the exact application payload carried inside the installer.
const archive = join(work, "app.tar");
const tar = zstdDecompressSync(payload);
writeFileSync(archive, tar);
const installed = join(work, "installed");
mkdirSync(installed);
execFileSync(tarExecutable, ["-xf", archive, "-C", installed]);
const launcher = readdirSync(installed, { recursive: true }).find(
  (f) =>
    basename(f) === (platform === "win" ? "launcher.exe" : "launcher") &&
    ["MacOS", "bin"].includes(basename(dirname(f))),
);
assert.ok(launcher, "Missing native launcher");
const data = join(work, "test-data");
const bin = join(installed, launcher);
const build = JSON.parse(
  readFileSync(join(dirname(bin), "../Resources/version.json"), "utf8"),
);
assert.equal(build.version, info.version);
assert.equal(build.hash, info.hash);
assert.equal(build.channel, "stable");
assert.equal(
  build.baseUrl,
  "https://github.com/ole3021/intloom/releases/latest/download",
);
const serviceDir = join(data, "service");
mkdirSync(serviceDir, { recursive: true });
const listener = createServer().listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
writeFileSync(
  join(serviceDir, "intloom.yaml"),
  `version: 1\nservice:\n  port: ${port}\n`,
);
const { createServiceClient } = await import(
  pathToFileURL(
    join(
      dirname(bin),
      "../Resources/app/bun/runtime/node_modules/@intloom/cli/dist/local-service.js",
    ),
  ).href
);
for (const mode of ["kernel", "mock"]) {
  const app = spawn(bin, mode === "mock" ? ["--mock"] : [], {
    cwd: dirname(bin),
    env: {
      ...process.env,
      INTLOOM_STUDIO_MOCK_DIR: join(data, "mock"),
      INTLOOM_STUDIO_DATA_DIR: join(data, "kernel"),
      INTLOOM_DATA_DIR: serviceDir,
      npm_config_prefix: join(work, "smoke-packages"),
      INTLOOM_STUDIO_SMOKE: "1",
    },
    detached: platform !== "win",
    stdio: "ignore",
  });
  try {
    const ready = join(data, mode, "view-ready.json");
    for (let i = 0; i < 180 && !existsSync(ready); i++) {
      assert.equal(
        app.exitCode,
        null,
        "Desktop exited before its webview requested the initial snapshot",
      );
      await delay(500);
    }
    assert.deepEqual(JSON.parse(readFileSync(ready, "utf8")), {
      ready: true,
      mode,
    });
  } finally {
    if (mode === "kernel" && existsSync(join(serviceDir, "service.json")))
      await createServiceClient(serviceDir)("serviceShutdown");
    if (app.pid && app.exitCode === null) {
      if (platform === "win")
        execFileSync("taskkill", ["/pid", String(app.pid), "/T", "/F"]);
      else process.kill(-app.pid, "SIGTERM");
    }
  }
}
execFileSync(
  process.execPath,
  [
    fileURLToPath(new URL("./installed-service.mjs", import.meta.url)),
    join(dirname(bin), "../Resources/app/bun/runtime"),
    work,
  ],
  { stdio: "inherit" },
);
mkdirSync(destination, { recursive: true });
const asset = `IntLoom-Studio-${version}-${platform}-${process.arch}${ext}`;
copyFileSync(installer, join(destination, asset));
writeFileSync(
  join(destination, manifest),
  JSON.stringify({
    ...info,
    archiveSha256: createHash("sha256").update(tar).digest("hex"),
    notes: readFileSync(
      new URL(`../../../releases/app/${version}.md`, import.meta.url),
      "utf8",
    )
      .replace(/^#[^\n]*\n+/, "")
      .trim(),
  }),
);
copyFileSync(join(source, payloads[0]), join(destination, payloads[0]));
writeFileSync(
  join(destination, `${asset}.sha256`),
  createHash("sha256").update(readFileSync(installer)).digest("hex") +
    "  " +
    asset +
    "\n",
);
console.log(
  "Verified installer, webview and release files:",
  asset,
  manifest,
  payloads[0],
);
