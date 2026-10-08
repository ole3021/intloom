import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execute = promisify(execFile);
export async function packDirectory(source: string, destination: string) {
  const result = await execute(
    "npm",
    ["pack", "--ignore-scripts", "--json", "--pack-destination", destination],
    { cwd: source },
  );
  return join(destination, JSON.parse(result.stdout)[0].filename);
}

/** Compiled Specification-only Intent, with fixture-local unpublished dependencies. */
export async function packSpecification(base: string) {
  const file = findPackageJSON("@intloom/workflow-intent", import.meta.url);
  assert.ok(file);
  const directory = join(base, "intent-package");
  await cp(join(dirname(file), "dist"), directory, { recursive: true });
  const manifest = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  );
  for (const name of ["@intloom/workflow-sdk", "@intloom/utils", "zod"]) {
    const dependency = findPackageJSON(name, pathToFileURL(file));
    assert.ok(dependency);
    manifest.dependencies[name] = `file:${dirname(dependency)}`;
  }
  const entry = join(directory, "workflow.generated.js");
  await writeFile(
    join(directory, "workflow.full.js"),
    await readFile(entry, "utf8"),
  );
  await writeFile(
    entry,
    `import {blueprint as full,codes,agentSpecs as agents} from "./workflow.full.js";
const stage=full.stages.specification;
const agentIds=Object.values(stage.steps).filter(s=>s.execution.kind==="agent").map(s=>s.execution.agentId);
export const blueprint={flowName:full.flowName,entryStageName:"specification",stages:{specification:{...stage,on:{complete:{kind:"workflow_end"}}}}};
export {codes};
export const agentSpecs=Object.fromEntries(Object.entries(agents).filter(([id])=>agentIds.includes(id)));
`,
  );
  delete manifest.peerDependencies;
  await writeFile(join(directory, "package.json"), JSON.stringify(manifest));
  return packDirectory(directory, base);
}

export async function packFixture(
  base: string,
  version: string,
  compatible = true,
) {
  const directory = join(base, `fixture-${version}`);
  await mkdir(directory);
  const manifest = {
    name: "fixture-workflow",
    version,
    type: "module",
    ...(compatible
      ? { intloom: { type: "workflow", version: "2026-10-08" } }
      : {}),
    exports: {
      ".": { types: "./index.d.ts", default: "./index.js" },
      "./package.json": "./package.json",
    },
    scripts: {
      install:
        "node -e \"require('fs').writeFileSync('SCRIPT_RAN', 'unexpected')\"",
    },
  };
  await writeFile(join(directory, "package.json"), JSON.stringify(manifest));
  await writeFile(
    join(directory, "index.js"),
    "export const fixture = true;\n",
  );
  return { archive: await packDirectory(directory, base), manifest };
}
