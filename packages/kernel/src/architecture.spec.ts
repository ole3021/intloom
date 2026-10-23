import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const root = dirname(fileURLToPath(import.meta.url));
async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? sources(resolve(directory, entry.name))
          : entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")
            ? [resolve(directory, entry.name)]
            : [],
      ),
    )
  ).flat();
}
test("Execution and Access depend on capability contracts, never Runtime or host state", async () => {
  for (const owner of ["execution", "access"])
    for (const file of await sources(resolve(root, owner))) {
      const code = await readFile(file, "utf8");
      assert.doesNotMatch(
        code,
        /from\s+["'][^"']*\/(?:runtime|host|operations|transport)\//u,
        relative(root, file),
      );
      assert.doesNotMatch(code, /\bRunEntry\b/u, relative(root, file));
    }
});
test("Kernel source never imports its public barrel and exports no private wildcards", async () => {
  for (const file of await sources(root))
    assert.doesNotMatch(
      await readFile(file, "utf8"),
      /from\s+["']@intloom\/kernel(?:["']|\/src\/)/u,
      relative(root, file),
    );
  const manifest = JSON.parse(
    await readFile(resolve(root, "../package.json"), "utf8"),
  );
  assert.ok(
    !Object.keys(manifest.exports).some(
      (key) =>
        key.includes("*") ||
        key.startsWith("./service") ||
        key.startsWith("./runtime"),
    ),
  );
  assert.doesNotMatch(
    await readFile(resolve(root, "host/index.ts"), "utf8"),
    /from ["']\.\/entry\.ts["']/u,
  );
});

test("Operations and Runtime reference adjacent owners only through their declared ports and contracts", async () => {
  const contracts = new Set([
    "host/contracts.ts",
    "host/project-contracts.ts",
    "runtime/contracts.ts",
    "runtime/mutation.ts",
    "runtime/run-view.ts",
    "runtime/execution-policy.ts",
    "execution/contracts.ts",
    "execution/execution.ts",
    "execution/delegated/contracts.ts",
  ]);
  for (const owner of ["operations", "runtime", "execution", "access"]) {
    for (const file of await sources(resolve(root, owner))) {
      const code = await readFile(file, "utf8");
      for (const match of code.matchAll(
        /(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/gu,
      )) {
        const specifier = match[1];
        assert.ok(specifier);
        const dependency = relative(root, resolve(dirname(file), specifier));
        const target = dependency.split("/")[0];
        if (target === owner) continue;
        if (
          owner === "operations" &&
          ["host", "runtime", "execution"].includes(target ?? "")
        )
          assert.ok(
            contracts.has(dependency),
            `${relative(root, file)} imports ${dependency}`,
          );
        if (owner === "runtime") {
          assert.ok(
            !["host", "operations", "transport"].includes(target ?? ""),
            dependency,
          );
          if (target === "execution")
            assert.ok(contracts.has(dependency), dependency);
        }
        if (owner === "execution" || owner === "access")
          assert.ok(
            !["host", "runtime", "operations", "transport"].includes(
              target ?? "",
            ),
            dependency,
          );
        if (owner === "access")
          assert.notEqual(target, "execution", dependency);
      }
    }
  }
});
