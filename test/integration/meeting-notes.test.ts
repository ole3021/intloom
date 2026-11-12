import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { createServer } from "node:http";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createServiceClient } from "../../apps/cli/src/service/client.ts";
import { cliArgs, shutdown } from "../fixtures/cli.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));

test("scoped npm package installs by name and exposes the verified meeting-notes editor and input contract", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "intloom-meeting-contract-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const prepared = process.env.INTLOOM_CANDIDATE_DIR
    ? join(process.env.INTLOOM_CANDIDATE_DIR, "npm-looms", "meeting-notes")
    : join(output, "package");
  await exec(process.execPath, [
    join(root, "examples/meeting-notes/scripts/prepare.mjs"),
    prepared,
  ]);
  const manifest = JSON.parse(
    await readFile(join(prepared, "package.json"), "utf8"),
  );
  assert.equal(manifest.name, "@intloom/meeting-notes");
  assert.equal(manifest.publishConfig.access, "public");
  const commandDir = join(prepared, "commands/summarize");
  const runtime = await import(
    pathToFileURL(join(commandDir, "runtime.mjs")).href
  );
  const editor = await readFile(
    join(root, "examples/meeting-notes/editor.md"),
    "utf8",
  );
  assert.equal(
    runtime.default.entry.uses.agents[0].instructions,
    editor.replace(/^---[\s\S]*?\n---\r?\n/, "").trim(),
  );
  const contract = JSON.parse(
    await readFile(join(commandDir, "command.json"), "utf8"),
  );
  const schema = z.fromJSONSchema(contract.input);
  const file = { kind: "input-file", path: "notes.md" };
  for (const input of [{ prompt: "We agreed to pilot." }, { files: [file] }]) {
    assert.deepEqual(schema.parse(input), input);
  }
  for (const input of [
    {},
    { prompt: "" },
    { files: [] },
    { files: [file, file] },
    { prompt: "notes", files: [file] },
    { files: ["notes.md"] },
    { prompt: "notes", extra: true },
  ]) {
    assert.equal(schema.safeParse(input).success, false);
  }
  const { stdout: json } = await exec(
    "npm",
    [
      "pack",
      prepared,
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      output,
    ],
    { cwd: output },
  );
  const [packed] = JSON.parse(json);
  assert.ok(
    packed.files.every(
      (f: { path: string }) =>
        ["package.json", "README.md", "LICENSE", "loom.yaml"].includes(
          f.path,
        ) || f.path.startsWith("commands/"),
    ),
  );
  const bytes = await readFile(join(output, packed.filename));
  const transcript = "Lin: We agreed to keep the pilot small.";
  let modelRequests = 0;
  let permanentTimeout = false;
  let authError = 0;
  let finishReason = "stop";
  const registry = createServer((req, res) => {
    if (req.url === "/v1/chat/completions") {
      if (++modelRequests === 1 || permanentTimeout) return; // Simulate waiting for response headers.
      if (authError) {
        res.writeHead(authError, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: "private provider diagnostic",
              type: "invalid_api_key",
            },
          }),
        );
        return;
      }
      const notes = {
        kind: "action",
        title: "Pilot",
        fullHeading: "Minutes",
        sections: [
          {
            heading: "Decisions",
            points: [
              {
                statement: "Keep the pilot small.",
                highlight: true,
                evidence: [{ line: 1, quote: transcript }],
              },
            ],
          },
        ],
      };
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: "completion",
          object: "chat.completion",
          created: 1,
          model: "gpt-4.1-mini",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: JSON.stringify(notes) },
              finish_reason: finishReason,
            },
          ],
        }),
      );
      return;
    }
    if (decodeURIComponent(req.url ?? "") === "/" + manifest.name) {
      const entry = {
        ...manifest,
        dist: { integrity: packed.integrity, tarball: origin + "/package" },
      };
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          name: manifest.name,
          "dist-tags": { latest: manifest.version },
          versions: { [manifest.version]: entry },
        }),
      );
    } else if (req.url === "/package") res.end(bytes);
    else res.writeHead(404).end();
  }).listen(0, "127.0.0.1");
  await once(registry, "listening");
  t.after(() => registry.close());
  const address = registry.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const bin = join(root, "apps/cli/dist/bin.js"),
    data = join(output, "data");
  const env = {
    ...process.env,
    npm_config_registry: origin,
    npm_config_prefix: join(output, "prefix"),
    npm_config_cache: join(output, "cache"),
  };
  await mkdir(data, { recursive: true });
  await writeFile(
    join(data, "intloom.yaml"),
    JSON.stringify({
      version: 1,
      harness: "mastra",
      models: {
        editor: {
          provider: "openai",
          model: "gpt-4.1-mini",
          credentialRef: "env:MEETING_TEST_KEY",
          options: {
            baseUrl: origin + "/v1",
            api: "chat",
            requestTimeoutMs: 500,
            totalTimeoutMs: 15000,
          },
        },
      },
      profiles: { default: "editor", standard: "editor" },
    }),
  );
  await writeFile(join(data, ".env"), "MEETING_TEST_KEY=local-test-only\n");
  t.after(() => shutdown(bin, data).catch(() => {}));
  await exec(
    process.execPath,
    cliArgs(bin, data, "install", manifest.name, "--plain"),
    { cwd: output, env },
  );
  const { stdout } = await exec(
    process.execPath,
    cliArgs(bin, data, "run", manifest.name, "--plain"),
    { cwd: output, env },
  );
  assert.match(stdout, /summarize/);
  assert.match(stdout, /@intloom\/meeting-notes/);
  const { stdout: completed, stderr: progress } = await exec(
    process.execPath,
    cliArgs(
      bin,
      data,
      "run",
      manifest.name,
      "summarize",
      "--prompt",
      transcript,
      "--plain",
    ),
    { cwd: output, env },
  );
  const run = JSON.parse(completed.trim().split("\n").at(-1)!).data;
  assert.equal(run.status, "succeeded");
  assert.equal(modelRequests, 2);
  assert.match(progress, /timed out · retrying/);
  assert.match(progress, /Waiting for model response · attempt 2/);
  const saved = join(output, "minutes.md");
  await exec(
    process.execPath,
    cliArgs(
      bin,
      data,
      "artifact",
      "export",
      run.output.id,
      "--out",
      saved,
      "--plain",
    ),
    { cwd: output, env },
  );
  assert.match(await readFile(saved, "utf8"), /Keep the pilot small/);

  const client = createServiceClient(data);
  const { ref } = await client("getLoom", [
    { id: manifest.name, command: "summarize" },
  ]);
  async function launch() {
    const run = await client("createRun", [
      { loom: ref, input: { prompt: transcript } },
    ]);
    await client("startRun", [run.id]);
    return run.id;
  }
  async function poll(
    id: string,
    until: (view: Awaited<ReturnType<typeof activity>>) => boolean,
  ) {
    for (let i = 0; i < 150; i++) {
      const view = await activity(id);
      if (until(view)) return view;
      await delay(50);
    }
    throw Error("Model did not reach expected state");
  }
  function activity(id: string) {
    return client("getRunActivity", [id]);
  }
  await assert.rejects(client("createRun", [{ loom: ref, input: {} }]), {
    code: "INPUT_INVALID",
  });
  const globalConfig = join(data, "intloom.yaml");
  const originalConfig = await readFile(globalConfig, "utf8");
  async function refused(input: object, code: string, message: RegExp) {
    const run = await client("createRun", [{ loom: ref, input }]);
    await assert.rejects(client("startRun", [run.id]), { code, message });
    const saved = await client("getRun", [run.id]);
    assert.equal(saved.status, "failed");
    assert.equal(saved.startedAt, undefined);
    const events = await client("listRunEvents", [{ runId: run.id }]);
    assert.deepEqual(
      events.items.map((e) => e.type),
      ["run.created", "run.failed"],
    );
    assert.equal(modelRequests, 2);
  }
  await refused(
    { files: [{ kind: "input-file", path: join(output, "missing.txt") }] },
    "INPUT_FILE_MISSING",
    /missing.txt/,
  );
  await writeFile(globalConfig, "version: 1\n");
  await refused(
    { prompt: transcript },
    "BINDING_UNAVAILABLE",
    /profiles.default/,
  );
  await writeFile(globalConfig, "version: [");
  await refused({ prompt: transcript }, "BINDING_UNAVAILABLE", /intloom.yaml/);
  const openCodeConfig = JSON.parse(originalConfig);
  openCodeConfig.harness = "opencode";
  openCodeConfig.models.meeting = {
    ...openCodeConfig.models.editor,
    provider: "alibaba",
    model: "qwen3.8-flash",
    options: { baseUrl: origin + "/v1", reasoningEffort: "none" },
  };
  openCodeConfig.bindings = {
    [`${manifest.name}@${manifest.version}`]: { editor: "meeting" },
  };
  await writeFile(globalConfig, JSON.stringify(openCodeConfig));
  await refused(
    { prompt: transcript },
    "BINDING_UNAVAILABLE",
    /Mastra.*Alibaba chat/,
  );
  await writeFile(globalConfig, originalConfig);
  for (const envFile of ["", 'MEETING_TEST_KEY="   "']) {
    await writeFile(join(data, ".env"), envFile);
    await refused(
      { prompt: transcript },
      "BINDING_UNAVAILABLE",
      /MEETING_TEST_KEY/,
    );
  }
  await writeFile(join(data, ".env"), "MEETING_TEST_KEY=local-test-only\n");
  permanentTimeout = true;
  const failed = await launch();
  const terminal = await poll(failed, (view) => view.run.status === "failed");
  assert.equal(terminal.run.error?.code, "MODEL_REQUEST_TIMEOUT");
  assert.equal(modelRequests, 4);
  const cancelled = await launch();
  await poll(cancelled, (view) =>
    view.activeExecutions.some((call) => call.request?.status === "retrying"),
  );
  await client("cancelRun", [cancelled]);
  await poll(cancelled, (view) => view.run.status === "cancelled");
  assert.equal(modelRequests, 5);
  permanentTimeout = false;
  for (const status of [401, 403]) {
    authError = status;
    const before: number = modelRequests;
    const run = await launch();
    const { run: rejected } = await poll(
      run,
      (view) => view.run.status === "failed",
    );
    assert.equal(rejected.error?.code, "MODEL_AUTH_FAILED");
    assert.deepEqual(rejected.error?.details, { status });
    assert.doesNotMatch(
      JSON.stringify(rejected.error),
      /private provider diagnostic|local-test-only/,
    );
    assert.equal(modelRequests, before + 1);
  }
  authError = 0;
  finishReason = "length";
  const truncated = await launch();
  const { run: incomplete } = await poll(
    truncated,
    (view) => view.run.status === "failed",
  );
  assert.equal(incomplete.error?.code, "MODEL_INCOMPLETE");
  assert.deepEqual(incomplete.error?.details, { finishReason: "length" });
});
