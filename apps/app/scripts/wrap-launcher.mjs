import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const build = process.env.ELECTROBUN_BUILD_DIR;
const mac = process.platform === "darwin";
const win = process.platform === "win32";
const app = readdirSync(build)
  .map((name) => join(build, name))
  .find((path) =>
    existsSync(
      join(
        path,
        mac ? "Contents/MacOS" : "bin",
        win ? "launcher.exe" : "launcher",
      ),
    ),
  );
if (!app) throw Error("Missing Electrobun application launcher");
const bin = join(app, mac ? "Contents/MacOS" : "bin");
const launcher = join(bin, win ? "launcher.exe" : "launcher");
const original = join(
  bin,
  win ? "electrobun-launcher.exe" : "electrobun-launcher",
);
renameSync(launcher, original);
execFileSync(
  win ? "clang" : "cc",
  [
    "-O2",
    "scripts/launcher.c",
    "-o",
    launcher,
    ...(win
      ? ["-Xlinker", "/subsystem:windows", "-Xlinker", "/entry:wmainCRTStartup"]
      : []),
  ],
  { stdio: "inherit" },
);
if (mac && process.env.INTLOOM_SIGN_MAC === "1") {
  const sign = [
    "--force",
    "--timestamp",
    "--options",
    "runtime",
    "--sign",
    process.env.ELECTROBUN_DEVELOPER_ID,
  ];
  execFileSync("codesign", [...sign, original]);
  execFileSync("codesign", [
    ...sign,
    "--preserve-metadata=entitlements",
    join(app, "Contents/Resources/app/bun/runtime/bin/node"),
  ]);
}
