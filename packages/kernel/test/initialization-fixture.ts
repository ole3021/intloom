import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import type { TestContext } from "node:test";
import { parse, stringify } from "yaml";
import type { WorkflowDependency } from "../src/core/schemas/loom-config.ts";
import { testConfig } from "./agent-fixture.ts";

export async function initializationProject(t: TestContext) {
  const root = await realpath(
    await mkdtemp(resolve(tmpdir(), "workflow-init-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const installation = resolve(root, ".intloom/workflows");
  await mkdir(resolve(installation, "node_modules"), { recursive: true });
  const zod = findPackageJSON("zod", import.meta.url);
  if (!zod) throw new Error("Zod is not installed");
  await symlink(dirname(zod), resolve(installation, "node_modules/zod"), "dir");
  const workflows: WorkflowDependency[] = [];
  async function configure(value: string | Record<string, unknown>) {
    await writeFile(
      resolve(root, "intloom.yaml"),
      stringify({
        ...(typeof value === "string" ? parse(value) : value),
        workflows,
      }),
    );
  }
  await configure(testConfig());
  async function add(
    name: string,
    body: string,
    local = false,
    protocol = "2026-10-08",
  ) {
    const directory = resolve(installation, "node_modules", name);
    const output = local ? resolve(directory, "dist") : directory;
    await mkdir(output, { recursive: true });
    await writeFile(
      resolve(directory, "package.json"),
      JSON.stringify({
        name,
        version: "1.0.0",
        type: "module",
        intloom: { type: "workflow", version: protocol },
        exports: {
          ".": {
            types: local ? "./dist/workflow.d.ts" : "./workflow.d.ts",
            default: local ? "./dist/workflow.js" : "./workflow.js",
          },
          "./package.json": "./package.json",
        },
      }),
    );
    await writeFile(resolve(output, "workflow.js"), body);
    workflows.push({ name, version: "1.0.0", sha256: "a".repeat(64) });
    await configure(await readFile(resolve(root, "intloom.yaml"), "utf8"));
    return output;
  }
  return { root, installation, workflows, add, configure };
}

export function compiledWorkflow(
  flowName: string,
  codeId: string,
  agents: Record<string, string> = {},
) {
  return `import * as z from "zod";
export const blueprint = { flowName: ${JSON.stringify(flowName)}, entryStageName: "first", stages: {
  first: { stageName: "first", initializeState: () => ({ value: "initial" }), stateSchema: z.object({ value: z.string() }), entryStepName: "run",
    steps: { run: { stepName: "run", execution: { kind: "code", codeId: ${JSON.stringify(codeId)} }, on: { complete: { kind: "stage_end" } } } },
    on: { complete: { kind: "workflow_end" } } }
} };
export const codes = { [${JSON.stringify(codeId)}]: () => ({ outcome: "complete" }) };
export const agentSpecs = { ${Object.entries(agents)
    .map(
      ([id, role]) => `[${JSON.stringify(id)}]: {
  name: "reviewer", description: "Reviews", instructions: "Review changes", llm: ${JSON.stringify(role)},
  outputSchema: z.object({ outcome: z.string() }), skills: [], tools: []
}`,
    )
    .join(",")} };
`;
}
