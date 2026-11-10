import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("../", import.meta.url));
const root = resolve(app, "../..");
const runtime = join(app, ".runtime");
const work = mkdtempSync(join(tmpdir(), "studio-runtime-"));
const manifest = (path) =>
  JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
const win = process.platform === "win32";
const binary = realpathSync(process.execPath);
const nodeHome = win ? dirname(binary) : resolve(dirname(binary), "..");
if (
  process.versions.node !==
  readFileSync(join(root, ".node-version"), "utf8").trim()
)
  throw Error("Build Studio with the Node version pinned in .node-version.");
execFileSync("bun", ["run", "turbo", "run", "@intloom/cli#build"], {
  cwd: root,
  stdio: "inherit",
});
try {
  for (const file of ["package.json", "bun.lock"])
    cpSync(join(root, file), join(work, file));
  const packages = new Map();
  for (const group of ["apps", "packages"]) {
    for (const dir of readdirSync(join(root, group))) {
      const path = join(root, group, dir);
      if (!existsSync(join(path, "package.json"))) continue;
      const temp = join(work, group, dir);
      mkdirSync(temp, { recursive: true });
      cpSync(join(path, "package.json"), join(temp, "package.json"));
      packages.set(manifest(path).name, { path, temp });
    }
  }
  execFileSync(
    "bun",
    [
      "install",
      "--filter",
      "@intloom/cli",
      "--production",
      "--frozen-lockfile",
      "--linker",
      "hoisted",
      "--ignore-scripts",
    ],
    { cwd: work, stdio: "inherit" },
  );
  for (const name of ["@intloom/loom-sdk", "@intloom/kernel", "@intloom/cli"]) {
    const { path, temp } = packages.get(name);
    const pkg = manifest(path);
    for (const [dep, range] of Object.entries(pkg.dependencies ?? {})) {
      if (range === "workspace:*")
        pkg.dependencies[dep] = manifest(packages.get(dep).path).version;
    }
    writeFileSync(join(temp, "package.json"), JSON.stringify(pkg));
    for (const file of pkg.files)
      cpSync(join(path, file), join(temp, file), { recursive: true });
  }
  rmSync(runtime, { recursive: true, force: true });
  mkdirSync(join(runtime, "bin"), { recursive: true });
  cpSync(join(work, "node_modules"), join(runtime, "node_modules"), {
    recursive: true,
    dereference: true,
  });
  cpSync(binary, join(runtime, "bin", basename(binary)));
  cpSync(
    join(nodeHome, win ? "node_modules/npm" : "lib/node_modules/npm"),
    join(runtime, "node_modules/npm"),
    { recursive: true, dereference: true },
  );
  for (const tool of ["npm", "npx"]) {
    const command = win
      ? '@"%~dp0node.exe" "%~dp0../node_modules/npm/bin/' +
        tool +
        '-cli.js" %*\r\n'
      : '#!/bin/sh\nexec "$(dirname "$0")/node" "$(dirname "$0")/../node_modules/npm/bin/' +
        tool +
        '-cli.js" "$@"\n';
    writeFileSync(join(runtime, "bin", win ? tool + ".cmd" : tool), command, {
      mode: 0o755,
    });
  }
  cpSync(join(nodeHome, "LICENSE"), join(runtime, "NODE-LICENSE"));
  cpSync(
    join(app, "scripts/manage-service.mjs"),
    join(runtime, "manage-service.mjs"),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
