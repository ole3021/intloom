import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { verifyConsumerImports, verifyCliSetup } from "./consumer.ts";
import { retryPublishedInstall, verifyPublishedEntries } from "./registry.ts";
import { readReleaseManifest } from "./release-files.ts";

const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
if (major < 26 || (major === 26 && minor < 4))
  throw new Error("Consumer verification requires Node >=26.4.0.");
const release = await readReleaseManifest();
if (process.env.GITHUB_SHA && release.commit !== process.env.GITHUB_SHA)
  throw new Error("Release commit mismatch.");
await verifyPublishedEntries(release.entries);
const temporary = await mkdtemp(resolve(tmpdir(), "intloom-published-"));
const run = promisify(execFile);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
try {
  for (const launcher of ["@intloom/cli", "intloom"]) {
    const project = resolve(
      temporary,
      launcher === "intloom" ? "launcher" : "scoped",
    );
    await mkdir(project);
    const dependencies = Object.fromEntries(
      Object.entries(release.versions).filter(
        ([name]) =>
          name === launcher || !["intloom", "@intloom/cli"].includes(name),
      ),
    );
    // Unchanged packages install from the registry; only selected versions have new archive checksums.
    await writeFile(
      resolve(project, "package.json"),
      JSON.stringify({ type: "module", dependencies }),
    );
    await retryPublishedInstall(release.entries, () =>
      run(
        npm,
        [
          "install",
          "--prefer-online",
          "--engine-strict",
          "--no-audit",
          "--no-fund",
        ],
        {
          cwd: project,
          timeout: 180_000,
          maxBuffer: 1024 * 1024,
        },
      ),
    );
    await verifyConsumerImports(project);
    // Isolated global prefixes exercise each advertised install command without changing the user's global bin.
    const prefix = resolve(project, "global");
    await retryPublishedInstall(release.entries, () =>
      run(
        npm,
        [
          "install",
          "--global",
          "--prefix",
          prefix,
          "--prefer-online",
          "--engine-strict",
          `${launcher}@${release.versions[launcher]}`,
          "--no-audit",
          "--no-fund",
        ],
        { cwd: project, timeout: 180_000, maxBuffer: 1024 * 1024 },
      ),
    );
    const bin =
      process.platform === "win32"
        ? resolve(prefix, "intloom.cmd")
        : resolve(prefix, "bin/intloom");
    await verifyCliSetup({
      command: [bin],
      directory: project,
      version: release.versions["@intloom/cli"],
      loomPackage: "@intloom/intent",
      loomSource: `@intloom/intent@${release.versions["@intloom/intent"]}`,
    });
  }
  console.log(
    "Both npm entries, Loom imports, CLI setup and file/SQLite storage passed; remote models remain separate acceptance.",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
