import { shutdown } from "../../test/fixtures/cli.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  mkdtempSync,
  rmSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const [action, unit, folder, testRegistry] = process.argv.slice(2);
assert.ok(
  ["publish", "verify", "inspect"].includes(action) &&
    ["framework", "cli"].includes(unit),
);
if (testRegistry)
  assert.ok(
    action === "verify" && /^http:\/\/127\.0\.0\.1:\d+$/.test(testRegistry),
  );
const registry = testRegistry ?? "https://registry.npmjs.org";
const dir = resolve(folder);
const candidate = JSON.parse(readFileSync(join(dir, "candidate.json"), "utf8"));
const plan = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));
assert.equal(candidate.commit, plan.sha);
const version = plan.units[unit].version;
const tag = version.includes("-") ? "next" : "latest";
const names =
  unit === "framework"
    ? ["@intloom/loom-sdk", "@intloom/compiler", "@intloom/kernel"]
    : ["@intloom/cli", "intloom"];
const prefix = mkdtempSync(join(tmpdir(), "intloom-registry-"));
process.on("exit", () => rmSync(prefix, { recursive: true, force: true }));
async function lookup(name, ver) {
  const r = await fetch(
    `${registry}/${encodeURIComponent(name)}/${encodeURIComponent(ver)}`,
  );
  if (r.status === 404) return undefined;
  if (!r.ok) throw new Error(`Registry lookup failed: ${r.status} ${name}`);
  return r.json();
}
for (const name of names) {
  const pkg = candidate.packages.find((p) => p.name === name);
  assert.equal(pkg?.version, version);
  const archive = join(dir, pkg.file);
  const integrity =
    "sha512-" +
    createHash("sha512").update(readFileSync(archive)).digest("base64");
  assert.equal(integrity, pkg.integrity);
  if (action === "inspect") continue;
  if (!testRegistry) assert.ok(plan.units[unit].changed);
  for (const [dep, required] of Object.entries(pkg.dependencies ?? {})) {
    if (dep.startsWith("@intloom/"))
      assert.equal(
        (await lookup(dep, required))?.version,
        required,
        `${dep}@${required} unavailable`,
      );
  }
  let published = await lookup(name, version);
  if (!published && action === "publish") {
    // Use the semver dependency of the npm CLI installed on the publishing runner.
    const npmRoot = execFileSync("npm", ["root", "--global"], {
      encoding: "utf8",
    }).trim();
    const semver = createRequire(join(npmRoot, "npm/package.json"))("semver");
    const current = await lookup(name, tag);
    assert.ok(
      !current || semver.gt(version, current.version),
      `A newer version already owns ${name}@${tag}`,
    );
    execFileSync(
      "npm",
      [
        "publish",
        archive,
        `--registry=${registry}`,
        "--access=public",
        "--tag",
        tag,
        "--ignore-scripts",
      ],
      { stdio: "inherit" },
    );
  }
  for (let attempt = 0; !published && attempt < 30; attempt++) {
    await delay(2000);
    published = await lookup(name, version);
  }
  assert.equal(
    published?.dist.integrity,
    integrity,
    `${name} registry integrity`,
  );
  if (action === "verify") {
    assert.equal(
      (await lookup(name, tag))?.version,
      version,
      `${name} channel`,
    );
    const destination = join(prefix, name.replaceAll("/", "-"));
    execFileSync(
      "npm",
      [
        "install",
        "--prefix",
        destination,
        ...(unit === "cli" ? ["--global"] : []),
        `--registry=${registry}`,
        "--no-audit",
        "--no-fund",
        `${name}@${version}`,
      ],
      { stdio: "inherit" },
    );
    if (name === "@intloom/compiler") {
      const project = join(destination, "package.json");
      writeFileSync(
        project,
        JSON.stringify({
          ...JSON.parse(readFileSync(project, "utf8")),
          name: "simple",
          version: "1.0.0",
          type: "module",
        }),
      );

      copyFileSync(
        new URL(
          "../../test/fixtures/compiler-simple.ts.fixture",
          import.meta.url,
        ),
        join(destination, "loom.ts"),
      );
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          'import {compileLoom} from "@intloom/compiler"; const built = await compileLoom({entryFile:"loom.ts",outDir:"compiled",target:"node22"}); if(!built.ok) throw new Error(JSON.stringify(built));',
        ],
        { cwd: destination, stdio: "inherit" },
      );
    }
    if (unit === "cli") {
      const bin = join(destination, "bin/intloom");
      assert.equal(
        execFileSync(bin, ["--version"], { encoding: "utf8" }).trim(),
        version,
      );
      const env = {
        ...process.env,
        INTLOOM_DATA_DIR: join(destination, "service"),
        npm_config_prefix: destination,
      };
      const socket = createServer().listen(0, "127.0.0.1");
      await once(socket, "listening");
      const port = socket.address().port;
      await new Promise((done) => socket.close(done));
      mkdirSync(env.INTLOOM_DATA_DIR);
      writeFileSync(
        join(env.INTLOOM_DATA_DIR, "intloom.yaml"),
        JSON.stringify({ version: 1, service: { port } }),
      );
      const draft = join(destination, "author");
      execFileSync(bin, ["dev", "init", draft, "--id", "hello", "--plain"], {
        cwd: destination,
        env,
      });
      const template = JSON.parse(
        readFileSync(join(draft, "package.json"), "utf8"),
      );
      assert.equal(
        template.devDependencies["@intloom/loom-sdk"],
        pkg.name === "intloom"
          ? candidate.packages.find((p) => p.name === "@intloom/cli")
              .dependencies["@intloom/loom-sdk"]
          : pkg.dependencies["@intloom/loom-sdk"],
      );
      if (name === "intloom") {
        execFileSync(
          "npm",
          ["install", `--registry=${registry}`, "--no-audit", "--no-fund"],
          { cwd: draft, stdio: "inherit" },
        );
        execFileSync("npm", ["run", "build"], { cwd: draft, stdio: "inherit" });
      }
      execFileSync(
        bin,
        ["install", join(dir, "looms/order-total-1.0.0.tgz"), "--plain"],
        { cwd: destination, env },
      );
      try {
        const result = JSON.parse(
          execFileSync(
            bin,
            [
              "run",
              "order-total@1.0.0",
              "--input",
              '{"prices":[19,23]}',
              "--plain",
            ],
            { cwd: destination, env, encoding: "utf8" },
          ),
        );
        assert.equal(result.data.status, "succeeded");
        assert.equal(result.data.output, 42);
      } finally {
        if (existsSync(join(env.INTLOOM_DATA_DIR, "service.json")))
          await shutdown(bin, env.INTLOOM_DATA_DIR);
      }
    } else {
      execFileSync(
        process.execPath,
        ["--input-type=module", "-e", `await import(${JSON.stringify(name)})`],
        { cwd: destination },
      );
    }
  }
}
