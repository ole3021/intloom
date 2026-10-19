import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { TestContext } from "node:test";
import { LoomError } from "@intloom/utils";
import type { LinkedLoom } from "../../src/analyze/model.ts";

export async function artifacts(t: TestContext) {
  const root = await realpath(
    await mkdtemp(resolve(tmpdir(), "compiler-artifacts-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = resolve(root, "dist");
  await mkdir(resolve(output, "codes"), { recursive: true });
  const manifest = {
    exports: {
      "./package.json": "./package.json",
      ".": {
        types: "./loom.generated.d.ts",
        default: "./loom.generated.js",
      } as Record<string, string>,
    },
    files: ["**/*"],
    dependencies: {} as Record<string, string>,
    peerDependencies: {} as Record<string, string>,
    optionalDependencies: {} as Record<string, string>,
    devDependencies: {} as Record<string, string>,
  };
  await writeFile(resolve(output, "package.json"), JSON.stringify(manifest));
  await writeFile(
    resolve(output, "loom.generated.js"),
    'import run from "./codes/run.js";\nexport const blueprint = {};\nexport const codes = { "CODE-fixed": run };\nexport const agentSpecs = {};\n',
  );
  await writeFile(
    resolve(output, "loom.generated.d.ts"),
    "export declare const blueprint: {}; export declare const codes: {}; export declare const agentSpecs: {};",
  );
  await writeFile(resolve(output, "loom.generated.js.map"), "{}");
  const codeFile = resolve(output, "codes/run.js");
  await writeFile(
    codeFile,
    'export default function run() { return { outcome: "complete" }; }',
  );
  const loom: LinkedLoom = {
    model: {
      manifest: {
        name: "example",
        version: "1.0.0",
        type: "module",
        loom: {
          type: "loom",
          version: "2026-10-15",
          name: "example",
          inputs: [],
          entry: "main",
          stages: {},
        },
      },
      inputs: [],
      options: { packageRoot: root },
      loomName: "example",
      version: "1.0.0",
      entryStageName: "main",
      stages: {},
      codes: {
        run: {
          resourceKey: "run",
          location: { file: resolve(root, "loom.yaml") },
          module: {
            sourceFile: resolve(root, "codes/run.ts"),
            exportName: "default",
          },
        },
      },
      agents: {},
      assets: [],
    },
    codeIds: { run: "CODE-fixed" },
    agentIds: {},
    diagnostics: [],
  };
  return { root, output, manifest, loom, codeFile };
}

export function invalidOutput(message: RegExp) {
  return (error: unknown) => {
    assert.ok(LoomError.is(error));
    assert.equal(error.code, "INVALID_OUTPUT");
    assert.match(error.message, message);
    return true;
  };
}
