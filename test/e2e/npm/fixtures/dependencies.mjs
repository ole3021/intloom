import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const compiler = createRequire(import.meta.resolve("@intloom/compiler"));
const kernel = createRequire(import.meta.resolve("@intloom/kernel"));
const cli = createRequire(
  join(process.cwd(), "node_modules/@intloom/cli/package.json"),
);

const { transform, version: esbuildVersion } = await import(
  pathToFileURL(compiler.resolve("esbuild")).href
);
const compiled = await transform("const value: number = 3; export { value };", {
  loader: "ts",
  format: "esm",
});
const module = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`
);
assert.equal(module.value, 3);

const tsc = join(
  dirname(compiler.resolve("typescript/package.json")),
  "bin/tsc",
);
const typescriptVersion = execFileSync(tsc, ["--version"], {
  encoding: "utf8",
}).trim();

const { createClient } = await import(
  pathToFileURL(kernel.resolve("@libsql/client")).href
);
const client = createClient({ url: "file:consumer.db" });
try {
  const transaction = await client.transaction("write");
  await transaction.execute("CREATE TABLE proof (value TEXT NOT NULL)");
  await transaction.execute({
    sql: "INSERT INTO proof VALUES (?)",
    args: ["ok"],
  });
  await transaction.commit();
  const result = await client.execute("SELECT value FROM proof");
  assert.equal(result.rows[0].value, "ok");
} finally {
  client.close();
}

const { createWorkflow } = await import(
  pathToFileURL(kernel.resolve("@mastra/core/workflows")).href
);
const { LibSQLStore } = await import(
  pathToFileURL(kernel.resolve("@mastra/libsql")).href
);
const { McpServer } = await import(
  pathToFileURL(cli.resolve("@modelcontextprotocol/server")).href
);
const { toNodeHandler } = await import(
  pathToFileURL(cli.resolve("@modelcontextprotocol/node")).href
);
assert.equal(typeof createWorkflow, "function");
assert.equal(typeof LibSQLStore, "function");
assert.equal(typeof McpServer, "function");
assert.equal(typeof toNodeHandler, "function");

console.log(
  JSON.stringify({
    node: process.versions.node,
    platform: `${process.platform}-${process.arch}`,
    esbuild: esbuildVersion,
    typescript: typescriptVersion,
    sqlite: "ok",
    mastra: "imports_only",
    mcp: "imports_only",
  }),
);
