import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
  readFile,
  lstat,
  readdir,
  readlink,
} from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  Client,
  StreamableHTTPClientTransport,
  type ClientOptions,
} from "@modelcontextprotocol/client";
import { stopService, serviceStatus } from "@intloom/cli";
import type { RunView } from "@intloom/kernel";
import { parse, stringify } from "yaml";

export const bin = fileURLToPath(new URL("../dist/bin.js", import.meta.url));
const execute = promisify(execFile);
export function pending(view: RunView) {
  assert.equal(view.status, "waiting");
  assert.ok(view.pendingAction);
  return view.pendingAction;
}
export async function cli(root: string, args: readonly string[]) {
  try {
    const result = await execute(
      process.execPath,
      [bin, "--project", root, ...args],
      { timeout: 20_000 },
    );
    return { ...result, code: 0 };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("stdout" in error) ||
      !("stderr" in error)
    )
      throw error;
    return {
      stdout: String(error.stdout),
      stderr: String(error.stderr),
      code: "code" in error ? error.code : 1,
    };
  }
}
export async function configureProject(
  root: string,
  changes: Record<string, unknown>,
) {
  const file = join(root, "intloom.yaml");
  const config = parse(await readFile(file, "utf8"));
  await writeFile(file, stringify({ ...config, ...changes }));
}

/** Keeps hand-authored protocol fixtures valid without exercising npm installation in every service test. */
export async function refreshFixtureInstallation(root: string) {
  const directory = join(root, ".intloom/workflows");
  const hash = createHash("sha256");
  async function walk(relative: string) {
    const file = join(directory, relative);
    const info = await lstat(file);
    hash.update(
      JSON.stringify([
        relative,
        info.isDirectory() ? "dir" : info.isSymbolicLink() ? "link" : "file",
      ]),
    );
    if (info.isDirectory()) {
      for (const name of (await readdir(file)).sort())
        await walk(join(relative, name));
    } else if (info.isSymbolicLink())
      hash.update(JSON.stringify(await readlink(file)));
    else
      hash.update(
        createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
      );
  }
  await walk("node_modules");
  const { workflows } = parse(
    await readFile(join(root, "intloom.yaml"), "utf8"),
  );
  await writeFile(
    join(directory, "installed.json"),
    JSON.stringify({ workflows, treeHash: hash.digest("hex") }),
  );
}

export async function projectFixture(
  t: TestContext,
  workflow = true,
  localStorage: "file" | "sqlite" = "file",
) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "intloom-cli-")));
  await writeFile(
    join(root, "intloom.yaml"),
    stringify({
      localStorage,
      workflows: workflow
        ? [
            {
              name: "fixture-workflow",
              version: "1.0.0",
              sha256: "a".repeat(64),
            },
          ]
        : [],
      intent: { apps: [] },
      llms: {
        default: {
          provider: "openai-compatible",
          model: "test",
          secret: "ENV.INTLOOM_CLI_TEST_KEY",
          baseURL: "https://model.invalid/v1",
        },
      },
    }),
  );
  if (workflow) {
    const installation = join(root, ".intloom/workflows");
    await mkdir(join(installation, "node_modules"), { recursive: true });
    const zod = findPackageJSON("zod", import.meta.url);
    assert.ok(zod);
    await symlink(dirname(zod), join(installation, "node_modules/zod"), "dir");
    const directory = join(installation, "node_modules/fixture-workflow");
    await mkdir(directory);
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        name: "fixture-workflow",
        version: "1.0.0",
        type: "module",
        intloom: { type: "workflow", version: "2026-10-08" },
        exports: {
          ".": { types: "./workflow.d.ts", default: "./workflow.js" },
          "./package.json": "./package.json",
        },
      }),
    );
    await writeFile(join(directory, "workflow.js"), compiledWorkflow);
    await refreshFixtureInstallation(root);
  }
  t.after(async () => {
    try {
      await serviceStatus(root);
      await stopService(root);
    } catch {
      /* startup-failure fixtures can be offline */
    }
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
export async function connection(root: string) {
  return JSON.parse(
    await readFile(join(root, ".intloom/connection.json"), "utf8"),
  ) as { port: number; token: string; storage: string };
}
export async function mcpClient(
  t: TestContext,
  root: string,
  options: ClientOptions = {},
  profile = "codex",
) {
  const saved = await connection(root);
  const client = new Client(
    { name: "codex-test-client", version: "1.0.0" },
    options,
  );
  const transport = new StreamableHTTPClientTransport(
    new URL(
      `http://127.0.0.1:${saved.port}/mcp${profile ? `/${profile}` : ""}`,
    ),
    { requestInit: { headers: { authorization: `Bearer ${saved.token}` } } },
  );
  await client.connect(transport, { timeout: 5_000 });
  t.after(async () => {
    try {
      if (transport.sessionId) await transport.terminateSession();
    } catch {
      /* host may have shut down */
    }
    await client.close();
  });
  return { client, transport };
}

/** Compiled fixture with an observable commit: writes a once record before answering so Code replay would cause an ID conflict. */
const compiledWorkflow = `import * as z from "zod";
export const blueprint = { flowName: "fixture", entryStageName: "first", stages: {
  first: { stageName: "first", initializeState: ({ runId, intent }) => ({ id: runId, intent }), stateSchema: z.object({ id: z.string(), intent: z.string(), answer: z.string().optional() }), entryStepName: "ask",
    steps: { ask: { stepName: "ask", execution: { kind: "code", codeId: "CODE-123456789012345678901" }, on: { complete: { kind: "stage_end" } } } }, on: { complete: { kind: "workflow_end" } } }
} };
export const codes = { "CODE-123456789012345678901": async (_input, access) => {
  const { id, intent } = access.state.value;
  await access.storage.commit([{ type: "append_record", id: "once-" + id, payload: { flowName: "fixture", stageName: "first", data: { intent } } }]);
  const answers = await access.interaction.askQuestions([{ id: "place", question: "Where should it be deployed?", options: [{ id: "local", label: "Local" }, { id: "cloud", label: "Cloud" }], isSkippable: false }, { id: "notes", question: "Any additional notes?", isSkippable: true }]);
  await access.state.update({ id, intent, answer: answers[0].answer });
  const decision = await access.interaction.confirm("Confirm saving?");
  await access.storage.commit([{ type: "append_record", id, payload: { flowName: "fixture", stageName: "first", data: { intent, answers, isConfirmed: decision.isConfirmed, ...(decision.feedback === undefined ? {} : { feedback: decision.feedback }) } } }]);
  if (intent === "fail-after-commit") throw new Error("after durable commit");
  return { outcome: "complete" };
} };
export const agentSpecs = {};
`;
