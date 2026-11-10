import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { satisfies, valid } from "semver";
import { runtimeBinding } from "../../packages/kernel/dist/execution/loader.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const graph = {
  "packages/loom-sdk": [],
  "packages/compiler": ["@intloom/loom-sdk"],
  "packages/kernel": ["@intloom/loom-sdk"],
  "apps/cli": ["@intloom/loom-sdk", "@intloom/kernel"],
};

test("saved runtime identities use the shipped Kernel and pinned engine versions", () => {
  const manifest = JSON.parse(
    readFileSync(join(root, "packages/kernel/package.json"), "utf8"),
  ) as { version: string; dependencies: Record<string, string> };
  assert.deepEqual(runtimeBinding({ components: { main: { kind: "code" } } }), {
    kind: "code",
    version: manifest.version,
    nodeMajor: Number.parseInt(process.versions.node, 10),
  });
  assert.deepEqual(
    runtimeBinding({ components: { main: { kind: "agent" } } }),
    {
      kind: "mastra",
      version: manifest.version,
      nodeMajor: Number.parseInt(process.versions.node, 10),
      engineVersion: manifest.dependencies["@mastra/core"],
      storageVersion: manifest.dependencies["@mastra/libsql"],
    },
  );
});

test("framework packages keep their declared dependency boundaries", () => {
  for (const [directory, allowed] of Object.entries(graph)) {
    const manifest = JSON.parse(
      readFileSync(join(root, directory, "package.json"), "utf8"),
    ) as {
      name: string;
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const deps = manifest.dependencies ?? {};
    assert.deepEqual(
      Object.keys(deps)
        .filter((name) => name.startsWith("@intloom/"))
        .sort(),
      [...allowed].sort(),
      manifest.name,
    );
    for (const [name, version] of Object.entries(deps)) {
      if (name.startsWith("@intloom/")) {
        assert.equal(version, "workspace:*");
      } else {
        assert.ok(valid(version), `${manifest.name}: ${name} must be exact`);
      }
    }
    if (directory === "packages/loom-sdk") {
      assert.deepEqual(Object.keys(deps), []);
      assert.deepEqual(Object.keys(manifest.peerDependencies ?? {}), ["zod"]);
    }
  }
});

test("public entry points are explicit ESM exports, and CLI is a binary", () => {
  for (const directory of Object.keys(graph)) {
    const manifest = JSON.parse(
      readFileSync(join(root, directory, "package.json"), "utf8"),
    ) as {
      type: string;
      exports?: Record<string, { types: string; import: string }>;
      bin?: Record<string, string>;
    };
    assert.equal(manifest.type, "module");
    if (directory === "apps/cli") {
      assert.deepEqual(manifest.exports, {
        "./bin": "./dist/bin.js",
        "./local-service": {
          types: "./dist/local-service.d.ts",
          import: "./dist/local-service.js",
        },
      });
      assert.deepEqual(manifest.bin, { intloom: "./dist/bin.js" });
      continue;
    }
    const expected =
      directory === "packages/loom-sdk"
        ? [".", "./package-format", "./json"]
        : directory === "packages/kernel"
          ? [".", "./lifecycle"]
          : ["."];
    assert.deepEqual(Object.keys(manifest.exports ?? {}), expected);
    for (const target of Object.values(manifest.exports ?? {})) {
      assert.ok(target.types.endsWith(".d.ts"));
      assert.ok(target.import.endsWith(".js"));
    }
  }
});

type InstalledManifest = {
  name: string;
  version: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

function installedManifest(from: string, name: string) {
  const resolved = findPackageJSON(name, from);
  assert.ok(resolved, `Cannot locate manifest for ${name}`);
  const path = realpathSync(resolved);
  const manifest = JSON.parse(readFileSync(path, "utf8")) as InstalledManifest;
  return { path, manifest };
}

test("installed direct versions and required peers match package contracts", () => {
  for (const directory of Object.keys(graph)) {
    const path = join(root, directory, "package.json");
    const manifest = JSON.parse(readFileSync(path, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
      const installed = installedManifest(path, name);
      if (!version.startsWith("workspace:")) {
        assert.equal(
          installed.manifest.version,
          version,
          `${directory}: ${name}`,
        );
      }
      for (const [peer, range] of Object.entries(
        installed.manifest.peerDependencies ?? {},
      )) {
        if (installed.manifest.peerDependenciesMeta?.[peer]?.optional) continue;
        const peerVersion = installedManifest(installed.path, peer).manifest
          .version;
        assert.ok(
          satisfies(peerVersion, range),
          `${name}: ${peer}@${peerVersion} must satisfy ${range}`,
        );
      }
    }
  }
});
