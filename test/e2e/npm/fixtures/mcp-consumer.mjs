import { cliArgs, shutdown } from "./cli.mjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
const exec = promisify(execFile);
const cli = resolve("node_modules/.bin/intloom");
const dataDir = resolve("outcomes-sdk");
await exec(process.execPath, [
  ...cliArgs(cli, dataDir),
  "dev",
  "init",
  "mcp-template",
  "--id",
  "consumer-mcp",
  "--name",
  "Consumer P7",
  "--plain",
]);
const template = JSON.parse(
  await readFile("mcp-template/package.json", "utf8"),
);
assert.equal(template.version, "0.1.0");
assert.equal(template.engines.node, "^22.22.0 || ^24.0.0 || ^26.0.0");
// Exercise the current published compiler on the generated project. The locked
// composition scenario below supplies its own scalar-output legacy fixture.
const { buildPackage } = await import("@intloom/compiler");
await buildPackage(resolve("mcp-template"), resolve("mcp-package"));
await writeFile(
  "mcp-template/loom.ts",
  `import {defineCode,defineLoom} from "@intloom/loom-sdk";import {z} from "zod";
export default defineLoom({id:"consumer-mcp",version:"0.1.0",description:"Greeting",entry:defineCode({id:"hello",inputSchema:z.object({name:z.string()}),outputSchema:z.string(),execute:({inputData})=>"Hello, "+inputData.name+"!"})});`,
);
const built = JSON.parse(
  (
    await exec(process.execPath, [
      ...cliArgs(cli, dataDir),
      "dev",
      "build",
      "--project",
      "mcp-template",
      "--plain",
    ])
  ).stdout,
).data;
const client = new Client(
  { name: "isolated-tarball-consumer", version: "0.3.0" },
  { versionNegotiation: { mode: { pin: "2026-07-28" } } },
);
// A regular CLI command starts the same service used by the HTTP client.
await exec(process.execPath, cliArgs(cli, dataDir, "loom", "list", "--plain"));
const endpoint = JSON.parse(
  await readFile(resolve(dataDir, "service.json"), "utf8"),
);
const transport = new StreamableHTTPClientTransport(new URL(endpoint.mcpUrl), {
  requestInit: { headers: { Authorization: `Bearer ${endpoint.token}` } },
});
const call = async (name, args) => {
  const response = await client.callTool({
    name: `intloom_${name}`,
    arguments: args,
  });
  assert.equal(response.structuredContent.ok, true, JSON.stringify(response));
  return response.structuredContent.data;
};
try {
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 20);
  const installed = JSON.parse(
    (
      await exec(process.execPath, [
        ...cliArgs(cli, dataDir),
        "install",
        built.archiveFile,
        "--plain",
      ])
    ).stdout,
  ).data;
  await mkdir("mcp-parent");
  await writeFile(
    "mcp-parent/package.json",
    JSON.stringify({ name: "hello-parent", version: "1.0.0", type: "module" }),
  );
  await writeFile(
    "mcp-parent/loom.ts",
    `
    import {defineLoom,defineWorkflow,defineStep} from "@intloom/loom-sdk";
    import {hello} from "./.intloom/dependencies.ts"; import {z} from "zod";
    export default defineLoom({id:"hello-parent",version:"1.0.0",description:"Compose the greeting",
      dependencies:{hello:{id:"consumer-mcp",version:"^0.1.0"}},
      entry:defineWorkflow({id:"flow",inputSchema:z.object({name:z.string()}),outputSchema:z.string()})
        .then(defineStep(hello,{id:"child"})).commit()});`,
  );
  const command = async (...args) =>
    JSON.parse(
      (
        await exec(process.execPath, [
          ...cliArgs(cli, dataDir),
          ...args,
          "--plain",
        ])
      ).stdout,
    ).data;
  const parent = await command("dev", "build", "--project", "mcp-parent");
  const lock = JSON.parse(await readFile("mcp-parent/loom.lock.json", "utf8"));
  assert.deepEqual(lock.dependencies.hello, installed);
  assert.equal(lock.declarations.hello.version, "^0.1.0");
  assert.match(
    await readFile("mcp-parent/.intloom/dependencies.ts", "utf8"),
    /LoomRef/,
  );
  const packageView = await command("loom", "describe", parent.archiveFile);
  assert.deepEqual(packageView.root.dependencies.hello, installed);
  await command("loom", "remove", installed.id);
  const frozen = await command("dev", "build", "--project", "mcp-parent");
  assert.deepEqual(frozen.root, parent.root);
  await command("install", parent.archiveFile);
  const composed = await command(
    "run",
    "hello-parent@1.0.0",
    "--input",
    '{"name":"nested"}',
  );
  assert.equal(composed.output, "Hello, nested!");
  const created = await call("run_create", {
    loom: installed,
    input: { name: "P7 consumer" },
  });
  assert.equal(created.status, "created");
  await call("run_start", { runId: created.id });
  let output;
  for (let i = 0; i < 100; i++) {
    output = await call("run_result", { runId: created.id });
    if (output.runStatus === "succeeded") break;
    await delay(10);
  }
  assert.equal(output.output, "Hello, P7 consumer!");
  const summaries = await call("runs_list", {});
  assert.ok(summaries.items.some((run) => run.id === created.id));
  assert.ok(summaries.items.every((run) => !("output" in run)));
  const activity = await call("run_activity", { runId: created.id });
  assert.equal(activity.run.status, "succeeded");
  assert.equal(activity.coverage, "complete");
  assert.equal(activity.validation.status, "passed");
  assert.deepEqual((await command("status", created.id)).activity, activity);
  const events = await call("run_events", {
    runId: created.id,
    after: 0,
    limit: 100,
  });
  assert.ok(events.items.every((event) => event.schemaVersion === 1));
  assert.equal(events.items.at(-1).seq, activity.throughSeq);
  const resources = await client.listResources();
  assert.ok(resources.resources.length >= 2);
  const text = resources.resources.find((r) => r.mimeType === "text/plain");
  assert.equal(
    (await client.readResource({ uri: text.uri })).contents[0].text,
    "draft",
  );
} finally {
  await client.close();
  await shutdown(cli, dataDir);
}
console.log(
  "mcp-consumer: installed CLI init/build and modern MCP discovery/create/start/result/resources verified",
);
