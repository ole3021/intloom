// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: This explicit Node acceptance command does not run through Turbo or cache model requests.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import {
  buildPackage,
  compileLoom,
} from "../../../packages/compiler/dist/index.js";
import { openService } from "../../../apps/cli/dist/service/server.js";
import { modelSchema } from "../../../packages/kernel/dist/execution/bindings.js";
import { cliArgs } from "../../fixtures/cli.mjs";
import type {
  RunActivityView,
  RunEvent,
  RunView,
} from "../../../packages/loom-sdk/dist/index.js";

const configFile = process.env.INTLOOM_E2E_CONFIG;
const configured = configFile
  ? JSON.parse(await readFile(configFile, "utf8"))
  : process.env.INTLOOM_E2E_PROVIDER === "minimax-cn" &&
      process.env.LOOM_TEST_LLM_HOST &&
      process.env.LOOM_TEST_LLM_MODEL
    ? {
        provider: "minimax-cn",
        model: process.env.LOOM_TEST_LLM_MODEL,
        credentialRef: "env:LOOM_TEST_LLM_KEY",
        options: { baseUrl: process.env.LOOM_TEST_LLM_HOST },
      }
    : (() => {
        throw new Error(
          "Set INTLOOM_E2E_CONFIG to a model binding JSON, or explicitly select INTLOOM_E2E_PROVIDER=minimax-cn with LOOM_TEST_LLM_HOST/MODEL/KEY. No automatic credential selection or skip.",
        );
      })();
const parsed = modelSchema.safeParse(configured);
assert.ok(
  parsed.success,
  "Expected a model binding with provider, model and an env: credential reference.",
);
const model = parsed.data;
const credentialName = /^env:([A-Za-z_][A-Za-z0-9_]*)$/.exec(
  model.credentialRef,
)?.[1];
assert.ok(credentialName, "Use an env:NAME credential reference.");
assert.ok(
  process.env[credentialName],
  `Set ${credentialName} before running test:intg.`,
);
const modes = (
  process.env.INTLOOM_E2E_SCENARIOS ?? "text,structured,tool,report"
).split(",");
assert.ok(
  modes.length > 0 &&
    new Set(modes).size === modes.length &&
    modes.every((mode) =>
      ["text", "structured", "tool", "report"].includes(mode),
    ),
  "Select non-repeated scenarios from text, structured, tool and report.",
);
const maxRequests = process.env.INTLOOM_E2E_MAX_REQUESTS
  ? Number(process.env.INTLOOM_E2E_MAX_REQUESTS)
  : undefined;
assert.ok(
  maxRequests === undefined ||
    (Number.isSafeInteger(maxRequests) && maxRequests > 0),
  "INTLOOM_E2E_MAX_REQUESTS must be a positive integer.",
);
const directory = process.env.INTLOOM_E2E_DIR
  ? resolve(process.env.INTLOOM_E2E_DIR)
  : await mkdtemp(join(tmpdir(), "intloom-execution-models-"));
const root = fileURLToPath(new URL("../../../", import.meta.url));
await writeFile(
  join(directory, "intloom.yaml"),
  JSON.stringify({
    version: 1,
    harness: "mastra",
    models: { live: model },
    profiles: { default: "live" },
  }),
);
const service = await openService({
  mcpPort: 0,
  dataDir: join(directory, "data"),
  projectDir: directory,
});
const host = service.kernel;
const evidence: {
  mode: string;
  run?: RunView;
  activity?: RunActivityView;
  exportedFile?: string;
  events?: RunEvent[];
  result?: string;
  error?: string;
}[] = [];
const requests: {
  host: string;
  path: string;
  status?: number;
  errorResponse?: {
    contentType: string;
    requestId: string;
    body: string;
  };
  maxOutputTokens?: number;
  structuredOutput?: { type: string; strict?: boolean; schema?: unknown };
  responseModel?: string;
  costUsd?: number;
  costEstimated?: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
  };
}[] = [];
const fetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (maxRequests !== undefined && requests.length >= maxRequests)
    throw new Error(
      "Model request budget exceeded; no further request dispatched.",
    );
  const url = new URL(input instanceof Request ? input.url : input);
  const request: (typeof requests)[number] = {
    host: url.host,
    path: url.pathname,
  };
  if (typeof init?.body === "string") {
    const body = JSON.parse(init.body);
    request.maxOutputTokens = body.max_output_tokens ?? body.max_tokens;
    const format = body.text?.format ?? body.response_format;
    if (format?.type === "json_schema")
      request.structuredOutput = {
        type: format.type,
        strict: format.strict ?? format.json_schema?.strict,
        schema: format.schema ?? format.json_schema?.schema,
      };
  }
  requests.push(request);
  const response = await fetch(input, init);
  request.status = response.status;
  if (!response.ok) {
    const diagnostic = {
      contentType: response.headers.get("content-type") ?? "",
      requestId:
        response.headers.get("x-opencode-log-id") ??
        response.headers.get("x-request-id") ??
        "",
      body: await response.clone().text(),
    };
    const credential = process.env[credentialName];
    for (const field of ["contentType", "requestId", "body"] as const) {
      const value = credential
        ? diagnostic[field].replaceAll(credential, "[REDACTED]")
        : diagnostic[field];
      diagnostic[field] = value
        .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [REDACTED]")
        .slice(0, 4096);
    }
    request.errorResponse = diagnostic;
  }
  if (
    response.ok &&
    response.headers.get("content-type")?.includes("application/json")
  ) {
    const body = (await response.clone().json()) as {
      model?: string;
      usage?: {
        cost?: number;
        opencode?: { estimated?: boolean };
        input_tokens?: number;
        output_tokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
        prompt_tokens_details?: { cached_tokens?: number };
      };
    };
    if (body.model) request.responseModel = body.model;
    if (typeof body.usage?.cost === "number") {
      request.costUsd = body.usage.cost;
      request.costEstimated = body.usage.opencode?.estimated ?? false;
    }
    const inputTokens = body.usage?.input_tokens ?? body.usage?.prompt_tokens;
    const outputTokens =
      body.usage?.output_tokens ?? body.usage?.completion_tokens;
    if (inputTokens !== undefined && outputTokens !== undefined)
      request.usage = {
        inputTokens,
        outputTokens,
        cachedInputTokens:
          body.usage?.input_tokens_details?.cached_tokens ??
          body.usage?.prompt_tokens_details?.cached_tokens ??
          0,
      };
  }
  return response;
};
const save = () =>
  writeFile(
    join(directory, "evidence.json"),
    JSON.stringify(
      {
        node: process.version,
        model,
        scenarios: modes,
        maxRequests,
        requests,
        evidence,
      },
      null,
      2,
    ),
  );
console.log(`Evidence directory: ${directory}`);
try {
  for (const mode of modes) {
    const entry: (typeof evidence)[number] = { mode };
    evidence.push(entry);
    if (mode === "report") {
      const archive = await buildPackage(
        join(import.meta.dirname, "incident-report"),
        directory,
      );
      const exec = promisify(execFile);
      const cli = async (...args: string[]) => {
        const binary = join(root, "apps/cli/dist/bin.js");
        const { stdout } = await exec(
          process.execPath,
          cliArgs(binary, join(directory, "data"), ...args, "--plain"),
          {
            cwd: directory,
            env: { ...process.env, npm_config_prefix: join(directory, "npm") },
          },
        );
        return JSON.parse(stdout.trimEnd().split("\n").at(-1) ?? "").data;
      };
      await writeFile(join(directory, "package.json"), '{"private":true}', {
        flag: "wx",
      });
      await cli("install", archive, "--project", directory);
      const run = await cli(
        "run",
        "incident-report",
        "summarize",
        "--timeout",
        "120",
        "--input",
        JSON.stringify({
          notes:
            "INC-1042 at the Shanghai site. Batch A had 19 failed uploads. Batch B had 23.",
        }),
      );
      entry.run = await host.getRun(run.id);
      entry.activity = await host.getRunActivity(run.id);
      assert.equal(entry.run.status, "succeeded");
      assert.equal(entry.activity.usage.finishedCalls, 1);
      entry.exportedFile = join(directory, "handover.txt");
      await cli(
        "artifact",
        "export",
        run.output.id,
        "--out",
        entry.exportedFile,
      );
      const report = await readFile(entry.exportedFile, "utf8");
      assert.match(report, /\bINC-1042\b/);
      assert.match(report, /\bShanghai\b/i);
      assert.match(report, /\b42 failed uploads\b/i);
      entry.result = "passed";
      await save();
      console.log(`report: passed (${run.id})`);
      continue;
    }
    const author = join(directory, mode);
    await mkdir(author, { recursive: true });
    await symlink(
      join(root, "packages/compiler/node_modules"),
      join(author, "node_modules"),
    );
    await writeFile(
      join(author, "loom.ts"),
      `
import {defineAgent,defineCode,defineLoom,defineTool} from "@intloom/loom-sdk";import {z} from "zod";
let calls=0;
const add=defineTool({id:"add",description:"Add two numbers; call this to compute the sum",inputSchema:z.strictObject({a:z.number(),b:z.number()}),outputSchema:z.number(),execute:({inputData})=>{calls++;return inputData.a+inputData.b;}});
const text=defineAgent({id:"text",inputSchema:z.string(),outputSchema:z.string(),instructions:"Follow the request exactly.",prompt:({inputData})=>inputData,model:{slot:"model"},outputMode:"text",generation:{maxSteps:2,maxOutputTokens:2048}});
const structured=defineAgent({id:"structured",inputSchema:z.string(),outputSchema:z.strictObject({value:z.literal(42)}),instructions:"Return the requested JSON object.",prompt:({inputData})=>inputData,model:{slot:"model"},outputMode:"structured",generation:{maxSteps:2,maxOutputTokens:2048}});
const tool=defineAgent({id:"tool",inputSchema:z.string(),outputSchema:z.string(),instructions:"Use the add tool to compute the answer. Return only the numerical answer after the tool succeeds.",prompt:({inputData})=>inputData,model:{slot:"model"},outputMode:"text",tools:[add],generation:{maxSteps:2,maxOutputTokens:2048}});
export default defineLoom({id:"execution-real-${mode}",version:"1.0.0",description:"Explicit model acceptance",entry:defineCode({id:"execute",inputSchema:z.string(),outputSchema:z.strictObject({value:${mode === "structured" ? "z.strictObject({value:z.literal(42)})" : "z.string()"},calls:z.number()}),uses:{agents:[${mode}]},execute:async({inputData,context})=>({value:await context.agents.generate(${mode},inputData),calls})})});`,
    );
    await writeFile(
      join(author, "package.json"),
      JSON.stringify({ name: `execution-real-${mode}`, type: "module" }),
    );
    const compiled = await compileLoom({
      entryFile: join(author, "loom.ts"),
      outDir: join(directory, `${mode}-artifact`),
      target: "node22",
    });
    assert.ok(compiled.ok, JSON.stringify(compiled));
    const loom = await host.installLoom({ source: compiled.artifactDir });
    const created = await host.createRun({
      loom,
      input:
        mode === "text"
          ? "Reply with exactly READY."
          : mode === "structured"
            ? "Return an object whose value is 42."
            : "Call add once with a=19 and b=23, then return only the answer.",
    });
    entry.run = created;
    await save();
    console.log(`${mode}: ${created.id}`);
    await host.startRun(created.id);
    const start = Date.now();
    let run = await host.getRun(created.id);
    while (["running", "stopping"].includes(run.status)) {
      if (Date.now() - start > 120_000 && run.status === "running")
        await host.cancelRun(run.id, "E2E observation deadline");
      await delay(100);
      run = await host.getRun(run.id);
    }
    entry.run = run;
    entry.activity = await host.getRunActivity(run.id);
    entry.events = [];
    let after = 0;
    for (;;) {
      const page = await host.listRunEvents({
        runId: run.id,
        after,
        limit: 100,
      });
      entry.events.push(...page.items);
      if (page.nextAfter === undefined) break;
      after = page.nextAfter;
    }
    await save();
    assert.equal(
      run.status,
      "succeeded",
      `${mode} failed; no retry or later scenario was dispatched.`,
    );
    assert.equal(entry.activity.coverage, "complete");
    assert.equal(entry.activity.throughSeq, entry.events.at(-1)?.seq);
    assert.equal(entry.activity.usage.calls, 1);
    assert.equal(entry.activity.usage.finishedCalls, 1);
    assert.ok(entry.events.some((event) => event.type === "agent.started"));
    assert.ok(
      entry.events.some((event) => event.type === "model.step.finished"),
    );
    const output = run.output as { value: unknown; calls: number };
    if (mode === "text") assert.equal(String(output.value).trim(), "READY");
    if (mode === "structured") {
      assert.deepEqual(output.value, { value: 42 });
      assert.equal(requests.at(-1)?.structuredOutput?.type, "json_schema");
      assert.equal(requests.at(-1)?.structuredOutput?.strict, true);
    }
    if (mode === "tool") {
      assert.equal(String(output.value).trim(), "42");
      assert.equal(output.calls, 1);
      const modelStart = entry.events.find(
        (event) => event.type === "model.invocation.started",
      );
      const toolStart = entry.events.find(
        (event) => event.type === "tool.started",
      );
      assert.ok(modelStart && toolStart);
      assert.equal(toolStart.parentExecutionId, modelStart.executionId);
    }
    entry.result = "passed";
    await save();
    console.log(`${mode}: passed`);
  }
} catch (error) {
  const last = evidence.at(-1);
  if (last) {
    last.result = "failed";
    last.error = error instanceof Error ? error.message : "failed";
  } else
    evidence.push({
      mode: modes[0] ?? "unknown",
      result: "failed_before_run",
      error: error instanceof Error ? error.message : "failed",
    });
  await save();
  throw new Error(
    "Model acceptance stopped. Inspect the retained evidence; no automatic retry.",
  );
} finally {
  await service.close();
  globalThis.fetch = fetch;
}
